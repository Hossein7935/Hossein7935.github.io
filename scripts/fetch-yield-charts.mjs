import fs from 'node:fs';

/** Build ~3 years of 2Y/10Y yield history for charting. */

const START = '2023-10-01';
const MAX_WEEKLY = 160;
const MAX_MONTHLY = 40;

const FRED_10Y = {
  DEU: 'IRLTLT01DEM156N',
  FRA: 'IRLTLT01FRM156N',
  JPN: 'IRLTLT01JPM156N',
  AUS: 'IRLTLT01AUM156N'
};

async function fredSeries(id, start = START) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${start}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'MacroWatch/1.7 (+https://hossein7935.github.io/)' },
    signal: AbortSignal.timeout(45000),
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

function sampleWeekly(rows, maxPts = MAX_WEEKLY) {
  if (!rows.length) return [];
  if (rows.length <= maxPts) return rows;
  const step = Math.max(1, Math.floor(rows.length / maxPts));
  const out = [];
  for (let i = 0; i < rows.length; i += step) out.push(rows[i]);
  if (out.at(-1)?.period !== rows.at(-1)?.period) out.push(rows.at(-1));
  return out.slice(-maxPts);
}

function mergeHistory(existing, incoming, maxPts = MAX_WEEKLY) {
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

async function ecb2Y(start = START) {
  const url = `https://data-api.ecb.europa.eu/service/data/YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_2Y?startPeriod=${start}&format=csvdata`;
  const r = await fetch(url, {
    headers: { Accept: 'text/csv', 'User-Agent': 'MacroWatch/1.7' },
    signal: AbortSignal.timeout(90000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`ECB 2Y HTTP ${r.status}`);
  const text = await r.text();
  const map = new Map();
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    if (!line || line.startsWith('{')) continue;
    const m = line.match(/(20\d{2}-\d{2}-\d{2})[,;]([0-9]+\.[0-9]+)/);
    if (m) {
      map.set(m[1], Math.round(Number(m[2]) * 1000) / 1000);
      continue;
    }
    const parts = line.split(',');
    for (let i = 0; i < parts.length - 1; i++) {
      if (/^20\d{2}-\d{2}-\d{2}$/.test(parts[i].trim()) && Number.isFinite(Number(parts[i + 1]))) {
        map.set(parts[i].trim(), Math.round(Number(parts[i + 1]) * 1000) / 1000);
        break;
      }
    }
  }
  const out = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([period, value]) => ({ period, value }));
  if (!out.length) throw new Error('ECB 2Y keine Punkte');
  return out;
}

async function japanYields(colIndex) {
  const url = 'https://www.mof.go.jp/jgbs/reference/interest_rate/data/jgbcm_all.csv';
  const r = await fetch(url, {
    headers: { 'User-Agent': 'MacroWatch/1.7' },
    signal: AbortSignal.timeout(90000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`MOF JGB HTTP ${r.status}`);
  const buf = await r.arrayBuffer();
  const text = new TextDecoder('shift-jis').decode(buf);
  const rows = [];
  for (const line of text.trim().split(/\r?\n/).slice(2)) {
    const parts = line.split(',');
    if (parts.length <= colIndex) continue;
    const d = parts[0].trim();
    if (!d.startsWith('R')) continue;
    try {
      const [y, m, day] = d.slice(1).split('.').map(Number);
      const iso = `${2018 + y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (iso < START) continue;
      const v = Number(parts[colIndex]);
      if (!Number.isFinite(v)) continue;
      rows.push({ period: iso, value: Math.round(v * 1000) / 1000 });
    } catch { /* skip */ }
  }
  return rows;
}

async function chinaYields(symbol) {
  const url = `https://bond.finance.sina.com.cn/hq/gb/daily?symbol=${symbol}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'MacroWatch/1.7', Accept: 'application/json' },
    signal: AbortSignal.timeout(40000),
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
    if (String(d) < START) continue;
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
  histories['USA-y2'] = sampleWeekly(await fredSeries('DGS2', START));
  histories['USA-y10'] = sampleWeekly(await fredSeries('DGS10', START));
} catch (e) {
  errors.push(`Yield-Charts USA FRED: ${e.message}`);
}

try {
  const ecb = sampleWeekly(await ecb2Y(START));
  histories['DEU-y2'] = ecb.slice();
  histories['FRA-y2'] = ecb.slice();
} catch (e) {
  errors.push(`Yield-Charts ECB 2Y: ${e.message}`);
}

try {
  const jp2 = sampleWeekly(await japanYields(2));
  const jp10 = sampleWeekly(await japanYields(10));
  if (jp2.length) histories['JPN-y2'] = jp2;
  if (jp10.length) histories['JPN-y10'] = jp10;
} catch (e) {
  errors.push(`Yield-Charts JPN MOF: ${e.message}`);
}

try {
  const cn2 = sampleWeekly(await chinaYields('CN2YT'));
  const cn10 = sampleWeekly(await chinaYields('CN10YT'));
  if (cn2.length) histories['CHN-y2'] = cn2;
  if (cn10.length) histories['CHN-y10'] = cn10;
} catch (e) {
  errors.push(`Yield-Charts CHN Sina: ${e.message}`);
}

for (const [id, seriesId] of Object.entries(FRED_10Y)) {
  try {
    const rows = await fredSeries(seriesId, START);
    if (rows.length) {
      const hist = rows.slice(-MAX_MONTHLY);
      if (id === 'JPN' && (histories['JPN-y10'] || []).length > hist.length) {
        // keep MOF
      } else {
        histories[`${id}-y10`] = hist;
      }
    }
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
    if (!/^\d{4}-\d{2}/.test(period)) period = today;
    histories[histKey] = mergeHistory(histories[histKey], [{ period, value: Number(cur.value) }], MAX_WEEKLY);
  }
}

payload.histories = histories;
payload.updatedAt = new Date().toISOString();
payload.errors = [
  ...(payload.errors || []).filter(e => !/Yield-Charts/i.test(e)),
  ...errors
];
fs.writeFileSync('data.json', JSON.stringify(payload, null, 2) + '\n');

const summary = countries.map(id => {
  const a = (histories[`${id}-y2`] || []).length;
  const b = (histories[`${id}-y10`] || []).length;
  return `${id}:2Y=${a},10Y=${b}`;
}).join(' ');
console.log('charts-3y', summary);
