import type { Metadata } from "next";
import Link from "next/link";
import ShieldMark from "@/components/ShieldMark";
import { COMPONENT_LABEL, DEFAULT_SCENARIO, DEFAULT_WEIGHTS, INTERVENTIONS, REF, TIERS, type ComponentKey, type Period } from "@/lib/model";
import { fmtInt } from "@/lib/format";
import { loadDataset } from "@/lib/server-data";

export const metadata: Metadata = { title: "Methodology & data — HeatShield 26" };

const SOURCES = [
  {
    name: "H3AT 2024 & 2020 heat mapping campaigns — modeled heat index (morning, afternoon, evening)",
    org: "HARC / Houston Harris Heat Action Team via ForUsTree HTX",
    use: "Local heat-index anomaly for each cell (10 m rasters, 7 samples per cell)",
    href: "https://www.forustreehtx.org/search?groupIds=5737b46445c14cecbdabc6a123bb3e6b",
  },
  {
    name: "NLCD Tree Canopy Cover (v2025.6, latest year)",
    org: "USDA Forest Service",
    use: "Tree canopy % per cell for the shade component (30 m raster, 17 samples per cell)",
    href: "https://data.fs.usda.gov/geodata/rastergateway/treecanopycover/",
  },
  {
    name: "2024 LiDAR tree canopy coverage",
    org: "HARC / ForUsTree HTX",
    use: "Supplementary high-resolution canopy shown as evidence where LiDAR focus areas exist (2 m raster)",
    href: "https://www.forustreehtx.org/search?groupIds=5737b46445c14cecbdabc6a123bb3e6b",
  },
  {
    name: "Urban Heat Vulnerability in Texas — Houston tracts (Landsat LST, NLCD impervious & canopy)",
    org: "ArcGIS Online feature service",
    use: "Surface temperature and impervious cover; tested as a predictor for heat-model gaps",
    href: "https://services1.arcgis.com/0j6vZbECadDEXdAS/ArcGIS/rest/services/Urban_Heat_Vulnerability_Texas_WFL1/FeatureServer",
  },
  {
    name: "CDC/ATSDR Social Vulnerability Index 2022 (Texas, census tracts)",
    org: "CDC / ATSDR",
    use: "Overall SVI percentile; age 65+, disability, uninsured, no-vehicle shares; tract population",
    href: "https://svi.cdc.gov/dataDownloads/data-download.html",
  },
  {
    name: "CDC PLACES: Local Data for Better Health, census tracts (2025 release)",
    org: "CDC",
    use: "Prevalence of coronary heart disease, COPD, diabetes and chronic kidney disease",
    href: "https://data.cdc.gov/500-Cities-Places/PLACES-Local-Data-for-Better-Health-Census-Tract-D/cwsq-ngmh",
  },
  {
    name: "City of Houston Cool Centers",
    org: "City of Houston via HARC",
    use: "Existing cooling sites for the distance-to-cooling component",
    href: "https://services2.arcgis.com/LYMgRMwHfrWWEg3s/arcgis/rest/services/City_of_Houston_Cool_Centers/FeatureServer",
  },
  {
    name: "METRO light rail stations and lines",
    org: "H-GAC Open Data",
    use: "Rail arrival routes, platform waits, map context",
    href: "https://gis.h-gac.com/arcgis/rest/services/Open_Data/Transportation/MapServer",
  },
  {
    name: "NRG Stadium footprint and NRG Park parking lots with capacities",
    org: "© OpenStreetMap contributors",
    use: "Gate locations, car-arrival distribution by lot capacity, tailgating dwell",
    href: "https://www.openstreetmap.org/",
  },
  {
    name: "City of Houston Super Neighborhoods",
    org: "City of Houston via HARC",
    use: "Human-readable zone names",
    href: "https://services2.arcgis.com/LYMgRMwHfrWWEg3s/arcgis/rest/services/City_Of_Houston_Super_Neighborhoods/FeatureServer",
  },
  {
    name: "2020 census tract boundaries (TIGER/Line 2024)",
    org: "U.S. Census Bureau",
    use: "Joining SVI and PLACES to cells",
    href: "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html",
  },
  {
    name: "Houston Stadium capacity (68,777)",
    org: "FIFA World Cup 2026 support center",
    use: "Attendance reference for the default scenario",
    href: "https://gpcustomersupportfwc2026.tickets.fifa.com/hc/en-gb/articles/28784010437021-2-What-are-the-official-addresses-stadium-capacities-and-maps-of-the-FIFA-World-Cup-2026-stadiums",
  },
];

const PERIOD_NAME: Record<Period, string> = { AM: "Morning", AF: "Afternoon", PM: "Evening" };

export default async function Methodology() {
  const ds = await loadDataset();
  const m = ds.meta;
  const crowd = m.crowdAssumptions as {
    walkSpeedMps: number;
    gateQueueMin: number;
    railPlatformWaitMin: number;
    railEgressQueueMin: number;
    rideshareWaitMin: number;
    alightShare: Record<string, number>;
    walkOriginRingM: number;
    walkOriginCount: number;
  };

  const components: { key: ComponentKey; how: string }[] = [
    {
      key: "heat",
      how: `Scenario heat index from forecast air temperature and humidity (NWS Rothfusz regression) plus the cell’s H3AT heat-index anomaly for the chosen event window. Scaled linearly from ${REF.heatIndexFloorF}°F (NWS “Caution”) = 0 to ${REF.heatIndexCeilF}°F (“Extreme Danger”) = 100.`,
    },
    {
      key: "crowd",
      how: `Modeled event person-hours in the cell (see crowd model). Log-scaled: 100 × log₁₀(1 + person-hours) / log₁₀(1 + ${fmtInt(REF.crowdPersonHours)}), capped at 100.`,
    },
    {
      key: "vuln",
      how: "50% CDC SVI 2022 overall percentile (Texas) + 50% health-burden percentile: the mean study-area percentile of coronary heart disease, COPD, diabetes, chronic kidney disease (CDC PLACES), age 65+ and disability (ACS via SVI). Tract values are assigned to cells by centroid.",
    },
    { key: "shade", how: `100 × (1 − canopy ÷ ${REF.canopyFullShadePct}%), floored at 0. Canopy from USFS NLCD Tree Canopy Cover (30 m), which under-counts street trees relative to LiDAR but covers every cell consistently; temporary shade adds canopy-equivalent points.` },
    { key: "cooling", how: `Straight-line distance to the nearest City of Houston cool center (or a placed cooling hub), scaled so ${(REF.coolingDeficitMaxM / 1609.34).toFixed(0)} mile or more = 100.` },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl px-5 pb-24">
      <header className="flex items-center gap-3 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <ShieldMark size={24} />
          <span className="text-[15px] font-semibold">HeatShield 26</span>
        </Link>
        <Link href="/planner" className="ml-auto rounded-lg bg-accent px-3 py-1.5 text-[13px] font-semibold text-black hover:brightness-110">
          Open planner
        </Link>
      </header>

      <h1 className="mt-8 text-[36px] font-semibold tracking-tight">Methodology &amp; data</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        HeatShield 26 scores {fmtInt(m.cellCount)} H3 resolution-{m.h3Res} hexagons ({m.hexAreaKm2} km² each) covering Downtown, Midtown, the Museum District, the Texas Medical Center, NRG Park and South Main. The Heat Event Risk Index is a{" "}
        <b className="text-text">decision-support composite</b>, not a medical prediction. It ranks where the same heat is most likely to harm the most people, so planners can compare options consistently.
      </p>

      <Block title="The index">
        <pre className="overflow-x-auto rounded-xl border border-line bg-panel p-4 font-mono text-[13px] leading-relaxed text-text">
{`Heat Event Risk = ( ${(Object.keys(DEFAULT_WEIGHTS) as ComponentKey[]).map((k) => `${DEFAULT_WEIGHTS[k].toFixed(2)} × ${COMPONENT_LABEL[k]}`).join("\n                  + ")} )
                  × (1 − protective factor from water/misting stations)`}
        </pre>
        <p className="mt-3 text-[14px] text-muted">Every component is normalized to 0–100. Weights are adjustable in the planner and re-normalized to sum to 1. Tiers:</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {TIERS.map((t) => (
            <span key={t.key} className="rounded-full px-3 py-1 text-[12.5px] font-semibold" style={{ color: t.color, background: `${t.color}1f` }}>
              {t.label} {t.key === "lower" ? "< 45" : `≥ ${t.min}`}
            </span>
          ))}
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[13.5px]">
            <thead className="text-[11px] uppercase tracking-wider text-faint">
              <tr>
                <th className="pb-2 pr-4 font-medium">Component</th>
                <th className="pb-2 font-medium">How it is computed</th>
              </tr>
            </thead>
            <tbody>
              {components.map((c) => (
                <tr key={c.key} className="border-t border-line align-top">
                  <td className="py-3 pr-4 font-medium">{COMPONENT_LABEL[c.key]}</td>
                  <td className="py-3 leading-relaxed text-muted">{c.how}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>

      <Block title="Heat surface: measured where possible, and honest where not">
        <p className="text-[14px] leading-relaxed text-muted">
          Heat anomalies come from H3AT’s modeled heat-index rasters, sampled at 7 points per cell. The 2020 layers cover {fmtInt(m.heat.AF.coverage.h3at2020)} of {fmtInt(m.cellCount)} cells. The published 2024 layers cover disadvantaged-community focus areas, and where both exist the two campaigns disagree at neighborhood scale (afternoon r = {m.heat.AF.agreement2020vs2024.r.toFixed(2)} across {fmtInt(m.heat.AF.agreement2020vs2024.n)} shared cells). So HeatShield does <b className="text-text">not</b> blend them. H3AT 2020 is the primary surface, measured as °F above or below its study-area median. 2024 values fill only the cells 2020 misses, after removing the mean 2024−2020 offset.
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          For cells neither campaign covers, inverse-distance interpolation (3 km radius, shrunk toward the median) is tested against a flat median fill with spatial hold-out cross-validation: every measured cell is predicted from measured cells at least {fmtInt(m.heat.AF.gapFill.holdoutDistanceM)} m away, the typical distance from a gap to data. Interpolation is used only where it wins. A Landsat surface-temperature regression was also tested and explains little of the afternoon anomaly.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-wider text-faint">
              <tr>
                <th className="pb-2 pr-3 font-medium">Window</th>
                <th className="pb-2 pr-3 text-right font-medium">2020 cells</th>
                <th className="pb-2 pr-3 text-right font-medium">2024-only</th>
                <th className="pb-2 pr-3 text-right font-medium">Filled</th>
                <th className="pb-2 pr-3 text-right font-medium">2020↔2024 r</th>
                <th className="pb-2 pr-3 text-right font-medium">CV RMSE interp. / median</th>
                <th className="pb-2 pr-3 text-right font-medium">LST reg. R²</th>
                <th className="pb-2 text-right font-medium">Gap fill used</th>
              </tr>
            </thead>
            <tbody className="tabular font-mono">
              {(Object.keys(m.heat) as Period[]).map((p) => {
                const h = m.heat[p];
                return (
                  <tr key={p} className="border-t border-line">
                    <td className="py-2 pr-3 font-sans">{PERIOD_NAME[p]}</td>
                    <td className="py-2 pr-3 text-right">{fmtInt(h.coverage.h3at2020)}</td>
                    <td className="py-2 pr-3 text-right">{fmtInt(h.coverage.h3at2024)}</td>
                    <td className="py-2 pr-3 text-right">{fmtInt(h.coverage.interpolated)}</td>
                    <td className="py-2 pr-3 text-right">{h.agreement2020vs2024.r.toFixed(2)}</td>
                    <td className="py-2 pr-3 text-right">
                      {h.gapFill.cvRmseIdwF.toFixed(2)}°F / {h.gapFill.cvRmseMedianF.toFixed(2)}°F
                    </td>
                    <td className="py-2 pr-3 text-right">{h.gapFill.lstRegressionR2.toFixed(2)}</td>
                    <td className="py-2 text-right font-sans">{h.gapFill.method === "idw" ? "Interpolation" : "Median"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12.5px] text-faint">
          Takeaway: afternoon heat-index differences inside this corridor are modest (most cells fall within about ±1°F of the median), so heat mainly sets how dangerous the whole event day is. Crowd exposure, vulnerability, shade and cooling access decide where the danger concentrates. Each cell’s heat source is labeled in the planner.
        </p>
      </Block>

      <Block title="Crowd model (all assumptions, all visible)">
        <p className="text-[14px] leading-relaxed text-muted">
          No public pedestrian counts exist for FIFA matches, so HeatShield routes an attendance scenario instead of pretending to know. Defaults: {fmtInt(DEFAULT_SCENARIO.attendance)} attendees, arrival split{" "}
          {Object.entries(DEFAULT_SCENARIO.modeSplit)
            .map(([k, v]) => `${v}% ${k}`)
            .join(", ")}
          ; {DEFAULT_SCENARIO.tailgateShare}% of car arrivals tailgate for {DEFAULT_SCENARIO.tailgateHours} h. All are sliders in the planner.
        </p>
        <ul className="mt-4 space-y-2 text-[13.5px] text-muted">
          <li>• <b className="text-text">Rail:</b> riders alight at {Object.entries(crowd.alightShare).map(([k, v]) => `${k} (${Math.round(v * 100)}%)`).join(", ")} and walk to the nearest gate; {crowd.railPlatformWaitMin} min inbound platform wait split across Red Line stations north of the TMC; {crowd.railEgressQueueMin} min post-event queue at the NRG-area station.</li>
          <li>• <b className="text-text">Car:</b> distributed across {m.counts.parkingLots} NRG Park lots ({fmtInt(m.counts.parkingSpaces)} OpenStreetMap-tagged spaces) by capacity; walk to nearest gate; tailgating dwell spread over each lot’s cells.</li>
          <li>• <b className="text-text">Rideshare:</b> two assumed curbside zones at the west (Kirby Dr) and east (Fannin St) edges of NRG Park, {crowd.rideshareWaitMin} min wait, then walk to gate.</li>
          <li>• <b className="text-text">Walk-up:</b> {crowd.walkOriginCount} origins on a {(crowd.walkOriginRingM / 1609.34).toFixed(1)}-mile ring, straight to the nearest gate.</li>
          <li>• <b className="text-text">Everyone:</b> {crowd.gateQueueMin} min security queue in cells touching a 150 m buffer around the stadium. Walking speed {crowd.walkSpeedMps} m/s.</li>
        </ul>
        <p className="mt-3 text-[12.5px] text-faint">Routes are straight lines, not a street network, which is adequate inside NRG Park’s open lots and coarse outside it. “Visitors routed through critical zones” counts attendees whose modeled route touches at least one critical cell.</p>
      </Block>

      <Block title="Interventions (planning assumptions)">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-wider text-faint">
              <tr>
                <th className="pb-2 pr-3 font-medium">Intervention</th>
                <th className="pb-2 pr-3 text-right font-medium">Cost</th>
                <th className="pb-2 pr-3 font-medium">Modeled effect</th>
                <th className="pb-2 pr-3 text-center font-medium">Feasibility</th>
                <th className="pb-2 text-center font-medium">Legacy</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(INTERVENTIONS).map((s) => (
                <tr key={s.type} className="border-t border-line align-top">
                  <td className="py-2.5 pr-3 font-medium">
                    {s.icon} {s.label}
                  </td>
                  <td className="tabular py-2.5 pr-3 text-right font-mono">${fmtInt(s.cost)}</td>
                  <td className="py-2.5 pr-3 leading-relaxed text-muted">{s.effect}</td>
                  <td className="py-2.5 pr-3 text-center font-mono">{s.feasibility}/5</td>
                  <td className="py-2.5 text-center font-mono">{s.legacy}/5</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
          Costs and effect sizes are placeholders for comparison, not vendor quotes or measured outcomes — replace them with City procurement and EMS data before real decisions. The optimizer minimizes <b className="text-text">exposure burden</b> = Σ (event person-hours + residents × {REF.residentOutdoorHours} h assumed outdoor exposure) × risk ÷ 100, adding the intervention with the best burden reduction per dollar until the budget runs out.
        </p>
      </Block>

      <Block title="AI use">
        <p className="text-[14px] leading-relaxed text-muted">
          The only generative-AI feature is “Explain this recommendation”. It sends the numbers already shown in the zone panel to Google Gemini and asks for a 3–4 sentence rationale that uses only those facts. Scores, routing and optimization are deterministic code. Without an API key the planner shows a template explanation instead.
        </p>
      </Block>

      <Block title="Known limitations">
        <ul className="space-y-2 text-[13.5px] leading-relaxed text-muted">
          <li>• H3AT rasters describe a single campaign day each (Aug 10, 2024 for 2024, and the 2020 campaign day); anomalies are applied to a user-chosen forecast, not a weather model.</li>
          <li>• SVI and PLACES describe residents, not visiting fans; visitor vulnerability (age, hydration, alcohol, travel fatigue) is not observed.</li>
          <li>• Tract population is split evenly across the cells whose centers fall in the tract.</li>
          <li>• Cool center hours, event-day closures and indoor stadium conditions are not modeled.</li>
          <li>• Intervention effects are additive heuristics with caps; they have not been validated against health outcomes.</li>
        </ul>
      </Block>

      <Block title="Sources">
        <ol className="space-y-3 text-[13.5px]">
          {SOURCES.map((s, i) => (
            <li key={s.name} className="flex gap-3">
              <span className="tabular w-5 shrink-0 text-right font-mono text-faint">{i + 1}</span>
              <div>
                <a href={s.href} target="_blank" rel="noreferrer" className="font-medium text-text underline decoration-line-strong underline-offset-4 hover:decoration-accent">
                  {s.name}
                </a>
                <div className="text-muted">
                  {s.org} — {s.use}
                </div>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[12px] text-faint">Data pipeline: scripts/build-data.mjs. Dataset built {new Date(m.generatedAt).toLocaleDateString("en-US", { dateStyle: "long" })}.</p>
      </Block>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="mb-4 text-[20px] font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
