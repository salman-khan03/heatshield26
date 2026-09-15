"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, MapLayerMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  type CellScore,
  type Dataset,
  type Intervention,
  type InterventionType,
  type VenueMeta,
  INTERVENTIONS,
  TIERS,
  zoneLabel,
} from "@/lib/model";
import type { MapLayers, MetricKey } from "./types";

const BASEMAP = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// See scripts/copy-maplibre-worker.mjs — the bundled module can't locate its own worker.
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

// Discrete colors that match the legend tiers exactly; opacity rises with risk so hotspots read first.
const RISK_RAMP: maplibregl.ExpressionSpecification = ["step", ["get", "v"], TIERS[3].color, TIERS[2].min, TIERS[2].color, TIERS[1].min, TIERS[1].color, TIERS[0].min, TIERS[0].color];
// Extrusions can't vary opacity per feature, so 3D uses muted tints for lower/moderate cells to keep hotspots dominant.
const RISK_3D: maplibregl.ExpressionSpecification = ["step", ["get", "v"], "#16392a", TIERS[2].min, "#4a3d17", TIERS[1].min, TIERS[1].color, TIERS[0].min, TIERS[0].color];
const RISK_OPACITY: maplibregl.ExpressionSpecification = ["interpolate", ["linear"], ["get", "v"], 35, 0.14, 45, 0.22, 59.9, 0.36, 60, 0.6, 75, 0.8, 90, 0.9];

const SEQ_RAMP = (stops: string[]): maplibregl.ExpressionSpecification => [
  "interpolate",
  ["linear"],
  ["get", "v"],
  0, stops[0],
  35, stops[1],
  65, stops[2],
  100, stops[3],
];

const RAMPS: Record<MetricKey, maplibregl.ExpressionSpecification> = {
  risk: RISK_RAMP,
  heat: SEQ_RAMP(["#1d2b3a", "#f59e0b", "#ea580c", "#b91c1c"]),
  crowd: SEQ_RAMP(["#141a22", "#6d28d9", "#c026d3", "#f472b6"]),
  vuln: SEQ_RAMP(["#15202b", "#0e7490", "#14b8a6", "#99f6e4"]),
  shade: SEQ_RAMP(["#14532d", "#65a30d", "#ca8a04", "#fde047"]),
  cooling: SEQ_RAMP(["#0c4a6e", "#0284c7", "#7dd3fc", "#f0f9ff"]),
};

const MODE_COLOR: Record<string, string> = { rail: "#f87171", car: "#fbbf24", rideshare: "#a78bfa", walk: "#34d399" };

interface Props {
  ds: Dataset;
  venue: VenueMeta;
  layers: MapLayers;
  scores: CellScore[];
  metric: MetricKey;
  is3D: boolean;
  showRoutes: boolean;
  selected: number | null;
  interventions: Intervention[];
  activeTool: InterventionType | null;
  flyTo: { cell: number; nonce: number } | null;
  onCellClick: (i: number) => void;
}

const stadiumMarkerHTML = (name: string) =>
  `<div class="relative h-3 w-3"><span class="pulse-ring absolute inset-0 rounded-full bg-white/70"></span><span class="absolute inset-0 rounded-full bg-white"></span></div><div class="mt-1 whitespace-nowrap rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white">${name.toUpperCase()}</div>`;

export default function MapView(props: Props) {
  const { ds, venue, layers, scores, metric, is3D, showRoutes, selected, interventions, activeTool, flyTo, onCellClick } = props;
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const pending = useRef<((map: maplibregl.Map) => void)[]>([]);
  const markers = useRef(new Map<string, maplibregl.Marker>());
  const venueMarkerRef = useRef<maplibregl.Marker | null>(null);
  const clickRef = useRef(onCellClick);
  const scoresRef = useRef(scores);
  const metricRef = useRef(metric);
  useEffect(() => {
    clickRef.current = onCellClick;
    scoresRef.current = scores;
    metricRef.current = metric;
  });

  const buildCells = (): GeoJSON.FeatureCollection => ({
    type: "FeatureCollection",
    features: ds.cells.map((c, i) => {
      const sc = scoresRef.current[i];
      const v = metricRef.current === "risk" ? sc.risk : sc[metricRef.current];
      return {
        type: "Feature",
        id: i,
        geometry: { type: "Polygon", coordinates: [[...c.b, c.b[0]]] },
        properties: { i, v: Math.round(v * 10) / 10, risk: sc.risk },
      };
    }),
  });

  // init
  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: BASEMAP,
      // Wide panes frame the venue and its surrounding corridor; narrow (phone) panes center on it.
      center: container.current.clientWidth < 640 ? [venue.lng, venue.lat - 0.004] : [venue.lng + 0.012, venue.lat + 0.018],
      zoom: container.current.clientWidth < 640 ? 13 : 12.6,
      minZoom: 10.5,
      maxZoom: 17,
      attributionControl: false,
    });
    mapRef.current = map;
    if (process.env.NODE_ENV !== "production") (window as unknown as { __heatshieldMap?: maplibregl.Map }).__heatshieldMap = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "top-right");

    const hover = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, maxWidth: "260px" });

    map.on("load", () => {
      map.addSource("cells", { type: "geojson", data: buildCells() });
      map.addSource("lots", { type: "geojson", data: layers.lots });
      map.addSource("stadium", { type: "geojson", data: layers.stadium });
      map.addSource("lines", { type: "geojson", data: layers.lines });
      map.addSource("stations", { type: "geojson", data: layers.stations });
      map.addSource("cool", { type: "geojson", data: layers.cool });
      map.addSource("paths", { type: "geojson", data: layers.paths });

      const firstLabel = map.getStyle().layers.find((l) => l.type === "symbol")?.id;

      map.addLayer(
        { id: "cells-fill", type: "fill", source: "cells", paint: { "fill-color": RAMPS.risk, "fill-opacity": RISK_OPACITY, "fill-outline-color": "#0a0d1266" } },
        firstLabel,
      );
      map.addLayer(
        {
          id: "cells-3d",
          type: "fill-extrusion",
          source: "cells",
          layout: { visibility: "none" },
          paint: {
            "fill-extrusion-color": RISK_3D,
            "fill-extrusion-height": ["interpolate", ["exponential", 1.6], ["get", "v"], 0, 0, 40, 40, 70, 380, 100, 1100],
            "fill-extrusion-opacity": 0.85,
          },
        },
        firstLabel,
      );
      map.addLayer({ id: "lots-fill", type: "fill", source: "lots", paint: { "fill-color": "#ffffff", "fill-opacity": 0.03 } });
      map.addLayer({ id: "lots-line", type: "line", source: "lots", paint: { "line-color": "#cbd5e1", "line-opacity": 0.35, "line-width": 1, "line-dasharray": [2, 2] } });
      map.addLayer({ id: "stadium-fill", type: "fill", source: "stadium", paint: { "fill-color": "#ffffff", "fill-opacity": 0.18 } });
      map.addLayer({ id: "stadium-line", type: "line", source: "stadium", paint: { "line-color": "#ffffff", "line-width": 1.5 } });
      map.addLayer({ id: "lines", type: "line", source: "lines", paint: { "line-color": "#e2e8f0", "line-opacity": 0.4, "line-width": 2 } });
      map.addLayer({
        id: "paths",
        type: "line",
        source: "paths",
        layout: { visibility: "none", "line-cap": "round" },
        paint: { "line-color": ["match", ["get", "mode"], "rail", MODE_COLOR.rail, "car", MODE_COLOR.car, "rideshare", MODE_COLOR.rideshare, MODE_COLOR.walk], "line-width": 2, "line-dasharray": [1, 1.5], "line-opacity": 0.9 },
      });
      map.addLayer({ id: "selected", type: "line", source: "cells", filter: ["==", ["get", "i"], -1], paint: { "line-color": "#ffffff", "line-width": 2.5 } });
      map.addLayer({ id: "stations", type: "circle", source: "stations", paint: { "circle-radius": 4, "circle-color": "#0a0d12", "circle-stroke-color": "#f1f5f9", "circle-stroke-width": 2 } });
      map.addLayer({ id: "cool", type: "circle", source: "cool", paint: { "circle-radius": 5, "circle-color": "#38bdf8", "circle-stroke-color": "#0a0d12", "circle-stroke-width": 2 } });

      // Venue marker (position/label updated on venue change — see the effect below)
      const el = document.createElement("div");
      el.className = "pointer-events-none flex flex-col items-center";
      el.innerHTML = stadiumMarkerHTML(venue.name);
      venueMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "top" }).setLngLat([venue.lng, venue.lat]).addTo(map);

      const onMove = (e: MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!f) return;
        const i = f.properties.i as number;
        const c = ds.cells[i];
        const sc = scoresRef.current[i];
        map.getCanvas().style.cursor = "pointer";
        hover
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-size:11px;color:#8b98a7">${zoneLabel(c)}</div><div style="font-size:13px;font-weight:600">Risk ${sc.risk.toFixed(0)} <span style="color:${TIERS.find((t) => t.key === sc.tier)!.color}">● ${sc.tier}</span></div>`,
          )
          .addTo(map);
      };
      map.on("mousemove", "cells-fill", onMove);
      map.on("mousemove", "cells-3d", onMove);
      const onLeave = () => {
        map.getCanvas().style.cursor = "";
        hover.remove();
      };
      map.on("mouseleave", "cells-fill", onLeave);
      map.on("mouseleave", "cells-3d", onLeave);

      const pointPopup = (layer: string, html: (p: Record<string, string>) => string) => {
        map.on("mouseenter", layer, (e) => {
          const p = e.features?.[0]?.properties as Record<string, string>;
          hover.setLngLat(e.lngLat).setHTML(html(p)).addTo(map);
        });
        map.on("mouseleave", layer, () => hover.remove());
      };
      pointPopup("cool", (p) => `<div style="font-size:11px;color:#38bdf8">City of Houston cool center</div><div style="font-size:12px;font-weight:600">${p.name}</div><div style="font-size:11px;color:#8b98a7">${p.address ?? ""}</div>`);
      pointPopup("stations", (p) => `<div style="font-size:11px;color:#8b98a7">METRORail station</div><div style="font-size:12px;font-weight:600">${p.name}</div>`);

      const onClick = (e: MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (f) clickRef.current(f.properties.i as number);
      };
      map.on("click", "cells-fill", onClick);
      map.on("click", "cells-3d", onClick);

      readyRef.current = true;
      pending.current.splice(0).forEach((fn) => fn(map));
    });

    const markerMap = markers.current;
    return () => {
      readyRef.current = false;
      markerMap.clear();
      venueMarkerRef.current = null;
      map.remove();
    };
    // Runs once per dataset. `venue`/`layers` seed the initial view; later changes are handled
    // by the dedicated effects below so switching venues doesn't tear down the whole map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ds]);

  const whenReady = (fn: (map: maplibregl.Map) => void) => {
    const map = mapRef.current;
    if (!map) return;
    if (readyRef.current) fn(map);
    else pending.current.push(fn);
  };

  // data + metric
  useEffect(() => {
    whenReady((map) => {
      (map.getSource("cells") as GeoJSONSource).setData(buildCells());
      map.setPaintProperty("cells-fill", "fill-color", RAMPS[metric]);
      map.setPaintProperty("cells-fill", "fill-opacity", metric === "risk" ? RISK_OPACITY : 0.62);
      map.setPaintProperty("cells-3d", "fill-extrusion-color", metric === "risk" ? RISK_3D : RAMPS[metric]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores, metric]);

  // venue-specific overlay geometry (stadium footprint, lots, paths) — swapped in place on venue change
  useEffect(() => {
    whenReady((map) => {
      (map.getSource("lots") as GeoJSONSource).setData(layers.lots);
      (map.getSource("stadium") as GeoJSONSource).setData(layers.stadium);
      (map.getSource("paths") as GeoJSONSource).setData(layers.paths);
    });
  }, [layers]);

  // venue marker + camera
  useEffect(() => {
    whenReady((map) => {
      venueMarkerRef.current?.setLngLat([venue.lng, venue.lat]);
      const el = venueMarkerRef.current?.getElement();
      if (el) el.innerHTML = stadiumMarkerHTML(venue.name);
      const narrow = (container.current?.clientWidth ?? 1200) < 640;
      map.flyTo({
        center: narrow ? [venue.lng, venue.lat - 0.004] : [venue.lng + 0.012, venue.lat + 0.018],
        zoom: narrow ? 13 : 12.6,
        duration: 1100,
        essential: true,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venue.id]);

  // 2D / 3D
  useEffect(() => {
    whenReady((map) => {
      map.setLayoutProperty("cells-3d", "visibility", is3D ? "visible" : "none");
      map.setLayoutProperty("cells-fill", "visibility", is3D ? "none" : "visible");
      map.easeTo({ pitch: is3D ? 58 : 0, bearing: is3D ? -24 : 0, duration: 900 });
    });
  }, [is3D]);

  useEffect(() => {
    whenReady((map) => map.setLayoutProperty("paths", "visibility", showRoutes ? "visible" : "none"));
  }, [showRoutes]);

  useEffect(() => {
    whenReady((map) => map.setFilter("selected", ["==", ["get", "i"], selected ?? -1]));
  }, [selected]);

  useEffect(() => {
    whenReady((map) => {
      map.getCanvas().style.cursor = activeTool ? "crosshair" : "";
    });
  }, [activeTool]);

  useEffect(() => {
    if (!flyTo) return;
    whenReady((map) => {
      const c = ds.cells[flyTo.cell];
      map.flyTo({ center: [c.lng, c.lat], zoom: Math.max(map.getZoom(), 14), duration: 900, essential: true });
    });
  }, [flyTo, ds]);

  // intervention markers
  useEffect(() => {
    whenReady((map) => {
      const live = new Set(interventions.map((iv) => iv.uid));
      for (const [uid, m] of markers.current) {
        if (!live.has(uid)) {
          m.remove();
          markers.current.delete(uid);
        }
      }
      // offset markers that share a cell so they don't overlap
      const perCell = new Map<number, number>();
      for (const iv of interventions) {
        const k = perCell.get(iv.cell) ?? 0;
        perCell.set(iv.cell, k + 1);
        if (markers.current.has(iv.uid)) continue;
        const spec = INTERVENTIONS[iv.type];
        const el = document.createElement("div");
        el.title = `${spec.label} (${iv.source === "optimizer" ? "optimizer" : "placed"})`;
        el.style.pointerEvents = "none";
        el.innerHTML = `<div class="rise flex h-7 w-7 items-center justify-center rounded-full text-[14px] shadow-lg" style="background:${spec.color};box-shadow:0 0 0 3px #0a0d12, 0 0 18px ${spec.color}88">${spec.icon}</div>`;
        const c = ds.cells[iv.cell];
        const marker = new maplibregl.Marker({ element: el, offset: [k * 16 - 8 * Math.min(k, 1), 0] }).setLngLat([c.lng, c.lat]).addTo(map);
        markers.current.set(iv.uid, marker);
      }
    });
  }, [interventions, ds]);

  return <div ref={container} className="h-full w-full" aria-label={`Interactive heat risk map around ${venue.name}`} />;
}
