import fs from 'node:fs';

/**
 * EUR/Dollar page data
 *
 * XEURBI (official):
 *   CME Cross Currency API
 *   GET https://markets.api.cmegroup.com/xccy/v1/history?productCodes=XEURBI
 *   Auth required → set GitHub secret CME_XCCY_TOKEN (Bearer) or CME_API_KEY
 *
 * Fallbacks always free:
 *   ECB EUR/USD → USA-eurusd
 *   SOFR − €STR (bp) → USA-sofrEstr
 */

const UA = 'MacroWatch/1.9 (+https://hossein7935.github.io/)';
const CME_HISTORY =
  'https://markets.api.cmegroup.com/xccy/v1/history?productCodes=XEURBI&startDate=2024-07-01';

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

async function getText(url, accept = '*/*', extraHeaders = {}) {
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: accept, ...extraHeaders },
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
  const text = await getText(
    `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${start}`,
    'text/csv'
  );
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

function authHeaders() {
  const token =
    process.env.CME_XCCY_TOKEN ||
    process.env.CME_API_KEY ||
    process.env.CME_BEARER_TOKEN ||
    '';
  if (!token) return null;
  // Support raw token or already "Bearer …"
  const auth = token.toLowerCase().startsWith('bearer ') ? token : `Bearer ${token}`;
  return {
    Authorization: auth,
    Accept: 'application/json',
    'User-Agent': UA
  };
}

/** Official CME Cross Currency API */
async function fetchCmeXccyApi() {
  const headers = authHeaders();
  if (!headers) {
    console.warn(
      'XEURBI: kein CME_XCCY_TOKEN / CME_API_KEY — offizielle API übersprungen (401 ohne Auth)'
    );
    return { pts: [], status: 'no_credentials' };
  }
  const r = await fetch(CME_HISTORY, {
    headers,
    signal: AbortSignal.timeout(60000),
    cache: 'no-store'
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    console.warn('CME xccy API', r.status, t.slice(0, 200));
    return { pts: [], status: `http_${r.status}` };
  }
  const j = await r.json();
  const rows = Array.isArray(j) ? j : j.data || j.history || j.results || j.items || [];
  const pts = [];
  for (const row of rows) {
    const period = String(
      row.tradeDate || row.date || row.effectiveDate || row.refDate || row.businessDate || ''
    ).slice(0, 10);
    const n = Number(
      row.indexValue ?? row.value ?? row.xeurbi ?? row.rate ?? row.index
    );
    if (period && Number.isFinite(n)) pts.push({ period, value: n });
  }
  console.log('CME xccy API points', pts.length, pts.at(-1));
  return { pts, status: pts.length ? 'ok' : 'empty' };
}

/** Best-effort public HTML/JSON (usually blocked) */
async function fetchCmePublic() {
  const pts = [];
  try {
    const r = await fetch('https://www.cmegroup.com/CmeWS/mvc/ProductSlate/V2/List', {
      headers: {
        'User-Agent': UA,
        Accept: 'application/json',
        Referer: 'https://www.cmegroup.com/'
      },
      signal: AbortSignal.timeout(30000),
      cache: 'no-store'
    });
    if (!r.ok) return pts;
    const j = await r.json();
    for (const p of j.products || []) {
      const blob = [p.name, p.clearing, p.globex, p.cpc]
        .map((x) => String(x || '').toLowerCase())
        .join(' ');
      if (!blob.includes('cross-currency') && !/\bxeu\b/.test(blob) && !blob.includes('xeurbi'))
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
            signal: AbortSignal.timeout(20000),
            cache: 'no-store'
          });
          if (!rr.ok) continue;
          const jj = await rr.json();
          for (const row of jj.settlements || jj.quotes || []) {
            const period = String(row.tradeDate || row.updated || '').slice(0, 10);
            const n = Number(row.settle || row.last || row.priorSettle);
            if (period && Number.isFinite(n)) pts.push({ period, value: n });
          }
        } catch {}
      }
    }
  } catch (e) {
    console.warn('CME public', e.message);
  }
  return pts;
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const data = payload.data || {};
data.USA = data.USA || {};
const errors = Array.isArray(payload.errors)
  ? payload.errors.filter(
      (e) => !String(e).startsWith('USA XEURBI') && !String(e).startsWith('USA EURUSD')
    )
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
    unit: 'USD je EUR',
    note: 'EZB-Referenzkurs USD/EUR · kostenlos · lange Historie'
  };
  console.log('EURUSD', eurusd.length, last.period, last.value);
} catch (e) {
  errors.push(`USA EURUSD: ${e.message}`);
  console.error('EURUSD', e.message);
}

// 2) Official XEURBI
let xStatus = 'unknown';
try {
  const api = await fetchCmeXccyApi();
  xStatus = api.status;
  const pub = await fetchCmePublic();
  const prev = histories['USA-xeurbi'] || [];
  const series = mergeSeries(prev, api.pts, pub);
  if (series.length) {
    histories['USA-xeurbi'] = series;
    const last = series.at(-1);
    data.USA.xeurbi = {
      value: last.value,
      date: last.period,
      points: series.length,
      firstDate: series[0].period,
      updatedAt: asOf,
      source: 'CME XEURBI',
      sourceUrl:
        'https://www.cmegroup.com/market-data/cme-group-benchmark-administration/eur-usd-cross-currency-basis-index.html',
      unit: 'bp',
      apiStatus: xStatus,
      note:
        xStatus === 'ok'
          ? 'Offizielle CME Cross-Currency API · gemerged'
          : 'Gespeicherte/teilweise CME-Daten · volle API braucht CME_XCCY_TOKEN'
    };
    console.log('XEURBI', series.length, last.period, last.value, 'status', xStatus);
  } else {
    data.USA.xeurbi = {
      value: null,
      date: null,
      points: 0,
      updatedAt: asOf,
      source: 'CME XEURBI',
      apiStatus: xStatus,
      unit: 'bp',
      note:
        'Kein XEURBI-Punkt. Offizielle API: https://markets.api.cmegroup.com/xccy/v1/history (Auth). GitHub Secret CME_XCCY_TOKEN setzen. Öffentliche CME-Seiten sind blockiert (401/403). DataMine ist die lizenzierte Alternative.'
    };
    console.warn('XEURBI empty', xStatus);
  }
} catch (e) {
  errors.push(`USA XEURBI: ${e.message}`);
  console.error('XEURBI', e.message);
}

// 3) SOFR − €STR context
try {
  const [sofr, estr] = await Promise.all([
    fredCsv('SOFR', '2021-01-01'),
    fredCsv('ECBESTRVOLWGTTRMDMNRT', '2021-01-01')
  ]);
  const eMap = new Map(estr.map((p) => [p.period, p.value]));
  const spread = [];
  for (const p of sofr) {
    if (!eMap.has(p.period)) continue;
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
      source: 'FRED SOFR − €STR',
      unit: 'bp',
      note: 'SOFR−€STR in bp · Kontext, nicht identisch mit XEURBI'
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
console.log('done xeurbi status=', xStatus);
