import fs from 'node:fs';

/**
 * SOFR expectation curve + tenor catalog with histories
 * Spot: NY Fed | Forwards: CME SR1/SR3 via Yahoo
 * Histories: Yahoo range=max, merged with previous runs (grows over time)
 */

const MONTH_CODES = ['F', 'G', 'H', 'J', 'K', 'M', 'N', 'Q', 'U', 'V', 'X', 'Z'];
const IMM_CODES = ['H', 'M', 'U', 'Z'];

function addMonthsUTC(d, n) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  x.setUTCMonth(x.getUTCMonth() + n);
  return x;
}

function srSymbol(root, d) {
  return `${root}${MONTH_CODES[d.getUTCMonth()]}${String(d.getUTCFullYear()).slice(2)}.CME`;
}

function mergeSeries(oldPts, newPts) {
  const map = new Map();
  for (const p of oldPts || []) {
    if (p && p.period != null && Number.isFinite(Number(p.value))) {
      map.set(String(p.period).slice(0, 10), Number(p.value));
    }
  }
  for (const p of newPts || []) {
    if (p && p.period != null && Number.isFinite(Number(p.value))) {
      map.set(String(p.period).slice(0, 10), Number(p.value));
    }
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, value]) => ({ period, value }));
}

async function fetchJson(url, label) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 MacroWatch/1.0',
      Accept: 'application/json'
    },
    signal: AbortSignal.timeout(30000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`${label} HTTP ${r.status}`);
  return r.json();
}

async function fetchSpotSofR() {
  const j = await fetchJson(
    'https://markets.newyorkfed.org/api/rates/secured/sofr/last/1.json',
    'NY Fed SOFR'
  );
  const row = j?.refRates?.[0];
  if (!row || !Number.isFinite(Number(row.percentRate))) throw new Error('SOFR missing');
  return {
    period: String(row.effectiveDate).slice(0, 10),
    value: Math.round(Number(row.percentRate) * 10000) / 10000
  };
}

async function fetchYahooPrice(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=10d`;
  const j = await fetchJson(url, symbol);
  const meta = j?.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice ?? meta?.previousClose;
  if (!Number.isFinite(Number(price))) throw new Error(`${symbol}: no price`);
  return {
    symbol,
    price: Number(price),
    rate: Math.round((100 - Number(price)) * 10000) / 10000
  };
}

/** Prefer range=max — CME futures often only sparse history on Yahoo */
async function fetchYahooHistory(symbol) {
  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=max`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=max`,
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2y`
  ];
  for (const url of urls) {
    try {
      const j = await fetchJson(url, symbol + ' hist');
      const res = j?.chart?.result?.[0];
      if (!res?.timestamp?.length) continue;
      const closes = res.indicators?.quote?.[0]?.close || [];
      const map = new Map();
      for (let i = 0; i < res.timestamp.length; i++) {
        const c = closes[i];
        if (c == null || !Number.isFinite(Number(c))) continue;
        const period = new Date(res.timestamp[i] * 1000).toISOString().slice(0, 10);
        map.set(period, Math.round((100 - Number(c)) * 10000) / 10000);
      }
      if (map.size >= 1) {
        return [...map.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([period, value]) => ({ period, value }));
      }
    } catch (e) {
      console.warn('hist', symbol, e.message);
    }
  }
  return [];
}

function interpolateAtMonths(strip, months) {
  if (!strip.length) return null;
  if (months <= strip[0].monthsFromNow) {
    const s = strip[0];
    return { value: s.rate, contracts: [s.symbol], method: 'front' };
  }
  if (months >= strip.at(-1).monthsFromNow) {
    const s = strip.at(-1);
    return { value: s.rate, contracts: [s.symbol], method: 'back' };
  }
  let i = 0;
  while (i < strip.length - 1 && strip[i + 1].monthsFromNow < months) i++;
  const a = strip[i];
  const b = strip[i + 1];
  const t = (months - a.monthsFromNow) / (b.monthsFromNow - a.monthsFromNow || 1);
  return {
    value: Math.round((a.rate + t * (b.rate - a.rate)) * 10000) / 10000,
    contracts: a.symbol === b.symbol ? [a.symbol] : [a.symbol, b.symbol],
    method: 'interp'
  };
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const data = payload.data || {};
data.USA = data.USA || {};
const prevFwd = data.USA.sofrFwd && typeof data.USA.sofrFwd === 'object' ? data.USA.sofrFwd : null;
const errors = Array.isArray(payload.errors)
  ? payload.errors.filter(e => !String(e).startsWith('USA SOFR Fwd'))
  : [];
const asOf = new Date().toISOString();
const today = asOf.slice(0, 10);
const now = new Date();

try {
  const spot = await fetchSpotSofR();
  console.log('spot', spot);

  const sr1Strip = [];
  for (let m = 0; m <= 15; m++) {
    const d = addMonthsUTC(now, m);
    const symbol = srSymbol('SR1', d);
    try {
      const q = await fetchYahooPrice(symbol);
      sr1Strip.push({
        monthsFromNow: m,
        yearMonth: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
        symbol: q.symbol,
        price: q.price,
        rate: q.rate,
        kind: 'SR1'
      });
      console.log('SR1', m + 'm', q.symbol, q.rate);
    } catch (e) {
      console.warn('SR1 skip', symbol, e.message);
    }
  }
  if (sr1Strip.length < 4) throw new Error(`SR1 strip too short (${sr1Strip.length})`);

  const sr3Strip = [];
  for (let y = now.getUTCFullYear(); y <= now.getUTCFullYear() + 6; y++) {
    for (const code of IMM_CODES) {
      const mi = MONTH_CODES.indexOf(code);
      if (y === now.getUTCFullYear() && mi < now.getUTCMonth()) continue;
      const symbol = `SR3${code}${String(y).slice(2)}.CME`;
      try {
        const q = await fetchYahooPrice(symbol);
        const monthsFromNow = (y - now.getUTCFullYear()) * 12 + (mi - now.getUTCMonth());
        sr3Strip.push({
          monthsFromNow: Math.max(0, monthsFromNow),
          yearMonth: `${y}-${String(mi + 1).padStart(2, '0')}`,
          symbol: q.symbol,
          price: q.price,
          rate: q.rate,
          kind: 'SR3'
        });
        console.log('SR3', q.symbol, monthsFromNow + 'm', q.rate);
      } catch (e) {}
    }
  }
  sr3Strip.sort((a, b) => a.monthsFromNow - b.monthsFromNow);

  const combined = [];
  const seen = new Set();
  for (const s of [...sr1Strip, ...sr3Strip].sort((a, b) => a.monthsFromNow - b.monthsFromNow)) {
    if (seen.has(s.monthsFromNow)) continue;
    seen.add(s.monthsFromNow);
    combined.push(s);
  }
  const maxM = combined.at(-1)?.monthsFromNow ?? 12;

  const horizons = [
    { tenor: 'Heute', months: 0, spot: true },
    { tenor: '3m', months: 3 },
    { tenor: '6m', months: 6 },
    { tenor: '9m', months: 9 },
    { tenor: '12m', months: 12 },
    { tenor: '2y', months: 24 },
    { tenor: '5y', months: 60 },
    { tenor: '10y', months: 120 },
    { tenor: '30y', months: 360 }
  ];

  const points = [];
  for (const h of horizons) {
    if (h.spot) {
      points.push({
        period: h.tenor,
        tenor: h.tenor,
        months: 0,
        value: spot.value,
        kind: 'spot',
        contracts: ['SOFR'],
        spotDate: spot.period
      });
      continue;
    }
    if (h.months > 12 && maxM < h.months * 0.7) {
      console.log('skip', h.tenor, 'max', maxM);
      continue;
    }
    const interp = interpolateAtMonths(combined, h.months);
    if (!interp) continue;
    points.push({
      period: h.tenor,
      tenor: h.tenor,
      months: h.months,
      value: interp.value,
      kind: 'fwd',
      method: interp.method,
      contracts: interp.contracts
    });
  }
  if (points.length < 3) throw new Error('curve too short');

  histories['USA-sofrFwd'] = points.map(p => ({ period: p.period, value: p.value }));

  const catalog = [];
  for (const s of sr1Strip) {
    catalog.push({
      id: `sr1_${s.yearMonth}`,
      label: `SR1 ${s.yearMonth} (${s.monthsFromNow}m)`,
      symbol: s.symbol,
      kind: 'SR1',
      yearMonth: s.yearMonth,
      monthsFromNow: s.monthsFromNow,
      lastRate: s.rate
    });
  }
  for (const s of sr3Strip.filter(x => x.monthsFromNow <= 72)) {
    const id = `sr3_${s.yearMonth}`;
    if (catalog.some(c => c.id === id)) continue;
    catalog.push({
      id,
      label: `SR3 ${s.yearMonth} (${s.monthsFromNow}m)`,
      symbol: s.symbol,
      kind: 'SR3',
      yearMonth: s.yearMonth,
      monthsFromNow: s.monthsFromNow,
      lastRate: s.rate
    });
  }

  // Fetch history for ALL catalog contracts (range=max), merge with previous
  const histKeys = {};
  for (const c of catalog) {
    const key = `USA-sofrTenor-${c.id}`;
    let neu = [];
    try {
      neu = await fetchYahooHistory(c.symbol);
      console.log('hist raw', c.id, neu.length);
    } catch (e) {
      console.warn('hist fail', c.symbol, e.message);
    }
    // always append today's lastRate so series grows daily even if Yahoo is sparse
    neu = mergeSeries(neu, [{ period: today, value: c.lastRate }]);
    const merged = mergeSeries(histories[key], neu);
    histories[key] = merged;
    histKeys[c.id] = merged.length;
    console.log('hist merge', c.id, merged.length);
  }

  const snaps = Array.isArray(histories['USA-sofrFwdSnapshots'])
    ? histories['USA-sofrFwdSnapshots']
    : [];
  snaps.push({
    asOf,
    spotDate: spot.period,
    curve: points.map(p => ({ period: p.period, value: p.value }))
  });
  while (snaps.length > 120) snaps.shift();
  histories['USA-sofrFwdSnapshots'] = snaps;

  data.USA.sofrFwd = {
    value: points.at(-1).value,
    date: today,
    updatedAt: asOf,
    curve: points.map(p => ({ period: p.period, value: p.value })),
    detail: points,
    source: 'NY Fed SOFR + CME SR1/SR3 (Yahoo)',
    maxStripMonths: maxM,
    sr1Count: sr1Strip.length,
    sr3Count: sr3Strip.length,
    catalog,
    histKeys
  };
  data.USA.sofrTenorCatalog = catalog;

  console.log(
    'OK curve',
    points.map(p => p.tenor).join(','),
    'catalog',
    catalog.length,
    'hist min/max',
    Math.min(...Object.values(histKeys)),
    Math.max(...Object.values(histKeys))
  );
} catch (e) {
  errors.push(`USA SOFR Fwd: ${e.message}`);
  console.error('FAIL', e.message);
  if (prevFwd && prevFwd.curve && prevFwd.curve.length) {
    data.USA.sofrFwd = prevFwd;
    if (!histories['USA-sofrFwd'] && prevFwd.curve) histories['USA-sofrFwd'] = prevFwd.curve;
    console.log('kept previous sofrFwd');
  }
}

payload.histories = histories;
payload.data = data;
payload.errors = errors;
payload.updatedAt = asOf;
fs.writeFileSync('data.json', JSON.stringify(payload));
console.log('done');
