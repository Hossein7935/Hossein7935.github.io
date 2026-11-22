import fs from 'node:fs';

/**
 * EUR/Dollar page data:
 * 1) SOFR−€STR proxy (or CME XEURBI when available)
 * 2) EUR/USD 25Δ Risk-Reversal Proxy from realized return skew
 *
 * Offizielle 25Δ RR Quotes sind OTC (Broker/Bloomberg) und nicht frei.
 * Proxy: rolling upside vs downside realized vol of EURUSD log-returns (FRED DEXUSEU).
 * RR_proxy ≈ σ_up − σ_down (Vol-Punkte). Negativ ≈ mehr Abwärtsrisiko eingepreist (analog Put-Skew).
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

async function fredCsv(id, start = '2015-01-01') {
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

/** 25Δ RR-Proxy: annualisierte Up-Vol minus Down-Vol über Fenster (Vol-Punkte). */
function riskReversalProxy(spotSeries, window = 21) {
  const pts = [];
  const rets = [];
  for (let i = 1; i < spotSeries.length; i++) {
    const a = spotSeries[i - 1].value;
    const b = spotSeries[i].value;
    if (!(a > 0 && b > 0)) continue;
    rets.push({
      period: spotSeries[i].period,
      r: Math.log(b / a)
    });
  }
  for (let i = window - 1; i < rets.length; i++) {
    const slice = rets.slice(i - window + 1, i + 1);
    const up = [];
    const dn = [];
    for (const x of slice) {
      if (x.r >= 0) up.push(x.r);
      else dn.push(x.r);
    }
    // brauchen beide Seiten
    if (up.length < 3 || dn.length < 3) continue;
    const rms = (arr) => {
      let s = 0;
      for (const v of arr) s += v * v;
      return Math.sqrt(s / arr.length);
    };
    // annualisiert (252) in Vol-Punkten (%)
    const sigUp = rms(up) * Math.sqrt(252) * 100;
    const sigDn = rms(dn) * Math.sqrt(252) * 100;
    // Call-Seite (Up) − Put-Seite (Down): negativ = Downside teurer / Put-Skew
    const rr = sigUp - sigDn;
    pts.push({
      period: rets[i].period,
      value: Math.round(rr * 100) / 100
    });
  }
  return pts;
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
  ? payload.errors.filter(
      (e) =>
        !String(e).startsWith('USA XEURBI') &&
        !String(e).startsWith('USA xccy') &&
        !String(e).startsWith('USA RR25')
    )
  : [];
const asOf = new Date().toISOString();

// --- SOFR−€STR / XEURBI ---
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
      value: Math.round((p.value - eMap.get(p.period)) * 10000) / 10000
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
    unit: '%',
    note: 'Proxy: Overnight-Zinsspread USD−EUR in Prozentpunkten (nicht CME XEURBI)'
  };
  console.log('Proxy', proxy.length, last.period, last.value);
} catch (e) {
  errors.push(`USA xccyProxy: ${e.message}`);
  console.error('Proxy', e.message);
  proxy = histories['USA-xccyProxy'] || [];
}

let cme = [];
try {
  const fresh = await tryCmeXeurbi();
  cme = mergeSeries(histories['USA-xeurbiOfficial'] || [], fresh);
  if (cme.length) histories['USA-xeurbiOfficial'] = cme;
} catch (e) {
  console.warn('CME', e.message);
}

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
    source: usingCme ? 'CME XEURBI' : 'Proxy SOFR−€STR (FRED)',
    unit: usingCme ? 'bp' : '%',
    note: usingCme
      ? 'Offizieller CME XEURBI'
      : 'Proxy SOFR−€STR in %-Punkten — nicht CME XEURBI'
  };
  console.log('Display basis', display.length, last.period, last.value);
}

// --- 25Δ Risk Reversal Proxy ---
try {
  const eurusd = await fredCsv('DEXUSEU', '2015-01-01');
  const rr = riskReversalProxy(eurusd, 21);
  if (rr.length < 30) throw new Error('RR Proxy zu kurz');
  histories['USA-rr25'] = rr;
  const last = rr.at(-1);
  data.USA.rr25 = {
    value: last.value,
    date: last.period,
    points: rr.length,
    firstDate: rr[0].period,
    updatedAt: asOf,
    source: 'Proxy aus FRED DEXUSEU (realized up/down vol, 21d)',
    unit: 'Vol-Punkte',
    note:
      '25Δ Risk-Reversal-Proxy: annualisierte Up-Vol minus Down-Vol (21 Handelstage). ' +
      'Negativ ≈ mehr Abwärtsrisiko (Put-Skew). Kein OTC-Optionsquote; echte 25Δ RR sind Broker/Bloomberg.'
  };
  console.log('RR25 proxy', rr.length, last.period, last.value);
} catch (e) {
  errors.push(`USA RR25: ${e.message}`);
  console.error('RR25', e.message);
}

payload.histories = histories;
payload.data = data;
payload.errors = errors;
payload.updatedAt = asOf;
fs.writeFileSync('data.json', JSON.stringify(payload));
console.log('done xeurbi + rr25');
