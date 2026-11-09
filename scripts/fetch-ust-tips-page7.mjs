import fs from 'node:fs';

/** Daily US Treasuries + TIPS real yields for USA page 7 */
const SERIES = [
  { id: 'DGS3MO', key: 'us3m', label: 'US 3M' },
  { id: 'DGS2', key: 'us2y', label: 'US 2Y' },
  { id: 'DGS5', key: 'us5y', label: 'US 5Y' },
  { id: 'DGS10', key: 'us10y', label: 'US 10Y' },
  { id: 'DGS30', key: 'us30y', label: 'US 30Y' },
  { id: 'DFII5', key: 'dfii5', label: 'TIPS 5Y' },
  { id: 'DFII10', key: 'dfii10', label: 'TIPS 10Y' }
];

async function fredCsv(id) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=2015-01-01`;
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
    out.push({ period: d.trim().slice(0, 10), value: Math.round(n * 10000) / 10000 });
  }
  return out;
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const data = payload.data || {};
data.USA = data.USA || {};
const errors = Array.isArray(payload.errors)
  ? payload.errors.filter(e => !String(e).startsWith('USA page7'))
  : [];
const asOf = new Date().toISOString();
const meta = { updatedAt: asOf, series: {} };

for (const s of SERIES) {
  try {
    const pts = await fredCsv(s.id);
    if (pts.length < 50) throw new Error(`only ${pts.length} pts`);
    histories[`USA-${s.key}`] = pts;
    const last = pts.at(-1);
    meta.series[s.key] = {
      value: last.value,
      date: last.period,
      n: pts.length,
      source: `FRED · ${s.id}`,
      label: s.label
    };
    console.log(s.id, s.key, pts.length, last.period, last.value);
  } catch (e) {
    errors.push(`USA page7 ${s.id}: ${e.message}`);
    console.error(s.id, e.message);
  }
}

data.USA.ustTipsPage7 = meta;
payload.histories = histories;
payload.data = data;
payload.errors = errors;
payload.updatedAt = asOf;
fs.writeFileSync('data.json', JSON.stringify(payload));
console.log('done');
