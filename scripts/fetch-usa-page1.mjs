import fs from 'node:fs';

/**
 * USA Seite 1 – Karten, die sonst nur selten aktualisiert würden:
 *
 *  Leitzins        Fed-Zielspanne täglich (FRED DFEDTARL / DFEDTARU) statt BIS (wöchentlich)
 *  Haushaltsdefizit Bundesdefizit der letzten 12 Monate in % des BIP, monatlich aus dem
 *                   Monthly Treasury Statement (FRED MTSDS133FMS / GDP) statt IMF-Prognose
 *                   (die IMF aktualisiert nur im April und Oktober)
 *
 * Fällt eine Quelle aus, bleiben die bisherigen Werte stehen.
 */

const UA = { 'User-Agent': 'MacroWatch/1.9 (+https://hossein7935.github.io/)', Accept: 'text/csv' };

async function fred(id, start) {
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${start}`, {
        headers: UA, signal: AbortSignal.timeout(45000), cache: 'no-store'
      });
      if (!r.ok) throw new Error(`${id} HTTP ${r.status}`);
      const text = await r.text();
      if (text.trim().startsWith('<')) throw new Error(`${id}: keine CSV`);
      const out = [];
      for (const line of text.trim().split(/\r?\n/).slice(1)) {
        const [d, v] = line.split(',');
        if (!d || v == null || v === '' || v === '.') continue;
        const n = Number(v);
        if (Number.isFinite(n)) out.push({ period: d.trim().slice(0, 10), value: n });
      }
      if (!out.length) throw new Error(`${id}: leer`);
      return out;
    } catch (e) {
      last = e;
      await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
    }
  }
  throw last;
}

const round = (v, n = 3) => Math.round(v * 10 ** n) / 10 ** n;
const fmtDe = (v) => Number(v).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || (payload.histories = {});
const data = payload.data || (payload.data = {});
data.USA = data.USA || {};
const errors = [];

// --- Leitzins: Fed-Zielspanne -----------------------------------------------------------
try {
  const [lo, hi] = await Promise.all([fred('DFEDTARL', '2024-01-01'), fred('DFEDTARU', '2024-01-01')]);
  const l = lo.at(-1);
  const u = hi.at(-1);
  if (!l || !u) throw new Error('keine Zielspanne');
  const mid = round((l.value + u.value) / 2, 3);
  const date = l.period > u.period ? l.period : u.period;
  data.USA.rate = {
    value: mid,
    date,
    source: `Fed-Zielspanne ${fmtDe(l.value)}–${fmtDe(u.value)} % (Mitte) · FRED DFEDTARL/DFEDTARU`
  };
  // Monatsverlauf (BIS) für den laufenden Monat nachziehen
  const hist = histories['USA-rate'];
  if (Array.isArray(hist) && hist.length && /^\d{4}-\d{2}$/.test(String(hist.at(-1).period))) {
    const month = date.slice(0, 7);
    const lastPt = hist.at(-1);
    if (lastPt.period === month) lastPt.value = mid;
    else if (lastPt.period < month) hist.push({ period: month, value: mid });
  }
  console.log(`Leitzins: ${l.value}–${u.value} % (Mitte ${mid}) Stand ${date}`);
} catch (e) {
  errors.push(`USA Leitzins Fed-Zielspanne: ${e.message}`);
  console.warn('Leitzins:', e.message);
}

// --- Haushaltsdefizit: 12 Monate rollierend / BIP ----------------------------------------
try {
  const [mts, gdp] = await Promise.all([fred('MTSDS133FMS', '2013-01-01'), fred('GDP', '2013-01-01')]);
  const gdpSorted = [...gdp].sort((a, b) => a.period.localeCompare(b.period));
  const monthly = [...mts].sort((a, b) => a.period.localeCompare(b.period));
  const out = [];
  for (let i = 11; i < monthly.length; i++) {
    const win = monthly.slice(i - 11, i + 1);
    // nur echte 12-Monats-Fenster (keine Lücken)
    const first = new Date(`${win[0].period}T00:00:00Z`);
    const lastD = new Date(`${win[11].period}T00:00:00Z`);
    const months = (lastD.getUTCFullYear() - first.getUTCFullYear()) * 12 + lastD.getUTCMonth() - first.getUTCMonth();
    if (months !== 11) continue;
    const sum = win.reduce((s, p) => s + p.value, 0); // Mio. $
    let g = null;
    for (const row of gdpSorted) {
      if (row.period <= monthly[i].period) g = row.value; // Mrd. $ (annualisiert)
      else break;
    }
    if (!g) continue;
    out.push({ period: monthly[i].period.slice(0, 7), value: round((sum / (g * 1000)) * 100, 2) });
  }
  const hist = out.filter((p) => p.period >= '2016-01');
  if (hist.length < 12) throw new Error(`nur ${hist.length} Monate`);
  const last = hist.at(-1);
  histories['USA-deficit'] = hist;
  data.USA.deficit = {
    value: last.value,
    date: last.period,
    source: 'US Treasury MTS · Bundeshaushalt, 12 Monate rollierend in % des BIP (FRED MTSDS133FMS / GDP)'
  };
  console.log(`Defizit: ${last.period} = ${last.value} % des BIP (${hist.length} Monate)`);
} catch (e) {
  errors.push(`USA Defizit MTS: ${e.message}`);
  console.warn('Defizit:', e.message);
}

payload.errors = [...(payload.errors || []).filter((e) => !/^USA (Leitzins Fed-Zielspanne|Defizit MTS)/.test(String(e))), ...errors];
fs.writeFileSync('data.json', JSON.stringify(payload));
console.log('done usa-page1');
