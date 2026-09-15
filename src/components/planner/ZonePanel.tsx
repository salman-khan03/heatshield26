"use client";

import { useMemo, useState } from "react";
import {
  type CellScore,
  type ComponentKey,
  type Dataset,
  type InterventionType,
  type Scenario,
  type Weights,
  COMPONENT_LABEL,
  INTERVENTIONS,
  PERIOD_LABEL,
  normalizeWeights,
  recommendFor,
  zoneLabel,
} from "@/lib/model";
import { fmtInt, fmtMi } from "@/lib/format";
import { Bar, Button, Section, TierBadge } from "./ui";

const COMPONENT_COLOR: Record<ComponentKey, string> = {
  heat: "#f97316",
  crowd: "#d946ef",
  vuln: "#14b8a6",
  shade: "#eab308",
  cooling: "#38bdf8",
};

const HEAT_SRC_LABEL = {
  h3at2020: "H3AT 2020 heat model",
  h3at2024: "H3AT 2024 heat model (offset-adjusted)",
  interpolated: "No H3AT coverage — gap-filled (see methodology)",
  median: "No H3AT coverage — gap-filled (see methodology)",
};

interface Props {
  ds: Dataset;
  scores: CellScore[];
  selected: number | null;
  weights: Weights;
  scenario: Scenario;
  onSelect: (i: number) => void;
  onPlace: (type: InterventionType, cell: number) => void;
}

export default function ZonePanel({ ds, scores, selected, weights, scenario, onSelect, onPlace }: Props) {
  const ranking = useMemo(
    () =>
      scores
        .map((s, i) => ({ i, s }))
        .sort((a, b) => b.s.risk - a.s.risk)
        .slice(0, 12),
    [scores],
  );
  const medians = useMemo(() => {
    const med = (k: ComponentKey) => {
      const v = scores.map((s) => s[k]).sort((a, b) => a - b);
      return v[Math.floor(v.length / 2)];
    };
    return { heat: med("heat"), crowd: med("crowd"), vuln: med("vuln"), shade: med("shade"), cooling: med("cooling") } as Record<ComponentKey, number>;
  }, [scores]);

  if (selected == null) {
    return (
      <Section title="Highest-risk zones" aside={<span className="text-[11px] text-faint">click a cell or a row</span>}>
        <ol className="space-y-1">
          {ranking.map(({ i, s }, rank) => {
            const c = ds.cells[i];
            const top = distinctiveDriver(s, weights, medians);
            return (
              <li key={c.id}>
                <button onClick={() => onSelect(i)} className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-panel-2">
                  <span className="tabular w-5 text-right font-mono text-[12px] text-faint">{rank + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium group-hover:text-white">{zoneLabel(c)}</span>
                    <span className="block text-[11px] text-muted">Stands out on: {COMPONENT_LABEL[top].toLowerCase()}</span>
                  </span>
                  <span className="tabular font-mono text-[15px] font-semibold">{s.risk.toFixed(0)}</span>
                  <TierBadge tier={s.tier} />
                </button>
              </li>
            );
          })}
        </ol>
      </Section>
    );
  }

  return <ZoneDetail key={selected} ds={ds} score={scores[selected]} cell={selected} weights={weights} scenario={scenario} onPlace={onPlace} />;
}

/** The weighted component that sits furthest above the study-area median for this cell. */
function distinctiveDriver(s: CellScore, weights: Weights, medians: Record<ComponentKey, number>): ComponentKey {
  const w = normalizeWeights(weights);
  const lift = (k: ComponentKey) => w[k] * (s[k] - medians[k]);
  return (Object.keys(w) as ComponentKey[]).sort((a, b) => lift(b) - lift(a))[0];
}

function ZoneDetail({ ds, score: s, cell, weights, scenario, onPlace }: { ds: Dataset; score: CellScore; cell: number; weights: Weights; scenario: Scenario; onPlace: (t: InterventionType, c: number) => void }) {
  const c = ds.cells[cell];
  const w = normalizeWeights(weights);
  const rec = recommendFor(s);
  const spec = INTERVENTIONS[rec];
  const [explain, setExplain] = useState<{ state: "idle" | "loading" | "done" | "error"; text?: string; source?: string }>({ state: "idle" });

  const level = (v: number) => (v >= 80 ? "Very high" : v >= 60 ? "High" : v >= 40 ? "Moderate" : v >= 20 ? "Low" : "Very low");

  async function runExplain() {
    setExplain({ state: "loading" });
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zone: {
            label: zoneLabel(c),
            neighborhood: c.nbhd,
            censusTract: c.tract,
            riskIndex: Math.round(s.risk),
            tier: s.tier,
            components: Object.fromEntries((Object.keys(w) as ComponentKey[]).map((k) => [COMPONENT_LABEL[k], { score: Math.round(s[k]), weight: Math.round(w[k] * 100) }])),
            facts: {
              scenarioHeatIndexF: Math.round(s.heatIndex),
              heatDataSource: HEAT_SRC_LABEL[c.heatSrc],
              landsatSurfaceTempC: c.lst,
              treeCanopyPct_NLCD: c.canopy,
              treeCanopyPct_LiDAR2024: c.lidarCanopy,
              h3atAfternoonHeatIndexF_2020CampaignDay: c.hi20AF,
              h3atAfternoonHeatIndexF_2024CampaignDay: c.hi24AF,
              imperviousPct: c.imp,
              sviPercentileTexas: c.svi,
              adults65plusPct: c.age65,
              disabilityPct: c.disabl,
              uninsuredPct: c.uninsur,
              noVehiclePct: c.noveh,
              coronaryHeartDiseasePct: c.chd,
              copdPct: c.copd,
              diabetesPct: c.diabetes,
              kidneyDiseasePct: c.kidney,
              residentsApprox: c.pop,
              eventPersonHours: Math.round(s.personHours),
              nearestCoolingSite: c.coolName,
              distanceToCoolingMi: Number((s.coolDist / 1609.34).toFixed(2)),
            },
          },
          recommendation: { type: rec, label: spec.label, costAssumptionUSD: spec.cost, modeledEffect: spec.effect, description: spec.description },
          scenario: { attendance: scenario.attendance, airTempF: scenario.airTempF, humidity: scenario.humidity, window: PERIOD_LABEL[scenario.period], modeSplitPct: scenario.modeSplit },
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Request failed");
      setExplain({ state: "done", text: j.text, source: j.source });
    } catch (e) {
      setExplain({ state: "error", text: e instanceof Error ? e.message : "Something went wrong" });
    }
  }

  return (
    <div className="rise">
      <Section title="Selected zone">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[16px] font-semibold">{c.nbhd}</div>
            <div className="font-mono text-[11px] text-faint">
              H3 {c.id} · tract {c.tract}
            </div>
          </div>
          <div className="text-right">
            <div className="tabular font-mono text-[34px] font-semibold leading-none">{s.risk.toFixed(0)}</div>
            <div className="mt-1">
              <TierBadge tier={s.tier} />
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          {(Object.keys(w) as ComponentKey[]).map((k) => (
            <div key={k}>
              <div className="mb-1 flex justify-between text-[12px]">
                <span className="text-text/90">{COMPONENT_LABEL[k]}</span>
                <span className="text-muted">
                  <span className="text-text">{level(s[k])}</span> · {s[k].toFixed(0)} × {Math.round(w[k] * 100)}% = <span className="tabular font-mono text-text">{(s[k] * w[k]).toFixed(1)}</span>
                </span>
              </div>
              <Bar value={s[k]} color={COMPONENT_COLOR[k]} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Recommended intervention">
        <div className="rounded-xl border border-line-strong bg-panel-2 p-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full text-[15px]" style={{ background: spec.color }}>
              {spec.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold">{spec.label}</div>
              <div className="text-[11px] text-muted">Cost assumption ${fmtInt(spec.cost)}</div>
            </div>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">{spec.description}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" onClick={() => onPlace(rec, cell)}>
              Place here
            </Button>
            <Button onClick={runExplain} disabled={explain.state === "loading"}>
              {explain.state === "loading" ? "Explaining…" : "Explain this recommendation"}
            </Button>
          </div>
          {explain.state === "done" && (
            <div className="rise mt-3 rounded-lg border border-line bg-ink p-3">
              <p className="text-[13px] leading-relaxed text-text/90">{explain.text}</p>
              <div className="mt-2 text-[10.5px] uppercase tracking-wider text-faint">{explain.source === "gemini" ? "Generated by Gemini from the facts shown in this panel" : "Template explanation — set GEMINI_API_KEY to enable Gemini"}</div>
            </div>
          )}
          {explain.state === "error" && <p className="mt-3 text-[12px] text-critical">{explain.text}</p>}
        </div>
      </Section>

      <Section title="Evidence for this cell">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-[12px]">
          <Fact k="Heat index (scenario)" v={`${s.heatIndex.toFixed(0)}°F`} sub={HEAT_SRC_LABEL[c.heatSrc]} />
          <Fact k="Surface temp (Landsat)" v={c.lst != null ? `${c.lst.toFixed(1)}°C` : "—"} sub="tract mean LST" />
          <Fact k="Tree canopy" v={`${c.canopy.toFixed(0)}%`} sub={s.canopy !== c.canopy ? `${s.canopy.toFixed(0)}% with added shade` : `USFS NLCD TCC ${ds.meta.canopySource.year}`} />
          <Fact k="Impervious surface" v={c.imp != null ? `${c.imp.toFixed(0)}%` : "—"} sub="tract mean" />
          <Fact k="Social vulnerability" v={c.svi != null ? `${c.svi.toFixed(0)}th pct` : "—"} sub="CDC SVI 2022 (Texas)" />
          <Fact k="Adults 65+" v={pct(c.age65)} sub="ACS via SVI" />
          <Fact k="Coronary heart disease" v={pct(c.chd)} sub="CDC PLACES" />
          <Fact k="COPD · Diabetes" v={`${pct(c.copd)} · ${pct(c.diabetes)}`} sub="CDC PLACES" />
          <Fact k="Residents (approx.)" v={fmtInt(c.pop)} sub="tract pop ÷ cells" />
          <Fact k="Event person-hours" v={fmtInt(s.personHours)} sub="crowd model" />
          <Fact k="Nearest cooling site" v={fmtMi(s.coolDist)} sub={s.coolDist < c.coolDist ? "HeatShield cooling hub" : c.coolName} />
          <Fact k="No vehicle households" v={pct(c.noveh)} sub="ACS via SVI" />
          <Fact k="H3AT afternoon heat index" v={c.hi20AF != null ? `${c.hi20AF.toFixed(1)}°F` : c.hi24AF != null ? `${c.hi24AF.toFixed(1)}°F` : "—"} sub={c.hi20AF != null ? "2020 campaign day" : c.hi24AF != null ? "2024 campaign day" : "not measured here"} />
          <Fact k="LiDAR canopy (2024)" v={c.lidarCanopy != null ? `${c.lidarCanopy.toFixed(0)}%` : "—"} sub={c.lidarCanopy != null ? "ForUsTree focus area" : "outside LiDAR focus areas"} />
        </dl>
      </Section>
    </div>
  );
}

const pct = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);

function Fact({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[11px] text-muted">{k}</dt>
      <dd className="tabular font-mono text-[14px] font-semibold text-text">{v}</dd>
      {sub && <div className="truncate text-[10.5px] text-faint">{sub}</div>}
    </div>
  );
}
