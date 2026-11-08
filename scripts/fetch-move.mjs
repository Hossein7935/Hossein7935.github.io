import fs from 'node:fs';

/**
 * ICE BofA MOVE Index — bond market implied volatility ("VIX of Treasuries")
 * Source: Yahoo Finance ^MOVE (daily closes back to 2002)
 * Unit: annualized basis points of yield volatility
 */
const YAHOO =
  'https://query1.finance.yahoo.com/v8/finance/chart/%5EMOVE?period1=0&period2=9999999999&interval=1d&events=history';

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const data = payload.data || {};
data.USA = data.USA || {};
const errors = Array.isArray(payload.errors)
  ? payload.errors.filter(e => !String(e).startsWith('USA MOVE'))
  : [];
const asOf = new Date().toISOString();

try {
  const r = await fetch(YAHOO, {
    headers: {
      'User-Agent': 'Mozilla/5.0 MacroWatch/1.0',
      Accept: 'application/json'
    },
    signal: AbortSignal.timeout(60000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`Yahoo HTTP ${r.status}`);
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
    series.push({ period, value: Math.round(Number(c) * 100) / 100 });
  }
  // dedupe by date
  const map = new Map(series.map(p => [p.period, p.value]));
  const out = [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, value]) => ({ period, value }));
  if (out.length < 100) throw new Error('MOVE series too short');

  histories['USA-move'] = out;
  const last = out.at(-1);
  const prev = out.length > 1 ? out.at(-2) : null;
  const absChg = prev ? Math.round((last.value - prev.value) * 100) / 100 : null;
  const pctChg =
    prev && prev.value
      ? Math.round(((last.value / prev.value) - 1) * 10000) / 100
      : null;

  data.USA.move = {
    value: last.value,
    date: last.period,
    prevValue: prev ? prev.value : null,
    absChange: absChg,
    pctChange: pctChg,
    updatedAt: asOf,
    source: 'Yahoo Finance ^MOVE · ICE BofA MOVE Index',
    sourceUrl: 'https://finance.yahoo.com/quote/%5EMOVE/',
    unit: 'bp (ann.)',
    points: out.length,
    note:
      'MOVE = implizite Treasury-Optionsvolatilität (2Y/5Y/10Y/30Y), in annualisierten Basispunkten. Kein Prognoseinstrument.'
  };

  console.log('MOVE', last.period, last.value, 'n=', out.length, 'chg', absChg);
} catch (e) {
  errors.push(`USA MOVE: ${e.message}`);
  console.error('MOVE failed', e.message);
}

payload.histories = histories;
payload.data = data;
payload.errors = errors;
payload.updatedAt = asOf;
fs.writeFileSync('data.json', JSON.stringify(payload));
console.log('done');
