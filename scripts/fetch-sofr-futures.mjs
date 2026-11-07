import fs from 'node:fs';

/**
 * SOFR Forward Curve: Spot (NY Fed) + implied rates from CME One-Month SOFR futures (Yahoo SR1).
 * Tenors: Heute, 3m, 6m, 9m, 12m
 * Rate = 100 - IMM index price
 */

const MONTH_CODES = ['F', 'G', 'H', 'J', 'K', 'M', 'N', 'Q', 'U', 'V', 'X', 'Z'];

function addMonths(d, n) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  x.setUTCMonth(x.getUTCMonth() + n);
  return x;
}

function sr1Symbol(d) {
  const code = MONTH_CODES[d.getUTCMonth()];
  const yy = String(d.getUTCFullYear()).slice(2);
  return `SR1${code}${yy}.CME`;
}

async function fetchSpotSofR() {
  const r = await fetch('https://markets.newyorkfed.org/api/rates/secured/sofr/last/1.json', {
    headers: { 'User-Agent': 'MacroWatch/1.0 (+https://hossein7935.github.io/)', Accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`NY Fed SOFR HTTP ${r.status}`);
  const j = await r.json();
  const row = j?.refRates?.[0];
  if (!row || !Number.isFinite(Number(row.percentRate))) throw new Error('SOFR missing');
  return { period: String(row.effectiveDate).slice(0, 10), value: Math.round(Number(row.percentRate) * 10000) / 10000 };
}

async function fetchYahooLast(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=10d`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 MacroWatch/1.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`Yahoo ${symbol} HTTP ${r.status}`);
  const j = await r.json();
  const meta = j?.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice ?? meta?.previousClose;
  if (!Number.isFinite(Number(price))) throw new Error(`Yahoo ${symbol} no price`);
  // IMM index → rate
  const rate = Math.round((100 - Number(price)) * 10000) / 10000;
  return { symbol, price: Number(price), rate };
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const data = payload.data || {};
data.USA = data.USA || {};
const errors = payload.errors || [];

try {
  const spot = await fetchSpotSofR();
  const now = new Date();
  const tenors = [
    { label: 'Heute', months: 0, spot: true },
    { label: '3m', months: 3 },
    { label: '6m', months: 6 },
    { label: '9m', months: 9 },
    { label: '12m', months: 12 }
  ];

  const points = [];
  const meta = [];
  for (const t of tenors) {
    if (t.spot) {
      points.push({ period: t.label, value: spot.value });
      meta.push({ tenor: t.label, source: 'NY Fed SOFR', period: spot.period, value: spot.value });
      continue;
    }
    const d = addMonths(now, t.months);
    const sym = sr1Symbol(d);
    try {
      const q = await fetchYahooLast(sym);
      points.push({ period: t.label, value: q.rate });
      meta.push({ tenor: t.label, source: sym, price: q.price, value: q.rate });
      console.log(t.label, sym, q.price, '→', q.rate);
    } catch (e) {
      console.error(t.label, sym, e.message);
      // skip missing leg
    }
  }

  if (points.length < 2) throw new Error('zu wenige Forward-Punkte');

  // Store as special history keyed for the tenor curve (latest snapshot only for spark; also append daily history of 12m)
  histories['USA-sofrFwd'] = points;

  // Keep a time-series of the 12m implied rate for optional history
  const leg12 = points.find(p => p.period === '12m');
  if (leg12) {
    const day = new Date().toISOString().slice(0, 10);
    const prev = histories['USA-sofrFwd12'] || [];
    const map = new Map(prev.map(p => [String(p.period), Number(p.value)]));
    map.set(day, leg12.value);
    histories['USA-sofrFwd12'] = [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-800)
      .map(([period, value]) => ({ period, value: Math.round(value * 10000) / 10000 }));
  }

  data.USA.sofrFwd = {
    value: points.find(p => p.period === '12m')?.value ?? points.at(-1).value,
    date: spot.period,
    source: 'NY Fed SOFR + CME SR1 (Yahoo)',
    curve: points,
    meta
  };

  console.log('SOFR Fwd curve:', points.map(p => `${p.period}=${p.value}`).join(' · '));
} catch (e) {
  errors.push(`USA SOFR Fwd: ${e.message}`);
  console.error('SOFR Fwd failed:', e.message);
}

payload.histories = histories;
payload.data = data;
payload.errors = errors;
payload.updatedAt = new Date().toISOString();
fs.writeFileSync('data.json', JSON.stringify(payload));
console.log('done');
