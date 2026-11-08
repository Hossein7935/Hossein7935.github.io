import fs from 'node:fs';

/** IORB (red) + US 1Y Treasury DGS1 (blue) — daily from FRED */
const IORB_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=IORB&cosd=2015-01-01';
const DGS1_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS1&cosd=2015-01-01';

async function loadCsv(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'MacroWatch/1.0', Accept: 'text/csv' },
    signal: AbortSignal.timeout(60000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const text = await r.text();
  const out = [];
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
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
  ? payload.errors.filter(e => !String(e).startsWith('USA IORB1Y'))
  : [];
const asOf = new Date().toISOString();

try {
  const [iorb, us1y] = await Promise.all([loadCsv(IORB_URL), loadCsv(DGS1_URL)]);
  if (iorb.length < 50) throw new Error('IORB too short');
  if (us1y.length < 50) throw new Error('DGS1 too short');

  histories['USA-iorb'] = iorb;
  histories['USA-us1y'] = us1y;

  const lastI = iorb.at(-1);
  const lastU = us1y.at(-1);
  const spread =
    lastI && lastU && lastI.period === lastU.period
      ? Math.round((lastU.value - lastI.value) * 10000) / 10000
      : null;

  data.USA.iorbUs1y = {
    iorb: lastI.value,
    iorbDate: lastI.period,
    us1y: lastU.value,
    us1yDate: lastU.period,
    spread,
    updatedAt: asOf,
    source: 'FRED IORB + DGS1',
    sourceUrl: 'https://fred.stlouisfed.org/series/IORB',
    iorbPoints: iorb.length,
    us1yPoints: us1y.length,
    note: 'IORB (Interest on Reserve Balances) rot · US 1Y Treasury (DGS1) blau'
  };

  console.log(
    'IORB', lastI.period, lastI.value,
    'US1Y', lastU.period, lastU.value,
    'n', iorb.length, us1y.length
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
