import fs from 'node:fs';

/**
 * ICE US Dollar Index (DXY) — daily history via Yahoo Finance DX-Y.NYB
 * Fallback: DX=F futures
 */
const SYMBOLS = ['DX-Y.NYB', 'DX=F'];

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const data = payload.data || {};
data.USA = data.USA || {};
const errors = Array.isArray(payload.errors)
  ? payload.errors.filter(e => !String(e).startsWith('USA DXY'))
  : [];
const asOf = new Date().toISOString();

async function fetchYahoo(symbol) {
  const url =
    'https://query1.finance.yahoo.com/v8/finance/chart/' +
    encodeURIComponent(symbol) +
    '?period1=0&period2=9999999999&interval=1d&events=history';
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 MacroWatch/1.0',
      Accept: 'application/json'
    },
    signal: AbortSignal.timeout(90000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`Yahoo HTTP ${r.status} ${symbol}`);
  const j = await r.json();
  const res = j?.chart?.result?.[0];
  if (!res) throw new Error('no chart result');
  const ts = res.timestamp || [];
  const closes = res.indicators?.quote?.[0]?.close || [];
  const series = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (c == null || !Number.isFinite(Number(c))) continue;
    const d = new Date(ts[i] * 1000);
    const period = d.toISOString().slice(0, 10);
    series.push({ period, value: Math.round(Number(c) * 1000) / 1000 });
  }
  const map = new Map(series.map(p => [p.period, p.value]));
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, value]) => ({ period, value }));
}

try {
  let out = null;
  let used = null;
  let lastErr = null;
  for (const sym of SYMBOLS) {
    try {
      const s = await fetchYahoo(sym);
      if (s.length >= 200) {
        out = s;
        used = sym;
        break;
      }
      lastErr = new Error(`${sym} too short (${s.length})`);
    } catch (e) {
      lastErr = e;
    }
  }
  if (!out) throw lastErr || new Error('DXY fetch failed');

  histories['USA-dxy'] = out;
  const last = out.at(-1);
  const prev = out.length > 1 ? out.at(-2) : null;
  const absChg = prev ? Math.round((last.value - prev.value) * 1000) / 1000 : null;
  const pctChg =
    prev && prev.value
      ? Math.round((last.value / prev.value - 1) * 10000) / 100
      : null;

  data.USA.dxy = {
    value: last.value,
    date: last.period,
    prevValue: prev ? prev.value : null,
    absChange: absChg,
    pctChange: pctChg,
    updatedAt: asOf,
    source: `Yahoo Finance ${used} · ICE US Dollar Index (DXY)`,
    sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(used)}/`,
    unit: 'index',
    points: out.length,
    firstDate: out[0].period,
    note: 'DXY: gewichteter USD-Korb (EUR, JPY, GBP, CAD, SEK, CHF). Volle Tageshistorie.'
  };
  console.log('DXY', used, out.length, out[0].period, '→', last.period, last.value);
} catch (e) {
  errors.push(`USA DXY: ${e.message}`);
  console.error(e.message);
}

payload.histories = histories;
payload.data = data;
payload.errors = errors;
payload.updatedAt = asOf;
fs.writeFileSync('data.json', JSON.stringify(payload));
console.log('done');
