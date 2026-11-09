import fs from 'node:fs';

/**
 * Marktimplizierte SOFR-Erwartungskurve
 * Spot: NY Fed SOFR
 * Forward: CME SR1 (1M) + SR3 (3M) via Yahoo
 * Horizons: Heute, 3m, 6m, 9m, 12m, 2y, 5y, 10y, 30y (nur wenn Strip reicht)
 * Plus: individuelle Kontrakt-Historien für Laufzeiten-Picker
 */

const MONTH_CODES = ['F', 'G', 'H', 'J', 'K', 'M', 'N', 'Q', 'U', 'V', 'X', 'Z'];
const IMM_CODES = ['H', 'M', 'U', 'Z'];

function addMonthsUTC(d, n) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  x.setUTCMonth(x.getUTCMonth() + n);
  return x;
}

function srSymbol(root, d) {
  const code = MONTH_CODES[d.getUTCMonth()];
  const yy = String(d.getUTCFullYear()).slice(2);
  return `${root}${code}${yy}.CME`;
}

async function fetchJson(url, label) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'MacroWatch/1.0 (+https://hossein7935.github.io/)',
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
  const rate = Math.round((100 - Number(price)) * 10000) / 10000;
  return { symbol, price: Number(price), rate };
}

async function fetchYahooHistory(symbol, range = '2y') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;
  const j = await fetchJson(url, symbol + ' hist');
  const res = j?.chart?.result?.[0];
  if (!res) return [];
  const ts = res.timestamp || [];
  const closes = res.indicators?.quote?.[0]?.close || [];
  const out = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (c == null || !Number.isFinite(Number(c))) continue;
    const period = new Date(ts[i] * 1000).toISOString().slice(0, 10);
    const rate = Math.round((100 - Number(c)) * 10000) / 10000;
    out.push({ period, value: rate });
  }
  const map = new Map(out.map(p => [p.period, p.value]));
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, value]) => ({ period, value }));
}

function interpolateAtMonths(strip, months) {
  if (!strip.length) return null;
  if (months <= strip[0].monthsFromNow) {
    const s = strip[0];
    return { value: s.rate, contracts: [s.symbol], price: s.price, method: 'front' };
  }
  if (months >= strip.at(-1).monthsFromNow) {
    const s = strip.at(-1);
    return { value: s.rate, contracts: [s.symbol], price: s.price, method: 'back' };
  }
  let i = 0;
  while (i < strip.length - 1 && strip[i + 1].monthsFromNow < months) i++;
  const a = strip[i];
  const b = strip[i + 1];
  const t = (months - a.monthsFromNow) / (b.monthsFromNow - a.monthsFromNow || 1);
  const value = Math.round((a.rate + t * (b.rate - a.rate)) * 10000) / 10000;
  return {
    value,
    contracts: a.symbol === b.symbol ? [a.symbol] : [a.symbol, b.symbol],
    price: Math.round((a.price + t * (b.price - a.price)) * 10000) / 10000,
    method: 'interp'
  };
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const data = payload.data || {};
data.USA = data.USA || {};
const errors = Array.isArray(payload.errors)
  ? payload.errors.filter(e => !String(e).startsWith('USA SOFR Fwd'))
  : [];
const asOf = new Date().toISOString();
const now = new Date();

try {
  const spot = await fetchSpotSofR();

  // SR1 monthly strip 0..18 months
  const sr1Strip = [];
  for (let m = 0; m <= 18; m++) {
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
      console.log('SR1', m + 'm', q.symbol, q.price, '→', q.rate);
    } catch (e) {
      console.warn('SR1 skip', symbol, e.message);
    }
  }
  if (sr1Strip.length < 4) throw new Error(`SR1 strip too short (${sr1Strip.length})`);

  // SR3 quarterly strip out to ~10y (as far as Yahoo lists)
  const sr3Strip = [];
  for (let y = now.getUTCFullYear(); y <= now.getUTCFullYear() + 10; y++) {
    for (const code of IMM_CODES) {
      const mi = MONTH_CODES.indexOf(code);
      if (y === now.getUTCFullYear() && mi < now.getUTCMonth()) continue;
      const symbol = `SR3${code}${String(y).slice(2)}.CME`;
      try {
        const q = await fetchYahooPrice(symbol);
        const monthsFromNow =
          (y - now.getUTCFullYear()) * 12 + (mi - now.getUTCMonth());
        sr3Strip.push({
          monthsFromNow: Math.max(0, monthsFromNow),
          yearMonth: `${y}-${String(mi + 1).padStart(2, '0')}`,
          symbol: q.symbol,
          price: q.price,
          rate: q.rate,
          kind: 'SR3'
        });
        console.log('SR3', q.symbol, monthsFromNow + 'm', q.price, '→', q.rate);
      } catch (e) {
        // many far contracts missing — stop after several consecutive misses per year
      }
    }
  }
  sr3Strip.sort((a, b) => a.monthsFromNow - b.monthsFromNow);

  // Combined strip for long interpolation: prefer SR1 near, SR3 far
  const combined = [];
  const seenM = new Set();
  for (const s of [...sr1Strip, ...sr3Strip].sort((a, b) => a.monthsFromNow - b.monthsFromNow)) {
    const k = s.monthsFromNow;
    if (seenM.has(k)) continue;
    seenM.add(k);
    combined.push(s);
  }

  const maxM = combined.length ? combined.at(-1).monthsFromNow : 12;

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
        note: 'Veröffentlichter Overnight-SOFR (NY Fed)',
        contracts: ['SOFR'],
        spotDate: spot.period
      });
      continue;
    }
    // only include long horizons if strip reaches at least ~70% of target
    if (h.months > 12 && maxM < h.months * 0.7) {
      console.log('skip horizon', h.tenor, 'maxStrip', maxM);
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
      contracts: interp.contracts,
      note: h.months > 12 ? 'SR3-Schwerpunkt' : 'SR1/SR3 Strip'
    });
  }

  histories['USA-sofrFwd'] = points.map(p => ({ period: p.period, value: p.value }));

  // Contract catalog + histories (SR1 near + SR3 available)
  const catalog = [];
  const histKeys = {};
  for (const s of sr1Strip) {
    const id = `sr1_${s.yearMonth}`;
    catalog.push({
      id,
      label: `SR1 ${s.yearMonth} (${s.monthsFromNow}m)`,
      symbol: s.symbol,
      kind: 'SR1',
      yearMonth: s.yearMonth,
      monthsFromNow: s.monthsFromNow,
      lastRate: s.rate
    });
    try {
      const hist = await fetchYahooHistory(s.symbol, '2y');
      if (hist.length >= 10) {
        histories[`USA-sofrTenor-${id}`] = hist;
        histKeys[id] = hist.length;
        console.log('hist', id, hist.length, hist.at(-1)?.period);
      }
    } catch (e) {
      console.warn('hist fail', s.symbol, e.message);
    }
  }
  // SR3 sample: every contract up to ~5y for picker
  for (const s of sr3Strip.filter(x => x.monthsFromNow <= 60)) {
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
    try {
      const hist = await fetchYahooHistory(s.symbol, '2y');
      if (hist.length >= 10) {
        histories[`USA-sofrTenor-${id}`] = hist;
        histKeys[id] = hist.length;
      }
    } catch (e) {
      console.warn('hist fail', s.symbol, e.message);
    }
  }

  // Snapshot for hist comparison panel (existing feature)
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
    value: points.at(-1)?.value,
    date: asOf.slice(0, 10),
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
    'curve points',
    points.map(p => p.tenor + '=' + p.value).join(' '),
    'catalog',
    catalog.length
  );
} catch (e) {
  errors.push(`USA SOFR Fwd: ${e.message}`);
  console.error(e);
}

payload.histories = histories;
payload.data = data;
payload.errors = errors;
payload.updatedAt = asOf;
fs.writeFileSync('data.json', JSON.stringify(payload));
console.log('done');
