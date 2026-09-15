# HeatShield 26

**Track 3 — Public Health & the Built Environment · Rice University Urban Sustainability Hackathon**

HeatShield 26 is a geospatial decision-support platform covering Houston inside Loop 610. It finds where event crowds, extreme heat, social and health vulnerability, missing shade and poor cooling access overlap at any of **6 real Houston venues** — NRG Stadium, Daikin Park, Toyota Center, Shell Energy Stadium, TDECU Stadium and Rice Stadium. Then it tells planners where cooling hubs, shade, water stations and shuttle changes do the most good before the next mega-event.

> Where should Houston invest $1M to protect visitors and residents from extreme heat during its next mega-event?

**Live:** https://heatshield26.vercel.app  ·  **Planner:** https://heatshield26.vercel.app/planner

## What it does

1. **Heat risk map.** ~3,400 H3 hexagons (~0.1 km² each) covering Houston inside Loop 610 — Downtown, Midtown, Montrose, Uptown/Galleria, the Medical Center, NRG Park, East End, the Heights and more — scored live in the browser. Views: 2D or 3D, the composite index or any single component.
2. **Pick a venue, then a mega-event mode.** A dropdown switches the crowd model between NRG Stadium, Daikin Park, Toyota Center, Shell Energy Stadium, TDECU Stadium and Rice Stadium — each with its own real gates, nearby parking, and nearest rail stations, computed generically rather than hand-typed per venue. Attendance, forecast temperature, humidity, event window (morning, afternoon or evening), arrival-mode split and tailgating are all sliders.
3. **Heat Event Risk Index.** A transparent 0–100 score per cell with a per-component breakdown and the evidence behind it.
4. **Intervention simulator.** Place cooling hubs, shade, water and misting stations, or shuttles, and compare before and after on critical zones, visitors routed through them, residents affected and distance to cooling.
5. **Budget optimizer and priorities.** Enter a budget and get a greedy cost-effectiveness portfolio, plus a top-5 ranking that blends impact, feasibility and long-term usefulness.
6. **Explain this recommendation.** Google Gemini (with a Groq fallback) turns the facts in the zone panel into a short planning rationale. This is the only AI in the product; everything else is deterministic code.

## The index

```
Heat Event Risk = 0.40 × Heat exposure
                + 0.25 × Event crowd exposure
                + 0.20 × Health & social vulnerability
                + 0.10 × Shade deficit
                + 0.05 × Cooling access deficit
                × (1 − protective factor from water/misting stations)
```

It is a decision-support composite, not a medical prediction. Every component is normalized to 0–100, and the weights can be adjusted in the app. Full formulas, heat-model fit statistics, crowd assumptions and limitations are on `/methodology`.

## Data (all open)

| Component | Source |
|---|---|
| Heat exposure | H3AT modeled heat index, morning/afternoon/evening (HARC / ForUsTree HTX). 2020 is primary; 2024 fills cells 2020 misses. The two campaigns disagree where they overlap (afternoon r = −0.19), so they are not blended. Gaps are filled by interpolation only where it beats a median fill under spatial cross-validation. |
| Surface temperature, impervious cover | Urban Heat Vulnerability in Texas (Houston tracts): evidence and a tested gap-fill predictor |
| Shade | USFS NLCD Tree Canopy Cover (30 m, latest year) for every cell; ForUsTree 2024 LiDAR canopy shown as evidence where it exists |
| Vulnerability | CDC/ATSDR SVI 2022; CDC PLACES 2025 release (CHD, COPD, diabetes, CKD) |
| Cooling access | City of Houston Cool Centers |
| Crowd routing | METRO light rail stations and lines (H-GAC); 6 venue footprints and their nearby parking lots/garages, by OSM capacity tag or area estimate (© OpenStreetMap contributors) |
| Zone names | City of Houston Super Neighborhoods |
| Venue capacities | NRG Stadium via FIFA; Daikin Park, Toyota Center, Shell Energy Stadium, TDECU Stadium and Rice Stadium via each venue's own published figures |

Costs and intervention effect sizes are **scenario assumptions**, labeled as such everywhere they appear.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
```

The processed data ships in `public/data/`. To rebuild it from the live sources, run the command below. It takes about 20–30 minutes, mostly raster sampling, and caches downloads in `data/raw/`:

```bash
npm run build:data     # add -- --refresh to re-download
```

Optional: copy `.env.example` to `.env.local` and set `GEMINI_API_KEY` to enable Gemini explanations (defaults to `gemini-flash-latest`, with fallbacks on overload; override with `GEMINI_MODEL`). Optionally also set `GROQ_API_KEY`: when Gemini is unavailable, explanations come from Groq (`openai/gpt-oss-120b`, override with `GROQ_MODEL`). With neither key, the app serves a template explanation.

## Architecture

```
scripts/build-data.mjs     Node pipeline: ArcGIS REST + ImageServer sampling, CDC CSV/Socrata, Overpass
        │                  → H3 grid joins, heat calibration + gap model, crowd routing
        ▼
public/data/cells.json     per-cell attributes; per-venue crowd layers & modeled routes (6 venues)
public/data/layers.json    per-venue stadium footprint/lots/rideshare zones/routes + city-wide stations, rail lines, cool centers
        │
src/lib/model.ts           scoring, intervention modifiers, summary metrics (pure TS)
src/lib/optimizer.ts       greedy budget allocation + priority ranking
src/components/planner/    MapLibre map, scenario/zone/simulate/optimize/priorities panels
src/app/api/explain        Gemini rationale → Groq fallback → deterministic template
```

No database: the static JSON totals ~1 MB and every computation runs client-side. One evaluation of all cells takes ~3 ms and a $1M optimizer run ~100 ms, so sliders, placed interventions and optimizer runs update instantly.

```bash
npx tsx scripts/check-model.ts      # headless sanity check: distributions, top cells, optimizer consistency
node scripts/screenshots.mjs        # captures docs/screenshots/*.png from a running dev server (local Chrome)
```

MapLibre GL 6 loads its web worker relative to its own module URL, which doesn't survive bundling. `scripts/copy-maplibre-worker.mjs` runs before `dev` and `build` to serve the worker from `public/maplibre/`.

## Screenshots

`docs/screenshots/` has the landing page, the baseline risk map, zone detail, the 3D view, the optimized $1M plan, and the crowd layer with modeled routes.

## 90-second demo

1. **Landing page.** "Neighborhoods can differ by 14°F during the same heat wave, but heat, transit, vulnerability and infrastructure live in separate datasets."
2. **Open the planner.** NRG Stadium, 68,000 attendees, 98°F afternoon. 3 critical cells sit in the South Main and Astrodome Area parking fields at the stadium's edge, where crowd density and heat exposure overlap. High-risk cells spread further out toward the Stadium Park/Astrodome station. Toggle **3D**, or switch the venue dropdown to Daikin Park, Toyota Center, Shell Energy Stadium, TDECU Stadium or Rice Stadium — the same pipeline re-routes crowds and re-scores risk for each.
3. **Click a critical cell.** Show the component breakdown, the evidence, and **Explain this recommendation**.
4. **Simulate tab.** Add a cooling hub and shade. Critical zones and visitors routed through them drop.
5. **Optimize tab.** Click **Optimize $1M plan**. The greedy search picks 18 items — mostly water stations, plus shade, cooling hubs and a shuttle: critical zones 3 → 0, visitors routed through critical zones 17,109 → 0, exposure burden −10.2% for $990K (default NRG scenario and assumptions).
6. **Close.** "FIFA is the case study. HeatShield becomes Houston's planning layer for every stadium event, festival, marathon and heat emergency."
