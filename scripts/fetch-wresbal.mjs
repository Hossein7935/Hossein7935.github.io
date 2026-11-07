import fs from 'node:fs';

/**
 * WRESBAL — Reserve Balances with Federal Reserve Banks (week average).
 * FRED weekly series, millions of USD → stored as trillions for display.
 */

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const data = payload.data || {};
const errors = [];

try {
  const url = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=WRESBAL&cosd=2015-01-01';
  const r = await fetch(url, {
    headers: { 'User-Agent': 'MacroWatch/1.0 (+https://hossein7935.github.io/)' },
    signal: AbortSignal.timeout(45000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`FRED WRESBAL HTTP ${r.status}`);
  const text = await r.text();
  if (text.includes('<html')) throw new Error('FRED WRESBAL blocked or HTML response');

  const points = [];
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const [date, val] = line.split(',');
    if (val && val !== '.' && Number.isFinite(Number(val))) {
      // millions → trillions
      const trillions = Number(val) / 1e6;
      points.push({
        period: date.slice(0, 10),
        value: Math.round(trillions * 1000) / 1000
      });
    }
  }
  if (points.length < 20) throw new Error(`Only ${points.length} WRESBAL points`);

  const maxPts = 600;
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

  histories['USA-wresbal'] = sampled;
  const last = histories['USA-wresbal'].at(-1);
  data.USA = data.USA || {};
  data.USA.wresbal = {
    value: last.value,
    date: last.period,
    source: 'FRED · WRESBAL · Bankreserven (Wochenmittel)'
  };

  console.log(
    'WRESBAL:',
    histories['USA-wresbal'].length,
    'pts, first',
    histories['USA-wresbal'][0]?.period,
    'last',
    last.period,
    last.value,
    'T$'
  );
} catch (e) {
  errors.push(`WRESBAL: ${e.message}`);
  console.error(e.message);
}

payload.histories = histories;
payload.data = data;
payload.updatedAt = new Date().toISOString();
payload.errors = [
  ...(payload.errors || []).filter(e => !/WRESBAL|wresbal/i.test(e)),
  ...errors
];
fs.writeFileSync('data.json', JSON.stringify(payload, null, 2) + '\n');
