import fs from 'node:fs';

/**
 * Daily EFFR, SOFR, IORB from FRED for USA page 3 + client-side spreads.
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
  const points = [];
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const [date, val] = line.split(',');
    if (val && val !== '.' && Number.isFinite(Number(val))) {
      points.push({ period: date.slice(0, 10), value: Math.round(Number(val) * 10000) / 10000 });
    }
  }
  return points;
}

function sample(points, maxPts = 1600) {
  if (points.length <= maxPts) return points;
  const sampled = [];
  for (let i = 0; i < maxPts; i++) {
    const idx = Math.round((i * (points.length - 1)) / (maxPts - 1));
    sampled.push(points[idx]);
  }
  const out = [];
  for (const p of sampled) {
    if (!out.length || out.at(-1).period !== p.period) out.push(p);
  }
  return out;
}

const series = [
  { id: 'EFFR', key: 'effr', label: 'EFFR', start: '2015-01-01' },
  { id: 'SOFR', key: 'sofr', label: 'SOFR', start: '2018-04-02' },
  { id: 'IORB', key: 'iorb', label: 'IORB', start: '2021-07-29' }
];

for (const s of series) {
  try {
    const pts = sample(await fredCsv(s.id, s.start));
    if (pts.length < 30) throw new Error(`Only ${pts.length} points`);
    histories[`USA-${s.key}`] = pts;
    const last = pts.at(-1);
    data.USA = data.USA || {};
    data.USA[s.key] = {
      value: last.value,
      date: last.period,
      source: `FRED · ${s.id}`
    };
    console.log(s.id + ':', pts.length, 'pts, last', last.period, last.value);
  } catch (e) {
    errors.push(`${s.id}: ${e.message}`);
    console.error(s.id, e.message);
  }
}

payload.histories = histories;
payload.data = data;
payload.updatedAt = new Date().toISOString();
payload.errors = [
  ...(payload.errors || []).filter(e => !/EFFR|SOFR|IORB|effr|sofr|iorb/i.test(e) || /SOFR−IORB|sofrIorb|Term SOFR/i.test(e)),
  ...errors
];
fs.writeFileSync('data.json', JSON.stringify(payload, null, 2) + '\n');
