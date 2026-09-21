// Enriquece contactos con tipo, modelo y operador vía hexdb.io.
// Sin auth, gratis. Rate limits razonables para 4-40 lookups por ciclo.

const HEXDB = "https://hexdb.io/api/v1/aircraft";

const MILITARY_OWNER_PATTERNS = [
  /royal\s+air\s+force/i,
  /raf\b/i,
  /royal\s+navy/i,
  /fleet\s+air\s+arm/i,
  /ministry\s+of\s+defence/i,
  /\bmod\b/i,
  /^us\s+(air|army|navy|marine)/i,
  /united\s+states\s+(air|army|navy|marine)/i,
  /\busaf\b/i,
  /\busn\b/i,
  /\busmc\b/i,
  /department\s+of\s+the\s+(air|army|navy)/i,
  /department\s+of\s+defen[cs]e/i,
  /aeronautica\s+militare/i,
  /armée\s+de\s+l['`]air/i,
  /armee\s+de\s+l['`]air/i,
  /french\s+(air|navy)/i,
  /marine\s+nationale/i,
  /luftwaffe/i,
  /bundeswehr/i,
  /ejército\s+del\s+aire/i,
  /ejercito\s+del\s+aire/i,
  /aviación\s+naval/i,
  /israeli\s+(air|navy|defense)/i,
  /\bidf\b/i,
  /turkish\s+(air|navy)/i,
  /türk\s+hava/i,
  /japan\s+(air|maritime|self)/i,
  /jasdf/i,
  /jmsdf/i,
  /republic\s+of\s+korea\s+(air|navy)/i,
  /\brokaf\b/i,
  /\brokn\b/i,
  /\bplaaf\b/i,
  /people['`]s\s+liberation\s+army/i,
  /nato\b/i,
  /aeronautique\s+navale/i,
];

const MILITARY_TYPE_HINTS = [
  /^f-?\d{1,3}/i,        // F-15, F-16, F-22, F-35
  /^mig-?\d/i,
  /^su-?\d/i,
  /^b-?\d{1,3}/i,        // B-52, B-2, B-1
  /^kc-?\d{2,3}/i,       // KC-135, KC-46
  /^c-?\d{1,3}/i,        // C-17, C-130, C-5 (con precaución)
  /^p-?\d/i,             // P-8 Poseidon
  /^e-?\d/i,             // E-3 AWACS, E-8
  /^rc-?\d/i,            // RC-135
  /^mq-?\d/i,            // MQ-9 Reaper
  /^rq-?\d/i,            // RQ-4 Global Hawk
  /reaper/i,
  /global\s+hawk/i,
  /hercules/i,
  /poseidon/i,
  /sentry/i,
  /rivet\s+joint/i,
  /awacs/i,
];

const cache = new Map();

async function lookupOnce(hex) {
  if (!hex) return null;
  hex = hex.toLowerCase();
  if (cache.has(hex)) return cache.get(hex);
  try {
    const res = await fetch(`${HEXDB}/${hex}`, {
      headers: { "User-Agent": "atalaya-osint/0.1 (dashboard educativo)" },
    });
    if (!res.ok) {
      cache.set(hex, null);
      return null;
    }
    const json = await res.json();
    if (json.status === "404" || json.error) {
      cache.set(hex, null);
      return null;
    }
    const info = {
      registration: json.Registration || null,
      manufacturer: json.Manufacturer || null,
      typeCode: json.ICAOTypeCode || null,
      type: json.Type || null,
      operator: json.RegisteredOwners || null,
    };
    cache.set(hex, info);
    return info;
  } catch (err) {
    cache.set(hex, null);
    return null;
  }
}

function isMilitaryByMeta(info) {
  if (!info) return false;
  const haystack = [info.operator, info.type, info.manufacturer].filter(Boolean).join(" ");
  if (MILITARY_OWNER_PATTERNS.some((r) => r.test(haystack))) return true;
  if (info.type && MILITARY_TYPE_HINTS.some((r) => r.test(info.type))) return true;
  return false;
}

export async function enrichContacts(contacts, { concurrency = 5 } = {}) {
  const results = [];
  const queue = [...contacts];
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const c = queue.shift();
      const info = await lookupOnce(c.icao24);
      results.push({ ...c, meta: info, meta_military: isMilitaryByMeta(info) });
    }
  });
  await Promise.all(workers);
  return results;
}

export { lookupOnce, isMilitaryByMeta };
