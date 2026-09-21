// GDELT 2.0 Doc API. Últimos 4 días, tono muy negativo o eventos militares/geopolíticos.
// Endpoint público, sin key. Doc: https://blog.gdeltproject.org/gdelt-doc-2-0-api/

const GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc";

const QUERIES = [
  {
    id: "movimiento-militar",
    q: '(sourcelang:eng OR sourcelang:spa) (militaryaction OR "troop movement" OR "military buildup" OR "military deployment" OR "airstrike" OR "naval exercise") theme:MILITARY',
  },
  {
    id: "tension-diplomatica",
    q: '(sourcelang:eng OR sourcelang:spa) (theme:ARMEDCONFLICT OR theme:ETH_TERRORISM) (ultimatum OR "war of words" OR "expels ambassador" OR "recalls ambassador")',
  },
  {
    id: "gibraltar-med",
    q: '(sourcelang:eng OR sourcelang:spa) ("Strait of Gibraltar" OR "Estrecho de Gibraltar" OR "Alboran" OR "Ceuta" OR "Melilla") (military OR navy OR aircraft OR patrol OR incident)',
  },
  {
    id: "taiwan",
    q: '(sourcelang:eng) ("Taiwan Strait" OR PLA OR "median line") (incursion OR aircraft OR carrier OR drill)',
  },
];

async function runQuery(query) {
  const params = new URLSearchParams({
    query: query.q,
    mode: "artlist",
    format: "json",
    maxrecords: "20",
    timespan: "1d",
    sort: "hybridrel",
  });
  const res = await fetch(`${GDELT_URL}?${params}`);
  if (!res.ok) return [];
  try {
    const text = await res.text();
    if (!text.trim().startsWith("{")) return [];
    const json = JSON.parse(text);
    return (json.articles || []).map((a) => ({
      title: a.title,
      url: a.url,
      seendate: a.seendate,
      domain: a.domain,
      language: a.language,
      sourcecountry: a.sourcecountry,
      tone: a.tone,
      queryId: query.id,
    }));
  } catch (err) {
    console.warn(`[gdelt] ${query.id} parse err: ${err.message}`);
    return [];
  }
}

export async function collectNews() {
  const results = [];
  for (const q of QUERIES) {
    try {
      const items = await runQuery(q);
      results.push(...items);
    } catch (err) {
      console.warn(`[gdelt] ${q.id} err: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return { articles: results, collectedAt: new Date().toISOString() };
}
