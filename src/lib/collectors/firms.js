import { ZONES } from "../zones.js";

// NASA FIRMS Area API. Devuelve focos térmicos VIIRS últimas 24h.
// Doc: https://firms.modaps.eosdis.nasa.gov/api/area/

const FIRMS_BASE = "https://firms.modaps.eosdis.nasa.gov/api/area/csv";
const SOURCE = "VIIRS_SNPP_NRT";
const DAY_RANGE = 1;

function parseCsv(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    const obj = {};
    headers.forEach((h, i) => (obj[h] = cols[i]));
    return {
      lat: parseFloat(obj.latitude),
      lon: parseFloat(obj.longitude),
      brightness: parseFloat(obj.bright_ti4 || obj.brightness || "0"),
      acq_date: obj.acq_date,
      acq_time: obj.acq_time,
      confidence: obj.confidence,
      frp: parseFloat(obj.frp || "0"),
      daynight: obj.daynight,
    };
  });
}

async function fetchZone(zone, key) {
  const [lamin, lomin, lamax, lomax] = zone.bbox;
  // FIRMS espera "west,south,east,north"
  const box = `${lomin},${lamin},${lomax},${lamax}`;
  const url = `${FIRMS_BASE}/${key}/${SOURCE}/${box}/${DAY_RANGE}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`[firms] ${zone.id} ${res.status}`);
    return [];
  }
  const text = await res.text();
  return parseCsv(text);
}

export async function collectFires() {
  const key = process.env.FIRMS_MAP_KEY;
  if (!key) {
    console.warn("[firms] sin FIRMS_MAP_KEY, saltando");
    return { perZone: {}, total: 0 };
  }
  const perZone = {};
  let total = 0;
  for (const zone of ZONES) {
    try {
      const fires = await fetchZone(zone, key);
      perZone[zone.id] = { name: zone.name, count: fires.length, fires };
      total += fires.length;
    } catch (err) {
      console.warn(`[firms] ${zone.id} err: ${err.message}`);
    }
  }
  return { perZone, total, collectedAt: new Date().toISOString() };
}
