// Estrategia: en build, cargar todo el histórico local con import.meta.glob.
// Si estamos en producción Netlify y hay Blobs con datos frescos, sobrescribir con esos.

const localHistory = import.meta.glob("../data/history/*.json", { eager: true });
import latestSeed from "../data/latest.json";
const localMeta = import.meta.glob("../data/meta.json", { eager: true });

function summarize(c) {
  return {
    id: c.id,
    startedAt: c.startedAt,
    resumen: c.analysis?.resumen_ejecutivo,
    nivel: c.analysis?.nivel_senal,
    metrics: c.metrics,
  };
}

async function fromBlobs() {
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore("atalaya");
    const latest = await store.get("latest.json", { type: "json" });
    if (!latest) return null;
    const index = (await store.get("index.json", { type: "json" })) || [];
    const meta = await store.get("meta.json", { type: "json" });
    return { latest, index, meta };
  } catch (err) {
    return null;
  }
}

function fromLocal() {
  const items = Object.values(localHistory)
    .map((m) => m.default || m)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  const latest = items[0] || latestSeed;
  const index = items.map(summarize);
  const metaMod = Object.values(localMeta)[0];
  const meta = metaMod ? (metaMod.default || metaMod) : null;
  return { latest, index, meta };
}

export async function loadData() {
  const b = await fromBlobs();
  if (b) return b;
  return fromLocal();
}

export async function loadCycle(id) {
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore("atalaya");
    const c = await store.get(`history/${id}.json`, { type: "json" });
    if (c) return c;
  } catch {}
  const items = Object.values(localHistory).map((m) => m.default || m);
  return items.find((c) => c.id === id) || null;
}
