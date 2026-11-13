import fs from 'node:fs';

/** IORB (IOER merge) + US 1Y — FRED history + TradingView live for US1Y */
const IORB_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=IORB&cosd=2015-01-01';
const IOER_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=IOER&cosd=2008-01-01';
const DGS1_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS1&cosd=2015-01-01';

async function loadCsv(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'MacroWatch/1.6', Accept: 'text/csv' },
    signal: AbortSignal.timeout(60000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
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

function mergeIoerIorb(ioer, iorb) {
  const map = new Map();
  for (const p of ioer) map.set(p.period, p.value);
  for (const p of iorb) map.set(p.period, p.value);
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, value]) => ({ period, value }));
}

function upsert(pts, period, value) {
  if (!period || !Number.isFinite(value)) return pts;
  const i = pts.findIndex((p) => p.period === period);
  if (i >= 0) pts[i] = { period, value };
  else pts.push({ period, value });
  pts.sort((a, b) => a.period.localeCompare(b.period));
  return pts;
}

async function tvClose(ticker) {
  const r = await fetch('https://scanner.tradingview.com/global/scan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'MacroWatch/1.6 (+https://hossein7935.github.io/)'
    },
    body: JSON.stringify({
      symbols: { tickers: [ticker], query: { types: [] } },
      columns: ['close']
    }),
    signal: AbortSignal.timeout(20000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`TV HTTP ${r.status}`);
  const j = await r.json();
  const n = Number(j.data?.[0]?.d?.[0]);
  if (!Number.isFinite(n) || n > 25) throw new Error('TV bad value');
  return Math.round(n * 10000) / 10000;
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const data = payload.data || {};
data.USA = data.USA || {};
const errors = Array.isArray(payload.errors)
  ? payload.errors.filter((e) => !String(e).startsWith('USA IORB1Y'))
  : [];
const asOf = new Date().toISOString();
const today = asOf.slice(0, 10);

try {
  const [iorbRaw, ioer, us1yRaw] = await Promise.all([
    loadCsv(IORB_URL),
    loadCsv(IOER_URL),
    loadCsv(DGS1_URL)
  ]);
  const iorb = mergeIoerIorb(ioer, iorbRaw);
  let us1y = us1yRaw;
  if (iorb.length < 50) throw new Error('IORB/IOER too short');
  if (us1y.length < 50) throw new Error('DGS1 too short');

  // TradingView live overlay for US 1Y
  try {
    const live = await tvClose('TVC:US01Y');
    us1y = upsert(us1y, today, live);
    console.log('US1Y TV', today, live);
  } catch (e) {
    console.error('US1Y TV', e.message);
    errors.push(`USA IORB1Y TV: ${e.message}`);
  }

  // Treasury nominal 1Y if available (from page7 treasury logic — quick CSV)
  try {
    const year = new Date().getUTCFullYear();
    const url =
      `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all` +
      `?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'MacroWatch/1.6', Accept: 'text/csv' },
      signal: AbortSignal.timeout(45000),
      cache: 'no-store'
    });
    if (r.ok) {
      const lines = (await r.text()).trim().split(/\r?\n/).filter(Boolean);
      const header = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim());
      const idx = header.indexOf('1 Yr');
      if (idx > 0) {
        for (const line of lines.slice(1)) {
          const cols = line.split(',');
          const m = String(cols[0]).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          if (!m) continue;
          const period = `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
          const n = Number(cols[idx]);
          if (Number.isFinite(n)) us1y = upsert(us1y, period, Math.round(n * 10000) / 10000);
        }
        console.log('US1Y Treasury merged, last', us1y.at(-1));
      }
    }
  } catch (e) {
    console.error('US1Y Treasury', e.message);
  }

  histories['USA-iorb'] = iorb;
  histories['USA-us1y'] = us1y;

  const lastI = iorb.at(-1);
  const lastU = us1y.at(-1);
  data.USA.iorbUs1y = {
    updatedAt: asOf,
    iorb: { value: lastI.value, date: lastI.period, source: 'FRED · IOER+IORB' },
    us1y: {
      value: lastU.value,
      date: lastU.period,
      source: 'FRED DGS1 + Treasury + TV US01Y'
    }
  };
  data.USA.us1y = data.USA.iorbUs1y.us1y;
  console.log('IORB', lastI.period, lastI.value, 'US1Y', lastU.period, lastU.value);
} catch (e) {
  errors.push(`USA IORB1Y: ${e.message}`);
  console.error(e.message);
}

payload.histories = histories;
payload.data = data;
payload.errors = errors;
payload.updatedAt = asOf;
fs.writeFileSync('data.json', JSON.stringify(payload));
console.log('done iorb-us1y');
