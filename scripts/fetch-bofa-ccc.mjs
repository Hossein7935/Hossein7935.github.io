import fs from 'node:fs';

/**
 * ICE BofA CCC & Lower US High Yield Index Effective Yield
 * FRED series BAMLH0A3HYCEY (same data as TradingView FRED:BAMLH0A3HYCEY).
 * Note: Since Apr 2026 FRED only publishes ~3 years (ICE restriction).
 * We keep full available history and accumulate daily updates.
 */

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const data = payload.data || {};
const errors = [];

try {
  const url = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=BAMLH0A3HYCEY';
  const r = await fetch(url, {
    headers: { 'User-Agent': 'MacroWatch/1.0 (+https://hossein7935.github.io/)' },
    signal: AbortSignal.timeout(45000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`FRED BAMLH0A3HYCEY HTTP ${r.status}`);
  const text = await r.text();
  const points = [];
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const [date, val] = line.split(',');
    if (val && val !== '.' && Number.isFinite(Number(val))) {
      points.push({ period: date.slice(0, 10), value: Math.round(Number(val) * 100) / 100 });
    }
  }
  if (points.length < 10) throw new Error(`Only ${points.length} CCC points`);

  // Merge with any previously stored points (in case FRED window moves)
  const map = new Map();
  for (const p of histories['USA-bofaCcc'] || []) {
    if (p?.period && Number.isFinite(Number(p.value))) map.set(String(p.period), Number(p.value));
  }
  for (const p of points) map.set(p.period, p.value);
  const merged = [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, value]) => ({ period, value }));

  // Keep up to ~10y of daily points if we ever accumulate more
  histories['USA-bofaCcc'] = merged.slice(-2600);

  const last = histories['USA-bofaCcc'].at(-1);
  data.USA = data.USA || {};
  data.USA.bofaCcc = {
    value: last.value,
    date: last.period,
    source: 'FRED · BAMLH0A3HYCEY · ICE BofA CCC Yield (TV FRED:BAMLH0A3HYCEY)'
  };

  console.log('BofA CCC:', histories['USA-bofaCcc'].length, 'pts, last', last.period, last.value);
} catch (e) {
  errors.push(`BofA CCC: ${e.message}`);
  console.error(e.message);
}

payload.histories = histories;
payload.data = data;
payload.updatedAt = new Date().toISOString();
payload.errors = [
  ...(payload.errors || []).filter(e => !/bofaCcc|BAMLH0A3|CCC/i.test(e)),
  ...errors
];
fs.writeFileSync('data.json', JSON.stringify(payload, null, 2) + '\n');
