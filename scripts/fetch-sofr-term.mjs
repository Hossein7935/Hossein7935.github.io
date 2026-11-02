import fs from 'node:fs';

/** Fetch recent CME Term SOFR 3M from global-rates.com and merge into growing history. */

async function fetchTermSof3m() {
  const url = 'https://www.global-rates.com/en/interest-rates/cme-term-sofr/2/term-sofr-interest-3-months/';
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'MacroWatch/1.0 (+https://hossein7935.github.io/)',
      Accept: 'text/html'
    },
    signal: AbortSignal.timeout(30000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const html = await r.text();

  const points = [];
  const dateRe = /(\d{2})-(\d{2})-(\d{4})/g;
  const rateRe = /(\d+\.\d{3,})\s*%/g;
  const dates = [...html.matchAll(dateRe)].map(m => {
    const [, mm, dd, yyyy] = m;
    return `${yyyy}-${mm}-${dd}`;
  });
  const rates = [...html.matchAll(rateRe)].map(m => Number(m[1]));

  const n = Math.min(dates.length, rates.length, 15);
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(rates[i]) && rates[i] > 0 && rates[i] < 20) {
      points.push({ period: dates[i], value: Math.round(rates[i] * 100000) / 100000 });
    }
  }

  const map = new Map();
  for (const p of points) map.set(p.period, p.value);
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, value]) => ({ period, value }));
}

function mergeHistory(existing, incoming, maxPts = 800) {
  const map = new Map();
  for (const p of existing || []) {
    if (p?.period && Number.isFinite(Number(p.value))) map.set(String(p.period), Number(p.value));
  }
  for (const p of incoming || []) {
    if (p?.period && Number.isFinite(Number(p.value))) map.set(String(p.period), Number(p.value));
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-maxPts)
    .map(([period, value]) => ({ period, value: Math.round(value * 100000) / 100000 }));
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const data = payload.data || {};
const errors = [];

try {
  const fresh = await fetchTermSof3m();
  if (!fresh.length) throw new Error('keine Raten geparst');
  histories['USA-sofr3m'] = mergeHistory(histories['USA-sofr3m'], fresh);
  const last = histories['USA-sofr3m'].at(-1);
  if (last) {
    data.USA = data.USA || {};
    data.USA.sofr3m = {
      value: last.value,
      date: last.period,
      source: 'global-rates.com · CME Term SOFR 3M'
    };
  }
  console.log('Term SOFR 3M:', histories['USA-sofr3m'].length, 'Punkte, zuletzt', last?.period, last?.value);
} catch (e) {
  errors.push(`USA Term SOFR 3M: ${e.message}`);
  console.error(e.message);
}

try {
  // Full 10 years of 10Y−2Y spread (FRED T10Y2Y), evenly sampled across the whole span
  const start = '2016-01-01';
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=T10Y2Y&cosd=${start}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'MacroWatch/1.0' },
    signal: AbortSignal.timeout(45000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`FRED T10Y2Y HTTP ${r.status}`);
  const text = await r.text();
  const rows = [];
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const [date, val] = line.split(',');
    if (val && val !== '.' && Number.isFinite(Number(val))) {
      rows.push({ period: date.slice(0, 10), value: Math.round(Number(val) * 1000) / 1000 });
    }
  }
  if (!rows.length) throw new Error('keine T10Y2Y-Punkte');

  // Evenly sample across full 10y range (do not drop the early years)
  const maxPts = 1600;
  let sampled;
  if (rows.length <= maxPts) {
    sampled = rows;
  } else {
    sampled = [];
    for (let i = 0; i < maxPts; i++) {
      const idx = Math.round((i * (rows.length - 1)) / (maxPts - 1));
      sampled.push(rows[idx]);
    }
    // de-dupe consecutive same period
    const out = [];
    for (const p of sampled) {
      if (!out.length || out.at(-1).period !== p.period) out.push(p);
    }
    sampled = out;
  }

  histories['USA-t10y2y'] = sampled;
  const last = histories['USA-t10y2y'].at(-1);
  data.USA = data.USA || {};
  data.USA.t10y2y = {
    value: last.value,
    date: last.period,
    source: 'FRED · T10Y2Y · 10 Jahre'
  };
  console.log(
    'T10Y2Y:',
    histories['USA-t10y2y'].length,
    'Punkte, first',
    histories['USA-t10y2y'][0]?.period,
    'last',
    last?.period,
    last?.value
  );
} catch (e) {
  errors.push(`USA T10Y2Y: ${e.message}`);
  console.error(e.message);
}

payload.histories = histories;
payload.data = data;
payload.updatedAt = new Date().toISOString();
payload.errors = [
  ...(payload.errors || []).filter(e => !/Term SOFR 3M|T10Y2Y/i.test(e)),
  ...errors
];
fs.writeFileSync('data.json', JSON.stringify(payload, null, 2) + '\n');
