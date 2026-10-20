import fs from 'node:fs';

async function fredCsv(id, start) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${start}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'MacroWatch/1.6 (+https://hossein7935.github.io/)' },
    signal: AbortSignal.timeout(35000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`FRED ${id} HTTP ${r.status}`);
  const text = await r.text();
  if (text.includes('<html')) throw new Error(`FRED ${id} blocked`);
  const rows = [];
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const [date, val] = line.split(',');
    if (val && val !== '.' && Number.isFinite(Number(val))) {
      rows.push({ period: date.slice(0, 10), value: Number(val) });
    }
  }
  return rows;
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const data = payload.data || {};
const histories = payload.histories || {};
const errors = [];

for (const id of ['CHN', 'JPN', 'FRA', 'DEU', 'AUS']) {
  if (data[id]) delete data[id].reservesGdp;
  delete histories[`${id}-reservesGdp`];
}

try {
  const [reserves, gdp] = await Promise.all([
    fredCsv('TOTRESNS', '2023-01-01'),
    fredCsv('GDP', '2022-01-01')
  ]);
  if (!reserves.length || !gdp.length) throw new Error('keine Reserven/BIP-Daten');

  const gdpSorted = [...gdp].sort((a, b) => a.period.localeCompare(b.period));
  const series = [];
  for (const r of reserves) {
    let g = null;
    for (const row of gdpSorted) {
      if (row.period <= r.period) g = row.value;
      else break;
    }
    if (g == null || g === 0) continue;
    series.push({
      period: r.period.slice(0, 7),
      value: Math.round((r.value / g) * 10000) / 100
    });
  }
  const map = new Map();
  for (const p of series) map.set(p.period, p.value);
  const hist = [...map.entries()]
    .map(([period, value]) => ({ period, value }))
    .filter(p => p.period >= '2023-10')
    .slice(-40);

  if (!hist.length) throw new Error('keine Ratio-Punkte');

  const last = hist.at(-1);
  data.USA = data.USA || {};
  data.USA.reservesGdp = {
    value: last.value,
    date: last.period,
    source: 'FRED · TOTRESNS / GDP (Bank reserves vs nominal GDP)'
  };
  histories['USA-reservesGdp'] = hist;
} catch (e) {
  errors.push(`Reserves/GDP USA: ${e.message}`);
}

payload.data = data;
payload.histories = histories;
payload.updatedAt = new Date().toISOString();
payload.errors = [
  ...(payload.errors || []).filter(e => !/Reserves\/GDP/i.test(e)),
  ...errors
];
fs.writeFileSync('data.json', JSON.stringify(payload, null, 2) + '\n');
console.log(
  'reservesGdp',
  data.USA?.reservesGdp?.value,
  'pts',
  (histories['USA-reservesGdp'] || []).length
);
