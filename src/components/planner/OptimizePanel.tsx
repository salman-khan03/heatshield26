"use client";

import { useState } from "react";
import { type Dataset, type InterventionType, type Summary, INTERVENTIONS, zoneLabel } from "@/lib/model";
import type { OptimizeResult } from "@/lib/optimizer";
import { fmtInt, fmtMoney } from "@/lib/format";
import { SpendCurve } from "./charts";
import { Button, Section, Slider } from "./ui";

interface Props {
  ds: Dataset;
  result: OptimizeResult | null;
  running: boolean;
  onRun: (budget: number, allowed: InterventionType[]) => void;
  onClear: () => void;
  baseline: Summary;
  current: Summary;
}

/** Benefit relative to the plan's single most effective item. */
const benefitLabel = (rel: number) => (rel >= 0.66 ? "Very high" : rel >= 0.4 ? "High" : rel >= 0.2 ? "Medium / high" : "Medium");

export default function OptimizePanel({ ds, result, running, onRun, onClear, baseline, current }: Props) {
  const [budget, setBudget] = useState(1_000_000);
  const [allowed, setAllowed] = useState<InterventionType[]>(Object.keys(INTERVENTIONS) as InterventionType[]);
  const toggle = (t: InterventionType) => setAllowed((a) => (a.includes(t) ? a.filter((x) => x !== t) : [...a, t]));
  const totalReduction = result ? result.baselineBurden - result.finalBurden : 0;
  const maxItemReduction = result ? Math.max(1e-9, ...result.items.map((it) => it.burdenReduction)) : 1;

  return (
    <div>
      <Section title="Budget optimizer">
        <Slider label="City budget" value={budget} min={100_000} max={3_000_000} step={50_000} format={fmtMoney} onChange={setBudget} />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(Object.values(INTERVENTIONS)).map((spec) => (
            <button
              key={spec.type}
              onClick={() => toggle(spec.type)}
              aria-pressed={allowed.includes(spec.type)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] ${allowed.includes(spec.type) ? "border-line-strong bg-panel-2 text-text" : "border-line text-faint line-through"}`}
            >
              <span>{spec.icon}</span>
              {spec.short} · {fmtMoney(spec.cost)}
            </button>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="primary" className="flex-1 py-2.5 text-[14px]" onClick={() => onRun(budget, allowed)} disabled={running || allowed.length === 0}>
            {running ? "Optimizing…" : `Optimize ${fmtMoney(budget)} plan`}
          </Button>
          {result && <Button onClick={onClear}>Clear</Button>}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-faint">
          Greedy search: each step adds the intervention with the largest reduction in exposure burden per dollar, re-scoring only the cells it changes. Costs and effects are scenario assumptions.
        </p>
      </Section>

      {result && (
        <>
          <Section title="Outcome">
            <div className="grid grid-cols-2 gap-2">
              <Outcome label="Without intervention" value={`${fmtInt(baseline.criticalZones)} critical zones`} sub={`${fmtInt(baseline.visitorsThroughCritical)} visitors routed through them`} />
              <Outcome label="Recommended plan" value={`${fmtInt(current.criticalZones)} critical zones`} sub={`${fmtInt(current.visitorsThroughCritical)} visitors routed through them`} highlight />
            </div>
            <div className="mt-2 rounded-lg border border-line bg-ink px-3 py-2 text-[12.5px]">
              Estimated exposure-burden reduction <span className="font-mono font-semibold text-text">{((totalReduction / result.baselineBurden) * 100).toFixed(1)}%</span> for{" "}
              <span className="font-mono font-semibold text-text">{fmtMoney(result.spent)}</span> ({result.items.length} interventions, {fmtInt(result.candidatesEvaluated)} options evaluated)
            </div>
          </Section>

          <Section title="Recommended portfolio">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead className="text-[10.5px] uppercase tracking-wider text-faint">
                  <tr>
                    <th className="pb-2 font-medium">Intervention</th>
                    <th className="pb-2 font-medium">Location</th>
                    <th className="pb-2 text-right font-medium">Cost</th>
                    <th className="pb-2 text-right font-medium">Benefit</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((it, k) => {
                    const spec = INTERVENTIONS[it.type];
                    return (
                      <tr key={k} className="border-t border-line">
                        <td className="py-1.5 pr-2">
                          <span className="mr-1">{spec.icon}</span>
                          {spec.short}
                        </td>
                        <td className="max-w-[120px] truncate py-1.5 pr-2 text-muted" title={zoneLabel(ds.cells[it.cell])}>
                          {zoneLabel(ds.cells[it.cell])}
                        </td>
                        <td className="tabular py-1.5 text-right font-mono">{fmtMoney(it.cost)}</td>
                        <td className="py-1.5 pl-2 text-right text-text/90">{benefitLabel(it.burdenReduction / maxItemReduction)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Burden reduced vs. spend">
            <SpendCurve
              baselineBurden={result.baselineBurden}
              points={result.items.map((it) => ({ spent: it.cumulativeCost, reduction: it.cumulativeReduction, label: `${INTERVENTIONS[it.type].label} · ${ds.cells[it.cell].nbhd}` }))}
            />
          </Section>
        </>
      )}
    </div>
  );
}

function Outcome({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${highlight ? "border-accent/60 bg-accent-soft" : "border-line bg-ink"}`}>
      <div className="text-[10.5px] uppercase tracking-wider text-muted">{label}</div>
      <div className="text-[15px] font-semibold">{value}</div>
      <div className="text-[11px] text-muted">{sub}</div>
    </div>
  );
}
