import fs from 'node:fs';

/**
 * 10-year government bond yields from TradingView scanner (TVC:*10Y).
 * No API key required.
 */
const symbols = {
  USA: 'TVC:US10Y',
  DEU: 'TVC:DE10Y',
  FRA: 'TVC:FR10Y',
  JPN: 'TVC:JP10Y',
  CHN: 'TVC:CN10Y',
  AUS: 'TVC:AU10Y'
};

async function fetchTradingViewYields() {
  const tickers = Object.values(symbols);
  const r = await fetch('https://scanner.tradingview.com/global/scan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'MacroWatch/1.3 (+https://hossein7935.github.io/)'
    },
    body: JSON.stringify({
      symbols: { tickers, query: { types: [] } },
      columns: ['close', 'name', 'description', 'update_mode']
    }),
    signal: AbortSignal.timeout(30000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`TradingView HTTP ${r.status}`);
  const j = await r.json();
  const byTicker = {};
  for (const row of j.data || []) {
    byTicker[row.s] = {
      value: row.d?.[0],
      name: row.d?.[1],
      description: row.d?.[2]
    };
  }
  return byTicker;
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const data = payload.data || {};
const errors = [];

try {
  const quotes = await fetchTradingViewYields();
  const today = new Date().toISOString().slice(0, 10);

  for (const [id, ticker] of Object.entries(symbols)) {
    const q = quotes[ticker];
    if (!q || q.value == null || !Number.isFinite(Number(q.value))) {
      errors.push(`10J-Rendite ${id}: TradingView ${ticker} ohne Wert`);
      continue;
    }
    data[id] = data[id] || {};
    data[id].y10 = {
      value: Math.round(Number(q.value) * 10000) / 10000,
      date: today,
      source: `TradingView · ${ticker} (${q.description || '10 Year Government Bond Yield'})`
    };
  }
} catch (e) {
  errors.push(`TradingView 10J-Renditen: ${e.message}`);
}

payload.data = data;
payload.counts = payload.counts || {};
payload.counts.y10 = Object.keys(symbols).filter(id => data[id]?.y10).length;
payload.updatedAt = new Date().toISOString();
payload.errors = [
  ...(payload.errors || []).filter(e => !/10-Jahres|10J-Rendite|TradingView 10J|OECD-Langfrist/i.test(e)),
  ...errors
];
fs.writeFileSync('data.json', JSON.stringify(payload, null, 2) + '\n');
console.log('y10', payload.counts.y10 + '/6 (TradingView TVC:*10Y)');
