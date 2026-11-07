import fs from 'node:fs';

/**
 * Federal Funds Market Daily Volume (Billions USD)
 * Primary: FRED series EFFRVOL (NY Fed → FRED)
 * Secondary: NY Fed markets API for latest cross-check
 * Also stores EFFR rate for optional dual view
 *
 * Unit: Billions of USD, business days only
 */

const FRED_VOL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=EFFRVOL&cosd=2016-01-01';
const FRED_RATE = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=EFFR&cosd=2016-01-01';
const NYFED =
  'https://markets.newyorkfed.org/api/rates/unsecured/effr/search.json?startDate=2025-01-01&endDate=2099-12-31';

async function loadCsvSeries(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'MacroWatch/1.0', Accept: 'text/csv' },
    signal: AbortSignal.timeout(60000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  const text = await r.text();
  const lines = text.trim().split(/\r?\n/).slice(1);
  const out = [];
  for (const line of lines) {
    const [d, v] = line.split(',');
    if (!d || v === '.' || v == null || v === '') continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    out.push({ period: d.trim(), value: n });
  }
  return out;
}

function pctChange(cur, prev) {
  if (prev == null || prev === 0 || cur == null) return null;
  return Math.round(((cur / prev) - 1) * 10000) / 100;
}

function meanStd(arr) {
  if (!arr.length) return { mean: 0, std: 0 };
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const v = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
  return { mean, std: Math.sqrt(v) };
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const data = payload.data || {};
data.USA = data.USA || {};
const errors = Array.isArray(payload.errors)
  ? payload.errors.filter(e => !String(e).startsWith('USA EFFRVOL'))
  : [];
const asOf = new Date().toISOString();

try {
  const vol = await loadCsvSeries(FRED_VOL);
  if (vol.length < 50) throw new Error('EFFRVOL too short');

  // Merge NY Fed latest if newer
  try {
    const r = await fetch(NYFED, {
      headers: { Accept: 'application/json', 'User-Agent': 'MacroWatch/1.0' },
      signal: AbortSignal.timeout(30000),
      cache: 'no-store'
    });
    if (r.ok) {
      const j = await r.json();
      const rows = j?.refRates || [];
      const byDate = new Map(vol.map(p => [p.period, p.value]));
      for (const row of rows) {
        const d = row.effectiveDate;
        const v = Number(row.volumeInBillions);
        if (d && Number.isFinite(v)) byDate.set(d, v);
      }
      vol.length = 0;
      for (const [period, value] of [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        vol.push({ period, value });
      }
      console.log('NY Fed merge ok, n=', vol.length);
    }
  } catch (e) {
    console.warn('NY Fed merge skip', e.message);
  }

  // Deduplicate by date (keep last)
  const map = new Map();
  for (const p of vol) map.set(p.period, p.value);
  const series = [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, value]) => ({ period, value }));

  // Daily % change (skip weekends/gaps — compare consecutive available days)
  const chg = [];
  for (let i = 1; i < series.length; i++) {
    const c = series[i];
    const p = series[i - 1];
    const pct = pctChange(c.value, p.value);
    if (pct != null) chg.push({ period: c.period, value: pct, prevVol: p.value, vol: c.value });
  }

  let rateSeries = [];
  try {
    rateSeries = await loadCsvSeries(FRED_RATE);
    console.log('EFFR rate points', rateSeries.length);
  } catch (e) {
    console.warn('EFFR rate', e.message);
  }

  histories['USA-effrVol'] = series.map(({ period, value }) => ({ period, value }));
  histories['USA-effrVolChg'] = chg.map(({ period, value }) => ({ period, value }));
  if (rateSeries.length) histories['USA-effr'] = rateSeries;

  const last = series.at(-1);
  const prev = series.at(-2);
  const absChg = prev ? Math.round((last.value - prev.value) * 100) / 100 : null;
  const pctChg = prev ? pctChange(last.value, prev.value) : null;

  // Alert: |daily %| vs recent 1y std
  const recentChg = chg.slice(-252).map(p => p.value);
  const { mean, std } = meanStd(recentChg);
  let alert = 'normal';
  let alertNote = 'Volumen im üblichen Tagesbereich.';
  if (pctChg != null && std > 0) {
    const z = (pctChg - mean) / std;
    if (Math.abs(z) >= 2.5) {
      alert = 'high';
      alertNote =
        pctChg < 0
          ? `Ungewöhnlich starker Rückgang des Handelsvolumens (${pctChg} %). Nicht automatisch ein Liquiditätsproblem.`
          : `Ungewöhnlich starker Anstieg des Handelsvolumens (+${pctChg} %).`;
    } else if (Math.abs(z) >= 1.5) {
      alert = 'watch';
      alertNote = `Überdurchschnittliche Tagesbewegung (${pctChg >= 0 ? '+' : ''}${pctChg} %).`;
    }
  }

  const lastRate = rateSeries.length ? rateSeries.at(-1) : null;

  data.USA.effrVol = {
    value: last.value,
    date: last.period,
    prevValue: prev ? prev.value : null,
    prevDate: prev ? prev.period : null,
    absChange: absChg,
    pctChange: pctChg,
    updatedAt: asOf,
    source: 'FRED EFFRVOL · New York Fed Effective Federal Funds Volume',
    sourceUrl: 'https://www.newyorkfed.org/markets/reference-rates/effr',
    unit: 'USD Milliarden',
    points: series.length,
    alert,
    alertNote,
    effr: lastRate ? lastRate.value : null,
    effrDate: lastRate ? lastRate.period : null,
    note:
      'Tägliches Handelsvolumen im Federal-Funds-Markt (Overnight). Quelle: NY Fed über FRED (EFFRVOL). Wochenenden/Feiertage ohne Beobachtung.'
  };

  console.log(
    'EFFRVOL',
    last.period,
    last.value + 'B',
    'chg',
    absChg,
    pctChg + '%',
    'alert',
    alert,
    'n=',
    series.length
  );
} catch (e) {
  errors.push(`USA EFFRVOL: ${e.message}`);
  console.error('EFFRVOL failed', e.message);
}

payload.histories = histories;
payload.data = data;
payload.errors = errors;
payload.updatedAt = asOf;
fs.writeFileSync('data.json', JSON.stringify(payload));
console.log('done');
