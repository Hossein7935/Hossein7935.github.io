import fs from 'node:fs';

const AREA = {
  USA: 'US',
  DEU: 'XM',
  FRA: 'XM',
  JPN: 'JP',
  CHN: 'CN',
  AUS: 'AU'
};

async function bisPolicyHistory() {
  const areas = [...new Set(Object.values(AREA))].join('+');
  const url = `https://stats.bis.org/api/v2/data/dataflow/BIS/WS_CBPOL/1.0/M.${areas}?startPeriod=2023-10&format=csv`;
  const r = await fetch(url, {
    headers: { Accept: 'text/csv', 'User-Agent': 'MacroWatch/1.4 (+https://hossein7935.github.io/)' },
    signal: AbortSignal.timeout(45000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`BIS HTTP ${r.status}`);
  const text = await r.text();
  function parseCSV(text) {
    const rows = [];
    let row = [], cur = '', q = false;
    const s = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '"') {
        if (q && s[i + 1] === '"') { cur += '"'; i++; }
        else q = !q;
      } else if ((ch === ',' && !q)) {
        row.push(cur); cur = '';
      } else if ((ch === '\n' || ch === '\r') && !q) {
        if (ch === '\r' && s[i + 1] === '\n') i++;
        row.push(cur); cur = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else cur += ch;
    }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }
  const table = parseCSV(text);
  if (table.length < 2) throw new Error('BIS leer');
  const headers = table[0];
  const iArea = headers.indexOf('REF_AREA');
  const iTime = headers.indexOf('TIME_PERIOD');
  const iVal = headers.indexOf('OBS_VALUE');
  if (iArea < 0 || iTime < 0 || iVal < 0) throw new Error('BIS Spalten fehlen');
  const by = {};
  for (const cols of table.slice(1)) {
    const area = cols[iArea];
    const t = cols[iTime];
    const v = cols[iVal];
    if (!area || !t || v === undefined || v === '') continue;
    const num = Number(v);
    if (!Number.isFinite(num)) continue;
    (by[area] ||= []).push({ period: t, value: Math.round(num * 1000) / 1000 });
  }
  for (const a of Object.keys(by)) {
    by[a].sort((x, y) => x.period.localeCompare(y.period));
  }
  return by;
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const data = payload.data || {};
const histories = payload.histories || {};
const errors = [];

try {
  const byArea = await bisPolicyHistory();
  for (const [id, area] of Object.entries(AREA)) {
    const rows = byArea[area];
    if (!rows?.length) {
      errors.push(`Leitzins-Chart ${id}: BIS ${area} ohne Daten`);
      continue;
    }
    histories[`${id}-rate`] = rows.slice(-36);
    const cur = data[id]?.rate;
    if (cur && Number.isFinite(Number(cur.value))) {
      const p = String(cur.date || '').slice(0, 7) || new Date().toISOString().slice(0, 7);
      const last = histories[`${id}-rate`].at(-1);
      if (!last || last.period < p || Math.abs(last.value - Number(cur.value)) > 0.0001) {
        if (last && last.period === p) last.value = Number(cur.value);
        else histories[`${id}-rate`].push({ period: p.length === 7 ? p : p.slice(0, 7), value: Number(cur.value) });
      }
    }
  }
} catch (e) {
  errors.push(`Leitzins-Charts BIS: ${e.message}`);
}

payload.histories = histories;
payload.updatedAt = new Date().toISOString();
payload.errors = [
  ...(payload.errors || []).filter(e => !/Leitzins-Chart/i.test(e)),
  ...errors
];
fs.writeFileSync('data.json', JSON.stringify(payload, null, 2) + '\n');
console.log('rate-charts', Object.keys(AREA).map(id => `${id}:${(histories[`${id}-rate`] || []).length}`).join(' '));
