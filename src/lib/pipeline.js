import { collectFlights } from "./collectors/opensky.js";
import { collectFires } from "./collectors/firms.js";
import { collectNews } from "./collectors/gdelt.js";
import { collectQuakes } from "./collectors/usgs.js";
import { analyze } from "./analyze.js";

export async function runCycle() {
  const startedAt = new Date().toISOString();
  console.log(`[atalaya] ciclo iniciado ${startedAt}`);

  const [flights, fires, news, quakes] = await Promise.all([
    collectFlights().catch((e) => {
      console.warn("flights err:", e.message);
      return { perZone: {}, allMilitary: [] };
    }),
    collectFires().catch((e) => {
      console.warn("fires err:", e.message);
      return { perZone: {}, total: 0 };
    }),
    collectNews().catch((e) => {
      console.warn("news err:", e.message);
      return { articles: [] };
    }),
    collectQuakes().catch((e) => {
      console.warn("quakes err:", e.message);
      return { features: [], suspicious: [] };
    }),
  ]);

  console.log(
    `[atalaya] recogido: ${flights.allMilitary.length} contactos mil, ` +
      `${fires.total || 0} focos, ${news.articles.length} noticias, ` +
      `${quakes.features.length} sismos`
  );

  let analysis;
  try {
    analysis = await analyze({ flights, fires, news, quakes });
  } catch (err) {
    console.error("[atalaya] analyze err:", err.message);
    analysis = {
      resumen_ejecutivo: "Ciclo sin análisis IA (fallo transitorio). Los datos crudos siguen disponibles.",
      nivel_senal: "bajo",
      nivel_senal_justificacion: "análisis no disponible",
      eventos_destacados: [],
      por_zona: {},
      senales_debiles: [],
      que_vigilar: [],
      error: err.message,
    };
  }

  const cycle = {
    id: startedAt.replace(/[:.]/g, "-"),
    startedAt,
    finishedAt: new Date().toISOString(),
    analysis,
    metrics: {
      military_contacts: flights.allMilitary.length,
      fires: fires.total || 0,
      news: news.articles.length,
      quakes: quakes.features.length,
      quakes_suspicious: (quakes.suspicious || []).length,
    },
    raw: {
      flights: {
        perZone: Object.fromEntries(
          Object.entries(flights.perZone).map(([id, z]) => [
            id,
            { name: z.name, total: z.total, military: z.military, contacts: z.contacts },
          ])
        ),
      },
      fires: fires.perZone || {},
      news: news.articles || [],
      quakes_suspicious: quakes.suspicious || [],
    },
  };

  return cycle;
}
