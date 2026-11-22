import fs from 'node:fs';

/**
 * Nur CME XEURBI (EUR/USD Cross-Currency Basis Index, bp).
 * Kein EZB-Kassakurs, kein SOFR−€STR als Ersatzserie.
 * Merge: bestehende Historie bleibt, neue CME-Punkte werden ergänzt.
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
  ? payload.errors.filter((e) => !String(e).startsWith('USA XEURBI'))
  : [];
const asOf = new Date().toISOString();

// Drop unused ECB FX / SOFR-ESTR display series from USA meta (keep histories if present)
delete data.USA.eurusd;
delete data.USA.sofrEstr;

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
      note: 'CME EUR/USD Cross-Currency Basis Index (bp) · nur echte XEURBI-Werte'
    };
    console.log('XEURBI', series.length, series[0].period, '→', last.period, last.value, 'fresh', fresh.length);
  } else {
    data.USA.xeurbi = {
      value: null,
      date: null,
      points: 0,
      updatedAt: asOf,
      source: 'CME XEURBI',
      sourceUrl:
        'https://www.cmegroup.com/market-data/cme-group-benchmark-administration/eur-usd-cross-currency-basis-index.html',
      unit: 'bp',
      note:
        'Noch keine Punkte: CME API/DataMine blockiert kostenlosen Abruf. Kein EZB-Kassakurs als Ersatz.'
    };
    console.warn('XEURBI: 0 Punkte (CME nicht erreichbar)');
    errors.push('USA XEURBI: CME Abruf lieferte keine Punkte');
  }
} catch (e) {
  errors.push(`USA XEURBI: ${e.message}`);
  console.error('XEURBI', e.message);
}

payload.histories = histories;
payload.data = data;
payload.errors = errors;
payload.updatedAt = asOf;
fs.writeFileSync('data.json', JSON.stringify(payload));
console.log('done xeurbi-only');
