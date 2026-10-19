import fs from 'node:fs';

/**
 * Inflation from official APIs only — no local calculation.
 * Primary: IMF DataMapper PCPIPCH ("Inflation rate, average consumer prices")
 * Fallback: World Bank FP.CPI.TOTL.ZG (annual CPI % change)
 */
const countries = ['CHN', 'USA', 'JPN', 'FRA', 'DEU', 'AUS'];
const nowYear = new Date().getUTCFullYear();

async function getJSON(url) {
  const r = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'MacroWatch/1.3 (+https://hossein7935.github.io/)' },
    signal: AbortSignal.timeout(30000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const data = payload.data || {};
const histories = payload.histories || {};
const errors = [];

// Clear previous inflation so we only keep API values
for (const id of countries) {
  if (data[id]?.inflation) delete data[id].inflation;
  delete histories[`${id}-inflation`];
}

// --- 1) IMF DataMapper: PCPIPCH = Inflation rate, average consumer prices ---
try {
  const ids = countries.join('/');
  const j = await getJSON(`https://www.imf.org/external/datamapper/api/v1/PCPIPCH/${ids}`);
  const series = j?.values?.PCPIPCH;
  if (!series) throw new Error('Antwort ohne PCPIPCH-Serie');

  for (const id of countries) {
    const s = series[id] || {};
    const year = String(nowYear);
    const prev = String(nowYear - 1);
    let used = null;
    let value = null;
    if (s[year] !== undefined && s[year] !== null && Number.isFinite(Number(s[year]))) {
      used = year;
      value = Number(s[year]);
    } else if (s[prev] !== undefined && s[prev] !== null && Number.isFinite(Number(s[prev]))) {
      used = prev;
      value = Number(s[prev]);
    }
    if (used == null) {
      errors.push(`Inflation ${id}: IMF PCPIPCH ohne Wert für ${year}/${prev}`);
      continue;
    }
    data[id] = data[id] || {};
    data[id].inflation = {
      value,
      date: `IMF WEO · ${used}`,
      source: 'IMF DataMapper · PCPIPCH (Inflation rate, average consumer prices)'
    };
    const hist = [];
    for (let y = Number(used) - 4; y <= Number(used); y++) {
      const v = s[String(y)];
      if (v !== undefined && v !== null && Number.isFinite(Number(v))) {
        hist.push({ period: String(y), value: Number(v) });
      }
    }
    histories[`${id}-inflation`] = hist.slice(-5);
  }
} catch (e) {
  errors.push(`IMF PCPIPCH: ${e.message}`);
}

// --- 2) World Bank FP.CPI.TOTL.ZG for any country still missing ---
for (const id of countries) {
  if (data[id]?.inflation) continue;
  try {
    const j = await getJSON(
      `https://api.worldbank.org/v2/country/${id}/indicator/FP.CPI.TOTL.ZG?format=json&date=${nowYear - 4}:${nowYear}&per_page=20`
    );
    const rows = Array.isArray(j) && Array.isArray(j[1]) ? j[1] : [];
    const points = rows
      .filter(r => r.value != null && Number.isFinite(Number(r.value)))
      .map(r => ({ period: String(r.date), value: Number(r.value) }))
      .sort((a, b) => a.period.localeCompare(b.period));
    const p = points.at(-1);
    if (!p) {
      errors.push(`Inflation ${id}: World Bank ohne Wert`);
      continue;
    }
    data[id] = data[id] || {};
    data[id].inflation = {
      value: Math.round(p.value * 100) / 100,
      date: p.period,
      source: 'World Bank · FP.CPI.TOTL.ZG (Inflation, consumer prices annual %)'
    };
    histories[`${id}-inflation`] = points.slice(-5);
  } catch (e) {
    errors.push(`Inflation ${id}: ${e.message}`);
  }
}

payload.data = data;
payload.histories = histories;
payload.counts = payload.counts || {};
payload.counts.inflation = countries.filter(c => data[c]?.inflation).length;
payload.updatedAt = new Date().toISOString();
payload.errors = [
  ...(payload.errors || []).filter(e => !/Inflation|OECD-G20-Inflation|IMF-Inflation|IMF PCPIPCH|FRED · CPI/i.test(e)),
  ...errors
];
fs.writeFileSync('data.json', JSON.stringify(payload, null, 2) + '\n');
console.log('inflation', payload.counts.inflation + '/6 (IMF/World Bank API only, no calculation)');
