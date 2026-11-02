import fs from 'node:fs';

/**
 * US 3M yield from TradingView (TVC:US03MY) + spread vs Term SOFR 3M.
 * Note: True short-term muni rate is SIFMA (not freely available with history on TV).
 * We use the 3M T-bill yield as the free 3M US rate for the SOFR–3M spread chart.
 */

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const data = payload.data || {};
const errors = [];

try {
  // Current 3M US yield from TradingView
  const r = await fetch('https://scanner.tradingview.com/global/scan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'MacroWatch/1.0 (+https://hossein7935.github.io/)'
    },
    body: JSON.stringify({
      symbols: { tickers: ['TVC:US03MY'], query: { types: [] } },
      columns: ['close', 'name', 'description']
    }),
    signal: AbortSignal.timeout(30000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`TradingView HTTP ${r.status}`);
  const j = await r.json();
  const row = (j.data || [])[0];
  const us3m = row?.d?.[0];
  if (us3m == null || !Number.isFinite(Number(us3m))) {
    throw new Error('TVC:US03MY ohne Wert');
  }

  const today = new Date().toISOString().slice(0, 10);
  const us3mVal = Math.round(Number(us3m) * 10000) / 10000;

  // Merge into growing history for US 3M
  const us3mHist = histories['USA-us3m'] || [];
  const map3 = new Map(us3mHist.map(p => [String(p.period), Number(p.value)]));
  map3.set(today, us3mVal);
  histories['USA-us3m'] = [...map3.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-400)
    .map(([period, value]) => ({ period, value }));

  data.USA = data.USA || {};
  data.USA.us3m = {
    value: us3mVal,
    date: today,
    source: 'TradingView · TVC:US03MY (US 3M T-Bill)'
  };

  // Spread: Term SOFR 3M − US 3M (when both available on same/near dates)
  const sofrHist = histories['USA-sofr3m'] || [];
  const spread = [];
  for (const s of sofrHist) {
    // find closest US3M on or before SOFR date
    let best = null;
    for (const u of histories['USA-us3m']) {
      if (u.period <= s.period) best = u;
      else break;
    }
    if (best && Number.isFinite(s.value) && Number.isFinite(best.value)) {
      spread.push({
        period: s.period,
        value: Math.round((s.value - best.value) * 10000) / 10000
      });
    }
  }
  // Also compute latest from current values
  const sofrLast = sofrHist.at(-1);
  if (sofrLast && Number.isFinite(sofrLast.value)) {
    const diff = Math.round((sofrLast.value - us3mVal) * 10000) / 10000;
    if (!spread.length || spread.at(-1).period !== today) {
      spread.push({ period: today, value: diff });
    } else {
      spread[spread.length - 1] = { period: today, value: diff };
    }
    data.USA.sofrUs3mSpread = {
      value: diff,
      date: today,
      source: 'Term SOFR 3M − US 3M (TV)'
    };
  }

  histories['USA-sofrUs3mSpread'] = spread.slice(-400);

  console.log('US3M', us3mVal, 'pts', histories['USA-us3m'].length);
  console.log('SOFR−US3M spread', data.USA.sofrUs3mSpread?.value, 'pts', histories['USA-sofrUs3mSpread'].length);
} catch (e) {
  errors.push(`SOFR−US3M spread: ${e.message}`);
  console.error(e.message);
}

payload.histories = histories;
payload.data = data;
payload.updatedAt = new Date().toISOString();
payload.errors = [
  ...(payload.errors || []).filter(e => !/sofrUs3m|US3M|US03MY/i.test(e)),
  ...errors
];
fs.writeFileSync('data.json', JSON.stringify(payload, null, 2) + '\n');
