import fs from 'node:fs';

const SERIES = {
  tips5: 'DFII5',
  tips10: 'DFII10'
};

async function fredCsv(id, start) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${start}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'MacroWatch/1.6 (+https://hossein7935.github.io/)' },
    signal: AbortSignal.timeout(35000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`FRED ${id} HTTP ${r.status}`);
  const text = await r.text();
  if (text.includes('<html')) throw new Error(`FRED ${id} blocked`);
  const rows = [];
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const [date, val] = line.split(',');
    if (val && val !== '.' && Number.isFinite(Number(val))) {
      rows.push({ period: date.slice(0, 10), value: Number(val) });
    }
  }
  return rows;
}

function sampleWeekly(rows, maxPts = 36) {
  if (rows.length <= maxPts) {
    return rows.map(r => ({
      period: r.period.slice(0, 7),
      value: Math.round(r.value * 100) / 100
    }));
  }
  const step = Math.max(1, Math.floor(rows.length / maxPts));
  const out = [];
  for (let i = 0; i < rows.length; i += step) {
    const r = rows[i];
    out.push({ period: r.period.slice(0, 7), value: Math.round(r.value * 100) / 100 });
  }
  const last = rows.at(-1);
  if (out.at(-1)?.period !== last.period.slice(0, 7)) {
    out.push({ period: last.period.slice(0, 7), value: Math.round(last.value * 100) / 100 });
  }
  const map = new Map();
  for (const p of out) map.set(p.period, p.value);
  return [...map.entries()].map(([period, value]) => ({ period, value })).slice(-maxPts);
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const data = payload.data || {};
const histories = payload.histories || {};
const errors = [];
const countries = ['CHN', 'USA', 'JPN', 'FRA', 'DEU', 'AUS'];

for (const id of countries) {
  data[id] = data[id] || {};
  if (id !== 'USA') {
    delete data[id].tips5;
    delete data[id].tips10;
    delete histories[`${id}-tips5`];
    delete histories[`${id}-tips10`];
  }
}

try {
  for (const [key, sid] of Object.entries(SERIES)) {
    try {
      const rows = await fredCsv(sid, '2023-10-01');
      if (!rows.length) throw new Error('keine Punkte');
      const last = rows.at(-1);
      data.USA[key] = {
        value: Math.round(last.value * 100) / 100,
        date: last.period,
        source: `FRED · ${sid} (US TIPS real yield, constant maturity)`
      };
      histories[`USA-${key}`] = sampleWeekly(rows, 40);
    } catch (e) {
      errors.push(`TIPS USA ${key}: ${e.message}`);
    }
  }
} catch (e) {
  errors.push(`TIPS: ${e.message}`);
}

payload.data = data;
payload.histories = histories;
payload.counts = payload.counts || {};
payload.counts.tips5 = data.USA?.tips5 ? 1 : 0;
payload.counts.tips10 = data.USA?.tips10 ? 1 : 0;
payload.updatedAt = new Date().toISOString();
payload.errors = [
  ...(payload.errors || []).filter(e => !/^TIPS/i.test(e)),
  ...errors
];
fs.writeFileSync('data.json', JSON.stringify(payload, null, 2) + '\n');
console.log(
  'tips',
  'tips5', data.USA?.tips5?.value,
  'hist5', (histories['USA-tips5'] || []).length,
  'tips10', data.USA?.tips10?.value,
  'hist10', (histories['USA-tips10'] || []).length
);
