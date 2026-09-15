"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TIERS, type Summary } from "@/lib/model";
import { fmtInt, fmtMoney } from "@/lib/format";

export const SERIES = { baseline: "#5c6878", plan: "#e8640f" };
const AXIS = { stroke: "#232c38", tick: { fill: "#8b98a7", fontSize: 11 } };

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-lg border border-line-strong bg-[#0f141b] px-3 py-2 text-[12px] shadow-xl">
      <div className="mb-1 text-muted">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          {r.color && <span className="h-2 w-2 rounded-sm" style={{ background: r.color }} />}
          <span className="text-muted">{r.label}</span>
          <span className="tabular ml-auto pl-3 font-mono font-semibold text-text">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-3 text-[11px] text-muted">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Zone counts per risk tier, baseline vs current plan. */
export function TierComparison({ baseline, current }: { baseline: Summary; current: Summary }) {
  const data = TIERS.map((t) => ({ tier: t.label, baseline: baseline.tierCounts[t.key], plan: current.tierCounts[t.key] }));
  return (
    <div>
      <Legend items={[{ label: "No intervention", color: SERIES.baseline }, { label: "With plan", color: SERIES.plan }]} />
      <div className="mt-2 h-[170px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -18 }} barGap={2} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="#1b232d" />
            <XAxis dataKey="tier" tickLine={false} axisLine={{ stroke: AXIS.stroke }} tick={AXIS.tick} />
            <YAxis tickLine={false} axisLine={false} tick={AXIS.tick} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "#ffffff08" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={`${label} zones`}
                    rows={[
                      { label: "No intervention", value: fmtInt(Number(payload[0].value)), color: SERIES.baseline },
                      { label: "With plan", value: fmtInt(Number(payload[1].value)), color: SERIES.plan },
                    ]}
                  />
                ) : null
              }
            />
            <Bar dataKey="baseline" fill={SERIES.baseline} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive animationDuration={500} />
            <Bar dataKey="plan" fill={SERIES.plan} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive animationDuration={500} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Cumulative burden reduction as the optimizer spends the budget. */
export function SpendCurve({ points, baselineBurden }: { points: { spent: number; reduction: number; label: string }[]; baselineBurden: number }) {
  const data = [{ spent: 0, pct: 0, label: "Start" }, ...points.map((p) => ({ spent: p.spent, pct: (p.reduction / baselineBurden) * 100, label: p.label }))];
  return (
    <div className="h-[160px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
          <CartesianGrid vertical={false} stroke="#1b232d" />
          <XAxis dataKey="spent" type="number" domain={[0, "dataMax"]} tickFormatter={(v) => fmtMoney(v)} tickLine={false} axisLine={{ stroke: AXIS.stroke }} tick={AXIS.tick} />
          <YAxis tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} tick={AXIS.tick} />
          <Tooltip
            cursor={{ stroke: "#8b98a7", strokeWidth: 1 }}
            content={({ active, payload }) => {
              const d = payload?.[0]?.payload as (typeof data)[number] | undefined;
              return active && d ? (
                <TooltipBox title={d.label} rows={[{ label: "Spent", value: fmtMoney(d.spent) }, { label: "Burden reduced", value: `${d.pct.toFixed(1)}%`, color: SERIES.plan }]} />
              ) : null;
            }}
          />
          <Area type="stepAfter" dataKey="pct" stroke={SERIES.plan} strokeWidth={2} fill={SERIES.plan} fillOpacity={0.1} dot={{ r: 4, fill: SERIES.plan, stroke: "#10151c", strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive animationDuration={600} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
