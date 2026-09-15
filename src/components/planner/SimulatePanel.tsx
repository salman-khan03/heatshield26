"use client";

import { type Dataset, type Intervention, type InterventionType, type Summary, INTERVENTIONS, zoneLabel } from "@/lib/model";
import { fmtInt, fmtMoney } from "@/lib/format";
import { TierComparison } from "./charts";
import { Button, Section } from "./ui";

interface Props {
  ds: Dataset;
  interventions: Intervention[];
  activeTool: InterventionType | null;
  setActiveTool: (t: InterventionType | null) => void;
  onRemove: (uid: string) => void;
  onClear: () => void;
  baseline: Summary;
  current: Summary;
}

export default function SimulatePanel({ ds, interventions, activeTool, setActiveTool, onRemove, onClear, baseline, current }: Props) {
  const spent = interventions.reduce((s, iv) => s + INTERVENTIONS[iv.type].cost, 0);
  const burdenCut = baseline.exposureBurden > 0 ? (1 - current.exposureBurden / baseline.exposureBurden) * 100 : 0;

  return (
    <div>
      <Section title="Intervention toolkit" aside={activeTool && <span className="text-[11px] text-accent">click the map to place</span>}>
        <div className="grid grid-cols-2 gap-2">
          {(Object.values(INTERVENTIONS)).map((spec) => {
            const on = activeTool === spec.type;
            return (
              <button
                key={spec.type}
                onClick={() => setActiveTool(on ? null : spec.type)}
                className={`rounded-xl border p-2.5 text-left transition ${on ? "border-accent bg-accent-soft" : "border-line bg-panel-2 hover:border-line-strong"}`}
                aria-pressed={on}
                title={spec.effect}
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full text-[12px]" style={{ background: spec.color }}>
                    {spec.icon}
                  </span>
                  <span className="text-[12.5px] font-semibold leading-tight">+ {spec.short}</span>
                </div>
                <div className="mt-1.5 text-[11px] text-muted">{fmtMoney(spec.cost)} each</div>
              </button>
            );
          })}
        </div>
        {activeTool && <p className="mt-2 text-[11px] leading-relaxed text-muted">{INTERVENTIONS[activeTool].effect}</p>}
      </Section>

      <Section title="Before → after">
        <div className="mb-3 grid grid-cols-3 gap-2">
          <Delta label="Critical zones" from={baseline.criticalZones} to={current.criticalZones} />
          <Delta label="Visitors via critical" from={baseline.visitorsThroughCritical} to={current.visitorsThroughCritical} />
          <div className="rounded-lg border border-line bg-ink px-2.5 py-2">
            <div className="text-[10.5px] text-muted">Exposure burden</div>
            <div className="font-mono text-[16px] font-semibold text-text">{burdenCut > 0 ? `−${burdenCut.toFixed(1)}%` : "0%"}</div>
          </div>
        </div>
        <TierComparison baseline={baseline} current={current} />
      </Section>

      <Section
        title={`Placed interventions (${interventions.length})`}
        aside={
          interventions.length > 0 && (
            <Button variant="ghost" className="!px-0 !py-0 text-[11px]" onClick={onClear}>
              Clear all
            </Button>
          )
        }
      >
        {interventions.length === 0 ? (
          <p className="text-[12px] text-muted">Pick a tool above and click a hex cell, or run the optimizer.</p>
        ) : (
          <>
            <ul className="space-y-1">
              {interventions.map((iv) => {
                const spec = INTERVENTIONS[iv.type];
                return (
                  <li key={iv.uid} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-panel-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px]" style={{ background: spec.color }}>
                      {spec.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px]">{spec.label}</span>
                      <span className="block truncate text-[11px] text-muted">{zoneLabel(ds.cells[iv.cell])}</span>
                    </span>
                    <span className="tabular font-mono text-[12px] text-muted">{fmtMoney(spec.cost)}</span>
                    <button onClick={() => onRemove(iv.uid)} className="px-1 text-faint hover:text-critical" aria-label={`Remove ${spec.label}`}>
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 flex justify-between border-t border-line pt-2 text-[12px]">
              <span className="text-muted">Total (cost assumptions)</span>
              <span className="tabular font-mono font-semibold">${fmtInt(spent)}</span>
            </div>
          </>
        )}
      </Section>
    </div>
  );
}

function Delta({ label, from, to }: { label: string; from: number; to: number }) {
  return (
    <div className="rounded-lg border border-line bg-ink px-2.5 py-2">
      <div className="truncate text-[10.5px] text-muted">{label}</div>
      <div className="font-mono text-[16px] font-semibold">
        <span className="text-faint">{fmtInt(from)}</span>
        <span className="mx-1 text-faint">→</span>
        <span className={to < from ? "text-lower" : "text-text"}>{fmtInt(to)}</span>
      </div>
    </div>
  );
}
