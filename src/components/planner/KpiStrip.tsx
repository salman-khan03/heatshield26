"use client";

import type { Summary } from "@/lib/model";
import { fmtInt } from "@/lib/format";
import { AnimatedNumber } from "./ui";

interface Kpi {
  label: string;
  base: number;
  now: number;
  format: (v: number) => string;
  formatBase?: (v: number) => string;
  color?: string;
  hint: string;
}

export default function KpiStrip({ baseline, current, compare }: { baseline: Summary; current: Summary; compare: boolean }) {
  const kpis: Kpi[] = [
    { label: "Critical zones", base: baseline.criticalZones, now: current.criticalZones, format: fmtInt, color: "#e5383b", hint: "Cells with risk ≥ 75" },
    { label: "High+ zones", base: baseline.highPlusZones, now: current.highPlusZones, format: fmtInt, color: "#ff8a2a", hint: "Cells with risk ≥ 60" },
    { label: "Visitors via critical", base: baseline.visitorsThroughCritical, now: current.visitorsThroughCritical, format: fmtInt, hint: "Attendees whose modeled arrival route crosses a critical cell" },
    { label: "Residents in critical", base: baseline.residentsInCritical, now: current.residentsInCritical, format: fmtInt, hint: "ACS population (via CDC SVI) apportioned to cells" },
    { label: "Avg. to cooling", base: baseline.avgCoolDistMi, now: current.avgCoolDistMi, format: (v) => `${v.toFixed(2)} mi`, formatBase: (v) => v.toFixed(2), hint: "Crowd-weighted distance to nearest cooling site" },
  ];

  return (
    <div className="@container">
    <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line-strong bg-line-strong shadow-2xl @xl:grid-cols-5">
      {kpis.map((k, idx) => {
        const changed = compare && Math.abs(k.now - k.base) > 1e-9;
        const better = k.now < k.base;
        return (
          <div key={k.label} className={`min-w-0 bg-panel/95 px-3 py-2.5 backdrop-blur ${idx >= 3 ? "hidden @xl:block" : ""}`} title={k.hint}>
            <div className="truncate text-[11px] text-muted">{k.label}</div>
            <div className="mt-0.5 flex items-baseline gap-1.5 whitespace-nowrap">
              {changed && <span className="tabular font-mono text-[11px] text-faint line-through">{(k.formatBase ?? k.format)(k.base)}</span>}
              <span className={`font-mono font-semibold ${changed ? "text-[16px]" : "text-[20px]"}`} style={{ color: k.color }}>
                <AnimatedNumber value={k.now} format={k.format} />
              </span>
              {changed && (
                <span className={`text-[10.5px] font-semibold ${better ? "text-lower" : "text-critical"}`}>
                  {better ? "▼" : "▲"}
                  {k.base !== 0 ? Math.abs(((k.now - k.base) / k.base) * 100).toFixed(0) : "—"}%
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
    </div>
  );
}
