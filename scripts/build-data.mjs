// HeatShield 26 — data pipeline.
// Pulls open Houston datasets, joins them onto an H3 hex grid around NRG Stadium,
// and writes compact JSON the frontend scores in the browser.
//
//   node scripts/build-data.mjs            (uses cached raw downloads in data/raw)
//   node scripts/build-data.mjs --refresh  (re-download everything)

import fs from "node:fs/promises";
import path from "node:path";
import * as h3 from "h3-js";
import * as turf from "@turf/turf";

const ROOT = path.resolve(import.meta.dirname, "..");
const RAW = path.join(ROOT, "data", "raw");
const OUT = path.join(ROOT, "public", "data");
const REFRESH = process.argv.includes("--refresh");

// Study area: Downtown → Midtown → Museum District → TMC → NRG Park → South Main.
const BBOX = { w: -95.455, s: 29.645, e: -95.335, n: 29.775 };
const H3_RES = 9;
const ENVELOPE = `geometry=${BBOX.w},${BBOX.s},${BBOX.e},${BBOX.n}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outSR=4326`;

const SRC = {
  heatVuln: "https://services1.arcgis.com/0j6vZbECadDEXdAS/ArcGIS/rest/services/Urban_Heat_Vulnerability_Texas_WFL1/FeatureServer",
  h3atRaster: "https://harcags.harcresearch.org/arcgisserver/rest/services/Project_Heat_Watch",
  lidarCanopy: "https://harcags.harcresearch.org/arcgisserver/rest/services/Project_FUT/ForUSTree_LiDAR_2024_High_Veg_Tree_Coverage/ImageServer",
  nlcdTcc: "https://imagery.geoplatform.gov/iipp/rest/services/Vegetation/USFS_EDW_NLCD_TCC_CONUS/ImageServer",
  coolCenters: "https://services2.arcgis.com/LYMgRMwHfrWWEg3s/arcgis/rest/services/City_of_Houston_Cool_Centers/FeatureServer/0",
  superNeighborhoods: "https://services2.arcgis.com/LYMgRMwHfrWWEg3s/arcgis/rest/services/City_Of_Houston_Super_Neighborhoods/FeatureServer/0",
  hgacTransit: "https://gis.h-gac.com/arcgis/rest/services/Open_Data/Transportation/MapServer",
  sviCsv: "https://svi.cdc.gov/Documents/Data/2022/csv/states/Texas.csv",
  places: "https://data.cdc.gov/resource/cwsq-ngmh.json",
  placesMeta: "https://data.cdc.gov/api/views/cwsq-ngmh.json",
  overpass: "https://overpass-api.de/api/interpreter",
};

// ---------------------------------------------------------------- crowd assumptions
// Every number here is a scenario assumption, surfaced verbatim on /methodology.
export const CROWD = {
  walkSpeedMps: 1.2, // dense event crowd walking speed
  gateQueueMin: 20, // security screening queue, all attendees
  railPlatformWaitMin: 8, // waiting on inbound platforms (Red Line, north of TMC)
  railEgressQueueMin: 15, // post-event platform queue at NRG-area stations
  rideshareWaitMin: 10, // curbside wait at drop-off / pick-up zone
  alightShare: { "Stadium Park/Astrodome": 0.7, "Fannin South": 0.2, "Smith Lands": 0.1 },
  walkOriginRingM: 1600, // walk-up visitors start on a 1-mile ring
  walkOriginCount: 12,
};

// ---------------------------------------------------------------- helpers
const log = (...a) => console.log("•", ...a);

async function cached(name, fetcher) {
  const file = path.join(RAW, name);
  if (!REFRESH) {
    try {
      return JSON.parse(await fs.readFile(file, "utf8"));
    } catch {}
  }
  const data = await fetcher();
  await fs.writeFile(file, JSON.stringify(data));
  return data;
}

async function getJSON(url, init) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { ...init, headers: { "User-Agent": "HeatShield26-hackathon/0.1", ...(init?.headers || {}) } });
    const text = await res.text();
    if (res.ok) {
      try {
        const j = JSON.parse(text);
        if (j.error) throw new Error(JSON.stringify(j.error));
        return j;
      } catch (e) {
        if (attempt >= 4) throw new Error(`Bad JSON from ${url.slice(0, 120)}: ${e.message}`);
      }
    } else if (attempt >= 4) {
      throw new Error(`HTTP ${res.status} from ${url.slice(0, 120)}`);
    }
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
}

async function arcgisGeoJSON(layerUrl, { where = "1=1", outFields = "*", envelope = true } = {}) {
  const features = [];
  for (let offset = 0; ; offset += 1000) {
    const q = `${layerUrl}/query?where=${encodeURIComponent(where)}&outFields=${encodeURIComponent(outFields)}&${envelope ? ENVELOPE : "outSR=4326"}&resultOffset=${offset}&resultRecordCount=1000&f=geojson`;
    const j = await getJSON(q);
    features.push(...j.features);
    if (!j.properties?.exceededTransferLimit && j.features.length < 1000) break;
  }
  return { type: "FeatureCollection", features };
}

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift().map((h) => h.replace(/^﻿/, ""));
  return rows.filter((r) => r.length === header.length).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

const num = (v) => {
  const x = Number(v);
  return Number.isFinite(x) && x > -999 ? x : null;
};
const round = (x, d = 1) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);
const median = (arr) => {
  const s = arr.filter((x) => x != null).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};
const mean = (arr) => {
  const s = arr.filter((x) => x != null);
  return s.length ? s.reduce((a, b) => a + b, 0) / s.length : null;
};

// Ordinary least squares with intercept. X: rows of predictors.
function ols(X, y) {
  const k = X[0].length + 1;
  const A = Array.from({ length: k }, () => new Array(k).fill(0));
  const b = new Array(k).fill(0);
  X.forEach((row, i) => {
    const r = [1, ...row];
    for (let p = 0; p < k; p++) {
      b[p] += r[p] * y[i];
      for (let q = 0; q < k; q++) A[p][q] += r[p] * r[q];
    }
  });
  for (let c = 0; c < k; c++) {
    let piv = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    [b[c], b[piv]] = [b[piv], b[c]];
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let q = c; q < k; q++) A[r][q] -= f * A[c][q];
      b[r] -= f * b[c];
    }
  }
  const coef = b.map((v, i) => v / A[i][i]);
  const pred = X.map((row) => coef[0] + row.reduce((s, x, i) => s + coef[i + 1] * x, 0));
  const ym = mean(y);
  const ssRes = y.reduce((s, v, i) => s + (v - pred[i]) ** 2, 0);
  const ssTot = y.reduce((s, v) => s + (v - ym) ** 2, 0);
  return { coef, r2: 1 - ssRes / ssTot, n: y.length, predict: (row) => coef[0] + row.reduce((s, x, i) => s + coef[i + 1] * x, 0) };
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

// Sample an ArcGIS ImageServer at many [lng,lat] points. Returns number|null per point.
async function sampleRaster(serviceUrl, points, label, extra = {}) {
  const BATCH = 600;
  const batches = [];
  for (let i = 0; i < points.length; i += BATCH) batches.push(points.slice(i, i + BATCH));
  let done = 0;
  const results = await pool(batches, 6, async (pts) => {
    const body = new URLSearchParams({
      geometry: JSON.stringify({ points: pts, spatialReference: { wkid: 4326 } }),
      geometryType: "esriGeometryMultipoint",
      returnFirstValueOnly: "true",
      interpolation: "RSP_NearestNeighbor",
      outFields: "",
      f: "json",
      ...extra,
    });
    const j = await getJSON(`${serviceUrl}/getSamples`, { method: "POST", body });
    const vals = new Array(pts.length).fill(null);
    j.samples.forEach((s, idx) => {
      const id = s.locationId ?? idx;
      const v = Number(s.value);
      vals[id] = s.value === "NoData" || s.value === "" || !Number.isFinite(v) ? null : v;
    });
    done++;
    if (done % 20 === 0) log(`  ${label}: ${done}/${batches.length} batches`);
    return vals;
  });
  return results.flat();
}

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371008.8, toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad, dLng = (lng2 - lng1) * toRad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Index polygons by bbox for quick point-in-polygon joins.
function polygonIndex(fc) {
  return fc.features.filter((f) => f.geometry).map((f) => ({ f, bbox: turf.bbox(f) }));
}
function findPolygon(index, lng, lat, { nearest = false } = {}) {
  const pt = turf.point([lng, lat]);
  for (const { f, bbox } of index) {
    if (lng < bbox[0] || lng > bbox[2] || lat < bbox[1] || lat > bbox[3]) continue;
    if (turf.booleanPointInPolygon(pt, f)) return f;
  }
  if (!nearest) return null;
  let best = null, bestD = Infinity;
  for (const { f } of index) {
    const c = turf.centroid(f).geometry.coordinates;
    const d = haversineM(lat, lng, c[1], c[0]);
    if (d < bestD) { bestD = d; best = f; }
  }
  return best;
}

// ---------------------------------------------------------------- main
await fs.mkdir(RAW, { recursive: true });
await fs.mkdir(OUT, { recursive: true });

// 1. Hex grid ------------------------------------------------------------
const ring = [[BBOX.s, BBOX.w], [BBOX.s, BBOX.e], [BBOX.n, BBOX.e], [BBOX.n, BBOX.w], [BBOX.s, BBOX.w]];
const cellIds = h3.polygonToCells(ring, H3_RES).sort();
const idx = new Map(cellIds.map((c, i) => [c, i]));
const cells = cellIds.map((id) => {
  const [lat, lng] = h3.cellToLatLng(id);
  return { id, lat, lng };
});
log(`hex grid: ${cells.length} H3 res-${H3_RES} cells (${h3.getHexagonAreaAvg(H3_RES, "km2").toFixed(3)} km² each)`);

// 2. Vector sources -------------------------------------------------------
const tracts = await cached("tracts_2020.json", () =>
  arcgisGeoJSON(`${SRC.heatVuln}/34`, { where: "COUNTYFP='201'", outFields: "GEOID,NAMELSAD" }),
);
const olsTracts = await cached("heat_vuln_ols.json", () => arcgisGeoJSON(`${SRC.heatVuln}/27`));
const superNbhd = await cached("super_neighborhoods.json", () => arcgisGeoJSON(SRC.superNeighborhoods));
const coolCenters = await cached("cool_centers.json", () => arcgisGeoJSON(SRC.coolCenters));
const lrtStations = await cached("metro_lrt_stations.json", () => arcgisGeoJSON(`${SRC.hgacTransit}/18`));
const lrtLines = await cached("metro_lrt_lines.json", () => arcgisGeoJSON(`${SRC.hgacTransit}/22`));
log(`tracts ${tracts.features.length}, heat-vuln tracts ${olsTracts.features.length}, super nbhds ${superNbhd.features.length}, cool centers ${coolCenters.features.length}, LRT stations ${lrtStations.features.length}`);

const osm = await cached("osm_nrg.json", async () => {
  const q = `[out:json][timeout:60];(way["amenity"="parking"](29.670,-95.425,29.697,-95.396);nwr["leisure"="stadium"](29.675,-95.42,29.695,-95.40);node["amenity"="drinking_water"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e}););out geom tags;`;
  return getJSON(SRC.overpass, { method: "POST", body: new URLSearchParams({ data: q }) });
});

const sviRows = await cached("svi_harris.json", async () => {
  const res = await fetch(SRC.sviCsv);
  return parseCSV(await res.text())
    .filter((r) => r.STCNTY === "48201")
    .map((r) => ({
      fips: r.FIPS, pop: num(r.E_TOTPOP), rpl: num(r.RPL_THEMES), pov150: num(r.EP_POV150), uninsur: num(r.EP_UNINSUR),
      age65: num(r.EP_AGE65), disabl: num(r.EP_DISABL), noveh: num(r.EP_NOVEH), limeng: num(r.EP_LIMENG),
    }));
});
const svi = new Map(sviRows.map((r) => [r.fips, r]));

const PLACES_MEASURES = ["CHD", "COPD", "DIABETES", "KIDNEY"];
const placesRows = await cached("places_harris.json", () =>
  getJSON(`${SRC.places}?$select=locationid,measureid,data_value,year&$where=${encodeURIComponent(`countyfips='48201' AND measureid in('${PLACES_MEASURES.join("','")}')`)}&$limit=50000`),
);
const placesMeta = await cached("places_meta.json", async () => {
  const m = await getJSON(SRC.placesMeta);
  return { name: m.name, rowsUpdatedAt: m.rowsUpdatedAt };
});
const places = new Map();
for (const r of placesRows) {
  if (!places.has(r.locationid)) places.set(r.locationid, {});
  places.get(r.locationid)[r.measureid] = num(r.data_value);
}
log(`SVI Harris tracts ${svi.size}, PLACES tracts ${places.size} (${placesMeta.name}, BRFSS ${placesRows[0]?.year})`);

// 3. Tract-level joins at hex centroids -----------------------------------
const tractIdx = polygonIndex(tracts);
const olsIdx = polygonIndex(olsTracts);
const snIdx = polygonIndex(superNbhd);
const snNameField = "SNBNAME";

const tractHexCount = new Map();
for (const c of cells) {
  const t = findPolygon(tractIdx, c.lng, c.lat, { nearest: true });
  c.tract = t.properties.GEOID;
  tractHexCount.set(c.tract, (tractHexCount.get(c.tract) || 0) + 1);
  const o = findPolygon(olsIdx, c.lng, c.lat, { nearest: true });
  const op = o.properties;
  const lst = num(op.Houston_Tracts_Complete_MEAN_1);
  c.lst = lst != null && lst >= 20 ? lst : null; // a few tracts carry 0-ish LST (no-data artifacts)
  c.imp = num(op.Houston_IMP_Zonal_MEAN);
  c.tccTract = num(op.Houston_Tracts_Complete_MEAN);
  c.income = num(op.Houston_Tracts_Complete_Income);
  const sn = findPolygon(snIdx, c.lng, c.lat);
  c.nbhd = sn ? titleCase(String(sn.properties[snNameField])) : "Outside City SN boundary";
}
function titleCase(s) {
  return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\bTmc\b/, "TMC").replace(/\bUh\b/, "UH");
}

// 4. Raster sampling: H3AT heat index + LiDAR canopy ----------------------
const heatPts = [], heatOwner = [];
cells.forEach((c, i) => {
  for (const ch of h3.cellToChildren(c.id, H3_RES + 1)) {
    const [la, ln] = h3.cellToLatLng(ch);
    heatPts.push([round(ln, 6), round(la, 6)]);
    heatOwner.push(i);
  }
});
const PERIODS = ["AM", "AF", "PM"];
const heatRaw = {};
for (const year of [2024, 2020]) {
  for (const p of PERIODS) {
    const svc = `Heat_Watch_CAPA_Houston_Harris_Heat_Index_Model_${p}_${year}${year === 2024 ? "_DACs" : ""}`;
    heatRaw[`${p}_${year}`] = await cached(`hi_${p}_${year}_res${H3_RES}.json`, async () => {
      log(`sampling H3AT ${year} ${p} heat index (${heatPts.length} pts)`);
      const vals = await sampleRaster(`${SRC.h3atRaster}/${svc}/ImageServer`, heatPts, `${p} ${year}`);
      const per = cells.map(() => []);
      vals.forEach((v, k) => v != null && per[heatOwner[k]].push(v));
      return per.map((arr) => (arr.length >= 3 ? round(mean(arr), 2) : null));
    });
  }
}

// ForUsTree 2024 LiDAR canopy only covers community focus areas (NoData elsewhere), so it is
// kept as supplementary evidence. Scoring uses USFS NLCD Tree Canopy Cover (30 m, full coverage).
const lidar = await cached(`canopy_lidar2024_res${H3_RES}.json`, async () => {
  const pts = [], owner = [];
  cells.forEach((c, i) => {
    for (const ch of h3.cellToChildren(c.id, H3_RES + 2)) {
      const [la, ln] = h3.cellToLatLng(ch);
      pts.push([round(ln, 6), round(la, 6)]);
      owner.push(i);
    }
  });
  log(`sampling LiDAR 2024 tree coverage (${pts.length} pts)`);
  const vals = await sampleRaster(SRC.lidarCanopy, pts, "canopy");
  const hits = cells.map(() => 0), tot = cells.map(() => 0);
  vals.forEach((v, k) => { tot[owner[k]]++; if (v === 1) hits[owner[k]]++; });
  return hits.map((h, i) => round((100 * h) / tot[i], 1));
});

const tccLatest = await cached("nlcd_tcc_latest.json", async () => {
  const j = await getJSON(`${SRC.nlcdTcc}/query?where=1%3D1&outFields=objectid,name&orderByFields=name%20DESC&returnGeometry=false&resultRecordCount=1&f=json`);
  const { objectid, name } = j.features[0].attributes;
  return { objectid, name, year: Number(name.match(/_(\d{4})0101_/)[1]) };
});
const tcc = await cached(`canopy_nlcd_tcc_${tccLatest.year}_res${H3_RES}.json`, async () => {
  const pts = [], owner = [];
  cells.forEach((c, i) => {
    // 17 samples per cell (every third res-11 grandchild) — plenty for a 30 m raster
    h3.cellToChildren(c.id, H3_RES + 2)
      .filter((_, k) => k % 3 === 0)
      .forEach((g) => {
        const [la, ln] = h3.cellToLatLng(g);
        pts.push([round(ln, 6), round(la, 6)]);
        owner.push(i);
      });
  });
  log(`sampling USFS NLCD TCC ${tccLatest.year} (${pts.length} pts)`);
  const vals = await sampleRaster(SRC.nlcdTcc, pts, "tcc", {
    mosaicRule: JSON.stringify({ mosaicMethod: "esriMosaicLockRaster", lockRasterIds: [tccLatest.objectid] }),
  });
  const per = cells.map(() => []);
  vals.forEach((v, k) => v != null && v <= 100 && per[owner[k]].push(v));
  return per.map((arr) => (arr.length ? round(mean(arr), 1) : null));
});
cells.forEach((c, i) => {
  c.canopy = tcc[i] ?? 0;
  c.lidarCanopy = lidar[i] > 0 ? lidar[i] : null;
});
log(`canopy: NLCD TCC ${tccLatest.year} median ${median(tcc)}%, LiDAR-covered cells ${cells.filter((c) => c.lidarCanopy != null).length}`);

// 5. Heat anomaly surface ----------------------------------------------------
// The 2020 and 2024 H3AT surfaces disagree at neighborhood scale where they overlap, so they
// are not blended. H3AT 2020 (widest coverage) is the primary surface; 2024 fills cells 2020
// lacks after removing the mean 2024−2020 offset on overlapping cells. Remaining gaps are
// filled by inverse-distance interpolation shrunk toward the median, kept only if it beats a
// flat median fill under spatial hold-out cross-validation.
const pearson = (a, b) => {
  const ma = mean(a), mb = mean(b);
  let n = 0, da = 0, db = 0;
  a.forEach((x, k) => { n += (x - ma) * (b[k] - mb); da += (x - ma) ** 2; db += (b[k] - mb) ** 2; });
  return n / Math.sqrt(da * db);
};
const rmse = (pairs) => Math.sqrt(mean(pairs.map(([p, o]) => (p - o) ** 2)));
const IDW = { radiusM: 3000, priorDistKm: 1.5, minDistKm: 0.15 };
function idw(i, known, excludeWithinM = 0) {
  const c = cells[i];
  let sw = 1 / IDW.priorDistKm ** 2, swv = 0; // pseudo-observation of 0 (the median) at 1.5 km
  for (const [j, v] of known) {
    if (j === i) continue;
    const d = haversineM(c.lat, c.lng, cells[j].lat, cells[j].lng);
    if (d > IDW.radiusM || d < excludeWithinM) continue;
    const w = 1 / Math.max(IDW.minDistKm, d / 1000) ** 2;
    sw += w;
    swv += w * v;
  }
  return swv / sw;
}

const heatStats = {};
for (const p of PERIODS) {
  const v20 = heatRaw[`${p}_2020`], v24 = heatRaw[`${p}_2024`];
  const overlap = cells.map((_, i) => i).filter((i) => v20[i] != null && v24[i] != null);
  const offset = overlap.length ? mean(overlap.map((i) => v24[i] - v20[i])) : 0;
  const med20 = median(v20);
  const measured = cells.map((_, i) => {
    if (v20[i] != null) return { v: v20[i] - med20, src: "h3at2020" };
    if (v24[i] != null) return { v: v24[i] - offset - med20, src: "h3at2024" };
    return null;
  });
  const known = cells.map((_, i) => i).filter((i) => measured[i]).map((i) => [i, measured[i].v]);
  const gaps = cells.map((_, i) => i).filter((i) => !measured[i]);

  // Hold-out distance = median distance from a gap cell to its nearest measured cell.
  const gapDist = median(gaps.map((g) => Math.min(...known.map(([j]) => haversineM(cells[g].lat, cells[g].lng, cells[j].lat, cells[j].lng)))));
  const excl = Math.max(600, gapDist ?? 600);
  const cvIdw = rmse(known.map(([i, v]) => [idw(i, known, excl), v]));
  const cvZero = rmse(known.map(([, v]) => [0, v]));
  const fitIdx = known.filter(([i]) => cells[i].lst != null && cells[i].imp != null);
  const reg = ols(fitIdx.map(([i]) => [cells[i].lst, cells[i].imp, cells[i].canopy]), fitIdx.map(([, v]) => v));
  const regInSample = rmse(fitIdx.map(([i, v]) => [reg.predict([cells[i].lst, cells[i].imp, cells[i].canopy]), v]));
  const useIdw = cvIdw < cvZero;

  cells.forEach((c, i) => {
    const m = measured[i];
    const anomaly = m ? m.v : useIdw ? idw(i, known) : 0;
    c[`hi${p}`] = round(anomaly, 2);
    if (p === "AF") {
      c.heatSrc = m ? m.src : useIdw ? "interpolated" : "median";
      c.hi20AF = v20[i] != null ? round(v20[i], 1) : null;
      c.hi24AF = v24[i] != null ? round(v24[i], 1) : null;
    }
  });
  heatStats[p] = {
    median2020: round(med20, 2),
    agreement2020vs2024: { r: round(pearson(overlap.map((i) => v20[i]), overlap.map((i) => v24[i])), 2), n: overlap.length, meanOffsetF: round(offset, 2) },
    gapFill: {
      method: useIdw ? "idw" : "median",
      holdoutDistanceM: Math.round(excl),
      cvRmseIdwF: round(cvIdw, 2),
      cvRmseMedianF: round(cvZero, 2),
      lstRegressionR2: round(reg.r2, 3),
      lstRegressionRmseInSampleF: round(regInSample, 2),
      n: known.length,
    },
    coverage: {
      h3at2020: measured.filter((m) => m?.src === "h3at2020").length,
      h3at2024: measured.filter((m) => m?.src === "h3at2024").length,
      interpolated: gaps.length,
    },
  };
  log(`heat ${p}: 2020 ${heatStats[p].coverage.h3at2020}, 2024-only ${heatStats[p].coverage.h3at2024}, gaps ${gaps.length} | 2020↔2024 r=${heatStats[p].agreement2020vs2024.r} | CV RMSE idw ${round(cvIdw, 2)}°F vs median ${round(cvZero, 2)}°F (holdout ${Math.round(excl)} m) | LST reg R² ${round(reg.r2, 3)}`);
}

// 6. Vulnerability ----------------------------------------------------------
const pctRank = (vals) => {
  const sorted = vals.filter((v) => v != null).sort((a, b) => a - b);
  return (v) => (v == null ? null : (100 * sorted.filter((x) => x <= v).length) / sorted.length);
};
cells.forEach((c) => {
  const s = svi.get(c.tract) || {};
  const pl = places.get(c.tract) || {};
  Object.assign(c, {
    svi: s.rpl != null ? round(s.rpl * 100, 1) : null,
    age65: s.age65, disabl: s.disabl, uninsur: s.uninsur, noveh: s.noveh, pov150: s.pov150,
    chd: pl.CHD ?? null, copd: pl.COPD ?? null, diabetes: pl.DIABETES ?? null, kidney: pl.KIDNEY ?? null,
    pop: s.pop != null ? Math.round(s.pop / tractHexCount.get(c.tract)) : 0,
  });
});
const healthKeys = ["chd", "copd", "diabetes", "kidney", "age65", "disabl"];
const rankers = Object.fromEntries(healthKeys.map((k) => [k, pctRank(cells.map((c) => c[k]))]));
const sviFallback = median(cells.map((c) => c.svi));
cells.forEach((c) => {
  const health = mean(healthKeys.map((k) => rankers[k](c[k])));
  c.healthPct = round(health ?? 50, 1);
  c.vuln = round(0.5 * (c.svi ?? sviFallback) + 0.5 * c.healthPct, 1);
});

// 7. Cooling access -----------------------------------------------------------
const coolPts = coolCenters.features.map((f) => ({
  name: f.properties.Facilities?.replace(/\*$/, "").trim(),
  address: f.properties.Street_Loc,
  lng: f.geometry.coordinates[0],
  lat: f.geometry.coordinates[1],
}));
cells.forEach((c) => {
  let best = Infinity, name = null;
  for (const p of coolPts) {
    const d = haversineM(c.lat, c.lng, p.lat, p.lng);
    if (d < best) { best = d; name = p.name; }
  }
  c.coolDist = Math.round(best);
  c.coolName = name;
});

// 8. Crowd model: per-attendee person-minutes by mode -------------------------
const stadiumWay = osm.elements.find((e) => e.tags?.leisure === "stadium" && /NRG Stadium/.test(e.tags.name || ""));
const stadiumPoly = turf.polygon([stadiumWay.geometry.map((g) => [g.lon, g.lat])]);
const [sw, ss, se, sn] = turf.bbox(stadiumPoly);
const stadium = { lat: (ss + sn) / 2, lng: (sw + se) / 2 };
const gates = [
  { name: "North gate", lat: sn, lng: stadium.lng },
  { name: "South gate", lat: ss, lng: stadium.lng },
  { name: "East gate", lat: stadium.lat, lng: se },
  { name: "West gate", lat: stadium.lat, lng: sw },
];
const nearestGate = (lat, lng) => gates.reduce((a, g) => (haversineM(lat, lng, g.lat, g.lng) < haversineM(lat, lng, a.lat, a.lng) ? g : a));

const layers = { crowd: {}, paths: [] };
const addTo = (layer, cellIndex, minutes) => {
  if (cellIndex == null) return;
  layers.crowd[layer] ||= {};
  layers.crowd[layer][cellIndex] = (layers.crowd[layer][cellIndex] || 0) + minutes;
};
const cellAt = (lat, lng) => idx.get(h3.latLngToCell(lat, lng, H3_RES));

// Walk a straight path, crediting minutes to each hex it crosses. Returns hex list.
function walkPath(layer, share, from, to) {
  const lenM = haversineM(from.lat, from.lng, to.lat, to.lng);
  const steps = Math.max(2, Math.ceil(lenM / 10));
  const minPerStep = lenM / steps / CROWD.walkSpeedMps / 60;
  const hexes = new Set();
  for (let s = 0; s < steps; s++) {
    const t = (s + 0.5) / steps;
    const ci = cellAt(from.lat + (to.lat - from.lat) * t, from.lng + (to.lng - from.lng) * t);
    if (ci == null) continue;
    addTo(layer, ci, share * minPerStep);
    hexes.add(ci);
  }
  return { hexes: [...hexes], minutes: lenM / CROWD.walkSpeedMps / 60, lengthM: Math.round(lenM) };
}

// Rail: alight at NRG-area stations, walk to nearest gate; platform waits inbound + egress queue.
const stationFeats = lrtStations.features.filter((f) => f.properties.Status === "Existing");
const stationByName = (n) => stationFeats.find((f) => f.properties.Stat_Name === n);
for (const [name, share] of Object.entries(CROWD.alightShare)) {
  const st = stationByName(name);
  const [lng, lat] = st.geometry.coordinates;
  const g = nearestGate(lat, lng);
  const p = walkPath("railWalk", share, { lat, lng }, g);
  addTo("railQueue", cellAt(lat, lng), share * CROWD.railEgressQueueMin);
  layers.paths.push({ mode: "rail", label: `${name} → ${g.name}`, share, ...p, start: [lng, lat], end: [g.lng, g.lat] });
}
const boarding = stationFeats.filter((f) => ["Red", "Shared"].includes(f.properties.LineColor) && f.geometry.coordinates[1] > 29.705);
for (const f of boarding) {
  const [lng, lat] = f.geometry.coordinates;
  addTo("railQueue", cellAt(lat, lng), CROWD.railPlatformWaitMin / boarding.length);
}

// Car: park at NRG Park lots in proportion to OSM capacity; walk to nearest gate; tailgate in lot.
const lotsSeen = new Set();
const lots = osm.elements
  .filter((e) => e.tags?.amenity === "parking" && e.tags.capacity && /Lot/i.test(e.tags.name || "") && e.geometry?.length > 3)
  .filter((e) => {
    const key = `${e.tags.name}|${e.tags.capacity}`;
    if (lotsSeen.has(key)) return false;
    lotsSeen.add(key);
    return true;
  })
  .map((e) => {
    const coords = e.geometry.map((g) => [g.lon, g.lat]);
    if (coords[0][0] !== coords.at(-1)[0] || coords[0][1] !== coords.at(-1)[1]) coords.push(coords[0]);
    const poly = turf.polygon([coords]);
    const [lng, lat] = turf.centroid(poly).geometry.coordinates;
    return { name: e.tags.name, capacity: Number(e.tags.capacity), poly, lat, lng };
  });
const totalCap = lots.reduce((s, l) => s + l.capacity, 0);
for (const lot of lots) {
  const share = lot.capacity / totalCap;
  const g = nearestGate(lot.lat, lot.lng);
  const p = walkPath("carWalk", share, lot, g);
  layers.paths.push({ mode: "car", label: `${lot.name} → ${g.name}`, share, ...p, start: [lot.lng, lot.lat], end: [g.lng, g.lat] });
  // tailgating: spread one hour of dwell across the lot's hexes by area
  const [bw, bs, be, bn] = turf.bbox(lot.poly);
  const inside = [];
  for (let la = bs; la <= bn; la += 0.00018) for (let ln = bw; ln <= be; ln += 0.0002) if (turf.booleanPointInPolygon(turf.point([ln, la]), lot.poly)) inside.push(cellAt(la, ln));
  const pts = inside.length ? inside : [cellAt(lot.lat, lot.lng)];
  pts.forEach((ci) => addTo("tailgatePerHour", ci, (share * 60) / pts.length));
}

// Rideshare: assumed curbside zones at the west (Kirby Dr) and east (Fannin St) edges of NRG Park.
const lotBounds = turf.bbox(turf.featureCollection(lots.map((l) => l.poly)));
const rideZones = [
  { name: "West curbside zone (Kirby Dr edge, assumed)", lat: stadium.lat, lng: lotBounds[0] },
  { name: "East curbside zone (Fannin St edge, assumed)", lat: stadium.lat - 0.002, lng: lotBounds[2] },
];
for (const z of rideZones) {
  const g = nearestGate(z.lat, z.lng);
  const p = walkPath("rideWalk", 0.5, z, g);
  addTo("rideWalk", cellAt(z.lat, z.lng), 0.5 * CROWD.rideshareWaitMin);
  layers.paths.push({ mode: "rideshare", label: `${z.name} → ${g.name}`, share: 0.5, ...p, start: [z.lng, z.lat], end: [g.lng, g.lat] });
}

// Walk-up: origins on a 1-mile ring, straight to nearest gate.
for (let k = 0; k < CROWD.walkOriginCount; k++) {
  const bearing = (360 * k) / CROWD.walkOriginCount;
  const [lng, lat] = turf.destination([stadium.lng, stadium.lat], CROWD.walkOriginRingM / 1000, bearing).geometry.coordinates;
  const g = nearestGate(lat, lng);
  const share = 1 / CROWD.walkOriginCount;
  const p = walkPath("walkWalk", share, { lat, lng }, g);
  layers.paths.push({ mode: "walk", label: `Walk-up (bearing ${bearing}°) → ${g.name}`, share, ...p, start: [lng, lat], end: [g.lng, g.lat] });
}

// Gate queue: all attendees, spread over hexes touching a 150 m buffer around the stadium.
const buffer = turf.buffer(stadiumPoly, 0.15, { units: "kilometers" });
const gateHexes = new Set();
const [gw, gs, ge, gn] = turf.bbox(buffer);
for (let la = gs; la <= gn; la += 0.0003) for (let ln = gw; ln <= ge; ln += 0.0003) if (turf.booleanPointInPolygon(turf.point([ln, la]), buffer)) gateHexes.add(cellAt(la, ln));
gateHexes.forEach((ci) => addTo("gateQueue", ci, CROWD.gateQueueMin / gateHexes.size));

// round crowd layers
for (const k of Object.keys(layers.crowd)) for (const ci of Object.keys(layers.crowd[k])) layers.crowd[k][ci] = round(layers.crowd[k][ci], 4);
log(`crowd model: ${lots.length} lots (${totalCap} spaces), ${layers.paths.length} paths, gate hexes ${gateHexes.size}`);

// 9. Neighbors + geometry -----------------------------------------------------
cells.forEach((c) => {
  c.n1 = h3.gridDisk(c.id, 1).filter((x) => x !== c.id).map((x) => idx.get(x)).filter((x) => x != null);
  c.n2 = h3.gridRing(c.id, 2).map((x) => idx.get(x)).filter((x) => x != null);
  c.b = h3.cellToBoundary(c.id).map(([la, ln]) => [round(ln, 5), round(la, 5)]);
});

// 10. Write outputs -------------------------------------------------------------
const cellOut = cells.map((c) => ({
  id: c.id, lat: round(c.lat, 5), lng: round(c.lng, 5), b: c.b, nbhd: c.nbhd, tract: c.tract,
  hiAM: c.hiAM, hiAF: c.hiAF, hiPM: c.hiPM, heatSrc: c.heatSrc,
  hi20AF: c.hi20AF, hi24AF: c.hi24AF,
  lst: round(c.lst, 1), imp: round(c.imp, 1), canopy: c.canopy, lidarCanopy: c.lidarCanopy, income: c.income,
  svi: c.svi, healthPct: c.healthPct, vuln: c.vuln,
  age65: c.age65, disabl: c.disabl, uninsur: c.uninsur, noveh: c.noveh, pov150: c.pov150,
  chd: c.chd, copd: c.copd, diabetes: c.diabetes, kidney: c.kidney,
  pop: c.pop, coolDist: c.coolDist, coolName: c.coolName, n1: c.n1, n2: c.n2,
}));

const meta = {
  generatedAt: new Date().toISOString(),
  bbox: BBOX,
  h3Res: H3_RES,
  hexAreaKm2: round(h3.getHexagonAreaAvg(H3_RES, "km2"), 4),
  cellCount: cells.length,
  stadium: { name: "NRG Stadium (FIFA: Houston Stadium)", ...stadium, capacity: 68777 },
  gates,
  heat: heatStats,
  idw: IDW,
  canopySource: { name: "USFS NLCD Tree Canopy Cover", raster: tccLatest.name, year: tccLatest.year },
  crowdAssumptions: CROWD,
  places: { ...placesMeta, measures: PLACES_MEASURES, brfssYear: placesRows[0]?.year },
  sources: SRC,
  counts: {
    tracts: new Set(cells.map((c) => c.tract)).size,
    coolCenters: coolPts.length,
    lrtStations: stationFeats.length,
    parkingLots: lots.length,
    parkingSpaces: totalCap,
    residents: cells.reduce((s, c) => s + c.pop, 0),
  },
};

const geo = {
  stadium: turf.feature(stadiumPoly.geometry, { name: "NRG Stadium" }),
  lots: turf.featureCollection(lots.map((l) => turf.feature(l.poly.geometry, { name: l.name, capacity: l.capacity }))),
  stations: turf.featureCollection(stationFeats.map((f) => turf.point(f.geometry.coordinates, { name: f.properties.Stat_Name, line: f.properties.LineColor }))),
  lines: turf.featureCollection(lrtLines.features.filter((f) => f.geometry).map((f) => turf.feature(f.geometry, { line: f.properties.LineColor || f.properties.Line_Name || f.properties.Corr_Name || "" }))),
  cool: turf.featureCollection(coolPts.map((p) => turf.point([p.lng, p.lat], { name: p.name, address: p.address }))),
  rideZones: turf.featureCollection(rideZones.map((z) => turf.point([z.lng, z.lat], { name: z.name }))),
  paths: turf.featureCollection(layers.paths.map((p) => turf.lineString([p.start, p.end], { mode: p.mode, label: p.label }))),
};

await fs.writeFile(path.join(OUT, "cells.json"), JSON.stringify({ meta, cells: cellOut, crowd: layers.crowd, paths: layers.paths.map((p) => ({ mode: p.mode, label: p.label, share: p.share, hexes: p.hexes, minutes: p.minutes, lengthM: p.lengthM })) }));
await fs.writeFile(path.join(OUT, "layers.json"), JSON.stringify(geo));
const size = (await fs.stat(path.join(OUT, "cells.json"))).size;
log(`wrote public/data/cells.json (${(size / 1024).toFixed(0)} KB) and layers.json`);
log(`residents in study area ≈ ${meta.counts.residents.toLocaleString()}`);
