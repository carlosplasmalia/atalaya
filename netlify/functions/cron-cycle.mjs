// Netlify Scheduled Function. Corre cada 4 horas.
// Ejecuta un ciclo, guarda en Netlify Blobs, dispara rebuild del site.
import { schedule } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { runCycle } from "../../src/lib/pipeline.js";

const handler = async () => {
  try {
    const cycle = await runCycle();
    const store = getStore("atalaya");

    // Guarda últimos y añade a histórico
    await store.setJSON("latest.json", cycle);
    await store.setJSON(`history/${cycle.id}.json`, cycle);

    // Índice ligero para el front (solo metadata + resumen)
    let index = [];
    try {
      index = (await store.get("index.json", { type: "json" })) || [];
    } catch {}
    index.unshift({
      id: cycle.id,
      startedAt: cycle.startedAt,
      resumen: cycle.analysis?.resumen_ejecutivo,
      nivel: cycle.analysis?.nivel_senal,
      metrics: cycle.metrics,
    });
    index = index.slice(0, 42);
    await store.setJSON("index.json", index);

    // Dispara rebuild para regenerar el site estático con el nuevo ciclo
    const hook = process.env.NETLIFY_BUILD_HOOK;
    if (hook) {
      await fetch(hook, { method: "POST" }).catch(() => {});
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, id: cycle.id, metrics: cycle.metrics }),
    };
  } catch (err) {
    console.error("[cron-cycle] fatal:", err);
    return { statusCode: 500, body: err.message };
  }
};

// Cada 4 horas
export default schedule("0 */4 * * *", handler);
