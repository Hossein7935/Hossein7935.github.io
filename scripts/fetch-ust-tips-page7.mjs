import fs from 'node:fs';

/**
 * USA page 7 yields — max freshness stack:
 * 1) FRED long history
 * 2) U.S. Treasury nominal + real yield CSVs
 * 3) TradingView live overlay
 */
const SERIES = [
  { id: 'DGS3MO', key: 'us3m', label: 'US 3M', tv: 'TVC:US03MY', treasCol: '3 Mo', realCol: null },
  { id: 'DGS2', key: 'us2y', label: 'US 2Y', tv: 'TVC:US02Y', treasCol: '2 Yr', realCol: null },
  { id: 'DGS5', key: 'us5y', label: 'US 5Y', tv: 'TVC:US05Y', treasCol: '5 Yr', realCol: null },
  { id: 'DGS10', key: 'us10y', label: 'US 10Y', tv: 'TVC:US10Y', treasCol: '10 Yr', realCol: null },
  { id: 'DGS30', key: 'us30y', label: 'US 30Y', tv: 'TVC:US30Y', treasCol: '30 Yr', realCol: null },
  { id: 'DFII5', key: 'dfii5', label: 'TIPS 5Y', tv: null, treasCol: null, realCol: '5 YR' },
  { id: 'DFII10', key: 'dfii10', label: 'TIPS 10Y', tv: null, treasCol: null, realCol: '10 YR' }
];

function parseMDY(s) {
  const m = String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

async function fredCsv(id) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=2015-01-01`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'MacroWatch/1.6', Accept: 'text/csv' },
    signal: AbortSignal.timeout(60000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`FRED HTTP ${r.status}`);
  const out = [];
  for (const line of (await r.text()).trim().split(/\r?\n/).slice(1)) {
    const [d, v] = line.split(',');
    if (!d || v === '.' || v == null || v === '') continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    out.push({ period: d.trim().slice(0, 10), value: Math.round(n * 10000) / 10000 });
  }
  return out;
}

async function treasuryCsv(type) {
  const year = new Date().getUTCFullYear();
  const url =
    `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all` +
    `?type=${type}&field_tdr_date_value=${year}&page&_format=csv`;
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'MacroWatch/1.6 (+https://hossein7935.github.io/)',
      Accept: 'text/csv'
    },
    signal: AbortSignal.timeout(60000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`Treasury ${type} HTTP ${r.status}`);
  const lines = (await r.text()).trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return new Map();
  const header = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim());
  const byDate = new Map();
  for (const line of lines.slice(1)) {
    const cols = line.split(',');
    const period = parseMDY(cols[0]);
    if (!period) continue;
    const row = {};
    for (let i = 1; i < header.length && i < cols.length; i++) {
      const n = Number(cols[i]);
      if (Number.isFinite(n)) row[header[i]] = Math.round(n * 10000) / 10000;
    }
    byDate.set(period, row);
  }
  return byDate;
}

async function tradingViewQuotes(tickers) {
  const r = await fetch('https://scanner.tradingview.com/global/scan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'MacroWatch/1.6 (+https://hossein7935.github.io/)'
    },
    body: JSON.stringify({
      symbols: { tickers, query: { types: [] } },
      columns: ['close', 'name', 'description']
    }),
    signal: AbortSignal.timeout(30000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`TV HTTP ${r.status}`);
  const j = await r.json();
  const by = {};
  for (const row of j.data || []) {
    const n = Number(row.d?.[0]);
    if (!Number.isFinite(n) || n > 25) continue;
    by[row.s] = Math.round(n * 10000) / 10000;
  }
  return by;
}

function upsertPoint(pts, period, value) {
  if (!period || !Number.isFinite(value)) return pts;
  const i = pts.findIndex((p) => p.period === period);
  if (i >= 0) pts[i] = { period, value };
  else pts.push({ period, value });
  pts.sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));
  return pts;
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const data = payload.data || {};
data.USA = data.USA || {};
const errors = Array.isArray(payload.errors)
  ? payload.errors.filter((e) => !String(e).startsWith('USA page7'))
  : [];
const asOf = new Date().toISOString();
const today = asOf.slice(0, 10);
const meta = {
  updatedAt: asOf,
  series: {},
  sourceNote: 'FRED + Treasury nominal/real CSV + TradingView live'
};

let treasNom = new Map();
let treasReal = new Map();
try {
  treasNom = await treasuryCsv('daily_treasury_yield_curve');
  const d = [...treasNom.keys()].sort();
  console.log('Treasury nominal', d.length, 'latest', d.at(-1));
} catch (e) {
  errors.push(`USA page7 Treasury nominal: ${e.message}`);
  console.error('Treasury nominal', e.message);
}
try {
  treasReal = await treasuryCsv('daily_treasury_real_yield_curve');
  const d = [...treasReal.keys()].sort();
  console.log('Treasury real', d.length, 'latest', d.at(-1));
} catch (e) {
  errors.push(`USA page7 Treasury real: ${e.message}`);
  console.error('Treasury real', e.message);
}

let tv = {};
try {
  const tickers = SERIES.map((s) => s.tv).filter(Boolean);
  tv = await tradingViewQuotes(tickers);
  console.log('TV', tv);
} catch (e) {
  errors.push(`USA page7 TradingView: ${e.message}`);
  console.error('TV', e.message);
}

for (const s of SERIES) {
  try {
    let pts = await fredCsv(s.id);
    if (pts.length < 50) throw new Error(`only ${pts.length} pts`);

    if (s.treasCol && treasNom.size) {
      for (const [period, row] of treasNom.entries()) {
        const v = row[s.treasCol];
        if (Number.isFinite(v)) pts = upsertPoint(pts, period, v);
      }
    }
    if (s.realCol && treasReal.size) {
      for (const [period, row] of treasReal.entries()) {
        const v = row[s.realCol];
        if (Number.isFinite(v)) pts = upsertPoint(pts, period, v);
      }
    }
    if (s.tv && tv[s.tv] != null) {
      pts = upsertPoint(pts, today, tv[s.tv]);
      console.log(s.key, 'TV today', today, tv[s.tv]);
    }

    histories[`USA-${s.key}`] = pts;
    // keep parallel tips keys used elsewhere
    if (s.key === 'dfii5') histories['USA-tips5Y'] = pts.slice(-800);
    if (s.key === 'dfii10') histories['USA-tips10Y'] = pts.slice(-800);

    const last = pts.at(-1);
    meta.series[s.key] = {
      value: last.value,
      date: last.period,
      n: pts.length,
      source:
        s.tv && tv[s.tv] != null
          ? `Treasury/FRED + TV · ${s.tv}`
          : s.realCol
            ? `Treasury real + FRED · ${s.id}`
            : `Treasury + FRED · ${s.id}`,
      label: s.label
    };
    console.log(s.id, s.key, pts.length, last.period, last.value);
  } catch (e) {
    errors.push(`USA page7 ${s.id}: ${e.message}`);
    console.error(s.id, e.message);
  }
}

data.USA.ustTipsPage7 = meta;
payload.histories = histories;
payload.data = data;
payload.errors = errors;
payload.updatedAt = asOf;
fs.writeFileSync('data.json', JSON.stringify(payload));
console.log('done page7', asOf);
