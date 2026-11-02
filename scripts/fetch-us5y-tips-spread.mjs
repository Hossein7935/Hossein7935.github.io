import fs from 'node:fs';

/**
 * US 5Y nominal − TIPS 5Y = 5-Year Breakeven Inflation (FRED T5YIE).
 * Daily history ≥ 5 years; updates automatically on each workflow run.
 */

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const data = payload.data || {};
const errors = [];

try {
  const url = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=T5YIE&cosd=2021-01-01';
  const r = await fetch(url, {
    headers: { 'User-Agent': 'MacroWatch/1.0 (+https://hossein7935.github.io/)' },
    signal: AbortSignal.timeout(45000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`FRED T5YIE HTTP ${r.status}`);
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
  if (points.length < 50) throw new Error(`Only ${points.length} T5YIE points`);

  const map = new Map();
  for (const p of histories['USA-us5yTips'] || []) {
    if (p?.period && Number.isFinite(Number(p.value))) map.set(String(p.period), Number(p.value));
  }
  for (const p of points) map.set(p.period, p.value);
  const merged = [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, value]) => ({ period, value }));

  histories['USA-us5yTips'] = merged.slice(-1800);

  const last = histories['USA-us5yTips'].at(-1);
  data.USA = data.USA || {};
  data.USA.us5yTips = {
    value: last.value,
    date: last.period,
    source: 'FRED · T5YIE · US5Y − TIPS5Y (Breakeven, 5y)'
  };

  console.log('US5Y−TIPS5Y:', histories['USA-us5yTips'].length, 'pts, first', histories['USA-us5yTips'][0]?.period, 'last', last.period, last.value);
} catch (e) {
  errors.push(`US5Y−TIPS5Y: ${e.message}`);
  console.error(e.message);
}

payload.histories = histories;
payload.data = data;
payload.updatedAt = new Date().toISOString();
payload.errors = [
  ...(payload.errors || []).filter(e => !/us5yTips|T5YIE|TIPS5/i.test(e)),
  ...errors
];
fs.writeFileSync('data.json', JSON.stringify(payload, null, 2) + '\n');
