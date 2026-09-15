import type { ComponentKey } from "@/lib/model";

export type MetricKey = "risk" | ComponentKey;

export interface MapLayers {
  stadium: GeoJSON.Feature;
  lots: GeoJSON.FeatureCollection;
  stations: GeoJSON.FeatureCollection;
  lines: GeoJSON.FeatureCollection;
  cool: GeoJSON.FeatureCollection;
  rideZones: GeoJSON.FeatureCollection;
  paths: GeoJSON.FeatureCollection;
}

export const METRICS: { key: MetricKey; label: string; hint: string }[] = [
  { key: "risk", label: "Risk index", hint: "Weighted composite, 0–100" },
  { key: "heat", label: "Heat", hint: "Scenario heat index + H3AT local anomaly" },
  { key: "crowd", label: "Crowd", hint: "Modeled event person-hours per cell" },
  { key: "vuln", label: "Vulnerability", hint: "CDC SVI + CDC PLACES health burden" },
  { key: "shade", label: "Shade gap", hint: "USFS NLCD tree canopy deficit" },
  { key: "cooling", label: "Cooling gap", hint: "Distance to nearest City cool center" },
];
