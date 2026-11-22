import fs from 'node:fs';

/**
 * EUR/USD Cross-Currency Basis Monitor
 *
 * Offizielles CME XEURBI ist oft gesperrt (403/401).
 * Deshalb:
 *  1) Öffentlicher Proxy: (SOFR − €STR) × 100 in bp  → lange Historie (FRED)
 *  2) CME XEURBI wenn erreichbar → überschreibt/ergänzt als USA-xeurbiOfficial
 *  3) Anzeige-Serie USA-xeurbi = CME wenn Punkte, sonst Proxy
 *
 * Der Proxy ist die USD–EUR Overnight-Zinsdifferenz in bp und
 * NICHT identisch mit dem CME Cross-Currency Basis Index,
 * korreliert aber mit Dollar-Funding-Stress und füllt die Chart.
 */

const UA = 'MacroWatch/1.9 (+https://hossein7935.github.io/)';

function mergeSeries(...lists) {
  const map = new Map();
  for (const list of lists) {
    for (const p of list || []) {
      if (!p?.period || !Number.isFinite(Number(p.value))) continue;
      map.set(String(p.period).slice(0, 10), Number(p.value));
    }
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, value]) => ({
      period,
      value: Math.round(value * 100) / 100
    }));
}

async function fredCsv(id, start = '2018-01-01') {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${start}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/csv' },
    signal: AbortSignal.timeout(90000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`${id} HTTP ${r.status}`);
  const text = await r.text();
  if (text.trim().startsWith('<')) throw new Error(`${id}: HTML`);
  const out = [];
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const [d, v] = line.split(',');
    if (!d || v == null || v === '' || v === '.') continue;
    const n = Number(v);
    if (Number.isFinite(n)) out.push({ period: d.trim().slice(0, 10), value: n });
  }
  if (!out.length) throw new Error(`${id}: leer`);
  return out;
}

async function tryCmeXeurbi() {
  const pts = [];
  try {
    const r = await fetch('https://www.cmegroup.com/CmeWS/mvc/ProductSlate/V2/List', {
      headers: {
        'User-Agent': UA,
        Accept: 'application/json',
        Referer: 'https://www.cmegroup.com/'
      },
      signal: AbortSignal.timeout(45000),
      cache: 'no-store'
    });
    if (!r.ok) throw new Error(`ProductSlate ${r.status}`);
    const j = await r.json();
    for (const p of j.products || []) {
      const blob = [p.name, p.clearing, p.globex, p.cpc]
        .map((x) => String(x || '').toLowerCase())
        .join(' ');
      if (
        !(blob.includes('cross-currency') ||
          blob.includes('cross currency') ||
          /\bxeu\b/.test(blob) ||
          blob.includes('xeurbi'))
      )
        continue;
      for (const path of [
        `https://www.cmegroup.com/CmeWS/mvc/Settlements/Futures/Settlements/${p.id}/G`,
        `https://www.cmegroup.com/CmeWS/mvc/Quotes/Future/${p.id}/G`
      ]) {
        try {
          const rr = await fetch(path, {
            headers: {
              'User-Agent': UA,
              Accept: 'application/json',
              Referer: 'https://www.cmegroup.com/'
            },
            signal: AbortSignal.timeout(30000),
            cache: 'no-store'
          });
          if (!rr.ok) continue;
          const jj = await rr.json();
          for (const row of jj.settlements || jj.quotes || []) {
            const period = String(
              row.tradeDate || row.businessDate || row.updated || ''
            ).slice(0, 10);
            const n = Number(
              row.settle || row.settlement || row.last || row.priorSettle || row.close
            );
            if (period && Number.isFinite(n)) pts.push({ period, value: n });
          }
        } catch (e) {
          console.warn('CME row', e.message);
        }
      }
    }
  } catch (e) {
    console.warn('CME', e.message);
  }
  return pts;
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const data = payload.data || {};
data.USA = data.USA || {};
const errors = Array.isArray(payload.errors)
  ? payload.errors.filter((e) => !String(e).startsWith('USA XEURBI') && !String(e).startsWith('USA xccy'))
  : [];
const asOf = new Date().toISOString();

// 1) Public proxy: SOFR − €STR in bp
let proxy = [];
try {
  const [sofr, estr] = await Promise.all([
    fredCsv('SOFR', '2018-04-01'),
    fredCsv('ECBESTRVOLWGTTRMDMNRT', '2019-10-01')
  ]);
  const eMap = new Map(estr.map((p) => [p.period, p.value]));
  for (const p of sofr) {
    if (!eMap.has(p.period)) continue;
    proxy.push({
      period: p.period,
      value: Math.round((p.value - eMap.get(p.period)) * 10000) / 100
    });
  }
  if (proxy.length < 50) throw new Error('Proxy zu kurz');
  histories['USA-xccyProxy'] = proxy;
  const last = proxy.at(-1);
  data.USA.xccyProxy = {
    value: last.value,
    date: last.period,
    points: proxy.length,
    firstDate: proxy[0].period,
    updatedAt: asOf,
    source: 'FRED SOFR − ECBESTRVOLWGTTRMDMNRT',
    unit: 'bp',
    note: 'Proxy: Overnight-Zinsspread USD−EUR in bp (nicht identisch mit CME XEURBI)'
  };
  console.log('Proxy', proxy.length, proxy[0].period, '→', last.period, last.value);
} catch (e) {
  errors.push(`USA xccyProxy: ${e.message}`);
  console.error('Proxy', e.message);
  proxy = histories['USA-xccyProxy'] || [];
}

// 2) CME official when available
let cme = [];
try {
  const fresh = await tryCmeXeurbi();
  cme = mergeSeries(histories['USA-xeurbiOfficial'] || [], fresh);
  if (cme.length) {
    histories['USA-xeurbiOfficial'] = cme;
    console.log('CME official', cme.length, 'fresh', fresh.length);
  } else {
    console.warn('CME: keine Punkte');
  }
} catch (e) {
  console.warn('CME', e.message);
}

// 3) Display series: prefer CME official, else proxy
const display = cme.length ? cme : proxy;
if (display.length) {
  histories['USA-xeurbi'] = display;
  const last = display.at(-1);
  const usingCme = cme.length > 0;
  data.USA.xeurbi = {
    value: last.value,
    date: last.period,
    points: display.length,
    firstDate: display[0].period,
    updatedAt: asOf,
    source: usingCme
      ? 'CME XEURBI'
      : 'Proxy SOFR−€STR (FRED) — CME XEURBI gesperrt',
    sourceUrl: usingCme
      ? 'https://www.cmegroup.com/market-data/cme-group-benchmark-administration/eur-usd-cross-currency-basis-index.html'
      : 'https://fred.stlouisfed.org/series/SOFR',
    unit: 'bp',
    note: usingCme
      ? 'Offizieller CME EUR/USD Cross-Currency Basis Index (bp)'
      : 'Proxy aus SOFR−€STR in bp. Nicht der CME-Index; dient als öffentlich verfügbare Historie bis CME erreichbar ist.'
  };
  console.log('Display', display.length, last.period, last.value, usingCme ? 'CME' : 'Proxy');
} else {
  errors.push('USA XEURBI: weder CME noch Proxy');
}

payload.histories = histories;
payload.data = data;
payload.errors = errors;
payload.updatedAt = asOf;
fs.writeFileSync('data.json', JSON.stringify(payload));
console.log('done xeurbi monitor');
