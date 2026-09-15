"use client";

import { type Dataset, type InterventionType, INTERVENTIONS, zoneLabel } from "@/lib/model";
import type { RankedOption } from "@/lib/optimizer";
import { fmtMoney } from "@/lib/format";
import { SERIES } from "./charts";
import { Bar, Button, Section } from "./ui";

interface Props {
  ds: Dataset;
  options: RankedOption[];
  onAdd: (type: InterventionType, cell: number) => void;
  onFocus: (cell: number) => void;
}

export default function PrioritiesPanel({ ds, options, onAdd, onFocus }: Props) {
  return (
    <Section title="Priority investments" aside={<span className="text-[11px] text-faint">given current plan</span>}>
      <p className="mb-3 text-[11.5px] leading-relaxed text-muted">
        Priority = 60% modeled impact + 25% feasibility + 15% long-term usefulness. Impact is each option&apos;s own burden reduction, relative to the best option. Feasibility and legacy ratings are planning judgments.
      </p>
      <ol className="space-y-2">
        {options.map((o, k) => {
          const spec = INTERVENTIONS[o.type];
          return (
            <li key={`${o.type}-${o.cell}`} className="rounded-xl border border-line bg-panel-2 p-3">
              <div className="flex items-start gap-2.5">
                <span className="tabular mt-0.5 font-mono text-[12px] text-faint">{k + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold">
                      {spec.icon} {spec.label}
                    </span>
                    <span className="font-mono text-[15px] font-semibold">{o.score.toFixed(0)}</span>
                  </div>
                  <button onClick={() => onFocus(o.cell)} className="block max-w-full truncate text-left text-[11.5px] text-muted hover:text-text">
                    {zoneLabel(ds.cells[o.cell])} · {fmtMoney(spec.cost)}
                  </button>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[10.5px] text-muted">
                    <Metric label="Impact" value={o.impact} />
                    <Metric label="Feasibility" value={spec.feasibility * 20} />
                    <Metric label="Legacy" value={spec.legacy * 20} />
                  </div>
                </div>
              </div>
              <div className="mt-2 flex justify-end">
                <Button className="!py-1 text-[12px]" onClick={() => onAdd(o.type, o.cell)}>
                  Add to plan
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between">
        <span>{label}</span>
        <span className="tabular font-mono text-text">{value.toFixed(0)}</span>
      </div>
      <Bar value={value} color={SERIES.plan} />
    </div>
  );
}
