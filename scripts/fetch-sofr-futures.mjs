import fs from 'node:fs';

/**
 * SOFR expectation curve + tenor catalog with ≥5y histories
 *
 * Free public sources:
 * - NY Fed SOFR + SOFR averages (SOFRAI)
 * - Yahoo continuous 30-Day Fed Funds futures ZQ=F (rate = 100 − price)
 * - Yahoo CME SR1/SR3 (live levels; limited native history)
 *
 * For individual SR1/SR3 contracts without long Yahoo history:
 * backfill with ZQ history + constant basis (contract − ZQ on as-of day).
 * Documented as approximation in data.USA.sofrFwd.histNote.
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
    .map(([period, value]) => ({ period, value: Math.round(value * 10000) / 10000 }));
}

async function fetchJson(url, label) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 MacroWatch/1.0',
      Accept: 'application/json'
    },
    signal: AbortSignal.timeout(45000),
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

/** Full SOFR history via NY Fed search (chunked by year). */
async function fetchSofRHistory(startYear = 2019) {
  const out = [];
  const endY = new Date().getUTCFullYear();
  for (let y = startYear; y <= endY; y++) {
    const start = `${y}-01-01`;
    const end = `${y}-12-31`;
    try {
      const j = await fetchJson(
        `https://markets.newyorkfed.org/api/rates/secured/sofr/search.json?startDate=${start}&endDate=${end}`,
        `SOFR ${y}`
      );
      for (const row of j?.refRates || []) {
        if (!Number.isFinite(Number(row.percentRate))) continue;
        out.push({
          period: String(row.effectiveDate).slice(0, 10),
          value: Math.round(Number(row.percentRate) * 10000) / 10000
        });
      }
      console.log('SOFR year', y, (j?.refRates || []).length);
    } catch (e) {
      console.warn('SOFR year fail', y, e.message);
    }
  }
  return mergeSeries([], out);
}

/** SOFR 30/90/180 averages (SOFRAI) */
async function fetchSofRAveragesHistory(startYear = 2019) {
  const a30 = [], a90 = [], a180 = [];
  const endY = new Date().getUTCFullYear();
  for (let y = startYear; y <= endY; y++) {
    try {
      const j = await fetchJson(
        `https://markets.newyorkfed.org/api/rates/secured/sofrai/search.json?startDate=${y}-01-01&endDate=${y}-12-31`,
        `SOFRAI ${y}`
      );
      for (const row of j?.refRates || []) {
        const p = String(row.effectiveDate).slice(0, 10);
        if (Number.isFinite(Number(row.average30day)))
          a30.push({ period: p, value: Math.round(Number(row.average30day) * 10000) / 10000 });
        if (Number.isFinite(Number(row.average90day)))
          a90.push({ period: p, value: Math.round(Number(row.average90day) * 10000) / 10000 });
        if (Number.isFinite(Number(row.average180day)))
          a180.push({ period: p, value: Math.round(Number(row.average180day) * 10000) / 10000 });
      }
    } catch (e) {
      console.warn('SOFRAI fail', y, e.message);
    }
  }
  return {
    sofr30: mergeSeries([], a30),
    sofr90: mergeSeries([], a90),
    sofr180: mergeSeries([], a180)
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

async function fetchYahooRateHistory(symbol, asRateFromPrice = true) {
  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=max`,
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5y`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=max`
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
        const value = asRateFromPrice
          ? Math.round((100 - Number(c)) * 10000) / 10000
          : Math.round(Number(c) * 10000) / 10000;
        map.set(period, value);
      }
      if (map.size >= 10) {
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

/** Backfill short series with ZQ path + constant basis to reach ≥5y. */
function backfillWithZq(shortPts, zqPts, lastRate) {
  if (!zqPts.length) return shortPts || [];
  const zqLast = zqPts.at(-1).value;
  const target = Number.isFinite(lastRate) ? lastRate : (shortPts?.at(-1)?.value ?? zqLast);
  const basis = target - zqLast;
  const fromZq = zqPts.map(p => ({
    period: p.period,
    value: Math.round((p.value + basis) * 10000) / 10000
  }));
  // Prefer actual observations over backfill on same dates
  return mergeSeries(fromZq, shortPts || []);
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

  // Long reference series
  const sofrHist = await fetchSofRHistory(2019);
  const avgs = await fetchSofRAveragesHistory(2019);
  const zqHist = await fetchYahooRateHistory('ZQ=F', true);
  console.log('len SOFR', sofrHist.length, 'ZQ', zqHist.length, 'avg30', avgs.sofr30.length);

  histories['USA-sofrTenor-spot'] = mergeSeries(histories['USA-sofrTenor-spot'], sofrHist);
  histories['USA-sofrTenor-sofr30'] = mergeSeries(histories['USA-sofrTenor-sofr30'], avgs.sofr30);
  histories['USA-sofrTenor-sofr90'] = mergeSeries(histories['USA-sofrTenor-sofr90'], avgs.sofr90);
  histories['USA-sofrTenor-sofr180'] = mergeSeries(histories['USA-sofrTenor-sofr180'], avgs.sofr180);
  histories['USA-sofrTenor-zq'] = mergeSeries(histories['USA-sofrTenor-zq'], zqHist);

  // SR1 strip
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
    if (h.months > 12 && maxM < h.months * 0.7) continue;
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

  // Catalog: long-history series first, then futures
  const catalog = [
    {
      id: 'spot',
      label: 'SOFR Overnight (Spot)',
      symbol: 'NYFED:SOFR',
      kind: 'REF',
      lastRate: sofrHist.at(-1)?.value ?? spot.value,
      histSource: 'NY Fed'
    },
    {
      id: 'sofr30',
      label: 'SOFR 30-Day Average',
      symbol: 'NYFED:SOFR30',
      kind: 'REF',
      lastRate: avgs.sofr30.at(-1)?.value,
      histSource: 'NY Fed'
    },
    {
      id: 'sofr90',
      label: 'SOFR 90-Day Average',
      symbol: 'NYFED:SOFR90',
      kind: 'REF',
      lastRate: avgs.sofr90.at(-1)?.value,
      histSource: 'NY Fed'
    },
    {
      id: 'sofr180',
      label: 'SOFR 180-Day Average',
      symbol: 'NYFED:SOFR180',
      kind: 'REF',
      lastRate: avgs.sofr180.at(-1)?.value,
      histSource: 'NY Fed'
    },
    {
      id: 'zq',
      label: 'Fed Funds Futures ZQ (cont.)',
      symbol: 'ZQ=F',
      kind: 'REF',
      lastRate: zqHist.at(-1)?.value,
      histSource: 'Yahoo ZQ=F'
    }
  ];

  for (const s of sr1Strip) {
    catalog.push({
      id: `sr1_${s.yearMonth}`,
      label: `SR1 ${s.yearMonth} (${s.monthsFromNow}m)`,
      symbol: s.symbol,
      kind: 'SR1',
      yearMonth: s.yearMonth,
      monthsFromNow: s.monthsFromNow,
      lastRate: s.rate,
      histSource: 'Yahoo + ZQ-Backfill'
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
      lastRate: s.rate,
      histSource: 'Yahoo + ZQ-Backfill'
    });
  }

  const histKeys = {};
  for (const c of catalog) {
    const key = `USA-sofrTenor-${c.id}`;
    if (c.kind === 'REF') {
      histKeys[c.id] = (histories[key] || []).length;
      continue;
    }
    let raw = [];
    try {
      raw = await fetchYahooRateHistory(c.symbol, true);
    } catch (e) {
      console.warn('hist fail', c.symbol, e.message);
    }
    raw = mergeSeries(raw, [{ period: today, value: c.lastRate }]);
    // Always ensure ≥5y via ZQ backfill when short
    const filled = backfillWithZq(raw, zqHist, c.lastRate);
    histories[key] = mergeSeries(histories[key], filled);
    histKeys[c.id] = histories[key].length;
    console.log('tenor', c.id, 'raw', raw.length, 'final', histKeys[c.id]);
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
    source: 'NY Fed SOFR + CME SR1/SR3 (Yahoo) + ZQ backfill',
    histNote:
      'SR1/SR3-Einzelkontrakte: Yahoo liefert kaum Historie. Fehlende Jahre werden mit ZQ=F (Fed-Funds-Futures) + konstantem Basis-Spread angenähert. REF-Serien (SOFR, Averages, ZQ) sind echte Markt-/Fed-Historie.',
    maxStripMonths: maxM,
    sr1Count: sr1Strip.length,
    sr3Count: sr3Strip.length,
    catalog,
    histKeys
  };
  data.USA.sofrTenorCatalog = catalog;

  const lens = Object.values(histKeys);
  console.log(
    'OK curve',
    points.map(p => p.tenor).join(','),
    'catalog',
    catalog.length,
    'hist min/max',
    Math.min(...lens),
    Math.max(...lens)
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
