// Pipeline de análisis: pasa el dump crudo a Groq (Llama 3.3 70B) con prompt
// de analista OSINT sobrio. Devuelve JSON estructurado.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "openai/gpt-oss-120b";

function buildPrompt(data) {
  const { flights, fires, news, quakes } = data;

  // Compactar para que quepa en contexto y sea legible por el modelo
  const flightSummary = Object.entries(flights.perZone).map(([id, z]) => ({
    zona: z.name,
    contactos_totales: z.total,
    militares: z.military,
    ejemplos: z.contacts.slice(0, 15).map((c) => ({
      hex: c.icao24,
      callsign: c.callsign,
      tipo: c.aircraft_type || c.type_code || null,
      registro: c.registration,
      operador: c.operator,
      pais: c.country,
      lat: c.lat?.toFixed(2),
      lon: c.lon?.toFixed(2),
      alt_m: c.baro_altitude ? Math.round(c.baro_altitude) : null,
      vel_ms: c.velocity ? Math.round(c.velocity) : null,
      motivo: c.reason,
    })),
  }));

  const fireSummary = Object.entries(fires.perZone || {}).map(([id, z]) => ({
    zona: z.name,
    focos: z.count,
    top: (z.fires || [])
      .sort((a, b) => b.frp - a.frp)
      .slice(0, 5)
      .map((f) => ({ lat: f.lat, lon: f.lon, frp: f.frp, confianza: f.confidence })),
  }));

  const newsSummary = (news.articles || []).slice(0, 40).map((a) => ({
    titulo: a.title,
    fuente: a.domain,
    pais: a.sourcecountry,
    tono: a.tone,
    q: a.queryId,
    url: a.url,
  }));

  const quakeSummary = {
    total_24h: quakes.features.length,
    sospechosos_superficiales: (quakes.suspicious || []).map((q) => ({
      mag: q.mag,
      lugar: q.place,
      prof_km: q.depth,
      url: q.url,
    })),
  };

  return `Eres un analista OSINT independiente. Redactas en español para lectores no técnicos.
Tono: sobrio, empírico, sin sensacionalismo. Marca claramente qué es hecho verificado y qué es hipótesis.
Nunca digas "según fuentes secretas". Cita solo las fuentes públicas del brief.
No afirmes cosas que no estén en los datos. Prefiere "no hay señales" antes que inventar.

DATOS DEL CICLO (últimas 4h aproximadamente):

Vuelos militares detectados por zona (OpenSky Network + heurística de rangos ICAO/callsigns):
${JSON.stringify(flightSummary, null, 2)}

Focos térmicos VIIRS por zona (NASA FIRMS):
${JSON.stringify(fireSummary, null, 2)}

Sismos con foco superficial sospechoso <3km, M≥3.5 (USGS):
${JSON.stringify(quakeSummary, null, 2)}

Titulares indexados por GDELT relevantes (últimas 24h):
${JSON.stringify(newsSummary, null, 2)}

Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta forma exacta:

{
  "resumen_ejecutivo": "3-4 frases neutras que un lector no experto pueda entender. Titular claro de la actualidad.",
  "nivel_senal": "bajo|medio|alto",
  "nivel_senal_justificacion": "una frase",
  "eventos_destacados": [
    {
      "titulo": "corto",
      "zona": "med-oeste|mar-negro|levante|corea|taiwan|global",
      "descripcion": "2-3 frases con contexto factual",
      "hipotesis": "interpretación con incertidumbre explícita, o null si no procede",
      "fuentes": ["OpenSky", "GDELT", "FIRMS", "USGS"]
    }
  ],
  "por_zona": {
    "gibraltar": "1-2 frases sobre estrecho, Ceuta, Melilla, con detalle si hay tipo de aeronave o operador identificado",
    "med-oeste": "1-2 frases",
    "mar-negro": "1-2 frases",
    "levante": "1-2 frases",
    "corea": "1-2 frases",
    "taiwan": "1-2 frases"
  },
  "senales_debiles": ["patrones interesantes que aún no confirman una tesis"],
  "que_vigilar": ["indicadores concretos que confirmarían o descartarían las hipótesis en próximos ciclos"]
}

Reglas:
- No em-dashes. Usa comas, dos puntos o puntos.
- No inventes datos. Si una zona no tiene actividad reseñable, di "sin señales relevantes en este ciclo".
- Los vuelos militares esporádicos son rutina, no los sobredimensiones. Solo destaca patrones (loitering, concentración anómala, callsigns raros).
- **PRIORIDAD ALTA: zona gibraltar (Estrecho, Ceuta, Melilla)**. Aunque haya pocos contactos, examina siempre con detalle: tipo de aeronave, operador, altitud, si sugiere vigilancia, reconocimiento o patrullaje.
- Si detectas tipo B-52, KC-135, RC-135, P-8, MQ-9, E-3, cita el modelo específico en la descripción del evento.
- Si detectas algo tipo "B-52 en holding sobre Alborán" indícalo como observación con contexto: es publicado, ocurre en Bomber Task Force, no es prueba de conflicto inminente.
- JSON puro, sin markdown, sin backticks.`;
}

export async function analyze(data) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY missing");
  const prompt = buildPrompt(data);

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      response_format: { type: "json_object" },
      max_tokens: 3500,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Groq ${res.status}: ${txt.slice(0, 300)}`);
  }
  const json = await res.json();
  const raw = json.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Groq empty content");
  return JSON.parse(raw);
}
