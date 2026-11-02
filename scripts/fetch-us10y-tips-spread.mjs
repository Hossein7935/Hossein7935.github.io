import fs from 'node:fs';

/**
 * US 10Y nominal − TIPS 10Y = 10-Year Breakeven Inflation (FRED T10YIE).
 * Daily history ≥ 5 years; updates automatically on each workflow run.
 */

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const data = payload.data || {};
const errors = [];

try {
  // ≥ 5 years
  const url = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=T10YIE&cosd=2021-01-01';
  const r = await fetch(url, {
    headers: { 'User-Agent': 'MacroWatch/1.0 (+https://hossein7935.github.io/)' },
    signal: AbortSignal.timeout(45000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`FRED T10YIE HTTP ${r.status}`);
  const text = await r.text();
  const points = [];
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const [date, val] = line.split(',');
    if (val && val !== '.' && Number.isFinite(Number(val))) {
      points.push({
        period: date.slice(0, 10),
        value: Math.round(Number(val) * 100) / 100
      });
    }
  }
  if (points.length < 50) throw new Error(`Only ${points.length} T10YIE points`);

  const map = new Map();
  for (const p of histories['USA-us10yTips'] || []) {
    if (p?.period && Number.isFinite(Number(p.value))) map.set(String(p.period), Number(p.value));
  }
  for (const p of points) map.set(p.period, p.value);
  const merged = [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, value]) => ({ period, value }));

  // Keep ~5+ years daily (~1300–1600 trading days)
  histories['USA-us10yTips'] = merged.slice(-1800);

  const last = histories['USA-us10yTips'].at(-1);
  data.USA = data.USA || {};
  data.USA.us10yTips = {
    value: last.value,
    date: last.period,
    source: 'FRED · T10YIE · US10Y − TIPS10Y (Breakeven, 5y)'
  };

  console.log('US10Y−TIPS10Y:', histories['USA-us10yTips'].length, 'pts, first', histories['USA-us10yTips'][0]?.period, 'last', last.period, last.value);
} catch (e) {
  errors.push(`US10Y−TIPS10Y: ${e.message}`);
  console.error(e.message);
}

payload.histories = histories;
payload.data = data;
payload.updatedAt = new Date().toISOString();
payload.errors = [
  ...(payload.errors || []).filter(e => !/us10yTips|T10YIE|TIPS10/i.test(e)),
  ...errors
];
fs.writeFileSync('data.json', JSON.stringify(payload, null, 2) + '\n');
