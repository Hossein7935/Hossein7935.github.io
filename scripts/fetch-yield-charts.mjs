import fs from 'node:fs';

const AUS_Y2_SEED = [
  { period: '2025-10', value: 3.437 },
  { period: '2025-11', value: 3.669 },
  { period: '2025-12', value: 4.008 },
  { period: '2026-01', value: 4.08 },
  { period: '2026-02', value: 4.23 },
  { period: '2026-03', value: 4.537 },
  { period: '2026-04', value: 4.663 },
  { period: '2026-05', value: 4.658 },
  { period: '2026-06', value: 4.497 },
  { period: '2026-07', value: 4.517 },
  { period: '2026-08', value: 4.573 },
  { period: '2026-09', value: 4.922 }
];

const FRED_10Y = {
  DEU: 'IRLTLT01DEM156N',
  FRA: 'IRLTLT01FRM156N',
  JPN: 'IRLTLT01JPM156N',
  AUS: 'IRLTLT01AUM156N'
};

async function fredSeries(id, start = '2026-04-01') {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${start}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'MacroWatch/1.5 (+https://hossein7935.github.io/)' },
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

async function ecb2Y(start = '2026-04-01') {
  const url = `https://data-api.ecb.europa.eu/service/data/YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_2Y?startPeriod=${start}&format=csvdata`;
  const r = await fetch(url, {
    headers: { Accept: 'text/csv', 'User-Agent': 'MacroWatch/1.5' },
    signal: AbortSignal.timeout(60000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`ECB 2Y HTTP ${r.status}`);
  const text = await r.text();
  const rows = [];
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const m = line.match(/(20\d{2}-\d{2}-\d{2}),([0-9.]+)/);
    if (m) rows.push({ period: m[1], value: Math.round(Number(m[2]) * 1000) / 1000 });
  }
  if (!rows.length) throw new Error('ECB 2Y keine Punkte');
  return rows;
}

async function japan2Y() {
  const url = 'https://www.mof.go.jp/jgbs/reference/interest_rate/data/jgbcm_all.csv';
  const r = await fetch(url, {
    headers: { 'User-Agent': 'MacroWatch/1.5' },
    signal: AbortSignal.timeout(60000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`MOF JGB HTTP ${r.status}`);
  const buf = await r.arrayBuffer();
  const text = new TextDecoder('shift-jis').decode(buf);
  const rows = [];
  for (const line of text.trim().split(/\r?\n/).slice(2)) {
    const parts = line.split(',');
    if (parts.length < 3) continue;
    const d = parts[0].trim();
    if (!d.startsWith('R')) continue;
    try {
      const [y, m, day] = d.slice(1).split('.').map(Number);
      const iso = `${2018 + y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (iso < '2026-04-01') continue;
      const v = Number(parts[2]);
      if (!Number.isFinite(v)) continue;
      rows.push({ period: iso, value: Math.round(v * 1000) / 1000 });
    } catch { /* skip */ }
  }
  return rows;
}

async function chinaYields(symbol) {
  // Sina Finance: China gov bond daily (CN2YT, CN10YT)
  const url = `https://bond.finance.sina.com.cn/hq/gb/daily?symbol=${symbol}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'MacroWatch/1.5', Accept: 'application/json' },
    signal: AbortSignal.timeout(30000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`Sina ${symbol} HTTP ${r.status}`);
  const j = await r.json();
  const data = j?.result?.data || j?.data || [];
  const rows = [];
  for (const x of data) {
    const d = x.d || x.date;
    const c = Number(x.c ?? x.close);
    if (!d || !Number.isFinite(c)) continue;
    if (String(d) < '2026-04-01') continue;
    rows.push({ period: String(d).slice(0, 10), value: Math.round(c * 1000) / 1000 });
  }
  rows.sort((a, b) => a.period.localeCompare(b.period));
  return rows;
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const data = payload.data || {};
const histories = payload.histories || {};
const errors = [];
const countries = ['CHN', 'USA', 'JPN', 'FRA', 'DEU', 'AUS'];

try {
  histories['USA-y2'] = sampleWeekly(await fredSeries('DGS2', '2026-04-01'));
  histories['USA-y10'] = sampleWeekly(await fredSeries('DGS10', '2026-04-01'));
} catch (e) {
  errors.push(`Yield-Charts USA FRED: ${e.message}`);
}

try {
  const ecb = sampleWeekly(await ecb2Y('2026-04-01'));
  histories['DEU-y2'] = mergeHistory([], ecb, 28);
  histories['FRA-y2'] = mergeHistory([], ecb, 28);
} catch (e) {
  errors.push(`Yield-Charts ECB 2Y: ${e.message}`);
}

try {
  const jp = sampleWeekly(await japan2Y());
  if (jp.length) histories['JPN-y2'] = mergeHistory([], jp, 28);
} catch (e) {
  errors.push(`Yield-Charts JPN 2Y: ${e.message}`);
}

try {
  const cn2 = sampleWeekly(await chinaYields('CN2YT'));
  const cn10 = sampleWeekly(await chinaYields('CN10YT'));
  if (cn2.length) histories['CHN-y2'] = mergeHistory([], cn2, 28);
  if (cn10.length) histories['CHN-y10'] = mergeHistory([], cn10, 28);
} catch (e) {
  errors.push(`Yield-Charts CHN Sina: ${e.message}`);
}

histories['AUS-y2'] = mergeHistory([], AUS_Y2_SEED, 18);

for (const [id, seriesId] of Object.entries(FRED_10Y)) {
  try {
    const rows = await fredSeries(seriesId, '2025-10-01');
    const recent = rows.filter(p => p.period >= '2026-04-01');
    const use = recent.length >= 3 ? recent : rows.slice(-6);
    histories[`${id}-y10`] = mergeHistory([], use, 12);
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
    let period = String(cur.date || today).slice(0, 10);
    if (period.includes('T')) period = period.slice(0, 10);
    histories[histKey] = mergeHistory(histories[histKey], [{ period, value: Number(cur.value) }], id === 'USA' ? 30 : 28);
  }
}

payload.histories = histories;
payload.updatedAt = new Date().toISOString();
payload.errors = [
  ...(payload.errors || []).filter(e => !/Yield-Charts/i.test(e)),
  ...errors
];
fs.writeFileSync('data.json', JSON.stringify(payload, null, 2) + '\n');
console.log(
  'charts',
  'USA-y2', (histories['USA-y2'] || []).length,
  'DEU-y2', (histories['DEU-y2'] || []).length,
  'FRA-y2', (histories['FRA-y2'] || []).length,
  'JPN-y2', (histories['JPN-y2'] || []).length,
  'AUS-y2', (histories['AUS-y2'] || []).length,
  'CHN-y2', (histories['CHN-y2'] || []).length,
  'CHN-y10', (histories['CHN-y10'] || []).length
);
