"use client";

import dynamic from "next/dynamic";
import ShieldMark from "@/components/ShieldMark";
import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  type Dataset,
  type Intervention,
  type InterventionType,
  type Scenario,
  type Weights,
  DEFAULT_SCENARIO,
  DEFAULT_WEIGHTS,
  INTERVENTIONS,
  TIERS,
  evaluate,
} from "@/lib/model";
import { type OptimizeResult, optimize, rankOptions } from "@/lib/optimizer";
import KpiStrip from "./KpiStrip";
import OptimizePanel from "./OptimizePanel";
import PrioritiesPanel from "./PrioritiesPanel";
import ScenarioPanel from "./ScenarioPanel";
import SimulatePanel from "./SimulatePanel";
import ZonePanel from "./ZonePanel";
import { METRICS, type MapLayers, type MetricKey } from "./types";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-pulse bg-panel" />,
});

type Tab = "zone" | "simulate" | "optimize" | "priorities";
const TABS: { key: Tab; label: string }[] = [
  { key: "zone", label: "Zones" },
  { key: "simulate", label: "Simulate" },
  { key: "optimize", label: "Optimize" },
  { key: "priorities", label: "Priorities" },
];

export default function Planner() {
  const [ds, setDs] = useState<Dataset | null>(null);
  const [layers, setLayers] = useState<MapLayers | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO);
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [activeTool, setActiveTool] = useState<InterventionType | null>(null);
  const [metric, setMetric] = useState<MetricKey>("risk");
  const [is3D, setIs3D] = useState(false);
  const [showRoutes, setShowRoutes] = useState(false);
  const [tab, setTab] = useState<Tab>("zone");
  const [flyTo, setFlyTo] = useState<{ cell: number; nonce: number } | null>(null);
  const [optResult, setOptResult] = useState<OptimizeResult | null>(null);
  const [optKey, setOptKey] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const uid = useRef(0);

  useEffect(() => {
    Promise.all([fetch("/data/cells.json").then((r) => r.json()), fetch("/data/layers.json").then((r) => r.json())])
      .then(([d, l]) => {
        setDs(d);
        setLayers(l);
      })
      .catch((e) => setLoadError(String(e)));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveTool(null);
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const dScenario = useDeferredValue(scenario);
  const dWeights = useDeferredValue(weights);

  const baseline = useMemo(() => (ds ? evaluate(ds, dScenario, dWeights, []) : null), [ds, dScenario, dWeights]);
  const current = useMemo(() => (ds ? (interventions.length ? evaluate(ds, dScenario, dWeights, interventions) : baseline) : null), [ds, dScenario, dWeights, interventions, baseline]);
  const priorities = useMemo(() => (ds && tab === "priorities" ? rankOptions(ds, dScenario, dWeights, interventions) : []), [ds, dScenario, dWeights, interventions, tab]);

  const place = useCallback((type: InterventionType, cell: number) => {
    setInterventions((list) => (list.some((iv) => iv.type === type && iv.cell === cell) ? list : [...list, { uid: `iv${++uid.current}`, type, cell, source: "manual" }]));
  }, []);

  const onCellClick = useCallback(
    (i: number) => {
      if (activeTool) {
        place(activeTool, i);
        return;
      }
      setSelected(i);
      setTab("zone");
    },
    [activeTool, place],
  );

  const focusCell = (i: number) => {
    setSelected(i);
    setTab("zone");
    setFlyTo({ cell: i, nonce: Date.now() });
  };

  const scenarioKey = JSON.stringify([scenario, weights]);

  const runOptimizer = (budget: number, allowed: InterventionType[]) => {
    if (!ds) return;
    setRunning(true);
    setTimeout(() => {
      const manual = interventions.filter((iv) => iv.source === "manual");
      const result = optimize(ds, scenario, weights, manual, budget, { allowed });
      setOptResult(result);
      setOptKey(scenarioKey);
      setInterventions([...manual, ...result.items.map((it) => ({ uid: `iv${++uid.current}`, type: it.type, cell: it.cell, source: "optimizer" as const }))]);
      setRunning(false);
    }, 40);
  };

  const clearOptimizer = () => {
    setOptResult(null);
    setInterventions((list) => list.filter((iv) => iv.source === "manual"));
  };

  if (loadError) return <div className="p-8 text-critical">Could not load data: {loadError}</div>;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line bg-panel px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <ShieldMark />
          <span className="text-[15px] font-semibold tracking-tight">HeatShield 26</span>
        </Link>
        <span className="hidden text-[12px] text-muted md:inline">Mega-event heat risk planner · Houston Stadium / NRG Park</span>
        <nav className="ml-auto flex items-center gap-4 text-[12.5px] text-muted">
          <Link href="/" className="hover:text-text">
            Overview
          </Link>
          <Link href="/methodology" className="hover:text-text">
            Methodology &amp; data
          </Link>
        </nav>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <aside className="scroll-thin order-3 shrink-0 border-line bg-panel lg:order-1 lg:w-[310px] lg:overflow-y-auto lg:border-r">
          <ScenarioPanel
            scenario={scenario}
            setScenario={setScenario}
            weights={weights}
            setWeights={setWeights}
            metric={metric}
            setMetric={setMetric}
            is3D={is3D}
            setIs3D={setIs3D}
            showRoutes={showRoutes}
            setShowRoutes={setShowRoutes}
            capacity={ds?.meta.stadium.capacity ?? 68777}
          />
        </aside>

        <main className="relative order-1 h-[64vh] shrink-0 lg:order-2 lg:h-auto lg:flex-1">
          {ds && layers && current ? (
            <MapView
              ds={ds}
              layers={layers}
              scores={current.scores}
              metric={metric}
              is3D={is3D}
              showRoutes={showRoutes}
              selected={selected}
              interventions={interventions}
              activeTool={activeTool}
              flyTo={flyTo}
              onCellClick={onCellClick}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-panel text-[13px] text-muted">Loading Houston heat, health and transit layers…</div>
          )}

          <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-2">
            <MapLegend metric={metric} />
          </div>

          {activeTool && (
            <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-accent/60 bg-panel/95 px-4 py-1.5 text-[12.5px] shadow-xl backdrop-blur">
              {INTERVENTIONS[activeTool].icon} Placing <b>{INTERVENTIONS[activeTool].label}</b> — click a cell ·{" "}
              <button className="text-accent underline-offset-2 hover:underline" onClick={() => setActiveTool(null)}>
                done (Esc)
              </button>
            </div>
          )}

          {baseline && current && (
            <div className="absolute inset-x-3 bottom-3">
              <KpiStrip baseline={baseline.summary} current={current.summary} compare={interventions.length > 0} />
            </div>
          )}
        </main>

        <aside className="scroll-thin order-2 flex shrink-0 flex-col border-line bg-panel lg:order-3 lg:w-[390px] lg:overflow-hidden lg:border-l">
          <div className="flex shrink-0 border-b border-line px-2" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`relative flex-1 px-2 py-3 text-[12.5px] font-medium transition ${tab === t.key ? "text-text" : "text-muted hover:text-text"}`}
              >
                {t.label}
                {t.key === "simulate" && interventions.length > 0 && <span className="ml-1 rounded-full bg-accent px-1.5 text-[10px] font-semibold text-black">{interventions.length}</span>}
                {tab === t.key && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent" />}
              </button>
            ))}
          </div>
          <div className="scroll-thin min-h-0 flex-1 lg:overflow-y-auto">
            {ds && current && baseline && (
              <>
                {tab === "zone" && (
                  <>
                    {selected != null && (
                      <button onClick={() => setSelected(null)} className="px-4 pt-3 text-[12px] text-muted hover:text-text">
                        ← All zones
                      </button>
                    )}
                    <ZonePanel ds={ds} scores={current.scores} selected={selected} weights={dWeights} scenario={dScenario} onSelect={focusCell} onPlace={(t, c) => place(t, c)} />
                  </>
                )}
                {tab === "simulate" && (
                  <SimulatePanel
                    ds={ds}
                    interventions={interventions}
                    activeTool={activeTool}
                    setActiveTool={setActiveTool}
                    onRemove={(id) => setInterventions((l) => l.filter((iv) => iv.uid !== id))}
                    onClear={() => {
                      setInterventions([]);
                      setOptResult(null);
                    }}
                    baseline={baseline.summary}
                    current={current.summary}
                  />
                )}
                {tab === "optimize" && (
                  <>
                    {optResult && optKey !== scenarioKey && (
                      <div className="mx-4 mt-3 rounded-lg border border-moderate/40 bg-moderate/10 px-3 py-2 text-[12px] text-moderate">Scenario changed since this plan was optimized — re-run for an up-to-date portfolio.</div>
                    )}
                    <OptimizePanel ds={ds} result={optResult} running={running} onRun={runOptimizer} onClear={clearOptimizer} baseline={baseline.summary} current={current.summary} />
                  </>
                )}
                {tab === "priorities" && <PrioritiesPanel ds={ds} options={priorities} onAdd={place} onFocus={focusCell} />}
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function MapLegend({ metric }: { metric: MetricKey }) {
  const m = METRICS.find((x) => x.key === metric)!;
  return (
    <div className="rounded-xl border border-line-strong bg-panel/90 px-3 py-2 shadow-xl backdrop-blur">
      <div className="text-[10.5px] uppercase tracking-wider text-muted">{m.label}</div>
      {metric === "risk" ? (
        <div className="mt-1.5 flex flex-col gap-1">
          {TIERS.map((t) => (
            <div key={t.key} className="flex items-center gap-2 text-[11.5px]">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: t.color }} />
              <span className="text-text/90">{t.label}</span>
              <span className="ml-auto pl-3 font-mono text-[10.5px] text-faint">{t.key === "lower" ? "< 45" : `≥ ${t.min}`}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-1.5 w-40">
          <div className="h-2 rounded-full" style={{ background: LEGEND_GRADIENT[metric] }} />
          <div className="mt-0.5 flex justify-between font-mono text-[10px] text-faint">
            <span>0</span>
            <span>100</span>
          </div>
        </div>
      )}
      <div className="mt-2 flex items-center gap-3 border-t border-line pt-1.5 text-[10.5px] text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-cool" /> Cool center
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full border-2 border-white" /> METRORail
        </span>
      </div>
    </div>
  );
}

const LEGEND_GRADIENT: Record<Exclude<MetricKey, "risk">, string> = {
  heat: "linear-gradient(90deg,#1d2b3a,#f59e0b,#ea580c,#b91c1c)",
  crowd: "linear-gradient(90deg,#141a22,#6d28d9,#c026d3,#f472b6)",
  vuln: "linear-gradient(90deg,#15202b,#0e7490,#14b8a6,#99f6e4)",
  shade: "linear-gradient(90deg,#14532d,#65a30d,#ca8a04,#fde047)",
  cooling: "linear-gradient(90deg,#0c4a6e,#0284c7,#7dd3fc,#f0f9ff)",
};

