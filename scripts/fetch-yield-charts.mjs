import fs from 'node:fs';

const FRED_10Y = {
  DEU: 'IRLTLT01DEM156N',
  FRA: 'IRLTLT01FRM156N',
  JPN: 'IRLTLT01JPM156N',
  AUS: 'IRLTLT01AUM156N'
};

async function fredSeries(id, start = '2026-04-01') {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${start}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'MacroWatch/1.4 (+https://hossein7935.github.io/)' },
    signal: AbortSignal.timeout(30000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`FRED ${id} HTTP ${r.status}`);
  const text = await r.text();
  const rows = [];
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const [date, val] = line.split(',');
    if (val && val !== '.' && Number.isFinite(Number(val))) {
      rows.push({ period: date.slice(0, 10), value: Math.round(Number(val) * 1000) / 1000 });
    }
  }
  return rows;
}

function sampleWeekly(rows, maxPts = 26) {
  if (rows.length <= maxPts) return rows;
  const step = Math.max(1, Math.floor(rows.length / maxPts));
  const out = [];
  for (let i = 0; i < rows.length; i += step) out.push(rows[i]);
  if (out.at(-1)?.period !== rows.at(-1)?.period) out.push(rows.at(-1));
  return out.slice(-maxPts);
}

function mergeHistory(existing, incoming, maxPts = 30) {
  const map = new Map();
  for (const p of existing || []) {
    if (p?.period != null && Number.isFinite(Number(p.value))) map.set(String(p.period), Number(p.value));
  }
  for (const p of incoming || []) {
    if (p?.period != null && Number.isFinite(Number(p.value))) map.set(String(p.period), Number(p.value));
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-maxPts)
    .map(([period, value]) => ({ period, value: Math.round(value * 1000) / 1000 }));
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const data = payload.data || {};
const histories = payload.histories || {};
const errors = [];
const countries = ['CHN', 'USA', 'JPN', 'FRA', 'DEU', 'AUS'];

try {
  const y2 = sampleWeekly(await fredSeries('DGS2', '2026-04-01'));
  const y10 = sampleWeekly(await fredSeries('DGS10', '2026-04-01'));
  histories['USA-y2'] = y2;
  histories['USA-y10'] = y10;
} catch (e) {
  errors.push(`Yield-Charts USA FRED: ${e.message}`);
}

for (const [id, seriesId] of Object.entries(FRED_10Y)) {
  try {
    const rows = await fredSeries(seriesId, '2025-10-01');
    const recent = rows.filter(p => p.period >= '2026-04-01');
    const use = recent.length >= 3 ? recent : rows.slice(-6);
    histories[`${id}-y10`] = mergeHistory(histories[`${id}-y10`], use, 12);
  } catch (e) {
    errors.push(`Yield-Charts ${id} 10Y: ${e.message}`);
  }
}

const today = new Date().toISOString().slice(0, 10);
for (const id of countries) {
  for (const key of ['y2', 'y10']) {
    const cur = data[id]?.[key];
    if (!cur || !Number.isFinite(Number(cur.value))) continue;
    const histKey = `${id}-${key}`;
    const point = { period: (cur.date || today).toString().slice(0, 10), value: Number(cur.value) };
    if (point.period.includes('T')) point.period = point.period.slice(0, 10);
    histories[histKey] = mergeHistory(histories[histKey], [point], id === 'USA' ? 30 : 24);
  }
}

payload.histories = histories;
payload.updatedAt = new Date().toISOString();
payload.errors = [
  ...(payload.errors || []).filter(e => !/Yield-Charts/i.test(e)),
  ...errors
];
fs.writeFileSync('data.json', JSON.stringify(payload, null, 2) + '\n');

const n = (k) => (histories[k] || []).length;
console.log('charts', 'USA-y2', n('USA-y2'), 'USA-y10', n('USA-y10'), 'DEU-y10', n('DEU-y10'), 'FRA-y10', n('FRA-y10'), 'JPN-y10', n('JPN-y10'), 'AUS-y10', n('AUS-y10'));
