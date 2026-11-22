import fs from 'node:fs';

/**
 * USA EUR/Dollar page data
 * 1) ECB EUR/USD reference rate → USA-eurusd (long free history)
 * 2) CME XEURBI when reachable → USA-xeurbi (merge, never wipe)
 * 3) SOFR − €STR (bp) → USA-sofrEstr as funding-basis context
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
      value: Math.round(value * 10000) / 10000
    }));
}

async function getText(url, accept = '*/*') {
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: accept, Referer: 'https://www.cmegroup.com/' },
    signal: AbortSignal.timeout(90000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

async function fetchEcbEurUsd() {
  const url =
    'https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?startPeriod=2010-01-01&format=csvdata';
  const text = await getText(url, 'text/csv');
  const out = [];
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const parts = line.split(',');
    // KEY,...,TIME_PERIOD,OBS_VALUE,...
    // find TIME_PERIOD (YYYY-MM-DD) and OBS_VALUE
    let period = null;
    let value = null;
    for (let i = 0; i < parts.length; i++) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(parts[i])) {
        period = parts[i];
        const n = Number(parts[i + 1]);
        if (Number.isFinite(n)) value = n;
        break;
      }
    }
    if (period && value != null) out.push({ period, value });
  }
  if (out.length < 100) throw new Error('ECB EURUSD too short');
  return out;
}

async function fredCsv(id, start = '2018-01-01') {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${start}`;
  const text = await getText(url, 'text/csv');
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
  // Product slate → XEU / cross-currency
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
    if (r.ok) {
      const j = await r.json();
      for (const p of j.products || []) {
        const blob = [p.name, p.clearing, p.globex, p.cpc]
          .map((x) => String(x || '').toLowerCase())
          .join(' ');
        if (
          blob.includes('cross-currency') ||
          blob.includes('cross currency') ||
          /\bxeu\b/.test(blob) ||
          blob.includes('xeurbi')
        ) {
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
              const rows = jj.settlements || jj.quotes || [];
              for (const row of rows) {
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
      }
    }
  } catch (e) {
    console.warn('CME slate', e.message);
  }
  return pts;
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const data = payload.data || {};
data.USA = data.USA || {};
const errors = Array.isArray(payload.errors)
  ? payload.errors.filter((e) => !String(e).startsWith('USA XEURBI') && !String(e).startsWith('USA EURUSD'))
  : [];
const asOf = new Date().toISOString();

// 1) ECB EUR/USD
try {
  const eurusd = await fetchEcbEurUsd();
  histories['USA-eurusd'] = eurusd;
  const last = eurusd.at(-1);
  data.USA.eurusd = {
    value: last.value,
    date: last.period,
    points: eurusd.length,
    firstDate: eurusd[0].period,
    updatedAt: asOf,
    source: 'ECB EXR D.USD.EUR.SP00.A',
    sourceUrl: 'https://data.ecb.europa.eu/',
    unit: 'USD je EUR',
    note: 'EZB-Referenzkurs USD/EUR · lange Historie · kostenlos'
  };
  console.log('EURUSD', eurusd.length, eurusd[0].period, '→', last.period, last.value);
} catch (e) {
  errors.push(`USA EURUSD: ${e.message}`);
  console.error('EURUSD', e.message);
}

// 2) CME XEURBI merge
try {
  const fresh = await tryCmeXeurbi();
  const prev = histories['USA-xeurbi'] || [];
  const series = mergeSeries(prev, fresh);
  if (series.length) {
    histories['USA-xeurbi'] = series;
    const last = series.at(-1);
    data.USA.xeurbi = {
      value: last.value,
      date: last.period,
      points: series.length,
      firstDate: series[0].period,
      updatedAt: asOf,
      source: fresh.length ? 'CME XEURBI (merged)' : 'CME XEURBI (cached)',
      sourceUrl:
        'https://www.cmegroup.com/market-data/cme-group-benchmark-administration/eur-usd-cross-currency-basis-index.html',
      unit: 'bp',
      note:
        'XEURBI = CME EUR/USD Cross-Currency Basis Index (bp). Offizielle Langhistorie: CME DataMine. Hier: merge aus CME-Abruf + gespeicherter Historie.'
    };
    console.log('XEURBI', series.length, series[0].period, '→', last.period, last.value, 'fresh', fresh.length);
  } else {
    console.warn('XEURBI: noch keine Punkte (CME blockiert/leer)');
  }
} catch (e) {
  errors.push(`USA XEURBI: ${e.message}`);
  console.error('XEURBI', e.message);
}

// 3) SOFR − €STR in bp (context, not official XEURBI)
try {
  const [sofr, estr] = await Promise.all([
    fredCsv('SOFR', '2021-01-01'),
    fredCsv('ECBESTRVOLWGTTRMDMNRT', '2021-01-01')
  ]);
  const eMap = new Map(estr.map((p) => [p.period, p.value]));
  const spread = [];
  for (const p of sofr) {
    if (!eMap.has(p.period)) continue;
    // bp = (SOFR − ESTR) * 100
    spread.push({
      period: p.period,
      value: Math.round((p.value - eMap.get(p.period)) * 10000) / 100
    });
  }
  if (spread.length > 50) {
    histories['USA-sofrEstr'] = spread;
    const last = spread.at(-1);
    data.USA.sofrEstr = {
      value: last.value,
      date: last.period,
      points: spread.length,
      firstDate: spread[0].period,
      updatedAt: asOf,
      source: 'FRED SOFR − ECBESTRVOLWGTTRMDMNRT',
      unit: 'bp',
      note:
        'SOFR−€STR in bp · Kontext zur EUR/USD-Finanzierung, nicht identisch mit CME XEURBI'
    };
    console.log('SOFR-ESTR', spread.length, last.period, last.value);
  }
} catch (e) {
  console.warn('SOFR-ESTR', e.message);
}

payload.histories = histories;
payload.data = data;
payload.errors = errors;
payload.updatedAt = asOf;
fs.writeFileSync('data.json', JSON.stringify(payload));
console.log('done xeurbi/eurusd');
