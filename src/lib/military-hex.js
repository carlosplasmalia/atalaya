// Rangos ICAO24 asignados EXCLUSIVAMENTE a fuerzas militares.
// Fuente: Mictronics ICAO ranges, cross-check con ADS-B Exchange military categories.
// Nota: los rangos "de país" (0x14xxxx Rusia, 0x78xxxx China, 0x73xxxx Israel, 0x86xxxx Japón)
// son ICAO de aviación CIVIL de esos países, NO militar. Los descartamos deliberadamente
// para evitar falsos positivos masivos con aerolíneas comerciales (Cathay, China Southern, ANA...).

// Rangos ICAO24 exclusivamente militares. Ultra conservador para evitar falsos
// positivos con civil (Iberia, Vueling, Cathay, ANA salían clasificadas mal).
// Solo incluimos rangos donde HAY consenso público de que son 100% militares.
export const MIL_RANGES = [
  // USA DoD (todas las ramas). Bloque FAA asignado a US military.
  { start: 0xae0000, end: 0xafffff, country: "US" },
  // UK military (RAF + Fleet Air Arm). Bloque estricto verificado.
  { start: 0x43c000, end: 0x43ffff, country: "UK" },
];

export function classifyHex(hex) {
  if (!hex) return null;
  const n = parseInt(hex, 16);
  if (Number.isNaN(n)) return null;
  for (const r of MIL_RANGES) {
    if (n >= r.start && n <= r.end) return { military: true, country: r.country };
  }
  return { military: false };
}

// Callsigns exclusivamente militares. Filtro estricto para evitar colisiones
// con aerolíneas comerciales (CPA, CSN, ANA, IBE, VLG, etc.).
// Fuente: convenciones ATC militares USA/OTAN.
const CALLSIGN_EXACT_PREFIXES = [
  "RCH",     // USAF Air Mobility Command "Reach"
  "REACH",
  "SPAR",    // USAF Special Air Missions
  "PAT",     // US Army Priority Air Transport
  "SAM",     // USAF Special Air Mission (VIP)
  "MC",      // Marine Corps
  "CNV",     // US Navy Reserve
  "CG",      // Coast Guard
  "RRR",     // RAF Ascot
  "ASCOT",
  "COMET",
  "MMF",     // Multinational MRTT Fleet
  "GAF",     // German Air Force
  "GAM",
  "FRAF",    // French Air Force
  "COTAM",   // French Air Mobility
  "FNY",     // French Navy
  "IAM",     // Italian Air Force
  "IAF",     // Israeli Air Force
  "TUAF",    // Turkish Air Force
  "SUI",     // Swiss Air Force
  "POLAF",   // Polish Air Force
  "JASDF",   // Japan Air Self-Defense Force
  "NATO",
  "AWACS",
  "MAGMA",   // OTAN AWACS
  "OTIS",    // E-3 AWACS USA
  "DARK",    // MQ-9 Reaper family
  "BLKCT",   // U-2 Black Cat
];

// Sufijos numéricos aceptados (para dejar solo callsigns claros tipo "RCH471").
export function callsignLikelyMilitary(cs) {
  if (!cs) return false;
  const c = cs.trim().toUpperCase();
  if (c.length < 4) return false;
  return CALLSIGN_EXACT_PREFIXES.some((p) => {
    if (!c.startsWith(p)) return false;
    // Después del prefijo debe venir un dígito (para descartar coincidencias como "CGA" airline vs "CG1" coast guard)
    const rest = c.slice(p.length);
    return /^\d/.test(rest);
  });
}
