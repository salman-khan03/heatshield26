import ShieldMark from "./ShieldMark";

/**
 * Shown instead of crashing when public/data/cells.json is missing the current
 * (multi-venue) shape — e.g. mid-rebuild, where `npm run build:data` hasn't finished
 * writing its output yet. A stale or partial dataset should degrade gracefully, not
 * take down the whole page with a raw stack trace.
 */
export default function RebuildingNotice() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ink px-6 text-center text-text">
      <ShieldMark size={40} />
      <h1 className="text-[22px] font-semibold">Dataset is rebuilding</h1>
      <p className="max-w-md text-[14px] leading-relaxed text-muted">
        HeatShield&apos;s data pipeline is running (<code className="text-text">npm run build:data</code>). This page will work again as soon as it finishes writing{" "}
        <code className="text-text">public/data/cells.json</code>. Refresh in a few minutes.
      </p>
    </div>
  );
}
