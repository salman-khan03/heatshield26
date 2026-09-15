// MapLibre GL 6 loads its web worker relative to import.meta.url, which does not survive
// bundling. Copy the worker (and the shared chunk it imports) into public/ and point
// maplibregl.setWorkerUrl at it. Runs before dev and build so versions stay in sync.
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const src = path.join(root, "node_modules", "maplibre-gl", "dist");
const dest = path.join(root, "public", "maplibre");
await mkdir(dest, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) await copyFile(path.join(src, f), path.join(dest, f));
console.log("copied MapLibre worker to public/maplibre");
