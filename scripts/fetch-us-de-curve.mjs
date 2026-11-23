import fs from 'node:fs';

/**
 * USA vs DE/EA yield curve — daily history for time scrubber
 * USA: FRED DGS3MO, DGS1, DGS2, DGS5, DGS10, DGS30
 * DE: EZB AAA-Kurve (Euro area, bund-nah) SR_3M…SR_30Y
 *      + TradingView TVC:DE* für aktuellen DE-Snapshot
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

const ECB_LEGS = [
  { tenor: '3M', key: 'SR_3M', histKey: 'DEU-y3m' },
  { tenor: '1Y', key: 'SR_1Y', histKey: 'DEU-y1y' },
  { tenor: '2Y', key: 'SR_2Y', histKey: 'DEU-y2y' },
  { tenor: '5Y', key: 'SR_5Y', histKey: 'DEU-y5y' },
  { tenor: '10Y', key: 'SR_10Y', histKey: 'DEU-y10y' },
  { tenor: '30Y', key: 'SR_30Y', histKey: 'DEU-y30y' }
];

const DE_TV = [
  { tenor: '3M', ticker: 'TVC:DE03M', isPrice: true },
  { tenor: '1Y', ticker: 'TVC:DE01Y' },
  { tenor: '2Y', ticker: 'TVC:DE02Y' },
  { tenor: '5Y', ticker: 'TVC:DE05Y' },
  { tenor: '10Y', ticker: 'TVC:DE10Y' },
  { tenor: '30Y', ticker: 'TVC:DE30Y' }
];

function mergeSeries(prev, next) {
  const map = new Map();
  for (const p of prev || []) {
    if (p?.period && Number.isFinite(Number(p.value)))
      map.set(String(p.period).slice(0, 10), Number(p.value));
  }
  for (const p of next || []) {
    if (p?.period && Number.isFinite(Number(p.value)))
      map.set(String(p.period).slice(0, 10), Number(p.value));
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, value]) => ({
      period,
      value: Math.round(value * 10000) / 10000
    }));
}

async function fredSeries(id, start = '2015-01-01') {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${start}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/csv' },
    signal: AbortSignal.timeout(90000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`${id} HTTP ${r.status}`);
  const text = await r.text();
  if (text.trim().startsWith('<')) throw new Error(`${id} HTML`);
  const out = [];
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const [date, val] = line.split(',');
    if (!date || val === '.' || val == null || val === '') continue;
    const v = Number(val);
    if (!Number.isFinite(v)) continue;
    out.push({ period: date.slice(0, 10), value: Math.round(v * 1000) / 1000 });
  }
  if (!out.length) throw new Error(`${id} empty`);
  return out;
}

async function ecbSeries(srKey, start = '2015-01-01') {
  const series = `B.U2.EUR.4F.G_N_A.SV_C_YM.${srKey}`;
  const url =
    `https://data-api.ecb.europa.eu/service/data/YC/${series}` +
    `?startPeriod=${start}&format=csvdata`;
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/csv' },
    signal: AbortSignal.timeout(90000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`ECB ${srKey} HTTP ${r.status}`);
  const text = await r.text();
  const out = [];
  for (const line of text.trim().split(/\r?\n/)) {
    const m = line.match(/(\d{4}-\d{2}-\d{2}),([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
    if (!m) continue;
    const v = Number(m[2]);
    if (!Number.isFinite(v)) continue;
    out.push({ period: m[1], value: Math.round(v * 1000) / 1000 });
  }
  if (!out.length) throw new Error(`ECB ${srKey} empty`);
  return out;
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
    by[row.s] = { value: row.d?.[0] };
  }
  return by;
}

function priceToApproxYield(price) {
  const p = Number(price);
  if (!Number.isFinite(p)) return null;
  if (p > 50 && p < 100.5) return Math.round((100 - p) * 4 * 1000) / 1000;
  return Math.round(p * 1000) / 1000;
}

/** Build list of {period, usa:[{period:tenor,value}], de:[...]} for scrubber */
function buildDailyCurves(usMaps, deMaps) {
  const tenors = ['3M', '1Y', '2Y', '5Y', '10Y', '30Y'];
  const dates = new Set();
  for (const t of tenors) {
    for (const d of usMaps[t]?.keys() || []) dates.add(d);
    for (const d of deMaps[t]?.keys() || []) dates.add(d);
  }
  const sorted = [...dates].sort();
  // forward-fill per tenor
  const lastU = {};
  const lastD = {};
  const out = [];
  for (const day of sorted) {
    for (const t of tenors) {
      if (usMaps[t]?.has(day)) lastU[t] = usMaps[t].get(day);
      if (deMaps[t]?.has(day)) lastD[t] = deMaps[t].get(day);
    }
    const usa = [];
    const de = [];
    for (const t of tenors) {
      if (Number.isFinite(lastU[t])) usa.push({ period: t, value: lastU[t] });
      if (Number.isFinite(lastD[t])) de.push({ period: t, value: lastD[t] });
    }
    // need at least 3 points each side
    if (usa.length >= 3 && de.length >= 3) {
      out.push({ period: day, usa, de });
    }
  }
  // keep last ~8y to limit size (~2000 business days)
  return out.length > 2200 ? out.slice(-2200) : out;
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

const usMaps = {};
const deMaps = {};

// --- USA full history ---
for (const leg of US_LEGS) {
  try {
    const series = await fredSeries(leg.id, '2015-01-01');
    histories[leg.histKey] = mergeSeries(histories[leg.histKey], series);
    usMaps[leg.tenor] = new Map(histories[leg.histKey].map((p) => [p.period, p.value]));
    console.log('US', leg.tenor, histories[leg.histKey].length, histories[leg.histKey].at(-1));
  } catch (e) {
    errors.push(`USA/DE curve US ${leg.tenor}: ${e.message}`);
    console.warn('US', leg.tenor, e.message);
    const prev = histories[leg.histKey] || [];
    usMaps[leg.tenor] = new Map(prev.map((p) => [p.period, p.value]));
  }
}

// --- DE/EA AAA from ECB (daily history) ---
for (const leg of ECB_LEGS) {
  try {
    const series = await ecbSeries(leg.key, '2015-01-01');
    histories[leg.histKey] = mergeSeries(histories[leg.histKey], series);
    deMaps[leg.tenor] = new Map(histories[leg.histKey].map((p) => [p.period, p.value]));
    console.log('DE/ECB', leg.tenor, histories[leg.histKey].length, histories[leg.histKey].at(-1));
  } catch (e) {
    errors.push(`USA/DE curve DE ${leg.tenor}: ${e.message}`);
    console.warn('DE', leg.tenor, e.message);
    const prev = histories[leg.histKey] || [];
    deMaps[leg.tenor] = new Map(prev.map((p) => [p.period, p.value]));
  }
}

// --- TradingView today overlay for DE (market) ---
try {
  const quotes = await tradingViewQuotes(DE_TV.map((t) => t.ticker));
  for (const leg of DE_TV) {
    const q = quotes[leg.ticker];
    if (!q || q.value == null) continue;
    let y = Number(q.value);
    if (leg.isPrice) y = priceToApproxYield(y);
    if (!Number.isFinite(y) || y < -2 || y > 15) continue;
    const histKey = ECB_LEGS.find((x) => x.tenor === leg.tenor)?.histKey;
    if (histKey) {
      histories[histKey] = mergeSeries(histories[histKey], [{ period: today, value: y }]);
      deMaps[leg.tenor] = new Map(histories[histKey].map((p) => [p.period, p.value]));
    }
    console.log('DE TV', leg.tenor, y);
  }
} catch (e) {
  console.warn('TV DE', e.message);
}

const daily = buildDailyCurves(usMaps, deMaps);
if (daily.length) {
  histories['USA-usDeCurveDaily'] = daily.map((d) => ({
    period: d.period,
    // pack as JSON string in value? better store parallel structure in data
    value: d.usa.find((x) => x.period === '10Y')?.value ?? d.usa[0]?.value
  }));
  // Full payload for scrubber (dates + curves)
  data.USA.usDeCurveDaily = {
    dates: daily.map((d) => d.period),
    curves: daily.map((d) => ({ usa: d.usa, de: d.de })),
    updatedAt: asOf,
    source: 'USA FRED DGS* · DE/EA EZB AAA YC (+ TV Spot)',
    note: 'Tägliche Historie für Zeitachse. Maus auf Zeitachse = Kurve dieses Tages.'
  };

  const last = daily[daily.length - 1];
  data.USA.usDeCurve = {
    usa: last.usa,
    de: last.de,
    date: last.period,
    updatedAt: asOf,
    source: 'USA: FRED · DE: EZB AAA / TradingView',
    note: 'X = Laufzeit · Y = %. Zeitachse darunter = Tag wählen.'
  };
  histories['USA-usDeCurveUsa'] = last.usa;
  histories['USA-usDeCurveDe'] = last.de;
  console.log('daily curves', daily.length, last.period);
} else {
  errors.push('USA/DE curve: keine tägliche Historie');
}

payload.histories = histories;
payload.data = data;
payload.errors = errors;
payload.updatedAt = asOf;
fs.writeFileSync('data.json', JSON.stringify(payload));
console.log('done us-de-curve history');
