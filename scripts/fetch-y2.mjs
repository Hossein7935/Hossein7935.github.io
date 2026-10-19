import fs from 'node:fs';

/**
 * 2-year government bond yields from TradingView scanner (TVC:*02Y).
 * No API key required.
 */
const symbols = {
  USA: 'TVC:US02Y',
  DEU: 'TVC:DE02Y',
  FRA: 'TVC:FR02Y',
  JPN: 'TVC:JP02Y',
  CHN: 'TVC:CN02Y',
  AUS: 'TVC:AU02Y'
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
      errors.push(`2J-Rendite ${id}: TradingView ${ticker} ohne Wert`);
      continue;
    }
    data[id] = data[id] || {};
    data[id].y2 = {
      value: Math.round(Number(q.value) * 10000) / 10000,
      date: today,
      source: `TradingView · ${ticker} (${q.description || '2 Year Government Bond Yield'})`
    };
  }
} catch (e) {
  errors.push(`TradingView 2J-Renditen: ${e.message}`);
}

payload.data = data;
payload.counts = payload.counts || {};
payload.counts.y2 = Object.keys(symbols).filter(id => data[id]?.y2).length;
payload.updatedAt = new Date().toISOString();
payload.errors = [
  ...(payload.errors || []).filter(e => !/2-Jahres|2J-Rendite|TradingView 2J|TRADING_ECONOMICS.*2/i.test(e)),
  ...errors
];
fs.writeFileSync('data.json', JSON.stringify(payload, null, 2) + '\n');
console.log('y2', payload.counts.y2 + '/6 (TradingView TVC:*02Y)');
