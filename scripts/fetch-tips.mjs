import fs from 'node:fs';

/**
 * US TIPS real yields from FRED (official Fed H.15).
 * DFII5 = 5-Year TIPS (shortest constant-maturity series; no 2Y CMT exists)
 * DFII10 = 10-Year TIPS
 */
const series = {
  USA: {
    tips5: 'DFII5',
    tips10: 'DFII10'
  }
};

async function fredLatest(id) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=2025-01-01`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'MacroWatch/1.3 (+https://hossein7935.github.io/)' },
    signal: AbortSignal.timeout(30000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`FRED ${id} HTTP ${r.status}`);
  const text = await r.text();
  const lines = text.trim().split(/\r?\n/).slice(1);
  let last = null;
  for (const line of lines) {
    const [date, val] = line.split(',');
    if (val && val !== '.' && Number.isFinite(Number(val))) {
      last = { date, value: Number(val) };
    }
  }
  if (!last) throw new Error(`FRED ${id} ohne Wert`);
  return last;
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const data = payload.data || {};
const errors = [];
const countries = ['CHN', 'USA', 'JPN', 'FRA', 'DEU', 'AUS'];

for (const id of countries) {
  data[id] = data[id] || {};
  if (id !== 'USA') {
    delete data[id].tips5;
    delete data[id].tips10;
  }
}

try {
  const cfg = series.USA;
  for (const [key, sid] of Object.entries(cfg)) {
    try {
      const p = await fredLatest(sid);
      data.USA[key] = {
        value: Math.round(p.value * 100) / 100,
        date: p.date,
        source: `FRED · ${sid} (US TIPS real yield, constant maturity)`
      };
    } catch (e) {
      errors.push(`TIPS USA ${key}: ${e.message}`);
    }
  }
} catch (e) {
  errors.push(`TIPS: ${e.message}`);
}

payload.data = data;
payload.counts = payload.counts || {};
payload.counts.tips5 = countries.filter(c => data[c]?.tips5).length;
payload.counts.tips10 = countries.filter(c => data[c]?.tips10).length;
payload.updatedAt = new Date().toISOString();
payload.errors = [
  ...(payload.errors || []).filter(e => !/^TIPS/i.test(e)),
  ...errors
];
fs.writeFileSync('data.json', JSON.stringify(payload, null, 2) + '\n');
console.log('tips5', payload.counts.tips5 + '/6', 'tips10', payload.counts.tips10 + '/6');
