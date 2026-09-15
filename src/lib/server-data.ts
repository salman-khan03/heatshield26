import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Dataset } from "./model";

let cache: Promise<Dataset> | null = null;

export function loadDataset(): Promise<Dataset> {
  cache ??= readFile(path.join(process.cwd(), "public", "data", "cells.json"), "utf8").then((t) => JSON.parse(t) as Dataset);
  return cache;
}
