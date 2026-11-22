import fs from 'node:fs';

/**
 * USA vs Deutschland Zinskurve (wie Seite-4-Trick)
 * US: FRED DGS3MO, DGS1, DGS2, DGS5, DGS10, DGS30
 * DE: TradingView TVC:DE03M/DE01Y/DE02Y/DE05Y/DE10Y/DE30Y
 * Speichert:
 *  - histories DEU-y3m … DEU-y30y (tägliche Punkte, wachsen mit jedem Run)
 *  - data.USA.usDeCurve { usa:[{period,value}], de:[...], date }
 *  - histories USA-usDeCurveUsa / USA-usDeCurveDe als Snapshot-Serie für Chart
 */

const UA = 'MacroWatch/1.9 (+https://hossein7935.github.io/)';

const US_LEGS = [
  { tenor: '3M', id: 'DGS3MO', histKey: 'USA-us3m' },
  { tenor: '1Y', id: 'DGS1', histKey: 'USA-us1y' },
  { tenor: '2Y', id: 'DGS2', histKey: 'USA-us2y' },
  { tenor: '5Y', id: 'DGS5', histKey: 'USA-us5y' },
  { tenor: '10Y', id: 'DGS10', histKey: 'USA-us10y' },
  { tenor: '30Y', id: 'DGS30', histKey: 'USA-us30y' }
];

const DE_TICKERS = [
  { tenor: '3M', ticker: 'TVC:DE03M', histKey: 'DEU-y3m', isPrice: true },
  { tenor: '1Y', ticker: 'TVC:DE01Y', histKey: 'DEU-y1y' },
  { tenor: '2Y', ticker: 'TVC:DE02Y', histKey: 'DEU-y2y' },
  { tenor: '5Y', ticker: 'TVC:DE05Y', histKey: 'DEU-y5y' },
  { tenor: '10Y', ticker: 'TVC:DE10Y', histKey: 'DEU-y10y' },
  { tenor: '30Y', ticker: 'TVC:DE30Y', histKey: 'DEU-y30y' }
];

function mergePoint(histories, key, period, value) {
  const prev = Array.isArray(histories[key]) ? histories[key] : [];
  const map = new Map(prev.map((p) => [String(p.period).slice(0, 10), Number(p.value)]));
  map.set(String(period).slice(0, 10), Number(value));
  histories[key] = [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, value]) => ({
      period,
      value: Math.round(value * 10000) / 10000
    }));
  return histories[key];
}

async function fredLast(id) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=2020-01-01`;
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/csv' },
    signal: AbortSignal.timeout(60000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`${id} HTTP ${r.status}`);
  const text = await r.text();
  if (text.trim().startsWith('<')) throw new Error(`${id} HTML`);
  let last = null;
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const [date, val] = line.split(',');
    if (!date || val === '.' || val == null || val === '') continue;
    const v = Number(val);
    if (!Number.isFinite(v)) continue;
    last = { period: date.slice(0, 10), value: Math.round(v * 1000) / 1000 };
  }
  if (!last) throw new Error(`${id} empty`);
  return last;
}

async function tradingViewQuotes(tickers) {
  const r = await fetch('https://scanner.tradingview.com/global/scan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': UA
    },
    body: JSON.stringify({
      symbols: { tickers, query: { types: [] } },
      columns: ['close', 'description']
    }),
    signal: AbortSignal.timeout(45000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`TradingView HTTP ${r.status}`);
  const j = await r.json();
  const by = {};
  for (const row of j.data || []) {
    by[row.s] = {
      value: row.d?.[0],
      description: row.d?.[1]
    };
  }
  return by;
}

/** DE 3M oft als Kurs ~99.x → Näherung Rendite in %: (100−P)×4 */
function priceToApproxYield(price) {
  const p = Number(price);
  if (!Number.isFinite(p)) return null;
  if (p > 50 && p < 100.5) {
    return Math.round((100 - p) * 4 * 1000) / 1000;
  }
  return Math.round(p * 1000) / 1000;
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const data = payload.data || {};
data.USA = data.USA || {};
data.DEU = data.DEU || {};
const errors = Array.isArray(payload.errors)
  ? payload.errors.filter((e) => !String(e).startsWith('USA/DE curve'))
  : [];
const asOf = new Date().toISOString();
const today = asOf.slice(0, 10);

const usaCurve = [];
const deCurve = [];

// --- USA via FRED (gleicher Ansatz wie Seite 4) ---
for (const leg of US_LEGS) {
  try {
    // bevorzugte bestehende Historie, falls frisch
    const existing = histories[leg.histKey];
    let last = null;
    if (Array.isArray(existing) && existing.length) {
      last = existing[existing.length - 1];
    }
    // immer FRED nachziehen
    const fred = await fredLast(leg.id);
    last = fred;
    mergePoint(histories, leg.histKey, fred.period, fred.value);
    usaCurve.push({ period: leg.tenor, value: last.value });
    console.log('US', leg.tenor, last.value, last.period);
  } catch (e) {
    errors.push(`USA/DE curve US ${leg.tenor}: ${e.message}`);
    console.warn('US', leg.tenor, e.message);
  }
}

// --- DE via TradingView (täglich anreichern) ---
try {
  const quotes = await tradingViewQuotes(DE_TICKERS.map((t) => t.ticker));
  for (const leg of DE_TICKERS) {
    const q = quotes[leg.ticker];
    if (!q || q.value == null || !Number.isFinite(Number(q.value))) {
      errors.push(`USA/DE curve DE ${leg.tenor}: kein Quote`);
      continue;
    }
    let y = Number(q.value);
    if (leg.isPrice) y = priceToApproxYield(y);
    if (y == null || !Number.isFinite(y)) continue;
    // sinnvolle Bandbreite für Bund-Renditen
    if (y < -2 || y > 15) {
      console.warn('DE skip outlier', leg.tenor, y);
      continue;
    }
    mergePoint(histories, leg.histKey, today, y);
    deCurve.push({ period: leg.tenor, value: Math.round(y * 1000) / 1000 });
    data.DEU['y' + leg.tenor.toLowerCase()] = {
      value: Math.round(y * 1000) / 1000,
      date: today,
      source: `TradingView · ${leg.ticker}`,
      updatedAt: asOf
    };
    console.log('DE', leg.tenor, y);
  }
} catch (e) {
  errors.push(`USA/DE curve DE: ${e.message}`);
  console.error('DE', e.message);
}

if (usaCurve.length && deCurve.length) {
  data.USA.usDeCurve = {
    usa: usaCurve,
    de: deCurve,
    date: today,
    updatedAt: asOf,
    source: 'USA: FRED DGS* · DE: TradingView TVC:DE*',
    note: 'X = Laufzeit 3M–30Y · Y = Rendite % · blau USA · rot DE. Täglich/stündlich per Workflow.'
  };
  // Snapshot-Serien für generische Line-Charts (Kategorien als period)
  histories['USA-usDeCurveUsa'] = usaCurve.map((p) => ({
    period: p.period,
    value: p.value
  }));
  histories['USA-usDeCurveDe'] = deCurve.map((p) => ({
    period: p.period,
    value: p.value
  }));
  console.log('curve ok', 'US', usaCurve.length, 'DE', deCurve.length);
} else {
  errors.push('USA/DE curve: unvollständig');
}

payload.histories = histories;
payload.data = data;
payload.errors = errors;
payload.updatedAt = asOf;
fs.writeFileSync('data.json', JSON.stringify(payload));
console.log('done us-de-curve');
