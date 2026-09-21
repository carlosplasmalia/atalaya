#!/usr/bin/env node
// Meta-review con Claude. Lee últimos 4 ciclos, busca patrones y contradicciones,
// proyecta próximas 24h. Escribe src/data/meta.json.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const HIST_DIR = path.join(ROOT, "src/data/history");
const META_PATH = path.join(ROOT, "src/data/meta.json");

async function loadLastCycles(n) {
  const files = (await fs.readdir(HIST_DIR)).filter((f) => f.endsWith(".json")).sort().reverse();
  const out = [];
  for (const f of files.slice(0, n)) {
    const c = JSON.parse(await fs.readFile(path.join(HIST_DIR, f), "utf8"));
    out.push(c);
  }
  return out;
}

function compact(c) {
  return {
    id: c.id,
    time: c.startedAt,
    nivel: c.analysis?.nivel_senal,
    resumen: c.analysis?.resumen_ejecutivo,
    eventos: (c.analysis?.eventos_destacados || []).map((e) => ({
      titulo: e.titulo,
      zona: e.zona,
      descripcion: e.descripcion,
      hipotesis: e.hipotesis,
    })),
    por_zona: c.analysis?.por_zona,
    metrics: c.metrics,
    top_militar: Object.values(c.raw?.flights?.perZone || {}).flatMap((z) =>
      (z.contacts || []).slice(0, 5).map((cc) => ({
        callsign: cc.callsign, hex: cc.icao24, country: cc.country,
        zone: z.name, lat: cc.lat?.toFixed(2), lon: cc.lon?.toFixed(2),
      }))
    ).slice(0, 20),
    top_news: (c.raw?.news || []).slice(0, 8).map((n) => ({ t: n.title, src: n.domain })),
  };
}

function buildPrompt(cycles) {
  const compacted = cycles.map(compact);
  return `Eres un analista OSINT senior. Vas a revisar los últimos ${cycles.length} ciclos horarios de Atalaya (últimas ~${cycles.length}h de datos públicos: ADS-B militar, FIRMS, GDELT, USGS).

Tu trabajo:
1. Sintetizar en 3-4 frases qué está pasando de verdad, más allá del ciclo individual.
2. Detectar patrones (repetición de callsigns, concentraciones anómalas, movimientos coordinados entre zonas).
3. Marcar contradicciones con narrativa oficial de prensa (si los hechos observables no encajan con la lectura dominante que ves en los titulares).
4. Proyectar próximas 24h en un párrafo, con incertidumbre explícita.

Reglas:
- Sobrio. Nada de sensacionalismo. Nada de conspiración sin evidencia.
- Si una contradicción es débil, dilo. Prefiere "no observado" antes que inventar.
- Vuelos militares esporádicos son rutina. Solo señala si hay patrón (holding, loitering, concentración, callsigns recurrentes).
- Español. Sin em-dashes. Usa comas, dos puntos o puntos.
- Devuelve SOLO un JSON válido, sin backticks, sin markdown, con esta forma exacta:

{
  "sintesis": "3-4 frases",
  "ciclos_revisados": ${cycles.length},
  "patrones": ["patrón 1 con evidencia concreta", "patrón 2"],
  "contradicciones": ["contradicción con evidencia, o cadena vacía si no hay ninguna sólida"],
  "prediccion": "1 párrafo con incertidumbre explícita"
}

DATOS DE LOS ÚLTIMOS ${cycles.length} CICLOS (más reciente primero):

${JSON.stringify(compacted, null, 2)}`;
}

function runClaude(prompt) {
  return new Promise((resolve, reject) => {
    const proc = spawn("claude", ["-p", "--output-format", "text"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "", err = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(`claude exit ${code}: ${err}`));
      resolve(out);
    });
    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

function extractJson(text) {
  // Puede venir con o sin ```json wrapper
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("No JSON found in Claude response");
  return JSON.parse(body.slice(start, end + 1));
}

async function main() {
  const cycles = await loadLastCycles(4);
  if (cycles.length === 0) {
    console.log("[meta-review] sin ciclos, abortando");
    return;
  }
  console.log(`[meta-review] revisando ${cycles.length} ciclos`);

  const prompt = buildPrompt(cycles);
  const raw = await runClaude(prompt);
  const parsed = extractJson(raw);

  const meta = {
    generatedAt: new Date().toISOString(),
    ciclos_revisados: cycles.length,
    rango: {
      desde: cycles[cycles.length - 1].startedAt,
      hasta: cycles[0].startedAt,
    },
    ...parsed,
  };

  await fs.writeFile(META_PATH, JSON.stringify(meta, null, 2));
  console.log(`[meta-review] escrito ${META_PATH}`);
  console.log(`[meta-review] síntesis: ${meta.sintesis?.slice(0, 100)}...`);
}

main().catch((err) => {
  console.error("[meta-review] fatal:", err.message);
  process.exit(1);
});
