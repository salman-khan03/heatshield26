# Devpost submission — copy/paste reference

Everything below is ready to paste into the Devpost submission form. The Houston-wide,
6-venue rebuild is complete and verified (typecheck, lint, production build, and
`check-model.ts` all clean) — remaining checklist items are the live push, fresh
screenshots, and the demo video.

---

## Elevator pitch (≤200 characters)

```
Where should Houston spend $1M to fight mega-event heat? HeatShield maps heat, crowds, vulnerability, shade & cooling at 6 Houston venues, then optimizes the fix.
```
(162 characters)

---

## Try it out links

- **Live app:** https://heatshield26.vercel.app
- **Planner (direct):** https://heatshield26.vercel.app/planner
- **Source code:** https://github.com/salman-khan03/heatshield26

---

## Built With

Paste these into the "Built with" tag field (Devpost autocompletes most of them):

```
nextjs, typescript, react, maplibre-gl, tailwindcss, recharts, h3, turf.js, nodejs,
arcgis, openstreetmap, overpass-api, google-gemini, groq, vercel, geospatial,
data-visualization, gis, css, javascript
```

---

## Project Story

Paste the section below as-is into "Project Story" — it's already in Devpost's Markdown.

<details>
<summary>Click to expand full markdown</summary>

```markdown
## Inspiration

Houston just hosted World Cup matches at NRG Stadium — tens of thousands of fans, in
one of the hottest, most humid big cities in the country. Houston's own H3AT heat
campaign has measured a 14°F difference between neighborhoods on the same afternoon.
The heat data exists. The transit data exists. The health-vulnerability data exists.
But they all live in separate government systems, and nobody had put them together
to answer the question a city actually needs answered before a mega-event: **where,
specifically, is it dangerous, and what should we fund first?**

That's HeatShield 26.

## What it does

HeatShield is a geospatial decision-support planner covering Houston inside Loop
610. Pick any of **6 real Houston venues** — NRG Stadium, Daikin Park, Toyota
Center, Shell Energy Stadium, TDECU Stadium, or Rice Stadium — set an attendance,
temperature, humidity and arrival-mode scenario, and the map lights up with a
transparent **Heat Event Risk Index** for roughly 3,400 hex cells: 40% heat
exposure, 25% event-crowd exposure, 20% health & social vulnerability, 10% shade
deficit, 5% cooling-access deficit.

Click any cell and see exactly why it scored the way it did — down to the Landsat
surface temperature, the CDC health data, and the distance to the nearest City cool
center. Then act: place cooling hubs, shade structures, water stations or shuttle
routes and watch the risk map update instantly, or hand the optimizer a budget and
let it build a ranked, cost-effective portfolio in a fraction of a second.

The only AI in the product is a single "Explain this recommendation" button, which
asks Gemini (with a Groq fallback) to turn the exact numbers already on screen into
a short planning memo. Every score, every route, and every optimizer decision is
plain, deterministic, auditable code.

## How we built it

- **Data pipeline** (Node.js): pulls live ArcGIS REST/ImageServer heat and canopy
  rasters, CDC SVI/PLACES vulnerability data, City of Houston cool centers, METRO
  rail, and OpenStreetMap venue footprints and parking, joins everything onto an
  H3 hexagon grid, and computes a crowd-routing model **generically** for all 6
  venues — gates, nearby parking (by tagged or area-estimated capacity), and the
  nearest real rail stations, with zero venue-specific hardcoding.
- **Scoring engine** (TypeScript): the entire risk index, intervention system, and
  greedy budget optimizer run client-side in the browser — no database, no server
  round-trip, so every slider move is instant.
- **Map & UI**: Next.js 16, MapLibre GL (2D and 3D), Recharts, Tailwind CSS.
- **AI**: Google Gemini for plain-language rationale generation, with an automatic
  Groq fallback and a deterministic template as a final backstop — the product
  never breaks if an AI provider is unavailable.

## Challenges we ran into

- **Two heat surveys that disagree.** Houston ran heat-mapping campaigns in 2020
  and 2024. Where they overlap, their afternoon readings are barely correlated —
  so instead of blending two inconsistent sources, we picked one primary surface
  and only fill gaps with interpolation where cross-validation proves it beats a
  flat guess.
- **A silent coverage gap.** A high-resolution LiDAR canopy layer looked perfect
  until we noticed it reported 0% tree canopy for Hermann Park — it only covers
  certain focus neighborhoods. We switched scoring to a lower-resolution but
  fully-consistent national dataset and kept the LiDAR layer only as supplementary
  evidence.
- **Generalizing one stadium's crowd model to six.** Our first version hardcoded
  NRG Park's named parking lots and fixed rail-alight percentages. Downtown venues
  like Toyota Center mostly have untagged parking garages, not named surface lots.
  We rebuilt the whole routing model to work from raw OpenStreetMap geometry and
  real distances instead — nearest-N-station weighting, area-based capacity
  estimates, and a labeled synthetic fallback for any venue with no nearby OSM
  parking data at all.

## Accomplishments that we're proud of

- A risk model that's fully explainable — every number a planner sees traces back
  to a named, cited, open dataset.
- A budget optimizer that runs in milliseconds and is verified, in code, to match
  a full re-score to within floating-point precision.
- Generalizing from one hardcoded stadium to six real venues without touching the
  scoring math — only the crowd-routing geometry changes per venue.

## What we learned

Public heat and health data is more available than we expected — the hard part
isn't finding it, it's reconciling sources that disagree, and being honest on the
page about exactly where the model is measured versus modeled versus assumed.

## What's next for HeatShield 26

- Real street-network routing instead of straight-line walking paths.
- Live weather-forecast integration instead of a user-chosen scenario temperature.
- Validating the risk index against historical EMS heat-illness call data.
- Extending the venue list and study area beyond Loop 610 as more Houston open
  data becomes available.
```

</details>

---

## Image gallery (3:2 ratio, ≤5 MB each, up to 15)

Use the images in `docs/screenshots/` (captured fresh after the rebuild — see the
checklist). Recommended order:

1. Landing page hero
2. Baseline risk map (2D)
3. 3D risk view
4. Zone detail panel with evidence
5. "Explain this recommendation" open
6. Optimizer result (before → after)
7. Crowd layer with modeled routes
8. Venue picker showing a second venue (e.g. Toyota Center)

If Devpost's 3:2 crop doesn't match the 1440×900 captures, crop to 1440×960 (3:2)
centered on the map/panel — don't stretch.

---

## Video demo link

Upload `docs/social/demo-full.mp4` to YouTube (unlisted is fine — Devpost just
needs a working link) or Vimeo, then paste that URL into "Video demo link." See
`docs/social/POSTS.md` for the shared caption/description text to reuse on the
YouTube listing itself.

---

## Post-rebuild checklist (do these before final submission)

- [x] Confirm `npm run build:data` finished with no errors
- [x] `npx tsx scripts/check-model.ts` — all 6 venues route paths and produce
      person-hours; no `! WARNING` lines
- [x] `npx tsc --noEmit` / `npx eslint` / `npm run build` all pass locally
- [x] Re-check every hardcoded number in this file and in `README.md` against the
      new dataset (critical-zone counts, visitor counts, optimizer $ and % figures)
- [x] Push to `main`, confirm Vercel redeploy succeeds, open the live URL
- [x] Re-run `node scripts/screenshots.mjs` against the live site for fresh,
      accurate screenshots
- [x] Record `docs/social/demo-full.mp4` (landscape, voiceover, real UI)
- [x] Regenerate the Instagram carousel, LinkedIn cover/PDF, stories, and reel
      against the final multi-venue numbers (3 → 0 critical zones, 17,109 → 0
      visitors, −10.2% for $990K)
- [x] Push these updated `docs/screenshots/` and `docs/social/` assets to `main`
- [ ] Upload `docs/social/demo-full.mp4` to YouTube/Vimeo and paste the URL into
      the Video demo link section above
