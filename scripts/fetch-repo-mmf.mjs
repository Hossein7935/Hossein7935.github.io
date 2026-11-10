import fs from 'node:fs';

/**
 * OFR Short-Term Funding Monitor
 * Chart1: MMF Total Assets + MMF Repo holdings (monthly, $T)
 * Chart2: Tri-party overnight repo volume ($B) + rates (TRI, DVP, SOFR)
 */

async function fetchJson(url, label) {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'MacroWatch/1.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(60000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`${label} HTTP ${r.status}`);
  return r.json();
}

async function ofrSeries(mnemonic) {
  const url = `https://data.financialresearch.gov/v1/series/timeseries?mnemonic=${encodeURIComponent(mnemonic)}`;
  const d = await fetchJson(url, mnemonic);
  if (!Array.isArray(d)) throw new Error(`${mnemonic}: not array`);
  return d
    .filter(row => Array.isArray(row) && row.length >= 2 && Number.isFinite(Number(row[1])))
    .map(([period, value]) => ({
      period: String(period).slice(0, 10),
      value: Number(value)
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

function toTrillions(pts) {
  return pts.map(p => ({ period: p.period, value: Math.round((p.value / 1e12) * 1000) / 1000 }));
}
function toBillions(pts) {
  return pts.map(p => ({ period: p.period, value: Math.round((p.value / 1e9) * 100) / 100 }));
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const data = payload.data || {};
data.USA = data.USA || {};
const errors = Array.isArray(payload.errors)
  ? payload.errors.filter(e => !String(e).startsWith('USA Repo/MMF'))
  : [];
const asOf = new Date().toISOString();

try {
  // MMF totals (monthly)
  const mmfTotRaw = await ofrSeries('MMF-MMF_TOT-M');
  const mmfRepoRaw = await ofrSeries('MMF-MMF_RP_TOT-M');
  const mmfTot = toTrillions(mmfTotRaw);
  const mmfRepo = toTrillions(mmfRepoRaw);
  histories['USA-mmfTot'] = mmfTot;
  histories['USA-mmfRepo'] = mmfRepo;

  // Repo volumes & rates (daily)
  const triVol = toBillions(await ofrSeries('REPO-TRI_TV_OO-P'));
  const dvpVol = toBillions(await ofrSeries('REPO-DVP_TV_OO-P'));
  const triRate = await ofrSeries('REPO-TRI_AR_OO-P');
  const dvpRate = await ofrSeries('REPO-DVP_AR_OO-P');
  let sofr = [];
  try {
    sofr = await ofrSeries('FNYR-SOFR-A');
  } catch (e) {
    sofr = histories['USA-sofr'] || [];
    console.warn('OFR SOFR fail, use local', e.message);
  }
  histories['USA-repoTriVol'] = triVol;
  histories['USA-repoDvpVol'] = dvpVol;
  histories['USA-repoTriRate'] = triRate;
  histories['USA-repoDvpRate'] = dvpRate;
  if (sofr.length) histories['USA-sofr'] = sofr.length > (histories['USA-sofr'] || []).length ? sofr : histories['USA-sofr'];

  // Combined volume (tri + dvp overnight) for chart convenience
  const volMap = new Map();
  for (const p of triVol) volMap.set(p.period, { period: p.period, tri: p.value, dvp: null });
  for (const p of dvpVol) {
    const row = volMap.get(p.period) || { period: p.period, tri: null, dvp: null };
    row.dvp = p.value;
    volMap.set(p.period, row);
  }
  const repoVolSum = [...volMap.values()]
    .map(r => ({
      period: r.period,
      value: Math.round(((r.tri || 0) + (r.dvp || 0)) * 100) / 100
    }))
    .filter(p => p.value > 0)
    .sort((a, b) => a.period.localeCompare(b.period));
  histories['USA-repoVolSum'] = repoVolSum;

  data.USA.repoMmf = {
    updatedAt: asOf,
    source: 'OFR Short-Term Funding Monitor (mmf + repo + fnyr)',
    mmfTotLast: mmfTot.at(-1) || null,
    mmfRepoLast: mmfRepo.at(-1) || null,
    triVolLast: triVol.at(-1) || null,
    triRateLast: triRate.at(-1) || null,
    dvpRateLast: dvpRate.at(-1) || null,
    sofrLast: (sofr.at(-1) || (histories['USA-sofr'] || []).at(-1)) || null,
    units: {
      mmf: '$T',
      repoVol: '$B',
      rate: '%'
    }
  };

  console.log(
    'MMF tot', mmfTot.length, mmfTot.at(-1),
    'repo', mmfRepo.length, mmfRepo.at(-1),
    'triVol', triVol.length, triVol.at(-1),
    'triRate', triRate.at(-1)
  );
} catch (e) {
  errors.push(`USA Repo/MMF: ${e.message}`);
  console.error(e);
}

payload.histories = histories;
payload.data = data;
payload.errors = errors;
payload.updatedAt = asOf;
fs.writeFileSync('data.json', JSON.stringify(payload));
console.log('done');
