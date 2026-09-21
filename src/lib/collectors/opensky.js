import { ZONES } from "../zones.js";
import { classifyHex, callsignLikelyMilitary } from "../military-hex.js";

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
  const allMilitary = [];

  for (const zone of ZONES) {
    let states = [];
    try {
      states = await fetchZone(zone, auth);
    } catch (err) {
      console.warn(`[opensky] ${zone.id} error: ${err.message}`);
      continue;
    }

    const zoneMilitary = [];
    for (const s of states) {
      const cls = classifyHex(s.icao24);
      const csMil = callsignLikelyMilitary(s.callsign);
      if ((cls && cls.military) || csMil) {
        zoneMilitary.push({
          ...s,
          zone: zone.id,
          country: cls?.country || null,
          reason: cls?.military ? "hex_range" : "callsign",
        });
      }
    }

    perZone[zone.id] = {
      name: zone.name,
      total: states.length,
      military: zoneMilitary.length,
      contacts: zoneMilitary,
    };
    allMilitary.push(...zoneMilitary);

    // Cortesía: pequeño delay entre zonas para no saturar OpenSky anon
    await new Promise((r) => setTimeout(r, 800));
  }

  return { perZone, allMilitary, collectedAt: new Date().toISOString() };
}
