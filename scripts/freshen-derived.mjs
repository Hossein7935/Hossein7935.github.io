import fs from 'node:fs';

/**
 * Fills FRED-lagged series with newer days from sources that are already in
 * data.json (no extra network calls):
 *
 *   USA-us3m/us1y/us2y/us5y/us10y/us30y  FRED + U.S. Treasury CSV + TradingView (today)
 *   USA-dfii5/dfii10                     FRED + U.S. Treasury real-yield CSV
 *   USA-sofr/effr                        FRED + NY Fed API
 *   USA-iorb                             FRED
 *
 * FRED publishes DGS*, DFII*, T10Y2Y, T10YIE ... with a delay of one to two
 * business days. FRED computes these series from exactly the same Treasury
 * yields, so appending the newer days keeps the methodology identical:
 *
 *   T10Y2Y = DGS10 - DGS2       T10YIE = DGS10 - DFII10
 *   10Y-5Y = DGS10 - DGS5       T5YIE  = DGS5  - DFII5
 *   SOFR-IORB = SOFR - IORB
 *
 * Runs after all fetch-*.mjs scripts. Only appends days that are newer than
 * the last day of the existing series and never removes points.
 */

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const data = payload.data || {};
data.USA = data.USA || {};
const log = [];

const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const isWeekday = (s) => {
  const d = new Date(`${s}T00:00:00Z`).getUTCDay();
  return d >= 1 && d <= 5;
};
const round = (v, n = 4) => Math.round(v * 10 ** n) / 10 ** n;

function dayMap(key) {
  const map = new Map();
  for (const p of histories[key] || []) {
    if (p && isDay(p.period) && Number.isFinite(Number(p.value))) map.set(p.period, Number(p.value));
  }
  return map;
}

function lastDay(key) {
  const arr = (histories[key] || []).filter((p) => p && isDay(p.period) && Number.isFinite(Number(p.value)));
  return arr.length ? arr[arr.length - 1] : null;
}

function sourceWithSuffix(src, suffix) {
  const base = String(src || '').replace(/\s*\+ neuere Tage:.*$/, '');
  return base ? `${base} + neuere Tage: ${suffix}` : suffix;
}

/**
 * Append target[d] = fn(a[d], b[d]) for every weekday d newer than the last
 * point of the target history where both inputs exist.
 */
function appendDerived(targetKey, aKey, bKey, fn, opts = {}) {
  const target = histories[targetKey];
  if (!Array.isArray(target) || !target.length) return 0;
  const last = lastDay(targetKey);
  if (!last) return 0;
  const a = dayMap(aKey);
  const b = dayMap(bKey);
  const dates = [...a.keys()].filter((d) => d > last.period && b.has(d) && isWeekday(d)).sort();
  if (!dates.length) return 0;

  // sanity check on the overlap day: derived value should match the FRED value
  if (a.has(last.period) && b.has(last.period)) {
    const check = fn(a.get(last.period), b.get(last.period));
    const diff = Math.abs(check - Number(last.value));
    if (diff > (opts.maxOverlapDiff ?? 0.08)) {
      log.push(`${targetKey}: übersprungen (Abweichung am ${last.period}: ${round(diff, 3)})`);
      return 0;
    }
  }

  for (const d of dates) target.push({ period: d, value: round(fn(a.get(d), b.get(d)), opts.digits ?? 4) });
  const newest = target[target.length - 1];
  if (opts.dataKey) {
    const prev = data.USA[opts.dataKey] || {};
    data.USA[opts.dataKey] = {
      ...prev,
      value: newest.value,
      date: newest.period,
      source: sourceWithSuffix(prev.source, opts.label)
    };
  }
  log.push(`${targetKey}: +${dates.length} (${dates[0]} … ${newest.period} = ${newest.value})`);
  return dates.length;
}

// --- spreads -------------------------------------------------------------
appendDerived('USA-t10y2y', 'USA-us10y', 'USA-us2y', (a, b) => a - b, {
  dataKey: 't10y2y', label: 'Treasury/TradingView (US10Y − US2Y)', digits: 3
});
appendDerived('USA-t10y5y', 'USA-us10y', 'USA-us5y', (a, b) => a - b, {
  dataKey: 't10y5y', label: 'Treasury/TradingView (US10Y − US5Y)', digits: 3
});
appendDerived('USA-us10yTips', 'USA-us10y', 'USA-dfii10', (a, b) => a - b, {
  dataKey: 'us10yTips', label: 'Treasury (10Y nominal − 10Y real)', digits: 3
});
appendDerived('USA-us5yTips', 'USA-us5y', 'USA-dfii5', (a, b) => a - b, {
  dataKey: 'us5yTips', label: 'Treasury (5Y nominal − 5Y real)', digits: 3
});
appendDerived('USA-sofrIorb', 'USA-sofr', 'USA-iorb', (a, b) => a - b, {
  dataKey: 'sofrIorb', label: 'NY Fed SOFR − IORB', digits: 4, maxOverlapDiff: 0.02
});

// --- TIPS cards (monthly sampled chart + latest value) ---------------------
for (const [key, base, sid] of [['tips5', 'USA-dfii5', 'DFII5'], ['tips10', 'USA-dfii10', 'DFII10']]) {
  const latest = lastDay(base);
  const cur = data.USA[key];
  if (!latest || !cur || !isDay(cur.date) || latest.period <= cur.date) continue;
  const value = round(latest.value, 2);
  data.USA[key] = {
    ...cur,
    value,
    date: latest.period,
    source: sourceWithSuffix(cur.source, `U.S. Treasury Real Yield Curve (${sid})`)
  };
  const hist = histories[`USA-${key}`];
  if (Array.isArray(hist) && hist.length) {
    const month = latest.period.slice(0, 7);
    const lastPt = hist[hist.length - 1];
    if (lastPt.period === month) lastPt.value = value;
    else if (String(lastPt.period) < month) hist.push({ period: month, value });
  }
  log.push(`${key}: ${cur.date} → ${latest.period} = ${value}`);
}

// --- UST + TIPS curve (USA page 4) -----------------------------------------
const CURVE = [
  { tenor: '3M', kind: 'nominal', base: 'USA-us3m', hist: 'USA-ust3M' },
  { tenor: '1Y', kind: 'nominal', base: 'USA-us1y', hist: 'USA-ust1Y' },
  { tenor: '2Y', kind: 'nominal', base: 'USA-us2y', hist: 'USA-ust2Y' },
  { tenor: '5Y', kind: 'nominal', base: 'USA-us5y', hist: 'USA-ust5Y' },
  { tenor: '10Y', kind: 'nominal', base: 'USA-us10y', hist: 'USA-ust10Y' },
  { tenor: '30Y', kind: 'nominal', base: 'USA-us30y', hist: 'USA-ust30Y' },
  { tenor: '5Y', kind: 'tips', base: 'USA-dfii5', hist: 'USA-tips5Y' },
  { tenor: '10Y', kind: 'tips', base: 'USA-dfii10', hist: 'USA-tips10Y' }
];
const curve = data.USA.ustCurve;
if (curve && Array.isArray(curve.detail)) {
  let updated = 0;
  for (const leg of CURVE) {
    const latest = lastDay(leg.base);
    const det = curve.detail.find((d) => d.kind === leg.kind && d.tenor === leg.tenor);
    if (!latest || !det || !isDay(det.date) || latest.period <= det.date) continue;
    const value = round(latest.value, 3);
    det.value = value;
    det.date = latest.period;
    det.series = `${det.series || ''} → Treasury/TV`.replace(/( → Treasury\/TV)+$/, ' → Treasury/TV');
    const list = leg.kind === 'nominal' ? curve.nominal : curve.tips;
    const pt = Array.isArray(list) ? list.find((p) => p.period === leg.tenor) : null;
    if (pt) pt.value = value;
    // extend the per-tenor history that the curve-compare view uses
    const h = histories[leg.hist];
    if (Array.isArray(h) && h.length) {
      const hl = h[h.length - 1];
      const fresh = (histories[leg.base] || []).filter((p) => isDay(p.period) && p.period > hl.period && isWeekday(p.period));
      for (const p of fresh) h.push({ period: p.period, value: round(Number(p.value), 3) });
    }
    updated++;
  }
  if (updated) {
    if (Array.isArray(curve.nominal)) histories['USA-ustCurve'] = curve.nominal.map((p) => ({ ...p }));
    if (Array.isArray(curve.tips)) histories['USA-tipsCurve'] = curve.tips.map((p) => ({ ...p }));
    const ten = curve.detail.find((d) => d.kind === 'nominal' && d.tenor === '10Y');
    if (ten) {
      curve.value = ten.value;
      curve.date = ten.date;
    }
    curve.source = sourceWithSuffix(curve.source, 'U.S. Treasury + TradingView');
    const snaps = histories['USA-ustCurveSnapshots'];
    if (Array.isArray(snaps) && snaps.length) {
      const s = snaps[snaps.length - 1];
      s.nominal = (curve.nominal || []).map((p) => ({ ...p }));
      s.tips = (curve.tips || []).map((p) => ({ ...p }));
      s.detail = curve.detail.map((d) => ({ ...d }));
    }
    log.push(`ustCurve: ${updated} Laufzeiten aktualisiert (10Y ${curve.date} = ${curve.value})`);
  }
}

// --- US 2Y + SOFR card label (page 3) --------------------------------------
if (data.USA.us2ySofr) {
  const u = lastDay('USA-us2y');
  const s = lastDay('USA-sofr');
  const m = data.USA.us2ySofr;
  if (u && s && (u.period > String(m.us2yDate || '') || s.period > String(m.sofrDate || ''))) {
    m.us2y = u.value;
    m.us2yDate = u.period;
    m.sofr = s.value;
    m.sofrDate = s.period;
    m.spread = round(u.value - s.value);
    m.source = 'FRED DGS2 + Treasury + TradingView · SOFR FRED + NY Fed';
    log.push(`us2ySofr: US2Y ${u.period} · SOFR ${s.period}`);
  }
}

payload.histories = histories;
payload.data = data;
fs.writeFileSync('data.json', JSON.stringify(payload));
console.log(log.length ? log.join('\n') : 'nichts aufzufüllen');
