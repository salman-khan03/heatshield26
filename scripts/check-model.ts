// Headless sanity check of the scoring model and optimizer against the built dataset.
//   npx tsx scripts/check-model.ts
import { readFileSync } from "node:fs";
import { DEFAULT_SCENARIO, DEFAULT_WEIGHTS, INTERVENTIONS, type Dataset, evaluate, zoneLabel } from "../src/lib/model";
import { optimize, rankOptions } from "../src/lib/optimizer";

const ds = JSON.parse(readFileSync("public/data/cells.json", "utf8")) as Dataset;
const q = (arr: number[], p: number) => [...arr].sort((a, b) => a - b)[Math.floor(p * (arr.length - 1))];

const t0 = performance.now();
const base = evaluate(ds, DEFAULT_SCENARIO, DEFAULT_WEIGHTS, []);
console.log(`evaluate: ${(performance.now() - t0).toFixed(1)} ms`);

for (const k of ["risk", "heat", "crowd", "vuln", "shade", "cooling", "personHours"] as const) {
  const vals = base.scores.map((s) => s[k]);
  console.log(`${k.padEnd(12)} min ${q(vals, 0).toFixed(1)}  p25 ${q(vals, 0.25).toFixed(1)}  p50 ${q(vals, 0.5).toFixed(1)}  p90 ${q(vals, 0.9).toFixed(1)}  max ${q(vals, 1).toFixed(1)}`);
}
console.log("summary", base.summary);

console.log("\nTop 10 cells:");
base.scores
  .map((s, i) => ({ s, i }))
  .sort((a, b) => b.s.risk - a.s.risk)
  .slice(0, 10)
  .forEach(({ s, i }) => console.log(`  ${zoneLabel(ds.cells[i]).padEnd(40)} risk ${s.risk.toFixed(1)} heat ${s.heat.toFixed(0)} crowd ${s.crowd.toFixed(0)} vuln ${s.vuln.toFixed(0)} shade ${s.shade.toFixed(0)} cool ${s.cooling.toFixed(0)} ph ${s.personHours.toFixed(0)}`));

const t1 = performance.now();
const opt = optimize(ds, DEFAULT_SCENARIO, DEFAULT_WEIGHTS, [], 1_000_000);
console.log(`\noptimize $1M: ${(performance.now() - t1).toFixed(0)} ms, ${opt.items.length} items, spent ${opt.spent}, burden −${((1 - opt.finalBurden / opt.baselineBurden) * 100).toFixed(1)}%`);
opt.items.forEach((it) => console.log(`  ${INTERVENTIONS[it.type].short.padEnd(8)} ${zoneLabel(ds.cells[it.cell]).padEnd(40)} −${it.burdenReduction.toFixed(0)}`));

const planned = evaluate(
  ds,
  DEFAULT_SCENARIO,
  DEFAULT_WEIGHTS,
  opt.items.map((it, k) => ({ uid: `o${k}`, type: it.type, cell: it.cell, source: "optimizer" as const })),
);
console.log("with plan", planned.summary);
const check = Math.abs(planned.summary.exposureBurden - opt.finalBurden) / opt.finalBurden;
console.log(`optimizer burden consistency: ${(check * 100).toFixed(4)}% difference ${check < 1e-6 ? "OK" : "MISMATCH"}`);

const t2 = performance.now();
const pri = rankOptions(ds, DEFAULT_SCENARIO, DEFAULT_WEIGHTS, []);
console.log(`\nrankOptions: ${(performance.now() - t2).toFixed(0)} ms`);
pri.forEach((o) => console.log(`  ${INTERVENTIONS[o.type].short.padEnd(8)} ${zoneLabel(ds.cells[o.cell]).padEnd(40)} score ${o.score.toFixed(0)} impact ${o.impact.toFixed(0)}`));

// scenario sensitivity
for (const s of [
  { ...DEFAULT_SCENARIO, attendance: 20000 },
  { ...DEFAULT_SCENARIO, airTempF: 88 },
  { ...DEFAULT_SCENARIO, period: "PM" as const },
]) {
  const e = evaluate(ds, s, DEFAULT_WEIGHTS, []);
  console.log(`scenario att=${s.attendance} T=${s.airTempF} ${s.period}: critical ${e.summary.criticalZones}, high+ ${e.summary.highPlusZones}, visitors ${e.summary.visitorsThroughCritical}`);
}

// venue coverage — every venue should route a non-trivial share of attendees and evaluate fast
console.log(`\n${ds.meta.venues.length} venues:`);
for (const v of ds.meta.venues) {
  const t3 = performance.now();
  const e = evaluate(ds, { ...DEFAULT_SCENARIO, venueId: v.id, attendance: v.capacity }, DEFAULT_WEIGHTS, []);
  const ms = performance.now() - t3;
  const crowdLayers = Object.keys(ds.crowdByVenue[v.id] ?? {});
  const pathCount = (ds.pathsByVenue[v.id] ?? []).length;
  console.log(
    `  ${v.name.padEnd(22)} cap ${String(v.capacity).padStart(6)}  lots ${String(v.counts.parkingLots).padStart(2)} (${String(v.counts.parkingSpaces).padStart(5)} spaces)  ` +
      `stations ${v.counts.lrtStationsUsed}  layers [${crowdLayers.join(",")}]  paths ${pathCount}  ` +
      `critical ${e.summary.criticalZones}  visitors ${e.summary.visitorsThroughCritical}  totalPH ${Math.round(e.summary.totalPersonHours)}  (${ms.toFixed(1)} ms)`,
  );
  if (pathCount === 0) console.log(`  ! WARNING: ${v.name} has zero routed paths`);
  if (e.summary.totalPersonHours <= 0) console.log(`  ! WARNING: ${v.name} produced zero event person-hours`);
}
