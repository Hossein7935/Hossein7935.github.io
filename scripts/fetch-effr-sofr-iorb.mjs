import fs from 'node:fs';

/**
 * Daily EFFR, SOFR, IORB from FRED for USA page 3 + dual charts.
 * IORB is merged with predecessor IOER (pre 2021-07) for long history.
 * Always preserves the most recent observation.
 */

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const data = payload.data || {};
const errors = [];

async function fredCsv(id, start) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${start}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'MacroWatch/1.0 (+https://hossein7935.github.io/)' },
    signal: AbortSignal.timeout(60000),
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

/** Prefer full recent history; sample only older points if needed */
function sample(points, maxPts = 4000) {
  if (!points.length) return points;
  if (points.length <= maxPts) return points;
  const keepTail = Math.min(2000, maxPts);
  const tail = points.slice(-keepTail);
  const head = points.slice(0, -keepTail);
  const headBudget = maxPts - tail.length;
  const sampled = [];
  if (head.length && headBudget > 0) {
    for (let i = 0; i < headBudget; i++) {
      const idx =
        headBudget === 1 ? 0 : Math.round((i * (head.length - 1)) / (headBudget - 1));
      sampled.push(head[idx]);
    }
  }
  const out = [];
  for (const p of [...sampled, ...tail]) {
    if (!out.length || out.at(-1).period !== p.period) out.push(p);
  }
  const last = points.at(-1);
  if (out.length && out.at(-1).period !== last.period) out.push(last);
  return out;
}

function mergeByDate(a, b) {
  const map = new Map();
  for (const p of a) map.set(p.period, p.value);
  for (const p of b) map.set(p.period, p.value);
  return [...map.entries()]
    .sort((x, y) => x[0].localeCompare(y[0]))
    .map(([period, value]) => ({ period, value }));
}

for (const s of [
  { id: 'EFFR', key: 'effr', start: '2015-01-01' },
  { id: 'SOFR', key: 'sofr', start: '2018-04-02' }
]) {
  try {
    const pts = sample(await fredCsv(s.id, s.start));
    if (pts.length < 30) throw new Error(`Only ${pts.length} points`);
    histories[`USA-${s.key}`] = pts;
    const last = pts.at(-1);
    data.USA = data.USA || {};
    data.USA[s.key] = { value: last.value, date: last.period, source: `FRED · ${s.id}` };
    console.log(s.id + ':', pts.length, 'pts, last', last.period, last.value);
  } catch (e) {
    errors.push(`${s.id}: ${e.message}`);
    console.error(s.id, e.message);
  }
}

try {
  const [ioer, iorb] = await Promise.all([
    fredCsv('IOER', '2008-10-01'),
    fredCsv('IORB', '2021-07-29')
  ]);
  const merged = sample(mergeByDate(ioer, iorb), 7000);
  if (merged.length < 30) throw new Error(`Only ${merged.length} points`);
  histories['USA-iorb'] = merged;
  const last = merged.at(-1);
  data.USA = data.USA || {};
  data.USA.iorb = {
    value: last.value,
    date: last.period,
    source: 'FRED · IOER+IORB (merged)',
    note: 'IOER bis 2021-07, danach IORB'
  };
  console.log('IORB/IOER:', merged.length, 'pts, last', last.period, last.value, 'from', merged[0].period);
} catch (e) {
  errors.push(`IORB: ${e.message}`);
  console.error('IORB', e.message);
}

payload.histories = histories;
payload.data = data;
payload.updatedAt = new Date().toISOString();
payload.errors = [
  ...(payload.errors || []).filter(
    e => !/EFFR|SOFR|IORB|effr|sofr|iorb/i.test(e) || /SOFR−IORB|sofrIorb|Term SOFR/i.test(e)
  ),
  ...errors
];
fs.writeFileSync('data.json', JSON.stringify(payload));
console.log('done');
