import fs from 'node:fs';

const QUARTERLY = {
  USA: 'A191RL1Q225SBEA',
  DEU: 'NAEXKP01DEQ657S',
  FRA: 'NAEXKP01FRQ657S',
  JPN: 'NAEXKP01JPQ657S',
  AUS: 'NAEXKP01AUQ657S'
};

async function fredCsv(id, start = '2022-10-01') {
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
      rows.push({ period: date.slice(0, 7), value: Math.round(Number(val) * 100) / 100 });
    }
  }
  return rows;
}

async function worldBankAnnualGdp() {
  const url =
    'https://api.worldbank.org/v2/country/CN;US;DE;FR;JP;AU/indicator/NY.GDP.MKTP.KD.ZG?format=json&date=2020:2025&per_page=100';
  const r = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'MacroWatch/1.6' },
    signal: AbortSignal.timeout(30000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`WorldBank HTTP ${r.status}`);
  const j = await r.json();
  const by = {};
  for (const row of j[1] || []) {
    if (row.value == null) continue;
    const id = row.countryiso3code;
    (by[id] ||= []).push({
      period: String(row.date),
      value: Math.round(Number(row.value) * 100) / 100
    });
  }
  for (const id of Object.keys(by)) {
    by[id].sort((a, b) => a.period.localeCompare(b.period));
  }
  return by;
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const errors = [];

for (const [id, seriesId] of Object.entries(QUARTERLY)) {
  try {
    const rows = await fredCsv(seriesId, '2022-10-01');
    const recent = rows.filter(p => p.period >= '2023-01');
    if (!recent.length) throw new Error('keine Punkte');
    histories[`${id}-gdp`] = recent.slice(-16);
  } catch (e) {
    errors.push(`BIP-Chart ${id}: ${e.message}`);
  }
}

try {
  const wb = await worldBankAnnualGdp();
  if (wb.CHN?.length) {
    histories['CHN-gdp'] = wb.CHN.filter(p => p.period >= '2020').slice(-6);
  } else {
    errors.push('BIP-Chart CHN: World Bank ohne Daten');
  }
  for (const id of ['USA', 'DEU', 'FRA', 'JPN', 'AUS']) {
    if (!(histories[`${id}-gdp`]?.length) && wb[id]?.length) {
      histories[`${id}-gdp`] = wb[id].filter(p => p.period >= '2020').slice(-6);
    }
  }
} catch (e) {
  errors.push(`BIP-Chart WorldBank: ${e.message}`);
}

payload.histories = histories;
payload.updatedAt = new Date().toISOString();
payload.errors = [
  ...(payload.errors || []).filter(e => !/BIP-Chart/i.test(e)),
  ...errors
];
fs.writeFileSync('data.json', JSON.stringify(payload, null, 2) + '\n');
console.log(
  'gdp-charts',
  ['USA', 'DEU', 'FRA', 'JPN', 'AUS', 'CHN']
    .map(id => `${id}:${(histories[`${id}-gdp`] || []).length}`)
    .join(' ')
);
