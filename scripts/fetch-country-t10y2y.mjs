import fs from 'node:fs';

/**
 * 10Y − 2Y yield curve (term spread) for non-USA countries.
 * Live: TradingView y10 − y2 (already in data.json).
 * History: daily accumulation + FRED/OECD monthly bootstrap (10Y − 3M short rate)
 * where available, so charts start with multi-year depth.
 */

const COUNTRIES = {
  DEU: { y10: 'IRLTLT01DEM156N', short: 'IR3TIB01DEM156N' },
  FRA: { y10: 'IRLTLT01FRM156N', short: 'IR3TIB01FRM156N' },
  JPN: { y10: 'IRLTLT01JPM156N', short: 'IR3TIB01JPM156N' },
  AUS: { y10: 'IRLTLT01AUM156N', short: 'IR3TIB01AUM156N' },
  CHN: { y10: null, short: null } // live only until free history exists
};

async function fredCsv(id, start = '2016-01-01') {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${start}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'MacroWatch/1.0 (+https://hossein7935.github.io/)' },
    signal: AbortSignal.timeout(40000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`FRED ${id} HTTP ${r.status}`);
  const text = await r.text();
  if (text.includes('<html')) throw new Error(`FRED ${id} blocked`);
  const rows = [];
  for (const line of text.trim().split(/\r?\n/).slice(1)) {
    const [date, val] = line.split(',');
    if (val && val !== '.' && Number.isFinite(Number(val))) {
      rows.push({ period: date.slice(0, 10), value: Number(val) });
    }
  }
  return rows;
}

function mergePoints(existing, incoming, maxPts = 400) {
  const map = new Map();
  for (const p of existing || []) {
    if (p?.period && Number.isFinite(Number(p.value))) map.set(String(p.period), Number(p.value));
  }
  for (const p of incoming || []) {
    if (p?.period && Number.isFinite(Number(p.value))) map.set(String(p.period), Number(p.value));
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-maxPts)
    .map(([period, value]) => ({ period, value: Math.round(value * 1000) / 1000 }));
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const data = payload.data || {};
const histories = payload.histories || {};
const errors = [];
const today = new Date().toISOString().slice(0, 10);

for (const [id, series] of Object.entries(COUNTRIES)) {
  try {
    const y10 = data[id]?.y10?.value;
    const y2 = data[id]?.y2?.value;
    const livePts = [];

    if (Number.isFinite(Number(y10)) && Number.isFinite(Number(y2))) {
      const spread = Math.round((Number(y10) - Number(y2)) * 1000) / 1000;
      livePts.push({ period: today, value: spread });
      data[id] = data[id] || {};
      data[id].t10y2y = {
        value: spread,
        date: today,
        source: `TradingView · ${id} 10Y − 2Y`
      };
    }

    // Monthly bootstrap from OECD long-term − short-term (proxy depth)
    let monthly = [];
    if (series.y10 && series.short) {
      try {
        const longRows = await fredCsv(series.y10);
        const shortRows = await fredCsv(series.short);
        const shortMap = new Map(shortRows.map(r => [r.period.slice(0, 7), r.value]));
        for (const r of longRows) {
          const ym = r.period.slice(0, 7);
          if (shortMap.has(ym)) {
            monthly.push({
              period: r.period.slice(0, 10),
              value: Math.round((r.value - shortMap.get(ym)) * 1000) / 1000
            });
          }
        }
      } catch (e) {
        errors.push(`${id} T10Y2Y bootstrap: ${e.message}`);
      }
    }

    const key = `${id}-t10y2y`;
    // Prefer monthly for past years; overwrite/merge with live daily points
    histories[key] = mergePoints(monthly, [...(histories[key] || []), ...livePts], 400);

    const last = histories[key].at(-1);
    if (last && !data[id]?.t10y2y) {
      data[id] = data[id] || {};
      data[id].t10y2y = {
        value: last.value,
        date: last.period,
        source: 'FRED/OECD · 10Y − short rate (approx)'
      };
    }

    console.log(
      id,
      't10y2y',
      histories[key].length,
      'pts',
      'first',
      histories[key][0]?.period,
      'last',
      last?.period,
      last?.value
    );
  } catch (e) {
    errors.push(`${id} T10Y2Y: ${e.message}`);
    console.error(id, e.message);
  }
}

payload.data = data;
payload.histories = histories;
payload.updatedAt = new Date().toISOString();
payload.errors = [
  ...(payload.errors || []).filter(e => !/T10Y2Y|t10y2y/i.test(e)),
  ...errors
];
fs.writeFileSync('data.json', JSON.stringify(payload, null, 2) + '\n');
