import type { ComponentKey } from "@/lib/model";

export type MetricKey = "risk" | ComponentKey;

export interface VenueLayers {
  stadium: GeoJSON.Feature;
  lots: GeoJSON.FeatureCollection;
  rideZones: GeoJSON.FeatureCollection;
  paths: GeoJSON.FeatureCollection;
}

// Shape of public/data/layers.json: venue-specific geometry keyed by venue id,
// plus geometry shared by every venue (rail, cool centers — city-wide either way).
export interface RawLayers {
  stations: GeoJSON.FeatureCollection;
  lines: GeoJSON.FeatureCollection;
  cool: GeoJSON.FeatureCollection;
  venues: Record<string, VenueLayers>;
}

export type MapLayers = VenueLayers & Pick<RawLayers, "stations" | "lines" | "cool">;

export const layersForVenue = (raw: RawLayers, venueId: string): MapLayers => ({
  ...raw.venues[venueId],
  stations: raw.stations,
  lines: raw.lines,
  cool: raw.cool,
});

export const METRICS: { key: MetricKey; label: string; hint: string }[] = [
  { key: "risk", label: "Risk index", hint: "Weighted composite, 0–100" },
  { key: "heat", label: "Heat", hint: "Scenario heat index + H3AT local anomaly" },
  { key: "crowd", label: "Crowd", hint: "Modeled event person-hours per cell" },
  { key: "vuln", label: "Vulnerability", hint: "CDC SVI + CDC PLACES health burden" },
  { key: "shade", label: "Shade gap", hint: "USFS NLCD tree canopy deficit" },
  { key: "cooling", label: "Cooling gap", hint: "Distance to nearest City cool center" },
];
