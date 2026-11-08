import fs from 'node:fs';

/** IORB (merged with predecessor IOER for long history) + US 1Y DGS1 */
const IORB_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=IORB&cosd=2015-01-01';
const IOER_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=IOER&cosd=2008-01-01';
const DGS1_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS1&cosd=2015-01-01';

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

/** Merge IOER (pre IORB era) + IORB; IORB wins on overlap */
function mergeIoerIorb(ioer, iorb) {
  const map = new Map();
  for (const p of ioer) map.set(p.period, p.value);
  for (const p of iorb) map.set(p.period, p.value);
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, value]) => ({ period, value }));
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const data = payload.data || {};
data.USA = data.USA || {};
const errors = Array.isArray(payload.errors)
  ? payload.errors.filter(e => !String(e).startsWith('USA IORB1Y'))
  : [];
const asOf = new Date().toISOString();

try {
  const [iorbRaw, ioer, us1y] = await Promise.all([
    loadCsv(IORB_URL),
    loadCsv(IOER_URL),
    loadCsv(DGS1_URL)
  ]);
  const iorb = mergeIoerIorb(ioer, iorbRaw);
  if (iorb.length < 50) throw new Error('IORB/IOER too short');
  if (us1y.length < 50) throw new Error('DGS1 too short');

  histories['USA-iorb'] = iorb;
  histories['USA-us1y'] = us1y;

  const lastI = iorb.at(-1);
  const lastU = us1y.at(-1);
  data.USA.iorbUs1y = {
    iorb: lastI.value,
    iorbDate: lastI.period,
    us1y: lastU.value,
    us1yDate: lastU.period,
    spread:
      lastI && lastU
        ? Math.round((lastU.value - lastI.value) * 10000) / 10000
        : null,
    updatedAt: asOf,
    source: 'FRED IOER+IORB (merged) + DGS1',
    sourceUrl: 'https://fred.stlouisfed.org/series/IORB',
    iorbPoints: iorb.length,
    us1yPoints: us1y.length,
    note: 'IORB ab 2021-07; davor IOER (Vorgänger). US 1Y = DGS1.'
  };

  console.log(
    'IORB/IOER', lastI.period, lastI.value, 'n=', iorb.length,
    'US1Y', lastU.period, lastU.value, 'n=', us1y.length
  );
} catch (e) {
  errors.push(`USA IORB1Y: ${e.message}`);
  console.error(e.message);
}

payload.histories = histories;
payload.data = data;
payload.errors = errors;
payload.updatedAt = asOf;
fs.writeFileSync('data.json', JSON.stringify(payload));
console.log('done');
