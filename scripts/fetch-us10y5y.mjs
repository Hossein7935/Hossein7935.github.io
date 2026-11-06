import fs from 'node:fs';

/**
 * US 10Y − 5Y Treasury spread = DGS10 − DGS5 (FRED).
 * T10Y5Y does not exist on FRED; we compute it ourselves.
 * Daily history from 2016; updates on each workflow run.
 */

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const data = payload.data || {};
const errors = [];

async function fredCsv(id, start) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${start}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'MacroWatch/1.0 (+https://hossein7935.github.io/)' },
    signal: AbortSignal.timeout(45000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`FRED ${id} HTTP ${r.status}`);
  const text = await r.text();
  if (text.includes('<html')) throw new Error(`FRED ${id} blocked or HTML response`);
  const map = new Map();
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const [date, val] = line.split(',');
    if (val && val !== '.' && Number.isFinite(Number(val))) {
      map.set(date.slice(0, 10), Number(val));
    }
  }
  return map;
}

try {
  const start = '2016-01-01';
  const [map10, map5] = await Promise.all([
    fredCsv('DGS10', start),
    fredCsv('DGS5', start)
  ]);

  const points = [];
  for (const [period, y10] of map10) {
    const y5 = map5.get(period);
    if (y5 != null && Number.isFinite(y5)) {
      points.push({
        period,
        value: Math.round((y10 - y5) * 1000) / 1000
      });
    }
  }
  points.sort((a, b) => a.period.localeCompare(b.period));

  if (points.length < 50) throw new Error(`Only ${points.length} computed 10Y−5Y points`);

  // Even sample across full range, keep last ~1600 points
  const maxPts = 1600;
  let sampled;
  if (points.length <= maxPts) {
    sampled = points;
  } else {
    sampled = [];
    for (let i = 0; i < maxPts; i++) {
      const idx = Math.round((i * (points.length - 1)) / (maxPts - 1));
      sampled.push(points[idx]);
    }
    const out = [];
    for (const p of sampled) {
      if (!out.length || out.at(-1).period !== p.period) out.push(p);
    }
    sampled = out;
  }

  histories['USA-t10y5y'] = sampled;
  const last = histories['USA-t10y5y'].at(-1);
  data.USA = data.USA || {};
  data.USA.t10y5y = {
    value: last.value,
    date: last.period,
    source: 'FRED · DGS10 − DGS5 · US10Y − US5Y'
  };

  console.log(
    'US10Y−US5Y:',
    histories['USA-t10y5y'].length,
    'pts, first',
    histories['USA-t10y5y'][0]?.period,
    'last',
    last.period,
    last.value
  );
} catch (e) {
  errors.push(`US10Y−US5Y: ${e.message}`);
  console.error(e.message);
}

payload.histories = histories;
payload.data = data;
payload.updatedAt = new Date().toISOString();
payload.errors = [
  ...(payload.errors || []).filter(e => !/T10Y5Y|t10y5y|US10Y−US5Y/i.test(e)),
  ...errors
];
fs.writeFileSync('data.json', JSON.stringify(payload, null, 2) + '\n');
