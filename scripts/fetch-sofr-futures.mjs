import fs from 'node:fs';

/**
 * Marktimplizierte SOFR-Erwartungskurve
 * ----------------------------------------
 * Spot: NY Fed SOFR (veröffentlichter Overnight-Satz)
 * Forward: CME One-Month SOFR Futures (SR1) via Yahoo Finance
 *
 * CME-Konvention SR1:
 *   Price = 100 − R
 *   R = erwarteter arithmetischer Durchschnitt der täglichen SOFR
 *       im Liefermonat des Kontrakts (nicht ein Einzeltag-Satz).
 *
 * Darstellung:
 *   Heute  → Spot SOFR (overnight, published)
 *   3/6/9/12m → aus SR1-Strip linear interpoliert auf exakt N Monate
 *              (Wert = erwarteter Monatsdurchschnitt SOFR um diesen Horizont)
 *
 * Zusätzlich SR3-Strip zur Dokumentation der Quartalskontrakte.
 * Historische Snapshots für Vergleich heute vs. vor 30/90 Tagen.
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
    signal: AbortSignal.timeout(25000),
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

/** Linear interpolation of rate at exact month offset from monthly strip. */
function interpolateAtMonths(strip, months) {
  // strip: [{monthsFromNow, rate, symbol, price}]
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
const errors = Array.isArray(payload.errors) ? payload.errors.filter(e => !String(e).startsWith('USA SOFR Fwd')) : [];

const asOf = new Date().toISOString();
const now = new Date();

try {
  const spot = await fetchSpotSofR();

  // --- SR1 monthly strip (0..13 months) ---
  const sr1Strip = [];
  for (let m = 0; m <= 13; m++) {
    const d = addMonthsUTC(now, m);
    const symbol = srSymbol('SR1', d);
    try {
      const q = await fetchYahooPrice(symbol);
      sr1Strip.push({
        monthsFromNow: m,
        yearMonth: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
        symbol: q.symbol,
        price: q.price,
        rate: q.rate
      });
      console.log('SR1', m + 'm', q.symbol, q.price, '→', q.rate);
    } catch (e) {
      console.warn('SR1 skip', symbol, e.message);
    }
  }
  if (sr1Strip.length < 4) throw new Error(`SR1 strip too short (${sr1Strip.length})`);

  // --- SR3 quarterly strip (documentation) ---
  const sr3Strip = [];
  for (let y = now.getUTCFullYear(); y <= now.getUTCFullYear() + 2; y++) {
    for (const code of IMM_CODES) {
      const mi = MONTH_CODES.indexOf(code);
      if (y === now.getUTCFullYear() && mi < now.getUTCMonth()) continue;
      const symbol = `SR3${code}${String(y).slice(2)}.CME`;
      try {
        const q = await fetchYahooPrice(symbol);
        sr3Strip.push({
          symbol: q.symbol,
          yearMonth: `${y}-${String(mi + 1).padStart(2, '0')}`,
          price: q.price,
          rate: q.rate // compounded avg SOFR over SR3 reference quarter
        });
        console.log('SR3', q.symbol, q.price, '→', q.rate);
      } catch (e) {
        console.warn('SR3 skip', symbol, e.message);
      }
    }
  }

  // --- Curve points at exact horizons ---
  const horizons = [
    { tenor: 'Heute', months: 0, spot: true },
    { tenor: '3m', months: 3 },
    { tenor: '6m', months: 6 },
    { tenor: '9m', months: 9 },
    { tenor: '12m', months: 12 }
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
    const interp = interpolateAtMonths(sr1Strip, h.months);
    if (!interp) continue;
    points.push({
      period: h.tenor,
      tenor: h.tenor,
      months: h.months,
      value: interp.value,
      kind: 'sr1',
      note: 'Erwarteter Monatsdurchschnitt SOFR (SR1, 100−Price)',
      contracts: interp.contracts,
      price: interp.price,
      method: interp.method,
      vsSpotBp: Math.round((interp.value - spot.value) * 10000) / 100 // bp
    });
  }

  if (points.length < 3) throw new Error('curve points incomplete');

  // Chart series (period labels on X)
  const chartPts = points.map(p => ({
    period: p.tenor,
    value: p.value
  }));
  histories['USA-sofrFwd'] = chartPts;

  // Daily time series of 12m leg
  const leg12 = points.find(p => p.months === 12);
  if (leg12) {
    const day = asOf.slice(0, 10);
    const prev = histories['USA-sofrFwd12'] || [];
    const map = new Map(prev.map(p => [String(p.period), Number(p.value)]));
    map.set(day, leg12.value);
    histories['USA-sofrFwd12'] = [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-900)
      .map(([period, value]) => ({ period, value: Math.round(value * 10000) / 10000 }));
  }

  // Historical snapshots (one per calendar day; keep ~180 days)
  const snap = {
    asOf,
    spotDate: spot.period,
    spot: spot.value,
    points: points.map(p => ({
      tenor: p.tenor,
      months: p.months,
      value: p.value,
      contracts: p.contracts,
      price: p.price ?? null,
      vsSpotBp: p.vsSpotBp ?? 0,
      kind: p.kind
    })),
    sr1: sr1Strip,
    sr3: sr3Strip,
    source: 'NY Fed SOFR + CME SR1/SR3 (Yahoo delayed)'
  };

  const snaps = Array.isArray(histories['USA-sofrFwdSnapshots'])
    ? histories['USA-sofrFwdSnapshots']
    : [];
  // replace same-day snapshot if exists
  const dayKey = asOf.slice(0, 10);
  const filtered = snaps.filter(s => String(s.asOf || '').slice(0, 10) !== dayKey);
  filtered.push(snap);
  filtered.sort((a, b) => String(a.asOf).localeCompare(String(b.asOf)));
  histories['USA-sofrFwdSnapshots'] = filtered.slice(-180);

  data.USA.sofrFwd = {
    value: leg12 ? leg12.value : points.at(-1).value,
    date: spot.period,
    updatedAt: asOf,
    source: snap.source,
    curve: chartPts,
    detail: points,
    vsSpotBp: leg12 ? leg12.vsSpotBp : null
  };

  console.log(
    'SOFR Fwd:',
    points.map(p => `${p.tenor}=${p.value}${p.vsSpotBp != null ? ` (${p.vsSpotBp > 0 ? '+' : ''}${p.vsSpotBp}bp)` : ''}`).join(' · ')
  );
  console.log('snapshots', histories['USA-sofrFwdSnapshots'].length, 'SR1', sr1Strip.length, 'SR3', sr3Strip.length);
} catch (e) {
  errors.push(`USA SOFR Fwd: ${e.message}`);
  console.error('SOFR Fwd failed:', e.message);
}

payload.histories = histories;
payload.data = data;
payload.errors = errors;
payload.updatedAt = asOf;
fs.writeFileSync('data.json', JSON.stringify(payload));
console.log('done');
