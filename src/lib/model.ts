// HeatShield Heat Event Risk Index — scored entirely client-side so every
// slider, intervention and optimizer step is instant and inspectable.

export type Period = "AM" | "AF" | "PM";
export type Mode = "rail" | "car" | "rideshare" | "walk";
export type ComponentKey = "heat" | "crowd" | "vuln" | "shade" | "cooling";
export type Tier = "critical" | "high" | "moderate" | "lower";
export type InterventionType = "cooling" | "shade" | "water" | "shuttle";

export interface Cell {
  id: string;
  lat: number;
  lng: number;
  b: [number, number][];
  nbhd: string;
  tract: string;
  hiAM: number;
  hiAF: number;
  hiPM: number;
  heatSrc: "h3at2020" | "h3at2024" | "interpolated" | "median";
  hi20AF: number | null; // H3AT 2020 modeled afternoon heat index, °F (campaign day)
  hi24AF: number | null; // H3AT 2024 modeled afternoon heat index, °F (campaign day)
  lst: number | null;
  imp: number | null;
  canopy: number; // USFS NLCD tree canopy cover, %
  lidarCanopy: number | null; // ForUsTree 2024 LiDAR canopy, % (focus areas only)
  income: number | null;
  svi: number | null;
  healthPct: number;
  vuln: number;
  age65: number | null;
  disabl: number | null;
  uninsur: number | null;
  noveh: number | null;
  pov150: number | null;
  chd: number | null;
  copd: number | null;
  diabetes: number | null;
  kidney: number | null;
  pop: number;
  coolDist: number;
  coolName: string;
  n1: number[];
  n2: number[];
}

export type CrowdLayer = "railWalk" | "railQueue" | "carWalk" | "tailgatePerHour" | "rideWalk" | "walkWalk" | "gateQueue";

export interface PathInfo {
  mode: Mode;
  label: string;
  share: number;
  hexes: number[];
  minutes: number;
  lengthM: number;
}

export interface VenueMeta {
  id: string;
  name: string;
  short: string; // "<name> · <neighborhood>"
  league: string;
  capacity: number;
  lat: number;
  lng: number;
  gates: { name: string; lat: number; lng: number }[];
  alightStations: { name: string; lat: number; lng: number; distM: number; share: number }[];
  counts: { parkingLots: number; parkingSpaces: number; lrtStationsUsed: number };
}

export interface DatasetMeta {
  generatedAt: string;
  h3Res: number;
  hexAreaKm2: number;
  cellCount: number;
  defaultVenue: string;
  venues: VenueMeta[];
  heat: Record<
    Period,
    {
      median2020: number;
      agreement2020vs2024: { r: number; n: number; meanOffsetF: number };
      gapFill: {
        method: "idw" | "median";
        holdoutDistanceM: number;
        cvRmseIdwF: number;
        cvRmseMedianF: number;
        lstRegressionR2: number;
        lstRegressionRmseInSampleF: number;
        n: number;
      };
      coverage: { h3at2020: number; h3at2024: number; interpolated: number };
    }
  >;
  idw: { radiusM: number; priorDistKm: number; minDistKm: number };
  canopySource: { name: string; raster: string; year: number };
  crowdAssumptions: Record<string, unknown>;
  places: { name: string; measures: string[]; brfssYear: string };
  counts: { tracts: number; coolCenters: number; lrtStations: number; residents: number };
}

export interface Dataset {
  meta: DatasetMeta;
  cells: Cell[];
  crowdByVenue: Record<string, Partial<Record<CrowdLayer, Record<string, number>>>>;
  pathsByVenue: Record<string, PathInfo[]>;
}

export const venueById = (ds: Dataset, venueId: string): VenueMeta =>
  ds.meta.venues.find((v) => v.id === venueId) ?? ds.meta.venues.find((v) => v.id === ds.meta.defaultVenue) ?? ds.meta.venues[0];

export interface Scenario {
  venueId: string;
  attendance: number;
  airTempF: number;
  humidity: number;
  period: Period;
  modeSplit: Record<Mode, number>; // percent, sums to 100
  tailgateHours: number;
  tailgateShare: number; // percent of car arrivals who tailgate
}

export type Weights = Record<ComponentKey, number>;

export interface Intervention {
  uid: string;
  type: InterventionType;
  cell: number;
  source: "manual" | "optimizer";
}

// ------------------------------------------------------------------ constants

export const DEFAULT_WEIGHTS: Weights = { heat: 0.4, crowd: 0.25, vuln: 0.2, shade: 0.1, cooling: 0.05 };

export const DEFAULT_SCENARIO: Scenario = {
  venueId: "nrg",
  attendance: 68000,
  airTempF: 98,
  humidity: 50,
  period: "AF",
  modeSplit: { rail: 35, car: 40, rideshare: 15, walk: 10 },
  tailgateHours: 2,
  tailgateShare: 50,
};

export const PERIOD_LABEL: Record<Period, string> = { AM: "Morning", AF: "Afternoon", PM: "Evening" };

export const TIERS: { key: Tier; label: string; min: number; color: string }[] = [
  { key: "critical", label: "Critical", min: 75, color: "#e5383b" },
  { key: "high", label: "High", min: 60, color: "#ff8a2a" },
  { key: "moderate", label: "Moderate", min: 45, color: "#f5c542" },
  { key: "lower", label: "Lower", min: 0, color: "#2fbf71" },
];

export const tierOf = (risk: number): Tier => (TIERS.find((t) => risk >= t.min) ?? TIERS[3]).key;

export const COMPONENT_LABEL: Record<ComponentKey, string> = {
  heat: "Heat exposure",
  crowd: "Event crowd exposure",
  vuln: "Health & social vulnerability",
  shade: "Shade deficit",
  cooling: "Cooling access deficit",
};

// Scale references (documented on /methodology).
export const REF = {
  heatIndexFloorF: 80, // NWS "Caution" threshold → 0
  heatIndexCeilF: 125, // NWS "Extreme Danger" threshold → 100
  crowdPersonHours: 5000, // person-hours in one ~0.1 km² cell that saturates crowd exposure
  canopyFullShadePct: 40, // NLCD canopy share treated as fully shaded
  coolingDeficitMaxM: 1609, // 1 mile to the nearest cooling site → 100
  residentOutdoorHours: 0.25, // residents' assumed outdoor exposure during the event window
};

export interface InterventionSpec {
  type: InterventionType;
  label: string;
  short: string;
  icon: string;
  color: string;
  cost: number;
  feasibility: number; // 1–5
  legacy: number; // 1–5 long-term usefulness
  description: string;
  effect: string;
}

// Cost and effect sizes are planning assumptions, not vendor quotes.
export const INTERVENTIONS: Record<InterventionType, InterventionSpec> = {
  cooling: {
    type: "cooling",
    label: "Cooling hub",
    short: "Cooling",
    icon: "❄",
    color: "#38bdf8",
    cost: 150_000,
    feasibility: 3,
    legacy: 5,
    description: "Air-conditioned tent or mobile cooling bus with EMS triage, staffed for the event window.",
    effect: "New cooling site (recomputes distance-to-cooling everywhere); heat exposure −8 in cell, −4 adjacent; protective factor −8% risk in cell (on-site EMS triage).",
  },
  shade: {
    type: "shade",
    label: "Temporary shade structures",
    short: "Shade",
    icon: "⛱",
    color: "#a78bfa",
    cost: 80_000,
    feasibility: 4,
    legacy: 4,
    description: "Shade sails and canopies over queues, walkways and transit platforms.",
    effect: "+35 canopy-equivalent points in cell, +15 adjacent; heat exposure −8 in cell, −3 adjacent (less direct sun on people waiting or walking).",
  },
  water: {
    type: "water",
    label: "Water & misting stations",
    short: "Water",
    icon: "💧",
    color: "#2dd4bf",
    cost: 35_000,
    feasibility: 5,
    legacy: 2,
    description: "Free water refill points and misting fans along the highest-traffic walking segments.",
    effect: "Protective factor: final risk −8% in cell, −4% adjacent.",
  },
  shuttle: {
    type: "shuttle",
    label: "Shuttle redistribution",
    short: "Shuttle",
    icon: "🚌",
    color: "#fbbf24",
    cost: 100_000,
    feasibility: 3,
    legacy: 3,
    description: "Shaded shuttle loop that moves walkers off the longest exposed segments.",
    effect: "Walking person-hours (not queues or tailgating) −50% in cell, −30% adjacent, −10% two cells out.",
  },
};

// ------------------------------------------------------------------ math helpers

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** NWS Rothfusz heat index regression with the standard adjustments. */
export function heatIndexF(T: number, RH: number): number {
  const simple = 0.5 * (T + 61 + (T - 68) * 1.2 + RH * 0.094);
  if ((simple + T) / 2 < 80) return simple;
  let hi =
    -42.379 +
    2.04901523 * T +
    10.14333127 * RH -
    0.22475541 * T * RH -
    0.00683783 * T * T -
    0.05481717 * RH * RH +
    0.00122874 * T * T * RH +
    0.00085282 * T * RH * RH -
    0.00000199 * T * T * RH * RH;
  if (RH < 13 && T >= 80 && T <= 112) hi -= ((13 - RH) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
  else if (RH > 85 && T >= 80 && T <= 87) hi += ((RH - 85) / 10) * ((87 - T) / 5);
  return hi;
}

export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371008.8;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLng = (lng2 - lng1) * toRad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function normalizeWeights(w: Weights): Weights {
  const sum = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v / sum])) as Weights;
}

// ------------------------------------------------------------------ static (scenario-level) inputs

export interface ScenarioBase {
  baseHeatIndex: number;
  walkHours: Float64Array; // event person-hours spent walking, per cell
  dwellHours: Float64Array; // event person-hours spent waiting, queuing or tailgating, per cell
}

export function scenarioBase(ds: Dataset, s: Scenario): ScenarioBase {
  const n = ds.cells.length;
  const walk = new Float64Array(n);
  const dwell = new Float64Array(n);
  const frac = {
    rail: s.modeSplit.rail / 100,
    car: s.modeSplit.car / 100,
    rideshare: s.modeSplit.rideshare / 100,
    walk: s.modeSplit.walk / 100,
  };
  const scale = s.attendance / 60; // person-minutes per attendee → person-hours
  const crowd = ds.crowdByVenue[s.venueId] ?? {};
  const perPerson = (target: Float64Array, layer: CrowdLayer, weight: number) => {
    const m = crowd[layer];
    if (!m || weight === 0) return;
    for (const k in m) target[+k] += weight * m[k] * scale;
  };
  perPerson(walk, "railWalk", frac.rail);
  perPerson(walk, "carWalk", frac.car);
  perPerson(walk, "rideWalk", frac.rideshare); // includes the short curbside wait
  perPerson(walk, "walkWalk", frac.walk);
  perPerson(dwell, "railQueue", frac.rail);
  perPerson(dwell, "tailgatePerHour", frac.car * (s.tailgateShare / 100) * s.tailgateHours);
  perPerson(dwell, "gateQueue", 1);
  return { baseHeatIndex: heatIndexF(s.airTempF, s.humidity), walkHours: walk, dwellHours: dwell };
}

// ------------------------------------------------------------------ intervention modifiers

export interface Modifiers {
  heatDelta: Float64Array;
  canopyAdd: Float64Array;
  protect: Float64Array; // combined protective share (0–0.3)
  walkMult: Float64Array; // shuttle effect on walking person-hours
  coolSites: { lat: number; lng: number; cell: number }[];
}

export function emptyModifiers(n: number): Modifiers {
  return {
    heatDelta: new Float64Array(n),
    canopyAdd: new Float64Array(n),
    protect: new Float64Array(n),
    walkMult: new Float64Array(n).fill(1),
    coolSites: [],
  };
}

export function cloneModifiers(m: Modifiers): Modifiers {
  return {
    heatDelta: m.heatDelta.slice(),
    canopyAdd: m.canopyAdd.slice(),
    protect: m.protect.slice(),
    walkMult: m.walkMult.slice(),
    coolSites: [...m.coolSites],
  };
}

/** Cells whose score can change when an intervention is placed at `cellIndex`. */
export function touchedBy(ds: Dataset, type: InterventionType, cellIndex: number): number[] {
  const c = ds.cells[cellIndex];
  const touched = new Set<number>([cellIndex, ...c.n1]);
  if (type === "shuttle") c.n2.forEach((i) => touched.add(i));
  if (type === "cooling") coolingReach(ds, cellIndex).forEach((i) => touched.add(i));
  return [...touched];
}

/** Applies one intervention in place. Returns the set of cells whose inputs changed. */
export function applyIntervention(ds: Dataset, mods: Modifiers, type: InterventionType, cellIndex: number): number[] {
  const c = ds.cells[cellIndex];
  const addHeat = (i: number, d: number) => (mods.heatDelta[i] = Math.max(-15, mods.heatDelta[i] + d));
  const addCanopy = (i: number, d: number) => (mods.canopyAdd[i] = Math.min(60, mods.canopyAdd[i] + d));
  const addProtect = (i: number, p: number) => (mods.protect[i] = Math.min(0.3, 1 - (1 - mods.protect[i]) * (1 - p)));
  const mulWalk = (i: number, f: number) => (mods.walkMult[i] = Math.max(0.3, mods.walkMult[i] * f));

  switch (type) {
    case "cooling":
      addHeat(cellIndex, -8);
      c.n1.forEach((i) => addHeat(i, -4));
      addProtect(cellIndex, 0.08);
      mods.coolSites.push({ lat: c.lat, lng: c.lng, cell: cellIndex });
      break;
    case "shade":
      addCanopy(cellIndex, 35);
      c.n1.forEach((i) => addCanopy(i, 15));
      addHeat(cellIndex, -8);
      c.n1.forEach((i) => addHeat(i, -3));
      break;
    case "water":
      addProtect(cellIndex, 0.08);
      c.n1.forEach((i) => addProtect(i, 0.04));
      break;
    case "shuttle":
      mulWalk(cellIndex, 0.5);
      c.n1.forEach((i) => mulWalk(i, 0.7));
      c.n2.forEach((i) => mulWalk(i, 0.9));
      break;
  }
  return touchedBy(ds, type, cellIndex);
}

const reachCache = new WeakMap<Dataset, Map<number, number[]>>();
/** Cells within the cooling-deficit radius of a cell (cached). */
export function coolingReach(ds: Dataset, cellIndex: number): number[] {
  let m = reachCache.get(ds);
  if (!m) reachCache.set(ds, (m = new Map()));
  const hit = m.get(cellIndex);
  if (hit) return hit;
  const c = ds.cells[cellIndex];
  const out: number[] = [];
  ds.cells.forEach((o, i) => {
    if (haversineM(c.lat, c.lng, o.lat, o.lng) < REF.coolingDeficitMaxM) out.push(i);
  });
  m.set(cellIndex, out);
  return out;
}

export function buildModifiers(ds: Dataset, interventions: Intervention[]): Modifiers {
  const mods = emptyModifiers(ds.cells.length);
  for (const iv of interventions) applyIntervention(ds, mods, iv.type, iv.cell);
  return mods;
}

// ------------------------------------------------------------------ scoring

export interface CellScore {
  heat: number;
  crowd: number;
  vuln: number;
  shade: number;
  cooling: number;
  risk: number;
  tier: Tier;
  personHours: number;
  heatIndex: number;
  canopy: number;
  coolDist: number;
}

export function scoreCell(
  ds: Dataset,
  s: Scenario,
  base: ScenarioBase,
  w: Weights,
  mods: Modifiers,
  i: number,
): CellScore {
  const c = ds.cells[i];
  const anomaly = s.period === "AM" ? c.hiAM : s.period === "PM" ? c.hiPM : c.hiAF;
  const heatIndex = base.baseHeatIndex + anomaly;
  const heat = 100 * clamp01((heatIndex - REF.heatIndexFloorF) / (REF.heatIndexCeilF - REF.heatIndexFloorF));
  const heatAdj = Math.max(0, heat + mods.heatDelta[i]);

  const personHours = base.dwellHours[i] + base.walkHours[i] * mods.walkMult[i];
  const crowd = 100 * clamp01(Math.log10(1 + personHours) / Math.log10(1 + REF.crowdPersonHours));

  const canopy = Math.min(100, c.canopy + mods.canopyAdd[i]);
  const shade = 100 * clamp01(1 - canopy / REF.canopyFullShadePct);

  let coolDist = c.coolDist;
  for (const site of mods.coolSites) coolDist = Math.min(coolDist, haversineM(c.lat, c.lng, site.lat, site.lng));
  const cooling = 100 * clamp01(coolDist / REF.coolingDeficitMaxM);

  const raw = w.heat * heatAdj + w.crowd * crowd + w.vuln * c.vuln + w.shade * shade + w.cooling * cooling;
  const risk = raw * (1 - mods.protect[i]);
  return { heat: heatAdj, crowd, vuln: c.vuln, shade, cooling, risk, tier: tierOf(risk), personHours, heatIndex, canopy, coolDist };
}

export interface Summary {
  tierCounts: Record<Tier, number>;
  criticalZones: number;
  highPlusZones: number;
  visitorsThroughCritical: number;
  residentsInCritical: number;
  avgCoolDistMi: number; // crowd-weighted
  exposureBurden: number; // Σ weight × risk/100
  totalPersonHours: number;
}

/** Exposure weight used by the optimizer: event person-hours + residents' assumed outdoor hours. */
export const exposureWeight = (ds: Dataset, score: CellScore, i: number) =>
  score.personHours + ds.cells[i].pop * REF.residentOutdoorHours;

export function summarize(ds: Dataset, s: Scenario, scores: CellScore[]): Summary {
  const tierCounts: Record<Tier, number> = { critical: 0, high: 0, moderate: 0, lower: 0 };
  let residentsInCritical = 0, burden = 0, phTotal = 0, coolWeighted = 0;
  scores.forEach((sc, i) => {
    tierCounts[sc.tier]++;
    if (sc.tier === "critical") residentsInCritical += ds.cells[i].pop;
    burden += exposureWeight(ds, sc, i) * (sc.risk / 100);
    phTotal += sc.personHours;
    coolWeighted += sc.personHours * sc.coolDist;
  });

  // Visitors whose modeled route crosses at least one critical cell.
  const modeFrac: Record<Mode, number> = {
    rail: s.modeSplit.rail / 100,
    car: s.modeSplit.car / 100,
    rideshare: s.modeSplit.rideshare / 100,
    walk: s.modeSplit.walk / 100,
  };
  let visitors = 0;
  for (const p of ds.pathsByVenue[s.venueId] ?? []) {
    if (p.hexes.some((h) => scores[h]?.tier === "critical")) visitors += s.attendance * modeFrac[p.mode] * p.share;
  }

  return {
    tierCounts,
    criticalZones: tierCounts.critical,
    highPlusZones: tierCounts.critical + tierCounts.high,
    visitorsThroughCritical: Math.round(visitors),
    residentsInCritical,
    avgCoolDistMi: phTotal > 0 ? coolWeighted / phTotal / 1609.34 : 0,
    exposureBurden: burden,
    totalPersonHours: phTotal,
  };
}

export interface Evaluation {
  base: ScenarioBase;
  mods: Modifiers;
  scores: CellScore[];
  summary: Summary;
}

export function evaluate(ds: Dataset, s: Scenario, weights: Weights, interventions: Intervention[]): Evaluation {
  const w = normalizeWeights(weights);
  const base = scenarioBase(ds, s);
  const mods = buildModifiers(ds, interventions);
  const scores = ds.cells.map((_, i) => scoreCell(ds, s, base, w, mods, i));
  return { base, mods, scores, summary: summarize(ds, s, scores) };
}

/** Short, stable zone label: super neighborhood + a compact H3 suffix. */
export const zoneLabel = (c: Cell) => `${c.nbhd} · ${c.id.replace(/f+$/, "").slice(-4).toUpperCase()}`;

export function recommendFor(score: CellScore): InterventionType {
  const drivers: [InterventionType, number][] = [
    ["cooling", score.cooling * 0.6 + score.heat * 0.4],
    ["shade", score.shade],
    ["shuttle", score.crowd > 55 ? score.crowd : 0],
    ["water", score.crowd * 0.5 + score.heat * 0.3],
  ];
  return drivers.sort((a, b) => b[1] - a[1])[0][0];
}
