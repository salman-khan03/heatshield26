// Greedy budget allocation. Each step re-scores only the cells an intervention
// touches and picks the option with the largest burden reduction per dollar.
// Fast enough to run live in the browser; not a guaranteed global optimum.

import {
  type CellScore,
  type Dataset,
  type Intervention,
  type InterventionType,
  type Modifiers,
  type Scenario,
  type Weights,
  INTERVENTIONS,
  applyIntervention,
  buildModifiers,
  exposureWeight,
  normalizeWeights,
  scenarioBase,
  scoreCell,
  touchedBy,
} from "./model";

export interface PortfolioItem {
  type: InterventionType;
  cell: number;
  cost: number;
  burdenReduction: number;
  cumulativeCost: number;
  cumulativeReduction: number;
}

export interface OptimizeResult {
  items: PortfolioItem[];
  spent: number;
  baselineBurden: number;
  finalBurden: number;
  candidatesEvaluated: number;
}

function snapshot(mods: Modifiers, cells: number[]) {
  return {
    cells,
    heat: cells.map((i) => mods.heatDelta[i]),
    canopy: cells.map((i) => mods.canopyAdd[i]),
    protect: cells.map((i) => mods.protect[i]),
    walk: cells.map((i) => mods.walkMult[i]),
    coolSites: mods.coolSites.length,
  };
}

function restore(mods: Modifiers, snap: ReturnType<typeof snapshot>) {
  snap.cells.forEach((i, k) => {
    mods.heatDelta[i] = snap.heat[k];
    mods.canopyAdd[i] = snap.canopy[k];
    mods.protect[i] = snap.protect[k];
    mods.walkMult[i] = snap.walk[k];
  });
  mods.coolSites.length = snap.coolSites;
}

export interface RankedOption {
  type: InterventionType;
  cell: number;
  gain: number; // burden reduction if added on its own
  impact: number; // 0–100, relative to the best option
  score: number; // composite priority 0–100
}

/**
 * Independent marginal value of each (intervention, cell) option given the current plan,
 * blended with feasibility and legacy value. Returns the best option per cell.
 */
export function rankOptions(ds: Dataset, s: Scenario, weights: Weights, existing: Intervention[], top = 5): RankedOption[] {
  const w = normalizeWeights(weights);
  const base = scenarioBase(ds, s);
  const mods = buildModifiers(ds, existing);
  const scores = ds.cells.map((_, i) => scoreCell(ds, s, base, w, mods, i));
  const burdenOf = (sc: CellScore, i: number) => exposureWeight(ds, sc, i) * (sc.risk / 100);
  const candidates = scores
    .map((sc, i) => ({ i, b: burdenOf(sc, i) }))
    .sort((a, b) => b.b - a.b)
    .slice(0, 80)
    .map((x) => x.i);
  const taken = new Set(existing.map((e) => `${e.type}:${e.cell}`));

  const options: Omit<RankedOption, "impact" | "score">[] = [];
  for (const type of Object.keys(INTERVENTIONS) as InterventionType[]) {
    for (const cell of candidates) {
      if (taken.has(`${type}:${cell}`)) continue;
      const snap = snapshot(mods, touchedBy(ds, type, cell));
      applyIntervention(ds, mods, type, cell);
      let gain = 0;
      for (const i of snap.cells) gain += burdenOf(scores[i], i) - burdenOf(scoreCell(ds, s, base, w, mods, i), i);
      restore(mods, snap);
      if (gain > 0) options.push({ type, cell, gain });
    }
  }
  const maxGain = Math.max(1e-9, ...options.map((o) => o.gain));
  const ranked = options
    .map((o) => {
      const spec = INTERVENTIONS[o.type];
      const impact = (100 * o.gain) / maxGain;
      return { ...o, impact, score: 0.6 * impact + 0.25 * spec.feasibility * 20 + 0.15 * spec.legacy * 20 };
    })
    .sort((a, b) => b.score - a.score);
  const seenCells = new Set<number>();
  const out: RankedOption[] = [];
  for (const r of ranked) {
    if (seenCells.has(r.cell)) continue;
    seenCells.add(r.cell);
    out.push(r);
    if (out.length === top) break;
  }
  return out;
}

export function optimize(
  ds: Dataset,
  s: Scenario,
  weights: Weights,
  existing: Intervention[],
  budget: number,
  { candidatePool = 160, allowed = Object.keys(INTERVENTIONS) as InterventionType[] } = {},
): OptimizeResult {
  const w = normalizeWeights(weights);
  const base = scenarioBase(ds, s);
  const mods = buildModifiers(ds, existing);
  const scores: CellScore[] = ds.cells.map((_, i) => scoreCell(ds, s, base, w, mods, i));
  const burdenOf = (sc: CellScore, i: number) => exposureWeight(ds, sc, i) * (sc.risk / 100);
  let burden = scores.reduce((sum, sc, i) => sum + burdenOf(sc, i), 0);
  const baselineBurden = burden;

  const candidates = scores
    .map((sc, i) => ({ i, b: burdenOf(sc, i) }))
    .filter((x) => x.b > 0)
    .sort((a, b) => b.b - a.b)
    .slice(0, candidatePool)
    .map((x) => x.i);

  const taken = new Set(existing.map((e) => `${e.type}:${e.cell}`));
  const items: PortfolioItem[] = [];
  let remaining = budget;
  let evaluated = 0;

  for (;;) {
    let best: { type: InterventionType; cell: number; gain: number; ratio: number } | null = null;
    for (const type of allowed) {
      const cost = INTERVENTIONS[type].cost;
      if (cost > remaining) continue;
      for (const cell of candidates) {
        if (taken.has(`${type}:${cell}`)) continue;
        const snap = snapshot(mods, touchedBy(ds, type, cell));
        applyIntervention(ds, mods, type, cell);
        let gain = 0;
        for (const i of snap.cells) gain += burdenOf(scores[i], i) - burdenOf(scoreCell(ds, s, base, w, mods, i), i);
        restore(mods, snap);
        evaluated++;
        const ratio = gain / cost;
        if (gain > 1e-6 && (!best || ratio > best.ratio)) best = { type, cell, gain, ratio };
      }
    }
    if (!best) break;

    const touched = applyIntervention(ds, mods, best.type, best.cell);
    for (const i of touched) scores[i] = scoreCell(ds, s, base, w, mods, i);
    const cost = INTERVENTIONS[best.type].cost;
    burden -= best.gain;
    remaining -= cost;
    taken.add(`${best.type}:${best.cell}`);
    items.push({
      type: best.type,
      cell: best.cell,
      cost,
      burdenReduction: best.gain,
      cumulativeCost: budget - remaining,
      cumulativeReduction: baselineBurden - burden,
    });
  }

  return { items, spent: budget - remaining, baselineBurden, finalBurden: burden, candidatesEvaluated: evaluated };
}
