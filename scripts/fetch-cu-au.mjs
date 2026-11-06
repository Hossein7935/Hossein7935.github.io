import fs from 'fs';

const UA = 'Mozilla/5.0 (compatible; MacroWatch/1.0)';

async function chart(symbol, range = 'max', interval = '1d') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${symbol} HTTP ${r.status}`);
  const j = await r.json();
  const res = j?.chart?.result?.[0];
  if (!res) throw new Error(`${symbol} no result`);
  const ts = res.timestamp || [];
  const closes = res.indicators?.quote?.[0]?.close || [];
  const out = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (c == null || !Number.isFinite(c)) continue;
    const d = new Date(ts[i] * 1000);
    const period = d.toISOString().slice(0, 10);
    out.push({ period, value: c });
  }
  return out;
}

function alignRatio(cu, au) {
  const map = new Map(au.map(x => [x.period, x.value]));
  const pts = [];
  for (const p of cu) {
    const g = map.get(p.period);
    if (g == null || g === 0) continue;
    pts.push({ period: p.period, value: (p.value / g) * 1000 });
  }
  return pts;
}

async function main() {
  const path = 'data.json';
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  data.histories = data.histories || {};
  data.data = data.data || {};
  data.data.USA = data.data.USA || {};

  let cu, au;
  try {
    [cu, au] = await Promise.all([
      chart('HG=F', 'max', '1d'),
      chart('GC=F', 'max', '1d'),
    ]);
  } catch (e) {
    console.error('daily max failed', e.message);
    [cu, au] = await Promise.all([
      chart('HG=F', '10y', '1d'),
      chart('GC=F', '10y', '1d'),
    ]);
  }

  const ratio = alignRatio(cu, au);
  if (ratio.length < 10) throw new Error('too few ratio points: ' + ratio.length);

  const cut = new Date();
  cut.setFullYear(cut.getFullYear() - 2);
  const cutStr = cut.toISOString().slice(0, 10);
  const compact = [];
  let lastMonth = '';
  for (const p of ratio) {
    if (p.period >= cutStr) {
      compact.push(p);
      continue;
    }
    const m = p.period.slice(0, 7);
    if (m !== lastMonth) {
      compact.push(p);
      lastMonth = m;
    }
  }

  data.histories['USA-cuAu'] = compact;
  const last = compact[compact.length - 1];
  data.data.USA.cuAu = {
    value: last.value,
    date: last.period,
    source: 'Yahoo HG=F / GC=F · Ratio×1000',
  };
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(path, JSON.stringify(data));
  console.log('cuAu points', compact.length, 'last', last.value.toFixed(4), last.period);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
