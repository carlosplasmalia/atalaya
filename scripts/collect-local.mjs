#!/usr/bin/env node
// Ejecuta un ciclo en local, guarda en data/latest.json + data/history/*.json
// Uso: GROQ_API_KEY=xxx FIRMS_MAP_KEY=xxx npm run collect

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Carga .env muy simple sin dependencia extra
try {
  const envRaw = await fs.readFile(new URL("../.env", import.meta.url), "utf8");
  for (const line of envRaw.split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

import { runCycle } from "../src/lib/pipeline.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "src/data");
const HIST_DIR = path.join(DATA_DIR, "history");

async function main() {
  await fs.mkdir(HIST_DIR, { recursive: true });

  const cycle = await runCycle();

  const latestPath = path.join(DATA_DIR, "latest.json");
  await fs.writeFile(latestPath, JSON.stringify(cycle, null, 2));

  const histPath = path.join(HIST_DIR, `${cycle.id}.json`);
  await fs.writeFile(histPath, JSON.stringify(cycle, null, 2));

  // Prune histórico a últimos 42 (7 días × 6 ciclos/día)
  const files = (await fs.readdir(HIST_DIR)).filter((f) => f.endsWith(".json")).sort();
  const excess = files.slice(0, Math.max(0, files.length - 42));
  for (const f of excess) await fs.unlink(path.join(HIST_DIR, f));

  console.log(`[atalaya] guardado ${latestPath}`);
  console.log(`[atalaya] histórico total: ${files.length - excess.length} ciclos`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
