import fs from 'node:fs';

/**
 * US Treasury nominal yield curve + TIPS real yields (where available).
 * Nominal (FRED): DGS3MO, DGS1, DGS2, DGS5, DGS10, DGS30
 * TIPS real (FRED): DFII5, DFII10, DFII30 (no liquid 3M/1Y/2Y TIPS on FRED)
 *
 * Chart X: 3M · 1Y · 2Y · 5Y · 10Y · 30Y
 * Nominal = primary series; TIPS = red overlay where a matching tenor exists.
 */

const NOMINAL = [
  { tenor: '3M', months: 3, id: 'DGS3MO' },
  { tenor: '1Y', months: 12, id: 'DGS1' },
  { tenor: '2Y', months: 24, id: 'DGS2' },
  { tenor: '5Y', months: 60, id: 'DGS5' },
  { tenor: '10Y', months: 120, id: 'DGS10' },
  { tenor: '30Y', months: 360, id: 'DGS30' }
];

const TIPS = [
  { tenor: '5Y', months: 60, id: 'DFII5' },
  { tenor: '10Y', months: 120, id: 'DFII10' },
  { tenor: '30Y', months: 360, id: 'DFII30' }
];

async function fetchFredLast(id) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=2020-01-01`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'MacroWatch/1.0 (+https://hossein7935.github.io/)' },
    signal: AbortSignal.timeout(45000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`${id} HTTP ${r.status}`);
  const text = await r.text();
  if (text.trim().startsWith('<')) throw new Error(`${id} not CSV`);
  let last = null;
  const hist = [];
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const [date, val] = line.split(',');
    if (!date || val === '.' || val == null || val === '') continue;
    const v = Number(val);
    if (!Number.isFinite(v)) continue;
    const row = { period: date.slice(0, 10), value: Math.round(v * 1000) / 1000 };
    hist.push(row);
    last = row;
  }
  if (!last) throw new Error(`${id} empty`);
  return { last, hist };
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const data = payload.data || {};
data.USA = data.USA || {};
const errors = Array.isArray(payload.errors)
  ? payload.errors.filter(e => !String(e).startsWith('USA UST curve'))
  : [];
const asOf = new Date().toISOString();

try {
  const nominalPts = [];
  const tipsPts = [];
  const detail = [];

  for (const leg of NOMINAL) {
    try {
      const { last, hist } = await fetchFredLast(leg.id);
      nominalPts.push({ period: leg.tenor, value: last.value });
      detail.push({
        tenor: leg.tenor,
        months: leg.months,
        kind: 'nominal',
        series: leg.id,
        value: last.value,
        date: last.period
      });
      // keep per-tenor history (sampled)
      const key = `USA-ust${leg.tenor}`;
      const maxPts = 800;
      let sampled = hist;
      if (hist.length > maxPts) {
        sampled = [];
        for (let i = 0; i < maxPts; i++) {
          sampled.push(hist[Math.round((i * (hist.length - 1)) / (maxPts - 1))]);
        }
      }
      histories[key] = sampled;
      console.log(leg.id, last.period, last.value);
    } catch (e) {
      console.warn(leg.id, e.message);
      errors.push(`USA UST curve ${leg.id}: ${e.message}`);
    }
  }

  for (const leg of TIPS) {
    try {
      const { last, hist } = await fetchFredLast(leg.id);
      tipsPts.push({ period: leg.tenor, value: last.value });
      detail.push({
        tenor: leg.tenor,
        months: leg.months,
        kind: 'tips',
        series: leg.id,
        value: last.value,
        date: last.period
      });
      const key = `USA-tips${leg.tenor}`;
      const maxPts = 800;
      let sampled = hist;
      if (hist.length > maxPts) {
        sampled = [];
        for (let i = 0; i < maxPts; i++) {
          sampled.push(hist[Math.round((i * (hist.length - 1)) / (maxPts - 1))]);
        }
      }
      histories[key] = sampled;
      console.log(leg.id, last.period, last.value);
    } catch (e) {
      console.warn(leg.id, e.message);
      errors.push(`USA UST curve ${leg.id}: ${e.message}`);
    }
  }

  if (nominalPts.length < 3) throw new Error('nominal curve incomplete');

  histories['USA-ustCurve'] = nominalPts;
  histories['USA-tipsCurve'] = tipsPts;

  // daily snapshot of full curve for history compare later
  const snaps = Array.isArray(histories['USA-ustCurveSnapshots'])
    ? histories['USA-ustCurveSnapshots']
    : [];
  const day = asOf.slice(0, 10);
  const snap = {
    asOf,
    nominal: nominalPts,
    tips: tipsPts,
    detail
  };
  const filtered = snaps.filter(s => String(s.asOf || '').slice(0, 10) !== day);
  filtered.push(snap);
  filtered.sort((a, b) => String(a.asOf).localeCompare(String(b.asOf)));
  histories['USA-ustCurveSnapshots'] = filtered.slice(-180);

  const lastNom = nominalPts.find(p => p.period === '10Y') || nominalPts.at(-1);
  data.USA.ustCurve = {
    value: lastNom.value,
    date: detail.find(d => d.kind === 'nominal' && d.tenor === lastNom.period)?.date || day,
    updatedAt: asOf,
    source: 'FRED · DGS* + DFII* (TIPS real yields)',
    nominal: nominalPts,
    tips: tipsPts,
    detail,
    note: 'TIPS nur 5Y/10Y/30Y (keine liquiden 3M/1Y/2Y TIPS bei FRED). Nominal = Par Yield, TIPS = Real Yield.'
  };

  console.log(
    'UST curve:',
    nominalPts.map(p => `${p.period}=${p.value}`).join(' · '),
    '| TIPS',
    tipsPts.map(p => `${p.period}=${p.value}`).join(' · ')
  );
} catch (e) {
  errors.push(`USA UST curve: ${e.message}`);
  console.error('UST curve failed:', e.message);
}

payload.histories = histories;
payload.data = data;
payload.errors = errors;
payload.updatedAt = asOf;
fs.writeFileSync('data.json', JSON.stringify(payload));
console.log('done');
