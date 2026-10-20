import fs from 'node:fs';

const MONTHLY = {
  USA: 'CPIAUCSL',
  DEU: 'DEUCPIALLMINMEI',
  FRA: 'FRACPIALLMINMEI',
  CHN: 'CHNCPIALLMINMEI'
};
const MONTHLY_FB = {
  DEU: 'CP0000DEM086NEST',
  FRA: 'CP0000FRM086NEST',
  CHN: 'CPALTT01CNM659N'
};
const QUARTERLY = {
  JPN: 'JPNCPIALLQINMEI',
  AUS: 'AUSCPIALLQINMEI'
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
  if (text.includes('<html') || text.includes('</script>')) throw new Error(`FRED ${id} blocked`);
  const rows = [];
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const [date, val] = line.split(',');
    if (val && val !== '.' && Number.isFinite(Number(val))) {
      rows.push({ period: date.slice(0, 10), value: Number(val) });
    }
  }
  return rows;
}

function toYoY(indexRows) {
  const sorted = [...indexRows].sort((a, b) => a.period.localeCompare(b.period));
  const byPeriod = new Map(sorted.map(r => [r.period, r.value]));
  const out = [];
  for (const r of sorted) {
    const [y, m] = r.period.split('-').map(Number);
    const prevKeys = [...byPeriod.keys()].filter(k => k.startsWith(`${y - 1}-${String(m).padStart(2, '0')}`));
    if (!prevKeys.length) continue;
    const base = byPeriod.get(prevKeys[prevKeys.length - 1]);
    if (!base) continue;
    const yoy = ((r.value / base) - 1) * 100;
    out.push({ period: r.period.slice(0, 7), value: Math.round(yoy * 100) / 100 });
  }
  const map = new Map();
  for (const p of out) map.set(p.period, p.value);
  return [...map.entries()].map(([period, value]) => ({ period, value }));
}

function looksLikeYoY(rows) {
  if (rows.length < 4) return false;
  const vals = rows.slice(-8).map(r => Math.abs(r.value));
  return Math.max(...vals) < 25;
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const errors = [];

async function loadCountry(id, seriesId, fallbackId) {
  let rows = await fredCsv(seriesId, '2021-01-01');
  let yoy;
  if (looksLikeYoY(rows)) {
    yoy = rows.map(r => ({ period: r.period.slice(0, 7), value: Math.round(r.value * 100) / 100 }));
  } else {
    yoy = toYoY(rows);
  }
  if (yoy.length < 8 && fallbackId) {
    try {
      const fb = await fredCsv(fallbackId, '2021-01-01');
      const alt = looksLikeYoY(fb)
        ? fb.map(r => ({ period: r.period.slice(0, 7), value: Math.round(r.value * 100) / 100 }))
        : toYoY(fb);
      if (alt.length > yoy.length) yoy = alt;
    } catch { /* keep */ }
  }
  yoy = yoy.filter(p => p.period >= '2023-10');
  if (!yoy.length) throw new Error('keine YoY-Punkte');
  histories[`${id}-inflation`] = yoy.slice(-40);
}

for (const [id, sid] of Object.entries(MONTHLY)) {
  try {
    await loadCountry(id, sid, MONTHLY_FB[id]);
  } catch (e) {
    errors.push(`Inflation-Chart ${id}: ${e.message}`);
  }
}
for (const [id, sid] of Object.entries(QUARTERLY)) {
  try {
    await loadCountry(id, sid, null);
  } catch (e) {
    errors.push(`Inflation-Chart ${id}: ${e.message}`);
  }
}

payload.histories = histories;
payload.updatedAt = new Date().toISOString();
payload.errors = [
  ...(payload.errors || []).filter(e => !/Inflation-Chart/i.test(e)),
  ...errors
];
fs.writeFileSync('data.json', JSON.stringify(payload, null, 2) + '\n');
const ids = [...Object.keys(MONTHLY), ...Object.keys(QUARTERLY)];
console.log('inflation-charts', ids.map(id => `${id}:${(histories[`${id}-inflation`] || []).length}`).join(' '));
