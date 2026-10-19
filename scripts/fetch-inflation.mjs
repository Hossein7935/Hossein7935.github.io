import fs from 'node:fs';

const countries = ['CHN','USA','JPN','FRA','DEU','AUS'];
const nowYear = new Date().getUTCFullYear();

async function getText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'MacroWatch/1.2' }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}
function csvParse(text) {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const cols = line.split(',');
    const row = {};
    headers.forEach((h, i) => row[h.trim()] = cols[i] ?? '');
    return row;
  });
}
async function fredSeries(id, start = '2024-01-01') {
  const text = await getText(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${start}`);
  const rows = csvParse(text);
  const col = Object.keys(rows[0] || {}).find(k => k === id) || Object.keys(rows[0] || {}).find(k => k !== 'observation_date');
  return rows.map(r => ({
    date: r.observation_date || r.DATE,
    value: r[col] === '' || r[col] === '.' ? NaN : Number(r[col])
  })).filter(p => p.date && Number.isFinite(p.value));
}
function yoy(points) {
  const by = Object.fromEntries(points.map(p => [p.date, p.value]));
  const out = [];
  for (const p of points) {
    const [y, m, d] = p.date.split('-');
    const prev = `${Number(y)-1}-${m}-${d || '01'}`;
    const prev2 = `${Number(y)-1}-${m}-01`;
    const base = by[prev] ?? by[prev2];
    if (base) out.push({ date: p.date, value: Math.round(((p.value/base)-1)*10000)/100 });
  }
  return out;
}

const indexes = {
  USA: 'CPIAUCSL',
  DEU: 'CP0000DEM086NEST',
  FRA: 'CP0000FRM086NEST',
};

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const data = payload.data || {};
const histories = payload.histories || {};
const errors = [];

for (const [id, seriesId] of Object.entries(indexes)) {
  try {
    const rows = await fredSeries(seriesId);
    const yy = yoy(rows).filter(p => (Date.now() - new Date(p.date+'T00:00:00Z'))/86400000 <= 120);
    if (!yy.length) throw new Error('keine frischen YoY-Werte');
    const hist = yy.slice(-5).map(p => {
      const dt = new Date(p.date+'T00:00:00Z');
      return { period: `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}`, value: p.value };
    });
    histories[`${id}-inflation`] = hist;
    data[id] = data[id] || {};
    data[id].inflation = { value: hist.at(-1).value, date: hist.at(-1).period, source: `FRED · CPI YoY (${seriesId})` };
  } catch (e) {
    errors.push(`Inflation ${id}: ${e.message}`);
  }
}

try {
  const ids = countries.join('/');
  const j = JSON.parse(await getText(`https://www.imf.org/external/datamapper/api/v1/PCPIPCH/${ids}`));
  const series = j?.values?.PCPIPCH || {};
  for (const id of countries) {
    if (data[id]?.inflation) continue;
    const s = series[id] || {};
    const year = String(nowYear);
    const prev = String(nowYear - 1);
    const v = s[year] ?? s[prev];
    const used = s[year] != null ? year : prev;
    if (v != null && Number.isFinite(Number(v))) {
      data[id] = data[id] || {};
      data[id].inflation = { value: Number(v), date: `IMF WEO · ${used}`, source: 'IMF DataMapper · PCPIPCH (annual)' };
      histories[`${id}-inflation`] = [
        ...(s[String(Number(used)-1)] != null ? [{ period: String(Number(used)-1), value: Number(s[String(Number(used)-1)]) }] : []),
        { period: used, value: Number(v) }
      ];
    }
  }
} catch (e) {
  errors.push(`IMF inflation: ${e.message}`);
}

payload.data = data;
payload.histories = histories;
payload.counts = payload.counts || {};
payload.counts.inflation = countries.filter(c => data[c]?.inflation).length;
payload.updatedAt = new Date().toISOString();
payload.errors = [...(payload.errors || []).filter(e => !/Inflation|OECD-G20-Inflation|IMF-Inflation/i.test(e)), ...errors];
fs.writeFileSync('data.json', JSON.stringify(payload, null, 2) + '\n');
console.log('inflation', payload.counts.inflation + '/6');
