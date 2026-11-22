import fs from 'node:fs';

/**
 * CME EUR/USD Cross-Currency Basis Index (XEURBI)
 * Official index since 2024-07-27; values in basis points.
 * Sources (best effort, free):
 *  1) CME CmeWS product slate + settlements/quotes (when reachable)
 *  2) Merge with any previously stored history in data.json
 * Note: full official history is on CME DataMine (licensed).
 * We keep every successful daily observation so history grows.
 */

const UA = 'MacroWatch/1.8 (+https://hossein7935.github.io/)';

function mergeSeries(...lists) {
  const map = new Map();
  for (const list of lists) {
    for (const p of list || []) {
      if (!p?.period || !Number.isFinite(Number(p.value))) continue;
      map.set(String(p.period).slice(0, 10), Math.round(Number(p.value) * 100) / 100);
    }
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, value]) => ({ period, value }));
}

async function jget(url) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json,text/plain,*/*',
      Referer: 'https://www.cmegroup.com/'
    },
    signal: AbortSignal.timeout(45000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function findXeuProductId() {
  const j = await jget('https://www.cmegroup.com/CmeWS/mvc/ProductSlate/V2/List');
  const products = j.products || [];
  for (const p of products) {
    const blob = [p.name, p.clearing, p.globex, p.cpc, p.floor]
      .map((x) => String(x || '').toLowerCase())
      .join(' ');
    if (
      blob.includes('cross-currency') ||
      blob.includes('cross currency') ||
      blob.includes('xeurbi') ||
      /\bxeu\b/.test(blob)
    ) {
      return { id: p.id, name: p.name, clearing: p.clearing, globex: p.globex };
    }
  }
  return null;
}

function pointsFromSettlements(j) {
  const out = [];
  const settlements = j?.settlements || j?.Settlements || j?.quotes || [];
  const list = Array.isArray(settlements) ? settlements : [];
  for (const row of list) {
    const period = String(
      row.tradeDate || row.businessDate || row.updated || row.lastUpdateTime || ''
    ).slice(0, 10);
    const raw =
      row.settle ||
      row.settlement ||
      row.last ||
      row.priorSettle ||
      row.close ||
      row.price;
    const n = Number(raw);
    if (period && Number.isFinite(n)) out.push({ period, value: Math.round(n * 100) / 100 });
  }
  return out;
}

async function fetchCmeSettlements(productId) {
  const urls = [
    `https://www.cmegroup.com/CmeWS/mvc/Settlements/Futures/Settlements/${productId}/G`,
    `https://www.cmegroup.com/CmeWS/mvc/Quotes/Future/${productId}/G`
  ];
  const all = [];
  for (const url of urls) {
    try {
      const j = await jget(url);
      const pts = pointsFromSettlements(j);
      console.log('CME', url.split('/').slice(-3).join('/'), 'pts', pts.length, pts.at(-1));
      all.push(...pts);
      // also walk nested contract months
      const quotes = j?.quotes || j?.tradeDateQuotes || [];
      if (Array.isArray(quotes)) {
        for (const q of quotes) {
          const period = String(q.updated || q.tradeDate || '').slice(0, 10);
          const n = Number(q.last || q.priorSettle || q.settle || q.close);
          if (period && Number.isFinite(n)) all.push({ period, value: Math.round(n * 100) / 100 });
        }
      }
    } catch (e) {
      console.warn('CME fail', url, e.message);
    }
  }
  return all;
}

/** Optional: try index fixings symbol used on CME webpage (XEURBIZ0) */
async function fetchFixingHint() {
  // Public HTML sometimes embeds last print; best-effort only
  try {
    const r = await fetch(
      'https://www.cmegroup.com/market-data/cme-group-benchmark-administration/eur-usd-cross-currency-basis-index.html',
      {
        headers: { 'User-Agent': UA, Accept: 'text/html' },
        signal: AbortSignal.timeout(30000),
        cache: 'no-store'
      }
    );
    if (!r.ok) return [];
    const html = await r.text();
    // look for number patterns near basis / index
    const m = html.match(/XEURBI[\s\S]{0,200}?([+-]?\d+\.\d{1,2})/);
    if (m) {
      const v = Number(m[1]);
      if (Number.isFinite(v) && Math.abs(v) < 200) {
        const today = new Date().toISOString().slice(0, 10);
        return [{ period: today, value: Math.round(v * 100) / 100 }];
      }
    }
  } catch (e) {
    console.warn('HTML hint', e.message);
  }
  return [];
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const data = payload.data || {};
data.USA = data.USA || {};
const errors = Array.isArray(payload.errors)
  ? payload.errors.filter((e) => !String(e).startsWith('USA XEURBI'))
  : [];
const asOf = new Date().toISOString();
const prev = histories['USA-xeurbi'] || [];

let fresh = [];
let metaProd = null;
try {
  metaProd = await findXeuProductId();
  console.log('product', metaProd);
  if (metaProd?.id) {
    fresh = await fetchCmeSettlements(metaProd.id);
  }
} catch (e) {
  console.warn('product slate', e.message);
  errors.push(`USA XEURBI product: ${e.message}`);
}

try {
  const hint = await fetchFixingHint();
  if (hint.length) fresh = mergeSeries(fresh, hint);
} catch (e) {
  console.warn(e.message);
}

const series = mergeSeries(prev, fresh);
if (series.length < 1) {
  errors.push('USA XEURBI: keine Daten (CME blockiert oder leer) — Historie bleibt erhalten falls vorhanden');
  console.error('no XEURBI points');
} else {
  histories['USA-xeurbi'] = series;
  const last = series.at(-1);
  const p2 = series.length > 1 ? series.at(-2) : null;
  data.USA.xeurbi = {
    value: last.value,
    date: last.period,
    prevValue: p2 ? p2.value : null,
    absChange: p2 ? Math.round((last.value - p2.value) * 100) / 100 : null,
    unit: 'bp',
    points: series.length,
    firstDate: series[0].period,
    updatedAt: asOf,
    source: metaProd
      ? `CME · ${metaProd.name || 'XEU'} / XEURBI`
      : 'CME XEURBI (merged history)',
    sourceUrl:
      'https://www.cmegroup.com/market-data/cme-group-benchmark-administration/eur-usd-cross-currency-basis-index.html',
    productId: metaProd?.id || null,
    note:
      'XEURBI = CME EUR/USD Cross-Currency Basis Index (bp Abweichung von Covered Interest Parity). Index seit 2024-07-27. Offizielle Langhistorie: CME DataMine.'
  };
  console.log('XEURBI', series.length, series[0].period, '→', last.period, last.value);
}

payload.histories = histories;
payload.data = data;
payload.errors = errors;
payload.updatedAt = asOf;
fs.writeFileSync('data.json', JSON.stringify(payload));
console.log('done xeurbi');
