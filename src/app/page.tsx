import Link from "next/link";
import ShieldMark from "@/components/ShieldMark";
import RebuildingNotice from "@/components/RebuildingNotice";
import { DEFAULT_SCENARIO, DEFAULT_WEIGHTS, TIERS, evaluate } from "@/lib/model";
import { fmtInt } from "@/lib/format";
import { loadDataset } from "@/lib/server-data";

export default async function Home() {
  const ds = await loadDataset();
  if (!ds.meta.venues?.length) return <RebuildingNotice />;
  const venue = ds.meta.venues.find((v) => v.id === DEFAULT_SCENARIO.venueId) ?? ds.meta.venues[0];
  const { scores, summary } = evaluate(ds, DEFAULT_SCENARIO, DEFAULT_WEIGHTS, []);

  // Project the hex grid for the hero graphic.
  const lat0 = venue.lat;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = ds.cells.flatMap((c) => c.b.map(([lng]) => lng * k));
  const ys = ds.cells.flatMap((c) => c.b.map(([, lat]) => lat));
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const W = 520;
  const scale = W / (maxX - minX);
  const H = Math.round((maxY - minY) * scale);
  const px = (lng: number, lat: number) => `${((lng * k - minX) * scale).toFixed(1)},${((maxY - lat) * scale).toFixed(1)}`;
  const color = (risk: number) => TIERS.find((t) => risk >= t.min)!.color;
  // Same visual language as the planner: hotspots loud, the moderate majority quiet.
  const heroOpacity = (risk: number) => (risk >= 75 ? 0.95 : risk >= 60 ? 0.75 : risk >= 45 ? 0.22 : 0.32);
  const venuePt = px(venue.lng, venue.lat).split(",").map(Number);

  const stats = [
    { value: "431,348", label: "street-level heat observations in the H3AT Houston campaign, Aug 10, 2024", href: "https://www.h3at.org/2024-campaign/2024-campaign-results" },
    { value: "14°F", label: "measured gap between Houston’s hottest and coolest neighborhoods (H3AT 2024)", href: "https://www.h3at.org/2024-campaign/2024-campaign-results" },
    { value: String(ds.meta.venues.length), label: `real Houston venues covered — ${venue.name} is the flagship scenario, capacity ${fmtInt(venue.capacity)}`, href: "/methodology" },
    { value: fmtInt(ds.meta.cellCount), label: "~0.1 km² hex cells inside Loop 610, scored from 11 open datasets", href: "/methodology" },
  ];

  const steps = [
    { n: "01", title: "Measure", body: "H3AT street-level heat models, USFS tree canopy, Landsat surface temperature, CDC social vulnerability and chronic-disease prevalence, City of Houston cool centers." },
    { n: "02", title: "Model the crowd", body: "Attendance and arrival-mode assumptions are routed from METRORail stations, each venue's nearby lots and garages (by real or estimated capacity), rideshare curbs and walk-ups to the gates." },
    { n: "03", title: "Score risk", body: "A transparent Heat Event Risk Index: 40% heat, 25% crowd, 20% vulnerability, 10% shade deficit, 5% cooling access. Every weight is adjustable." },
    { n: "04", title: "Act", body: "Place cooling hubs, shade, water or shuttles and watch the metrics move — or give the optimizer a budget and get a ranked portfolio." },
  ];

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 right-[-10%] h-[640px] w-[640px] rounded-full bg-[radial-gradient(closest-side,#ff7a1a33,transparent)]" />
      <header className="relative mx-auto flex max-w-6xl items-center gap-3 px-5 py-5">
        <ShieldMark size={26} />
        <span className="text-[16px] font-semibold tracking-tight">HeatShield 26</span>
        <nav className="ml-auto flex items-center gap-5 text-[13px] text-muted">
          <Link href="/methodology" className="hover:text-text">
            Methodology
          </Link>
          <Link href="/planner" className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-black hover:brightness-110">
            Open planner
          </Link>
        </nav>
      </header>

      <section className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-8 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-line-strong px-3 py-1 text-[11.5px] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Track 3 · Public Health &amp; the Built Environment
          </div>
          <h1 className="text-balance text-[34px] font-semibold leading-[1.1] tracking-tight sm:text-[46px]">
            Where should Houston invest <span className="text-accent">$1M</span> to protect visitors and residents from extreme heat during its next mega-event?
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-[16px] leading-relaxed text-muted">
            HeatShield 26 is a geospatial decision-support platform covering Houston inside Loop 610. It finds where event crowds, extreme heat, social and health vulnerability, missing shade and poor cooling access overlap at any of {ds.meta.venues.length} real Houston venues — and tells planners where cooling hubs, shade, water and shuttles do the most good.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/planner" className="rounded-xl bg-accent px-5 py-3 text-[15px] font-semibold text-black shadow-[0_8px_30px_#ff7a1a44] transition hover:brightness-110">
              Launch the planner →
            </Link>
            <Link href="/methodology" className="rounded-xl border border-line-strong px-5 py-3 text-[15px] text-text transition hover:border-muted">
              How the index works
            </Link>
          </div>
        </div>

        <figure className="relative">
          <div className="overflow-hidden rounded-2xl border border-line-strong bg-panel p-3 shadow-2xl">
            <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Hex map of baseline heat event risk around ${venue.name}, one of ${ds.meta.venues.length} Houston venues HeatShield covers`}>
              {ds.cells.map((c, i) => (
                <polygon key={c.id} points={c.b.map(([lng, lat]) => px(lng, lat)).join(" ")} fill={color(scores[i].risk)} fillOpacity={heroOpacity(scores[i].risk)} stroke="#0a0d12" strokeWidth={0.6} />
              ))}
              <circle cx={venuePt[0]} cy={venuePt[1]} r={10} fill="none" stroke="#fff" strokeWidth={1.5} className="pulse-ring" style={{ transformOrigin: `${venuePt[0]}px ${venuePt[1]}px` }} />
              <circle cx={venuePt[0]} cy={venuePt[1]} r={4} fill="#fff" />
              <text x={venuePt[0] + 9} y={venuePt[1] + 4} fill="#fff" fontSize={12} fontWeight={600}>
                {venue.name}
              </text>
            </svg>
          </div>
          <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
            <span>
              Baseline scenario: {venue.name}, {fmtInt(DEFAULT_SCENARIO.attendance)} attendees · {DEFAULT_SCENARIO.airTempF}°F afternoon ·{" "}
              <b className="text-text">{summary.criticalZones}</b> critical, <b className="text-text">{summary.tierCounts.high}</b> high-risk cells
            </span>
          </figcaption>
        </figure>
      </section>

      <section className="relative mx-auto max-w-6xl px-5">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <a key={s.value} href={s.href} target={s.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="group bg-panel p-5 transition hover:bg-panel-2">
              <div className="text-[32px] font-semibold tracking-tight">{s.value}</div>
              <div className="mt-1 text-[13px] leading-snug text-muted group-hover:text-text/80">{s.label}</div>
            </a>
          ))}
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-muted">How it works</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-line bg-panel p-5">
              <div className="font-mono text-[12px] text-accent">{s.n}</div>
              <div className="mt-2 text-[17px] font-semibold">{s.title}</div>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-5 pb-20">
        <div className="rounded-2xl border border-line-strong bg-gradient-to-br from-panel-2 to-panel p-8 md:p-10">
          <h2 className="max-w-3xl text-balance text-[26px] font-semibold leading-snug tracking-tight">
            The World Cup is the stress test. HeatShield is built for every mega-event Houston hosts next.
          </h2>
          <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-muted">
            Pick the venue — NRG Stadium, Daikin Park, Toyota Center, Shell Energy Stadium, TDECU Stadium or Rice Stadium — and swap the attendance and arrival assumptions; the same pipeline scores an Astros game, a Rockets or Dynamo night, a Texans Sunday, the Rodeo, a UH or Rice football Saturday, or a citywide heat emergency. Cooling hubs and shade placed for one event become reusable resilience infrastructure for the neighborhoods around it.
          </p>
        </div>
      </section>

      <footer className="relative border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-6 text-[12px] text-faint">
          <span>HeatShield 26 — Rice University Urban Sustainability Hackathon</span>
          <span>The risk index is a decision-support composite, not a medical prediction. Costs and effect sizes are scenario assumptions.</span>
        </div>
      </footer>
    </div>
  );
}
