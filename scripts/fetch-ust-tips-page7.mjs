import fs from 'node:fs';

/** Daily US Treasuries + TIPS: FRED history + TradingView live overlay */
const SERIES = [
  { id: 'DGS3MO', key: 'us3m', label: 'US 3M', tv: 'TVC:US03MY' },
  { id: 'DGS2', key: 'us2y', label: 'US 2Y', tv: 'TVC:US02Y' },
  { id: 'DGS5', key: 'us5y', label: 'US 5Y', tv: 'TVC:US05Y' },
  { id: 'DGS10', key: 'us10y', label: 'US 10Y', tv: 'TVC:US10Y' },
  { id: 'DGS30', key: 'us30y', label: 'US 30Y', tv: 'TVC:US30Y' },
  { id: 'DFII5', key: 'dfii5', label: 'TIPS 5Y', tv: null },
  { id: 'DFII10', key: 'dfii10', label: 'TIPS 10Y', tv: null }
];

async function fredCsv(id) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=2015-01-01`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'MacroWatch/1.0', Accept: 'text/csv' },
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

async function tradingViewQuotes(tickers) {
  const r = await fetch('https://scanner.tradingview.com/global/scan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'MacroWatch/1.4 (+https://hossein7935.github.io/)'
    },
    body: JSON.stringify({
      symbols: { tickers, query: { types: [] } },
      columns: ['close', 'name', 'description', 'update_mode']
    }),
    signal: AbortSignal.timeout(30000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`TV HTTP ${r.status}`);
  const j = await r.json();
  const by = {};
  for (const row of j.data || []) {
    const v = row.d?.[0];
    if (v == null || !Number.isFinite(Number(v))) continue;
    // skip bond price quotes (~100), keep yield-like values
    const n = Number(v);
    if (n > 25) continue;
    by[row.s] = Math.round(n * 10000) / 10000;
  }
  return by;
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const data = payload.data || {};
data.USA = data.USA || {};
const errors = Array.isArray(payload.errors)
  ? payload.errors.filter(e => !String(e).startsWith('USA page7'))
  : [];
const asOf = new Date().toISOString();
const today = asOf.slice(0, 10);
const meta = { updatedAt: asOf, series: {}, sourceNote: 'FRED history + TradingView live (scanner)' };

let tv = {};
try {
  const tickers = SERIES.map(s => s.tv).filter(Boolean);
  tv = await tradingViewQuotes(tickers);
  console.log('TV quotes', Object.keys(tv).length, tv);
} catch (e) {
  errors.push(`USA page7 TradingView: ${e.message}`);
  console.error('TV', e.message);
}

for (const s of SERIES) {
  try {
    const pts = await fredCsv(s.id);
    if (pts.length < 50) throw new Error(`only ${pts.length} pts`);

    // Overlay live TradingView close when available (same-day or newer than FRED last)
    if (s.tv && tv[s.tv] != null) {
      const live = tv[s.tv];
      const last = pts.at(-1);
      if (!last || last.period < today) {
        pts.push({ period: today, value: live });
        console.log(s.key, 'TV overlay', today, live, '(FRED last', last?.period, last?.value + ')');
      } else if (last.period === today && Math.abs(last.value - live) > 1e-6) {
        last.value = live;
        console.log(s.key, 'TV replace same-day', live);
      } else {
        console.log(s.key, 'keep FRED', last.period, last.value, 'TV', live);
      }
    }

    histories[`USA-${s.key}`] = pts;
    const last = pts.at(-1);
    meta.series[s.key] = {
      value: last.value,
      date: last.period,
      n: pts.length,
      source: s.tv && tv[s.tv] != null ? `FRED · ${s.id} + TV · ${s.tv}` : `FRED · ${s.id}`,
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
console.log('done page7');
