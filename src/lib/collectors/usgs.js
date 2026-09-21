// USGS Earthquake feed. Últimas 24h M≥2.5. Los ensayos nucleares aparecen aquí
// con firma sísmica peculiar (foco muy superficial, magnitud discreta, tectónica no coherente).

const URL_24H = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson";

export async function collectQuakes() {
  const res = await fetch(URL_24H);
  if (!res.ok) return { features: [], collectedAt: new Date().toISOString() };
  const geo = await res.json();
  const features = (geo.features || []).map((f) => ({
    mag: f.properties.mag,
    place: f.properties.place,
    time: f.properties.time,
    depth: f.geometry.coordinates[2],
    lon: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    url: f.properties.url,
    type: f.properties.type,
    tsunami: f.properties.tsunami,
  }));
  // Foco muy superficial (<3 km) es sospechoso de origen humano
  const suspicious = features.filter((f) => f.depth < 3 && f.mag >= 3.5);
  return { features, suspicious, collectedAt: new Date().toISOString() };
}
