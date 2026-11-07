import fs from 'node:fs';

/**
 * SOFR − IORB spread (overnight funding stress vs Fed reserve rate).
 * FRED series: SOFR, IORB. Daily; history from mid-2021 (IORB start).
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
  // IORB starts 2021-07-29; SOFR from 2018 — join on common dates
  const start = '2021-07-29';
  const [mapSofr, mapIorb] = await Promise.all([
    fredCsv('SOFR', start),
    fredCsv('IORB', start)
  ]);

  const points = [];
  for (const [period, sofr] of mapSofr) {
    const iorb = mapIorb.get(period);
    if (iorb != null && Number.isFinite(iorb)) {
      points.push({
        period,
        value: Math.round((sofr - iorb) * 10000) / 10000 // percentage points
      });
    }
  }
  points.sort((a, b) => a.period.localeCompare(b.period));

  if (points.length < 30) throw new Error(`Only ${points.length} SOFR−IORB points`);

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

  histories['USA-sofrIorb'] = sampled;
  const last = histories['USA-sofrIorb'].at(-1);
  data.USA = data.USA || {};
  data.USA.sofrIorb = {
    value: last.value,
    date: last.period,
    source: 'FRED · SOFR − IORB'
  };

  console.log(
    'SOFR−IORB:',
    histories['USA-sofrIorb'].length,
    'pts, first',
    histories['USA-sofrIorb'][0]?.period,
    'last',
    last.period,
    last.value,
    `(${Math.round(last.value * 100)} bp)`
  );
} catch (e) {
  errors.push(`SOFR−IORB: ${e.message}`);
  console.error(e.message);
}

payload.histories = histories;
payload.data = data;
payload.updatedAt = new Date().toISOString();
payload.errors = [
  ...(payload.errors || []).filter(e => !/SOFR.?IORB|sofrIorb/i.test(e)),
  ...errors
];
fs.writeFileSync('data.json', JSON.stringify(payload, null, 2) + '\n');
