import { ZONES } from "../zones.js";
import { classifyHex, callsignLikelyMilitary } from "../military-hex.js";
import { enrichContacts } from "../aircraft-lookup.js";

const OPENSKY_BASE = "https://opensky-network.org/api";

async function fetchZone(zone, auth) {
  const [lamin, lomin, lamax, lomax] = zone.bbox;
  const url = `${OPENSKY_BASE}/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
  const headers = {};
  if (auth) headers["Authorization"] = "Basic " + Buffer.from(auth).toString("base64");
  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.warn(`[opensky] ${zone.id} ${res.status}`);
    return [];
  }
  const json = await res.json();
  if (!json.states) return [];
  return json.states.map((s) => ({
    icao24: s[0],
    callsign: (s[1] || "").trim(),
    origin_country: s[2],
    time_position: s[3],
    lon: s[5],
    lat: s[6],
    baro_altitude: s[7],
    on_ground: s[8],
    velocity: s[9],
    heading: s[10],
    vertical_rate: s[11],
    geo_altitude: s[13],
    squawk: s[14],
  }));
}

export async function collectFlights() {
  const auth = process.env.OPENSKY_USER && process.env.OPENSKY_PASS
    ? `${process.env.OPENSKY_USER}:${process.env.OPENSKY_PASS}`
    : null;

  const perZone = {};
  const seedCandidates = [];

  for (const zone of ZONES) {
    let states = [];
    try {
      states = await fetchZone(zone, auth);
    } catch (err) {
      console.warn(`[opensky] ${zone.id} error: ${err.message}`);
      continue;
    }

    const candidates = [];
    for (const s of states) {
      const cls = classifyHex(s.icao24);
      const csMil = callsignLikelyMilitary(s.callsign);
      if ((cls && cls.military) || csMil) {
        candidates.push({
          ...s,
          zone: zone.id,
          country: cls?.country || null,
          reasonInit: cls?.military ? "hex_range" : "callsign",
        });
      }
    }

    perZone[zone.id] = {
      name: zone.name,
      total: states.length,
      candidates,
    };
    seedCandidates.push(...candidates);

    await new Promise((r) => setTimeout(r, 800));
  }

  // Enriquecer todos los candidatos con hexdb.io (tipo, operador, registro).
  console.log(`[opensky] enriqueciendo ${seedCandidates.length} candidatos con hexdb.io`);
  const enriched = await enrichContacts(seedCandidates, { concurrency: 5 });
  const byIcao = new Map(enriched.map((c) => [c.icao24, c]));

  // Rebuild perZone con clasificación final. Militar si:
  //   - hex_range confirmado (US DoD ae0000-afffff), o
  //   - metadata de operador coincide con military patterns, o
  //   - callsign militar Y meta lookup no lo desmiente como civil claro
  const allMilitary = [];
  for (const [zoneId, z] of Object.entries(perZone)) {
    const finalContacts = [];
    for (const c of z.candidates) {
      const enr = byIcao.get(c.icao24) || c;
      const isMil =
        c.reasonInit === "hex_range" && c.country === "US" ||
        enr.meta_military === true ||
        (c.reasonInit === "callsign" && !enr.meta?.operator);
      if (!isMil) continue;
      finalContacts.push({
        icao24: c.icao24,
        callsign: c.callsign,
        origin_country: c.origin_country,
        lat: c.lat,
        lon: c.lon,
        baro_altitude: c.baro_altitude,
        velocity: c.velocity,
        heading: c.heading,
        on_ground: c.on_ground,
        squawk: c.squawk,
        zone: zoneId,
        country: c.country,
        reason: enr.meta_military ? "meta_military" : c.reasonInit,
        registration: enr.meta?.registration || null,
        aircraft_type: enr.meta?.type || null,
        type_code: enr.meta?.typeCode || null,
        manufacturer: enr.meta?.manufacturer || null,
        operator: enr.meta?.operator || null,
      });
    }
    z.military = finalContacts.length;
    z.contacts = finalContacts;
    delete z.candidates;
    allMilitary.push(...finalContacts);
  }

  return { perZone, allMilitary, collectedAt: new Date().toISOString() };
}
