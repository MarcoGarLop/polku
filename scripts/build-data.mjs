// Builds processed data from data/raw (run fetch-data.mjs first). Run: node scripts/build-data.mjs
// Outputs:
//   data/processed/indicators.json            -> regional drivers for packages/sim (REAL public data)
//   apps/web/public/data/regions.geojson      -> 22 wellbeing counties (+ Helsinki), simplified
//   apps/web/public/data/municipalities.geojson -> 300+ municipalities with population and distance to hospital
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'data', 'raw');
const read = async (f) => JSON.parse(await readFile(join(RAW, f), 'utf8'));
const seed = JSON.parse(await readFile(join(ROOT, 'data', 'seed', 'regions.json'), 'utf8'));

// Official wellbeing services county code -> Polku region id
const HVA = {
  '01': 'ita-uusimaa', '02': 'keski-uusimaa', '03': 'lansi-uusimaa', '04': 'vantaa-kerava', '05': 'varsinais-suomi',
  '06': 'satakunta', '07': 'kanta-hame', '08': 'pirkanmaa', '09': 'paijat-hame', '10': 'kymenlaakso', '11': 'etela-karjala',
  '12': 'etela-savo', '13': 'pohjois-savo', '14': 'pohjois-karjala', '15': 'keski-suomi', '16': 'etela-pohjanmaa',
  '17': 'pohjanmaa', '18': 'keski-pohjanmaa', '19': 'pohjois-pohjanmaa', '20': 'kainuu', '21': 'lappi', '90': 'helsinki',
};
const seedById = new Map(seed.regions.map((r) => [r.id, r]));
const rtHospitals = seed.regions.filter((r) => r.hospital.has_radiotherapy === true).map((r) => r.hospital);

/* ---------- geometry helpers ---------- */
const q = (x) => Math.round(x * 1000) / 1000;
function simplifyRing(ring) {
  const out = [];
  for (const [x, y] of ring) {
    const p = [q(x), q(y)];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  if (out.length && (out[0][0] !== out[out.length - 1][0] || out[0][1] !== out[out.length - 1][1])) out.push(out[0]);
  return out.length >= 4 ? out : null;
}
function simplifyGeometry(g) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  const outPolys = polys
    .map((poly) => poly.map(simplifyRing).filter(Boolean))
    .filter((poly) => poly.length && ringArea(poly[0]) > 1e-6);
  return { type: 'MultiPolygon', coordinates: outPolys };
}
function ringArea(r) {
  let a = 0;
  for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
  return Math.abs(a / 2);
}
function ringCentroid(r) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < r.length - 1; i++) {
    const f = r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
    a += f; cx += (r[i][0] + r[i + 1][0]) * f; cy += (r[i][1] + r[i + 1][1]) * f;
  }
  return a === 0 ? r[0] : [cx / (3 * a), cy / (3 * a)];
}
function centroid(g) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  let best = polys[0][0];
  for (const p of polys) if (ringArea(p[0]) > ringArea(best)) best = p[0];
  const c = ringCentroid(best);
  return [Math.round(c[0] * 1e4) / 1e4, Math.round(c[1] * 1e4) / 1e4];
}
function haversineKm([lon1, lat1], [lon2, lat2]) {
  const R = 6371, toR = Math.PI / 180;
  const dLat = (lat2 - lat1) * toR, dLon = (lon2 - lon1) * toR;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/* ---------- StatFin key figures ---------- */
const kf = await read('statfin_11ra_keyfigures.json');
const areaDim = Object.keys(kf.dimension).find((k) => k.startsWith('alue'));
const areaIdx = kf.dimension[areaDim].category.index;
const contentIdx = kf.dimension.contentscode.category.index;
const contentLabels = kf.dimension.contentscode.category.label;
const nContent = Object.keys(contentIdx).length;
const cPop = Object.keys(contentLabels).find((k) => /Population/.test(contentLabels[k]));
const c65 = Object.keys(contentLabels).find((k) => /65 or over/.test(contentLabels[k]));
const cFor = Object.keys(contentLabels).find((k) => /foreign-language/.test(contentLabels[k]));
const statYear = Object.keys(kf.dimension[Object.keys(kf.dimension).find((k) => k.startsWith('timeperiod'))].category.index)[0];
const kfValue = (area, content) => {
  const i = areaIdx[area];
  return i == null ? null : kf.value[i * nContent + contentIdx[content]];
};
const keyFigures = (area) => ({ population: kfValue(area, cPop), pct65: kfValue(area, c65), foreignPct: kfValue(area, cFor) });

/* ---------- municipalities ---------- */
const mapRows = await read('kunta_hyvinvointialue_2026.json');
const kuntaToHva = new Map(mapRows.map((m) => [m.sourceLocalId.split('/')[1], m.targetLocalId.split('/')[1]]));
const kunta = await read('kunta1000k_2026.geojson');
const munis = [];
for (const f of kunta.features) {
  const code = f.properties.kunta;
  const regionId = HVA[kuntaToHva.get(code)];
  if (!regionId) continue; // Åland
  const hosp = seedById.get(regionId).hospital;
  const c = centroid(f.geometry);
  const kfm = keyFigures('KU' + code);
  let nearestRt = rtHospitals[0], dRt = Infinity;
  for (const h of rtHospitals) {
    const d = haversineKm(c, [h.lon, h.lat]);
    if (d < dRt) { dRt = d; nearestRt = h; }
  }
  munis.push({
    type: 'Feature',
    geometry: simplifyGeometry(f.geometry),
    properties: {
      code, name: f.properties.nimi, nameSv: f.properties.namn, regionId,
      population: kfm.population, pct65: kfm.pct65, foreignPct: kfm.foreignPct,
      centroid: c,
      distCentralKm: Math.round(haversineKm(c, [hosp.lon, hosp.lat])),
      distRtKm: Math.round(dRt), nearestRtHospital: nearestRt.id,
    },
  });
}

/* ---------- regions ---------- */
const hva = await read('hyvinvointialue1000k_2026.geojson');
const regions = [];
for (const f of hva.features) {
  const regionId = HVA[f.properties.hyvinvointialue];
  if (!regionId) continue;
  const kfr = keyFigures('HVA' + f.properties.hyvinvointialue);
  regions.push({
    type: 'Feature',
    geometry: simplifyGeometry(f.geometry),
    properties: {
      id: regionId, code: f.properties.hyvinvointialue, nameFi: f.properties.nimi, nameEn: seedById.get(regionId).name_en,
      population: kfr.population, pct65: kfr.pct65, foreignPct: kfr.foreignPct, centroid: centroid(f.geometry),
    },
  });
}

/* ---------- Sotkanet indicators ---------- */
const sotRegions = (await read('sotkanet_regions.json')).filter((r) => r.category === 'HYVINVOINTIALUE');
const sotIdToRegion = new Map(sotRegions.map((r) => [r.id, HVA[r.code]]));
async function latestByRegion(indicator) {
  const rows = (await read(`sotkanet_${indicator}.json`)).filter((x) => sotIdToRegion.get(x.region) && x.value != null);
  const out = {};
  for (const x of rows) {
    const id = sotIdToRegion.get(x.region);
    if (!out[id] || x.year > out[id].year) out[id] = { value: x.value, year: x.year };
  }
  return out;
}
const pcAccess = await latestByRegion(6411);
const specWait = await latestByRegion(3336);
const tertiary = await latestByRegion(3195);

/* ---------- regional indicators ---------- */
const popW = (arr, key) => {
  const tw = arr.reduce((s, m) => s + (m.properties.population || 0), 0);
  return arr.reduce((s, m) => s + (m.properties.population || 0) * m.properties[key], 0) / tw;
};
const nat = { pct65: 0, foreign: 0, pop: 0 };
for (const r of regions) {
  nat.pop += r.properties.population;
  nat.pct65 += r.properties.population * r.properties.pct65;
  nat.foreign += r.properties.population * r.properties.foreignPct;
}
nat.pct65 /= nat.pop;
nat.foreign /= nat.pop;
const NAV_NATIONAL = 0.35;

const indicators = {
  _readme: 'GENERATED by scripts/build-data.mjs from public data. Do not edit by hand. Values feed the regional drivers in packages/sim (docs/04 §3).',
  generated: new Date().toISOString().slice(0, 10),
  sources: {
    pc_access: 'THL Sotkanet 6411: GP non-urgent visit waited > 7 days after needs assessment, % of visits (latest year)',
    spec_wait: 'THL Sotkanet 3336: waited > 6 months for specialist care during the year / 10 000 inhabitants (latest year)',
    ses: 'Inverse of THL Sotkanet 3195: tertiary education, % of population 20+ (value stored = 100 / %)',
    dist_central: 'Population-weighted straight-line km from municipality centroid to the county central/university hospital (Statistics Finland municipalities 2026 + StatFin population ' + statYear + ')',
    dist_rt: 'Population-weighted straight-line km to the nearest hospital with confirmed radiotherapy in data/seed/regions.json (unconfirmed ones excluded: conservative)',
    share_navigation_barrier: 'ASSUMPTION: national 0.35 scaled by 0.7·(share 65+ / national) + 0.3·(foreign-language share / national), StatFin 11ra ' + statYear,
  },
  regions: {},
  raw: {},
};
for (const r of regions) {
  const id = r.properties.id;
  const ms = munis.filter((m) => m.properties.regionId === id && m.properties.population);
  const p = r.properties;
  const entry = {
    dist_central: Math.round(popW(ms, 'distCentralKm') * 10) / 10,
    dist_rt: Math.round(popW(ms, 'distRtKm') * 10) / 10,
  };
  if (pcAccess[id]) entry.pc_access = pcAccess[id].value;
  if (specWait[id]) entry.spec_wait = specWait[id].value;
  if (tertiary[id]) entry.ses = Math.round((100 / tertiary[id].value) * 1000) / 1000;
  entry.share_navigation_barrier = Math.round(NAV_NATIONAL * (0.7 * (p.pct65 / nat.pct65) + 0.3 * (p.foreignPct / nat.foreign)) * 1000) / 1000;
  indicators.regions[id] = entry;
  indicators.raw[id] = {
    population: p.population, pct65: p.pct65, foreignPct: p.foreignPct,
    gpWaitOver7dPct: pcAccess[id] ?? null, specialistOver6mPer10k: specWait[id] ?? null, tertiaryEduPct: tertiary[id] ?? null,
  };
  Object.assign(r.properties, { distCentralKm: entry.dist_central, distRtKm: entry.dist_rt });
}

await writeFile(join(ROOT, 'data', 'processed', 'indicators.json'), JSON.stringify(indicators, null, 2));
const WEB = join(ROOT, 'apps', 'web', 'public', 'data');
await mkdir(WEB, { recursive: true });
await writeFile(join(WEB, 'regions.geojson'), JSON.stringify({ type: 'FeatureCollection', features: regions }));
await writeFile(join(WEB, 'municipalities.geojson'), JSON.stringify({ type: 'FeatureCollection', features: munis }));

/* ---------- geographic context: neighbours + Åland (own health system) ---------- */
const context = [];
try {
  const ne = await read('ne_50m_admin_0_countries.geojson');
  for (const f of ne.features) {
    const a3 = f.properties.ADM0_A3;
    if (!['SWE', 'NOR', 'DNK'].includes(a3)) continue; // keep the map calm: only the Nordic comparators
    const geom = simplifyGeometry(f.geometry);
    // mainland only: drop Svalbard, Bear Island and Jan Mayen (they float at the top of the map)
    geom.coordinates = geom.coordinates.filter((poly) => {
      const r = poly[0];
      const lat = r.reduce((s, c) => s + c[1], 0) / r.length;
      const lon = r.reduce((s, c) => s + c[0], 0) / r.length;
      return lat < 71.3 && lon > 4.5;
    });
    context.push({ type: 'Feature', geometry: geom, properties: { kind: 'country', id: a3, name: f.properties.NAME_EN || f.properties.NAME } });
  }
} catch {
  console.warn('! Natural Earth countries not found in data/raw — run fetch-data.mjs');
}
const aland = hva.features.find((f) => f.properties.hyvinvointialue === '91');
if (aland) context.push({ type: 'Feature', geometry: simplifyGeometry(aland.geometry), properties: { kind: 'aland', id: 'aland', name: 'Åland (own health system)' } });
await writeFile(join(WEB, 'context.geojson'), JSON.stringify({ type: 'FeatureCollection', features: context }));

console.log(`regions ${regions.length} · municipalities ${munis.length} · StatFin ${statYear}`);
for (const [id, e] of Object.entries(indicators.regions)) console.log(id.padEnd(18), JSON.stringify(e));
