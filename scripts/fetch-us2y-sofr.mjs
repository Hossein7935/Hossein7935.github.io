import fs from 'node:fs';

/** US 2Y (FRED DGS2) + ensure SOFR history for dual chart on page 3 */
const DGS2 = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS2&cosd=2015-01-01';
const SOFR = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=SOFR&cosd=2018-01-01';

async function loadCsv(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'MacroWatch/1.0', Accept: 'text/csv' },
    signal: AbortSignal.timeout(60000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const out = [];
  for (const line of (await r.text()).trim().split(/\r?\n/).slice(1)) {
    const [d, v] = line.split(',');
    if (!d || v === '.' || v == null || v === '') continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    out.push({ period: d.trim(), value: n });
  }
  return out;
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const data = payload.data || {};
data.USA = data.USA || {};
const errors = Array.isArray(payload.errors)
  ? payload.errors.filter(e => !String(e).startsWith('USA US2YSOFR'))
  : [];
const asOf = new Date().toISOString();

try {
  const [us2y, sofr] = await Promise.all([loadCsv(DGS2), loadCsv(SOFR)]);
  if (us2y.length < 50) throw new Error('DGS2 too short');
  if (sofr.length < 50) throw new Error('SOFR too short');

  histories['USA-us2y'] = us2y;
  // merge SOFR into existing if longer, else replace
  const prev = histories['USA-sofr'] || [];
  if (sofr.length >= prev.length) histories['USA-sofr'] = sofr;

  const lastU = us2y.at(-1);
  const lastS = sofr.at(-1);
  data.USA.us2ySofr = {
    us2y: lastU.value,
    us2yDate: lastU.period,
    sofr: lastS.value,
    sofrDate: lastS.period,
    spread: Math.round((lastU.value - lastS.value) * 10000) / 10000,
    updatedAt: asOf,
    source: 'FRED DGS2 + SOFR',
    us2yPoints: us2y.length,
    sofrPoints: sofr.length,
    note: 'US 2Y blau · SOFR rot · nicht Teil der Differenz-Funktion'
  };

  console.log('US2Y', lastU.period, lastU.value, 'SOFR', lastS.period, lastS.value, 'n', us2y.length, sofr.length);
} catch (e) {
  errors.push(`USA US2YSOFR: ${e.message}`);
  console.error(e.message);
}

payload.histories = histories;
payload.data = data;
payload.errors = errors;
payload.updatedAt = asOf;
fs.writeFileSync('data.json', JSON.stringify(payload));
console.log('done');
