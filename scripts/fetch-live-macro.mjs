import fs from 'node:fs';

/**
 * Faster data sources for daily/hourly-updating series.
 * - US yields: Treasury.gov XML (official, same-day after close) + Yahoo (^TNX etc.) for intraday
 * - EFFR/SOFR: NY Fed Markets API (authoritative, earlier than FRED lag)
 * Merges onto existing histories; never deletes older FRED history.
 */

const UA = { 'User-Agent': 'MacroWatch/1.0 (+https://hossein7935.github.io/)', Accept: '*/*' };
const year = new Date().getUTCFullYear();

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const data = payload.data || {};
data.USA = data.USA || {};
const errors = Array.isArray(payload.errors)
  ? payload.errors.filter(e => !String(e).startsWith('LIVE '))
  : [];
const asOf = new Date().toISOString();

function mergeSeries(key, incoming, meta = {}) {
  if (!incoming?.length) return;
  const prev = histories[key] || [];
  const map = new Map(prev.map(p => [String(p.period), Number(p.value)]));
  for (const p of incoming) {
    if (p?.period && Number.isFinite(Number(p.value))) {
      map.set(String(p.period).slice(0, 10), Math.round(Number(p.value) * 10000) / 10000);
    }
  }
  const out = [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, value]) => ({ period, value }));
  histories[key] = out;
  const last = out.at(-1);
  const short = key.replace(/^USA-/, '');
  data.USA[short] = {
    ...(data.USA[short] || {}),
    value: last.value,
    date: last.period,
    updatedAt: asOf,
    ...meta
  };
  console.log(key, '→', last.period, last.value, `(${out.length} pts)`, meta.source || '');
}

async function fetchText(url) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60000), cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url.slice(0, 80)}`);
  return r.text();
}

async function fetchJson(url) {
  const r = await fetch(url, { headers: { ...UA, Accept: 'application/json' }, signal: AbortSignal.timeout(60000), cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** Treasury.gov daily par yield curve XML (official) */
async function loadTreasuryParYields() {
  const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=${year}`;
  const xml = await fetchText(url);
  const entries = xml.split(/<entry>/i).slice(1);
  const rows = [];
  for (const e of entries) {
    const dateM = e.match(/<d:NEW_DATE[^>]*>([^<]+)</i);
    if (!dateM) continue;
    const period = dateM[1].slice(0, 10);
    const get = (tag) => {
      const m = e.match(new RegExp(`<d:${tag}[^>]*>([^<]*)</`, 'i'));
      if (!m || m[1] === '' || m[1] === 'N/A') return null;
      const n = Number(m[1]);
      return Number.isFinite(n) ? n : null;
    };
    rows.push({
      period,
      us3m: get('BC_3MONTH'),
      us1y: get('BC_1YEAR'),
      us2y: get('BC_2YEAR'),
      us5y: get('BC_5YEAR'),
      us10y: get('BC_10YEAR'),
      us30y: get('BC_30YEAR')
    });
  }
  return rows.sort((a, b) => a.period.localeCompare(b.period));
}

/** Treasury real yield curve (TIPS) */
async function loadTreasuryRealYields() {
  const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_real_yield_curve&field_tdr_date_value=${year}`;
  const xml = await fetchText(url);
  const entries = xml.split(/<entry>/i).slice(1);
  const rows = [];
  for (const e of entries) {
    const dateM = e.match(/<d:NEW_DATE[^>]*>([^<]+)</i);
    if (!dateM) continue;
    const period = dateM[1].slice(0, 10);
    const get = (tag) => {
      const m = e.match(new RegExp(`<d:${tag}[^>]*>([^<]*)</`, 'i'));
      if (!m || m[1] === '' || m[1] === 'N/A') return null;
      const n = Number(m[1]);
      return Number.isFinite(n) ? n : null;
    };
    // field names vary; try common ones
    rows.push({
      period,
      dfii5: get('TC_5YEAR') ?? get('BC_5YEAR') ?? get('K5'),
      dfii10: get('TC_10YEAR') ?? get('BC_10YEAR') ?? get('K10')
    });
  }
  return rows.sort((a, b) => a.period.localeCompare(b.period));
}

/** Yahoo daily history for a symbol */
async function yahooDaily(symbol, range = '1y') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;
  const j = await fetchJson(url);
  const res = j?.chart?.result?.[0];
  if (!res) throw new Error(`Yahoo no result ${symbol}`);
  const ts = res.timestamp || [];
  const closes = res.indicators?.quote?.[0]?.close || [];
  const out = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (c == null || !Number.isFinite(Number(c))) continue;
    const period = new Date(ts[i] * 1000).toISOString().slice(0, 10);
    out.push({ period, value: Math.round(Number(c) * 10000) / 10000 });
  }
  // also inject regularMarketPrice as today if newer
  const meta = res.meta || {};
  const live = meta.regularMarketPrice;
  const liveTs = meta.regularMarketTime;
  if (Number.isFinite(live) && liveTs) {
    const period = new Date(liveTs * 1000).toISOString().slice(0, 10);
    const map = new Map(out.map(p => [p.period, p.value]));
    map.set(period, Math.round(Number(live) * 10000) / 10000);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([period, value]) => ({ period, value }));
  }
  return out;
}

/** NY Fed reference rates */
async function nyFedRates(path, n = 120) {
  const url = `https://markets.newyorkfed.org/api/rates/${path}/last/${n}.json`;
  const j = await fetchJson(url);
  const rows = j?.refRates || j?.rates || [];
  return rows
    .map(r => ({
      period: String(r.effectiveDate || r.date || '').slice(0, 10),
      value: Number(r.percentRate ?? r.rate)
    }))
    .filter(p => p.period && Number.isFinite(p.value))
    .sort((a, b) => a.period.localeCompare(b.period));
}

// ─── 1) Official Treasury par yields (beats FRED lag) ───
try {
  const rows = await loadTreasuryParYields();
  if (rows.length < 5) throw new Error('too few treasury rows');
  const mapKey = [
    ['us3m', 'us3m'],
    ['us1y', 'us1y'],
    ['us2y', 'us2y'],
    ['us5y', 'us5y'],
    ['us10y', 'us10y'],
    ['us30y', 'us30y']
  ];
  for (const [field, key] of mapKey) {
    const pts = rows
      .filter(r => r[field] != null)
      .map(r => ({ period: r.period, value: r[field] }));
    mergeSeries(`USA-${key}`, pts, {
      source: 'U.S. Treasury · Daily Par Yield Curve',
      sourceUrl: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/'
    });
  }
} catch (e) {
  errors.push(`LIVE Treasury: ${e.message}`);
  console.error('Treasury', e.message);
}

// ─── 2) Yahoo market quotes (intraday / same-day) ───
const yahooMap = [
  { symbol: '^IRX', key: 'us3m', note: 'Yahoo ^IRX 13-week' },
  { symbol: '2YY=F', key: 'us2y', note: 'Yahoo 2YY=F' },
  { symbol: '^FVX', key: 'us5y', note: 'Yahoo ^FVX' },
  { symbol: '^TNX', key: 'us10y', note: 'Yahoo ^TNX' },
  { symbol: '^TYX', key: 'us30y', note: 'Yahoo ^TYX' }
];
for (const y of yahooMap) {
  try {
    const pts = await yahooDaily(y.symbol, '6mo');
    if (pts.length < 5) throw new Error('short');
    // Merge: Yahoo updates same calendar day; keep Treasury/FRED history
    mergeSeries(`USA-${y.key}`, pts, {
      source: `${y.note} · live market`,
      sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(y.symbol)}`
    });
  } catch (e) {
    errors.push(`LIVE Yahoo ${y.symbol}: ${e.message}`);
    console.error('Yahoo', y.symbol, e.message);
  }
}

// ─── 3) NY Fed SOFR + EFFR ───
try {
  const sofr = await nyFedRates('secured/sofr', 180);
  mergeSeries('USA-sofr', sofr, {
    source: 'NY Fed · SOFR',
    sourceUrl: 'https://www.newyorkfed.org/markets/reference-rates/sofr'
  });
} catch (e) {
  errors.push(`LIVE NYFed SOFR: ${e.message}`);
  console.error('NYFed SOFR', e.message);
}
try {
  const effr = await nyFedRates('unsecured/effr', 180);
  mergeSeries('USA-effr', effr, {
    source: 'NY Fed · EFFR',
    sourceUrl: 'https://www.newyorkfed.org/markets/reference-rates/effr'
  });
} catch (e) {
  errors.push(`LIVE NYFed EFFR: ${e.message}`);
  console.error('NYFed EFFR', e.message);
}

// ─── 4) Spreads derived from updated series ───
try {
  const a = histories['USA-us10y'] || [];
  const b = histories['USA-us2y'] || [];
  const m2 = new Map(b.map(p => [p.period, p.value]));
  const spr = [];
  for (const p of a) {
    const v2 = m2.get(p.period);
    if (v2 == null) continue;
    spr.push({ period: p.period, value: Math.round((p.value - v2) * 10000) / 10000 });
  }
  if (spr.length) mergeSeries('USA-t10y2y', spr, { source: 'Derived · US10Y−US2Y (live)' });
} catch (e) {
  console.error('spread', e.message);
}
try {
  const a = histories['USA-us10y'] || [];
  const b = histories['USA-us5y'] || [];
  const m2 = new Map(b.map(p => [p.period, p.value]));
  const spr = [];
  for (const p of a) {
    const v2 = m2.get(p.period);
    if (v2 == null) continue;
    spr.push({ period: p.period, value: Math.round((p.value - v2) * 10000) / 10000 });
  }
  if (spr.length) mergeSeries('USA-t10y5y', spr, { source: 'Derived · US10Y−US5Y (live)' });
} catch (e) {
  console.error('spread5', e.message);
}

data.USA.liveSources = {
  updatedAt: asOf,
  note: 'Treasury.gov + NY Fed + Yahoo; hourly workflow. FRED remains historical backbone.'
};

payload.histories = histories;
payload.data = data;
payload.errors = errors;
payload.updatedAt = asOf;
fs.writeFileSync('data.json', JSON.stringify(payload));
console.log('live-macro done', asOf);
