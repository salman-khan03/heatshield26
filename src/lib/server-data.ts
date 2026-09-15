import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Dataset } from "./model";

let cache: Promise<Dataset> | null = null;

function read(): Promise<Dataset> {
  return readFile(path.join(process.cwd(), "public", "data", "cells.json"), "utf8").then((t) => JSON.parse(t) as Dataset);
}

export function loadDataset(): Promise<Dataset> {
  // In dev, `npm run build:data` can rewrite this file while `next dev` keeps running — don't
  // cache across requests, or a rebuilt dataset never becomes visible until the server restarts.
  // In production the file is static for the process lifetime, so caching it is free.
  if (process.env.NODE_ENV !== "production") return read();
  cache ??= read();
  return cache;
}
