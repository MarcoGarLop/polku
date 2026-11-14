// Downloads the public raw data Polku uses into data/raw/. Run: node scripts/fetch-data.mjs
// Sources: Statistics Finland (geo.stat.fi WFS, PxWeb StatFin, classification API) and THL Sotkanet.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAW = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'raw');
await mkdir(RAW, { recursive: true });

const WFS = 'https://geo.stat.fi/geoserver/tilastointialueet/wfs?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&srsName=EPSG:4326&typeNames=tilastointialueet:';
const SOTKANET = 'https://sotkanet.fi/rest/1.1';
const PX = 'https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin/vaerak/11ra.px';

async function save(name, url, init) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const text = await res.text();
  await writeFile(join(RAW, name), text);
  console.log(`✓ ${name} (${(text.length / 1024).toFixed(0)} kB)`);
  return text;
}

await save('hyvinvointialue1000k_2026.geojson', WFS + 'hyvinvointialue1000k_2026');
await save('kunta1000k_2026.geojson', WFS + 'kunta1000k_2026');
await save(
  'kunta_hyvinvointialue_2026.json',
  'https://data.stat.fi/api/classifications/v2/correspondenceTables/kunta_1_20260101%23hyvinvointialue_1_20260101/maps?content=data&format=json&lang=fi',
);
await save('sotkanet_regions.json', `${SOTKANET}/regions`);
// Natural Earth (public domain) for the neighbouring countries drawn as map context.
await save('ne_50m_admin_0_countries.geojson', 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson');
// 6411: GP non-urgent visit wait > 7 days (% of visits) · 3336: waited > 6 months for specialist care / 10 000 inhabitants
// 3195: tertiary education, % of 20+
for (const id of [6411, 3336, 3195]) {
  await save(`sotkanet_${id}.json`, `${SOTKANET}/json?indicator=${id}&years=2022&years=2023&years=2024&years=2025&genders=total`);
}

// StatFin 11ra key figures: population, share 65+, share foreign-language speakers, for municipalities and wellbeing counties.
const meta = JSON.parse(await (await fetch(PX)).text());
const area = meta.variables.find((v) => v.code.startsWith('alue'));
const content = meta.variables.find((v) => v.code === 'contentscode');
const year = meta.variables.find((v) => v.code.startsWith('timeperiod'));
const pick = (re) => content.values[content.valueTexts.findIndex((t) => re.test(t))];
const contents = [pick(/^Population 31 Dec/), pick(/aged 65 or over, %/), pick(/Share of foreign-language speakers/)];
const areas = area.values.filter((v) => /^(KU|HVA)/.test(v));
const lastYear = year.values[year.values.length - 1];
const query = {
  query: [
    { code: area.code, selection: { filter: 'item', values: areas } },
    { code: 'contentscode', selection: { filter: 'item', values: contents } },
    { code: year.code, selection: { filter: 'item', values: [lastYear] } },
  ],
  response: { format: 'json-stat2' },
};
await save('statfin_11ra_keyfigures.json', PX, { method: 'POST', body: JSON.stringify(query), headers: { 'Content-Type': 'application/json' } });
console.log(`StatFin year: ${lastYear}`);
