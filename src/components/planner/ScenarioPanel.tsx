"use client";

import {
  type ComponentKey,
  type Mode,
  type Period,
  type Scenario,
  type Weights,
  COMPONENT_LABEL,
  DEFAULT_SCENARIO,
  DEFAULT_WEIGHTS,
  heatIndexF,
  normalizeWeights,
} from "@/lib/model";
import { fmtInt } from "@/lib/format";
import { METRICS, type MetricKey } from "./types";
import { Section, Segmented, Slider } from "./ui";

const MODES: { key: Mode; label: string; color: string }[] = [
  { key: "rail", label: "METRORail", color: "#f87171" },
  { key: "car", label: "Car / parking", color: "#fbbf24" },
  { key: "rideshare", label: "Rideshare", color: "#a78bfa" },
  { key: "walk", label: "Walk-up", color: "#34d399" },
];

function nwsCategory(hi: number) {
  if (hi >= 125) return { label: "Extreme danger", color: "#9d0b3a" };
  if (hi >= 103) return { label: "Danger", color: "#e5383b" };
  if (hi >= 90) return { label: "Extreme caution", color: "#ff8a2a" };
  if (hi >= 80) return { label: "Caution", color: "#f5c542" };
  return { label: "Below caution", color: "#2fbf71" };
}

/** Change one mode's share and rebalance the rest proportionally so the split stays at 100%. */
function rebalance(split: Record<Mode, number>, key: Mode, value: number): Record<Mode, number> {
  const others = MODES.map((m) => m.key).filter((k) => k !== key);
  const rest = others.reduce((s, k) => s + split[k], 0);
  const target = 100 - value;
  const next = { ...split, [key]: value };
  let assigned = 0;
  others.forEach((k, idx) => {
    if (idx === others.length - 1) next[k] = Math.max(0, target - assigned);
    else {
      const v = rest > 0 ? Math.round((split[k] / rest) * target) : Math.round(target / others.length);
      next[k] = v;
      assigned += v;
    }
  });
  return next;
}

interface Props {
  scenario: Scenario;
  setScenario: (s: Scenario) => void;
  weights: Weights;
  setWeights: (w: Weights) => void;
  metric: MetricKey;
  setMetric: (m: MetricKey) => void;
  is3D: boolean;
  setIs3D: (v: boolean) => void;
  showRoutes: boolean;
  setShowRoutes: (v: boolean) => void;
  capacity: number;
}

export default function ScenarioPanel(p: Props) {
  const { scenario: s, setScenario } = p;
  const set = <K extends keyof Scenario>(k: K, v: Scenario[K]) => setScenario({ ...s, [k]: v });
  const hi = heatIndexF(s.airTempF, s.humidity);
  const cat = nwsCategory(hi);
  const nw = normalizeWeights(p.weights);

  return (
    <div>
      <Section title="Event scenario">
        <div className="mb-4 rounded-lg border border-line bg-ink px-3 py-2.5">
          <div className="text-[11px] uppercase tracking-wider text-faint">Venue</div>
          <div className="text-[14px] font-semibold">Houston Stadium · NRG Park</div>
          <div className="text-[11px] text-muted">FIFA-listed capacity {fmtInt(p.capacity)}</div>
        </div>
        <div className="space-y-4">
          <Slider label="Attendance" value={s.attendance} min={5000} max={75000} step={1000} format={fmtInt} onChange={(v) => set("attendance", v)} />
          <div>
            <div className="mb-1.5 text-[13px] text-text/90">Event window</div>
            <Segmented<Period>
              value={s.period}
              onChange={(v) => set("period", v)}
              options={[
                { value: "AM", label: "Morning" },
                { value: "AF", label: "Afternoon" },
                { value: "PM", label: "Evening" },
              ]}
            />
            <div className="mt-1 text-[11px] text-faint">Selects the H3AT morning / afternoon / evening heat anomaly surface.</div>
          </div>
          <Slider label="Forecast air temperature" value={s.airTempF} min={80} max={108} format={(v) => `${v}°F`} onChange={(v) => set("airTempF", v)} />
          <Slider label="Relative humidity" value={s.humidity} min={20} max={90} format={(v) => `${v}%`} onChange={(v) => set("humidity", v)} />
          <div className="flex items-center justify-between rounded-lg border border-line bg-ink px-3 py-2">
            <div>
              <div className="text-[11px] text-muted">Base heat index (NWS)</div>
              <div className="tabular font-mono text-[18px] font-semibold">{hi.toFixed(0)}°F</div>
            </div>
            <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: cat.color, background: `${cat.color}1f` }}>
              {cat.label}
            </span>
          </div>
        </div>
      </Section>

      <Section title="Arrival mode split" aside={<button className="text-[11px] text-muted hover:text-text" onClick={() => setScenario({ ...s, modeSplit: DEFAULT_SCENARIO.modeSplit })}>Reset</button>}>
        <div className="mb-3 flex h-2 overflow-hidden rounded-full">
          {MODES.map((m) => (
            <div key={m.key} style={{ width: `${s.modeSplit[m.key]}%`, background: m.color }} className="transition-[width] duration-300" />
          ))}
        </div>
        <div className="space-y-3">
          {MODES.map((m) => (
            <Slider
              key={m.key}
              label={m.label}
              value={s.modeSplit[m.key]}
              min={0}
              max={90}
              format={(v) => `${v}%`}
              onChange={(v) => set("modeSplit", rebalance(s.modeSplit, m.key, v))}
            />
          ))}
          <Slider label="Pre-event tailgating" value={s.tailgateHours} min={0} max={5} step={0.5} format={(v) => `${v} h`} onChange={(v) => set("tailgateHours", v)} />
          <Slider label="Car arrivals who tailgate" value={s.tailgateShare} min={0} max={100} step={5} format={(v) => `${v}%`} onChange={(v) => set("tailgateShare", v)} />
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-faint">
          Visible assumptions, not FIFA pedestrian counts. Parking demand is distributed across NRG Park lots by their OpenStreetMap capacity.
        </p>
      </Section>

      <Section title="Map layer">
        <div className="grid grid-cols-3 gap-1.5">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => p.setMetric(m.key)}
              title={m.hint}
              className={`rounded-md border px-2 py-1.5 text-[12px] transition ${p.metric === m.key ? "border-accent bg-accent-soft text-text" : "border-line text-muted hover:border-line-strong hover:text-text"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="mt-2 text-[11px] text-faint">{METRICS.find((m) => m.key === p.metric)?.hint}</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Segmented
            size="sm"
            value={p.is3D ? "3d" : "2d"}
            onChange={(v) => p.setIs3D(v === "3d")}
            options={[
              { value: "2d", label: "2D" },
              { value: "3d", label: "3D" },
            ]}
          />
          <button
            onClick={() => p.setShowRoutes(!p.showRoutes)}
            className={`rounded-lg border px-2 text-[11px] ${p.showRoutes ? "border-accent text-text" : "border-line text-muted hover:text-text"}`}
          >
            {p.showRoutes ? "Hide" : "Show"} modeled routes
          </button>
        </div>
      </Section>

      <Section title="Index weights" aside={<button className="text-[11px] text-muted hover:text-text" onClick={() => p.setWeights(DEFAULT_WEIGHTS)}>Reset</button>}>
        <details>
          <summary className="cursor-pointer text-[12px] text-muted hover:text-text">
            {(Object.keys(nw) as ComponentKey[]).map((k) => `${Math.round(nw[k] * 100)}`).join(" / ")} — adjust
          </summary>
          <div className="mt-3 space-y-3">
            {(Object.keys(p.weights) as ComponentKey[]).map((k) => (
              <Slider
                key={k}
                label={COMPONENT_LABEL[k]}
                value={Math.round(p.weights[k] * 100)}
                min={0}
                max={60}
                format={() => `${Math.round(nw[k] * 100)}%`}
                onChange={(v) => p.setWeights({ ...p.weights, [k]: v / 100 })}
              />
            ))}
            <p className="text-[11px] text-faint">Weights are re-normalized to sum to 100%.</p>
          </div>
        </details>
      </Section>
    </div>
  );
}
