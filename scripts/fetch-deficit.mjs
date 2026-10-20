import fs from 'node:fs';

const COUNTRIES = ['USA', 'DEU', 'FRA', 'JPN', 'CHN', 'AUS'];

async function imfFiscal() {
  const ids = COUNTRIES.join(',');
  const url = `https://www.imf.org/external/datamapper/api/v1/GGXCNL_NGDP/${ids}`;
  const r = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'MacroWatch/1.6' },
    signal: AbortSignal.timeout(40000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`IMF HTTP ${r.status}`);
  const j = await r.json();
  return j?.values?.GGXCNL_NGDP || {};
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const data = payload.data || {};
const histories = payload.histories || {};
const errors = [];

try {
  const byCountry = await imfFiscal();
  const nowY = new Date().getFullYear();
  for (const id of COUNTRIES) {
    const series = byCountry[id];
    if (!series || typeof series !== 'object') {
      errors.push(`Defizit ${id}: keine IMF-Daten`);
      continue;
    }
    const hist = Object.entries(series)
      .map(([year, value]) => ({
        period: String(year),
        value: Math.round(Number(value) * 100) / 100
      }))
      .filter(p => Number.isFinite(p.value) && p.period >= '2020')
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-8);

    if (!hist.length) {
      errors.push(`Defizit ${id}: keine Jahre ab 2020`);
      continue;
    }

    const latest =
      [...hist].reverse().find(p => Number(p.period) <= nowY) || hist.at(-1);

    data[id] = data[id] || {};
    data[id].deficit = {
      value: latest.value,
      date: `IMF · ${latest.period}`,
      source: 'IMF DataMapper · GGXCNL_NGDP (Net lending/borrowing % GDP)'
    };
    histories[`${id}-deficit`] = hist;
  }
} catch (e) {
  errors.push(`Defizit: ${e.message}`);
}

payload.data = data;
payload.histories = histories;
payload.updatedAt = new Date().toISOString();
payload.errors = [
  ...(payload.errors || []).filter(e => !/^Defizit/i.test(e)),
  ...errors
];
fs.writeFileSync('data.json', JSON.stringify(payload, null, 2) + '\n');
console.log(
  'deficit',
  COUNTRIES.map(id => `${id}:${data[id]?.deficit?.value ?? '—'}(${(histories[`${id}-deficit`] || []).length})`).join(' ')
);
