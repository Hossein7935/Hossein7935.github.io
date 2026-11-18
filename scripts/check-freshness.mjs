import fs from 'node:fs';

/**
 * Datenprüfung: vergleicht für jede angezeigte Reihe den Stand auf der Seite
 * (data.json) mit dem neuesten Stand, den die Originalquelle gerade anbietet.
 * Unabhängig von den Abrufskripten – jede Quelle wird hier frisch gefragt.
 *
 * Ergebnis: freshness.json (wird mit der Seite veröffentlicht und dort angezeigt)
 *           + Tabelle in der Zusammenfassung des Actions-Laufs.
 *
 * Status: ok (Seite ist auf dem neuesten Stand der Quelle)
 *         alt (Quelle hat neuere Daten als die Seite)
 *         info (Prognose/Quartalswert, nicht automatisch vergleichbar)
 *         fehler (Quelle bei der Prüfung nicht erreichbar)
 */

const UA = { 'User-Agent': 'MacroWatch-check/1.0 (+https://hossein7935.github.io/)' };
const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const D = payload.data || {};
const H = payload.histories || {};
const today = new Date().toISOString().slice(0, 10);

// ---------- Hilfen ------------------------------------------------------------------------
async function get(url, { accept = '*/*', json = false, method = 'GET', body, timeout = 30000 } = {}) {
  const r = await fetch(url, {
    method,
    headers: { ...UA, Accept: accept, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body,
    signal: AbortSignal.timeout(timeout),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return json ? r.json() : r.text();
}
const cache = new Map();
const once = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };

function lastWeekday(d = new Date()) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  while (x.getUTCDay() === 0 || x.getUTCDay() === 6) x.setUTCDate(x.getUTCDate() - 1);
  return x.toISOString().slice(0, 10);
}
const histLast = (key) => {
  const a = H[key];
  return Array.isArray(a) && a.length ? String(a[a.length - 1].period) : null;
};
const dateOf = (obj) => (obj && obj.date ? String(obj.date) : null);

// ---------- Quellen -----------------------------------------------------------------------
const fredLast = (id) => once(`fred:${id}`, async () => {
  const start = new Date(Date.now() - 3 * 365 * 86400000).toISOString().slice(0, 10);
  const text = await get(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${start}`, { accept: 'text/csv', timeout: 45000 });
  const rows = text.trim().split(/\r?\n/).slice(1).filter((l) => { const v = l.split(',')[1]; return v && v !== '.'; });
  if (!rows.length) throw new Error('leer');
  return { date: rows[rows.length - 1].split(',')[0].slice(0, 10) };
});
const nyfedLast = (path) => once(`ny:${path}`, async () => {
  const j = await get(`https://markets.newyorkfed.org/api/rates/${path}/last/1.json`, { json: true, accept: 'application/json' });
  const r = (j.refRates || [])[0];
  if (!r?.effectiveDate) throw new Error('keine Daten');
  return { date: r.effectiveDate };
});
const treasuryLast = (type) => once(`tr:${type}`, async () => {
  const y = new Date().getUTCFullYear();
  const text = await get(`https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${y}/all?type=${type}&field_tdr_date_value=${y}&page&_format=csv`, { accept: 'text/csv', timeout: 60000 });
  const dates = [...text.matchAll(/^(\d{2})\/(\d{2})\/(\d{4})/gm)].map((m) => `${m[3]}-${m[1]}-${m[2]}`).sort();
  if (!dates.length) throw new Error('keine Daten');
  return { date: dates[dates.length - 1] };
});
const yahooLast = (sym) => once(`y:${sym}`, async () => {
  const j = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=10d`, { json: true, accept: 'application/json' });
  const res = j?.chart?.result?.[0];
  const ts = (res?.timestamp || []).filter((t, i) => res.indicators?.quote?.[0]?.close?.[i] != null);
  if (!ts.length) throw new Error('keine Daten');
  return { date: new Date(ts[ts.length - 1] * 1000).toISOString().slice(0, 10) };
});
const ofrLast = (mn) => once(`ofr:${mn}`, async () => {
  const j = await get(`https://data.financialresearch.gov/v1/series/timeseries?mnemonic=${encodeURIComponent(mn)}`, { json: true, accept: 'application/json', timeout: 45000 });
  if (!Array.isArray(j) || !j.length) throw new Error('keine Daten');
  const dates = j.filter((r) => Array.isArray(r) && r[1] != null && Number.isFinite(Number(r[1]))).map((r) => String(r[0]).slice(0, 10)).sort();
  if (!dates.length) throw new Error('keine Werte');
  return { date: dates[dates.length - 1] };
});
const tvQuotes = () => once('tv', async () => {
  const tickers = ['TVC:US02Y', 'TVC:US10Y', 'TVC:DE02Y', 'TVC:DE10Y', 'TVC:FR02Y', 'TVC:FR10Y', 'TVC:JP02Y', 'TVC:JP10Y', 'TVC:CN02Y', 'TVC:CN10Y', 'TVC:AU02Y', 'TVC:AU10Y'];
  const j = await get('https://scanner.tradingview.com/global/scan', {
    method: 'POST', json: true, accept: 'application/json',
    body: JSON.stringify({ symbols: { tickers, query: { types: [] } }, columns: ['close'] })
  });
  const by = {};
  for (const row of j.data || []) by[row.s] = Number(row.d?.[0]);
  return by;
});
const sksiLast = () => once('sksi', async () => {
  const j = await get('https://raw.githubusercontent.com/Hossein7935/sksi-credit-stress-index/main/data/latest.json', { json: true, accept: 'application/json' });
  return { date: String(j.date).slice(0, 10) };
});
const fhlbNext = () => once('fhlb', async () => {
  // Ist das PDF für das Quartal nach dem angezeigten schon erschienen?
  const shown = dateOf(D.USA?.fhlbAdv) || '';
  const [y, m] = shown.split('-').map(Number);
  if (!y) throw new Error('kein Stand');
  let q = Math.ceil(m / 3) + 1, yy = y;
  if (q > 4) { q = 1; yy++; }
  const url = `https://cdn.fhlb-of.com/files/${yy}/${yy}Q${q}FHLBCombinedOperatingHighlights.pdf`;
  const r = await fetch(url, { method: 'HEAD', headers: UA, signal: AbortSignal.timeout(20000) });
  const end = new Date(Date.UTC(yy, q * 3, 0)).toISOString().slice(0, 10);
  return r.ok ? { date: end, note: `Quartal ${yy}Q${q} ist erschienen` } : { date: shown, note: `${yy}Q${q} noch nicht erschienen` };
});
const live = () => Promise.resolve({ date: lastWeekday(), note: 'laufend (TradingView)' });

// ---------- Prüfliste ---------------------------------------------------------------------
const C = (D.USA && D.USA.credit && D.USA.credit.items) || {};
const credit = (k) => (C[k] ? String(C[k].date) : null);
const curveTips10 = () => ((D.USA?.ustCurve?.detail || []).find((x) => x.kind === 'tips' && x.tenor === '10Y') || {}).date || null;

const CHECKS = [
  // USA Seite 1
  ['USA · Seite 1', 'Inflation (CPI J/J)', () => dateOf(D.USA?.inflation), () => fredLast('CPIAUCSL'), 'FRED CPIAUCSL'],
  ['USA · Seite 1', 'Leitzins (Fed-Zielspanne)', () => dateOf(D.USA?.rate), () => fredLast('DFEDTARU'), 'FRED DFEDTARU'],
  ['USA · Seite 1', 'Staatsanleihen 2 Jahre', () => dateOf(D.USA?.y2), live, 'TradingView TVC:US02Y', { tv: ['TVC:US02Y', () => D.USA?.y2?.value] }],
  ['USA · Seite 1', 'Staatsanleihen 10 Jahre', () => dateOf(D.USA?.y10), live, 'TradingView TVC:US10Y', { tv: ['TVC:US10Y', () => D.USA?.y10?.value] }],
  ['USA · Seite 1', 'Zinskurve 10Y − 2Y', () => dateOf(D.USA?.t10y2y), live, 'Treasury + TradingView'],
  ['USA · Seite 1', 'TIPS Realzins 5 Jahre', () => dateOf(D.USA?.tips5), () => treasuryLast('daily_treasury_real_yield_curve'), 'U.S. Treasury Real Yield'],
  ['USA · Seite 1', 'TIPS Realzins 10 Jahre', () => dateOf(D.USA?.tips10), () => treasuryLast('daily_treasury_real_yield_curve'), 'U.S. Treasury Real Yield'],
  ['USA · Seite 1', 'Bankreserven / BIP', () => dateOf(D.USA?.reservesGdp), () => fredLast('WRESBAL'), 'FRED WRESBAL'],
  ['USA · Seite 1', 'Haushaltsdefizit (MTS)', () => dateOf(D.USA?.deficit), () => fredLast('MTSDS133FMS'), 'FRED MTSDS133FMS'],
  ['USA · Seite 1', 'Reales BIP (Chart)', () => histLast('USA-gdp'), () => fredLast('A191RL1Q225SBEA'), 'FRED A191RL1Q225SBEA'],
  ['USA · Seite 1', 'Reales BIP (Karte)', () => dateOf(D.USA?.gdp), null, 'IMF-Prognose für das gewählte Jahr'],
  ['USA · Seite 1', 'DXY', () => dateOf(D.USA?.dxy), () => yahooLast('DX-Y.NYB'), 'Yahoo DX-Y.NYB'],
  // USA Seite 2
  ['USA · Seite 2', 'Bankreserven WRESBAL', () => dateOf(D.USA?.wresbal), () => fredLast('WRESBAL'), 'FRED WRESBAL'],
  ['USA · Seite 2', 'BofA CCC High Yield', () => dateOf(D.USA?.bofaCcc), () => fredLast('BAMLH0A3HYCEY'), 'FRED BAMLH0A3HYCEY'],
  ['USA · Seite 2', 'Kupfer / Gold', () => dateOf(D.USA?.cuAu), () => yahooLast('HG=F'), 'Yahoo HG=F'],
  ['USA · Seite 2', 'Schulden Haushalte / Unternehmen', () => dateOf(D.USA?.hhDebt), null, 'Fed Z.1, quartalsweise'],
  // USA Seite 3
  ['USA · Seite 3', 'EFFR', () => dateOf(D.USA?.effr), () => nyfedLast('unsecured/effr'), 'NY Fed'],
  ['USA · Seite 3', 'SOFR', () => dateOf(D.USA?.sofr), () => nyfedLast('secured/sofr'), 'NY Fed'],
  ['USA · Seite 3', 'IORB', () => dateOf(D.USA?.iorb), () => fredLast('IORB'), 'FRED IORB'],
  ['USA · Seite 3', 'US 2Y (Dual-Chart)', () => histLast('USA-us2y'), live, 'Treasury + TradingView'],
  // USA Seite 4
  ['USA · Seite 4', 'Zinsstruktur nominal', () => dateOf(D.USA?.ustCurve), live, 'Treasury + TradingView'],
  ['USA · Seite 4', 'Zinsstruktur TIPS 10Y', curveTips10, () => treasuryLast('daily_treasury_real_yield_curve'), 'U.S. Treasury Real Yield'],
  ['USA · Seite 4', 'SOFR-Futures', () => histLast(Object.keys(H).find((k) => k.startsWith('USA-sofrTenor-sr3_')) || ''), () => yahooLast('SR3=F'), 'Yahoo SR3=F'],
  ['USA · Seite 4', 'SOFR 30-Tage-Ø', () => histLast('USA-sofrTenor-sofr30'), () => nyfedLast('secured/sofrai'), 'NY Fed SOFRAI'],
  // USA Seite 5
  ['USA · Seite 5', 'FHLB Advances', () => dateOf(D.USA?.fhlbAdv), fhlbNext, 'FHLBanks Office of Finance'],
  ['USA · Seite 5', 'Fed Funds Volumen', () => dateOf(D.USA?.effrVol), () => nyfedLast('unsecured/effr'), 'NY Fed'],
  // USA Seite 6
  ['USA · Seite 6', 'US 1Y', () => histLast('USA-us1y'), live, 'Treasury + TradingView'],
  ['USA · Seite 6', 'MOVE Index', () => dateOf(D.USA?.move), () => yahooLast('^MOVE'), 'Yahoo ^MOVE'],
  // USA Seite 7
  ['USA · Seite 7', 'US 3M … 30Y', () => histLast('USA-us10y'), live, 'Treasury + TradingView'],
  ['USA · Seite 7', 'TIPS 5Y / 10Y', () => histLast('USA-dfii10'), () => treasuryLast('daily_treasury_real_yield_curve'), 'U.S. Treasury Real Yield'],
  // USA Repo-Markt
  ['USA · Repo-Markt', 'MMF Vermögen / Repo', () => histLast('USA-mmfTot'), () => ofrLast('MMF-MMF_TOT-M'), 'OFR'],
  ['USA · Repo-Markt', 'Repo TRI Volumen / Satz', () => histLast('USA-repoTriVol'), () => ofrLast('REPO-TRI_TV_OO-P'), 'OFR'],
  ['USA · Repo-Markt', 'Repo DVP Volumen / Satz', () => histLast('USA-repoDvpVol'), () => ofrLast('REPO-DVP_TV_OO-P'), 'OFR'],
  // USA Credit Vergabe
  ...[['sloosCiLarge', 'DRTSCILM'], ['sloosCiSmall', 'DRTSCIS'], ['sloosCards', 'DRTSCLCC'], ['sloosLinesLarge', 'SUBLPDCILTMNQ'], ['sloosLinesSmall', 'SUBLPDCISTMNQ'], ['sloosDemLarge', 'DRSDCILM'], ['sloosDemSmall', 'DRSDCIS']]
    .map(([k, id]) => ['USA · Credit Vergabe', (C[k]?.label || k), () => credit(k), () => fredLast(id), `FRED ${id}`]),
  ['USA · Credit Vergabe', 'Kreditanfragen', () => credit('sloosInquiries'), () => fredLast(C.sloosInquiries?.seriesId || 'SUBLPDCIAINQ'), `FRED ${C.sloosInquiries?.seriesId || 'SUBLPDCIAINQ'}`],
  ['USA · Credit Vergabe', 'Bankkredite (H.8)', () => credit('bankCreditYoy'), () => fredLast('TOTBKCR'), 'FRED TOTBKCR'],
  ['USA · Credit Vergabe', 'Unternehmenskredite (H.8)', () => credit('ciLoansYoy'), () => fredLast('TOTCI'), 'FRED TOTCI'],
  ['USA · Credit Vergabe', 'High-Yield-OAS', () => credit('hyOas'), () => fredLast('BAMLH0A0HYM2'), 'FRED BAMLH0A0HYM2'],
  ['USA · Credit Vergabe', 'Investment-Grade-OAS', () => credit('igOas'), () => fredLast('BAMLC0A0CM'), 'FRED BAMLC0A0CM'],
  ['USA · Credit Vergabe', 'Ausfallprämie Baa − Aaa', () => credit('baaAaa'), () => fredLast('DBAA'), 'FRED DBAA'],
  ['USA · Credit Vergabe', 'NFCI', () => credit('nfci'), () => fredLast('NFCI'), 'FRED NFCI'],
  ['USA · Credit Vergabe', 'SKSI', () => credit('sksi'), sksiLast, 'Repository sksi-credit-stress-index'],
  ['USA · Credit Vergabe', 'SKSI vs. neuester NFCI', () => credit('sksi'), () => fredLast('NFCI'), 'FRED NFCI (Rechenbasis des SKSI)'],
  // andere Länder
  ...[['DEU', 'DE'], ['FRA', 'FR'], ['JPN', 'JP'], ['CHN', 'CN'], ['AUS', 'AU']].flatMap(([c, t]) => [
    [c, 'Staatsanleihen 2 Jahre', () => dateOf(D[c]?.y2), live, `TradingView TVC:${t}02Y`, { tv: [`TVC:${t}02Y`, () => D[c]?.y2?.value] }],
    [c, 'Staatsanleihen 10 Jahre', () => dateOf(D[c]?.y10), live, `TradingView TVC:${t}10Y`, { tv: [`TVC:${t}10Y`, () => D[c]?.y10?.value] }],
    [c, 'Leitzins', () => dateOf(D[c]?.rate), null, 'BIS / EZB (Änderungen nur bei Notenbanksitzungen)'],
    [c, 'Inflation / Defizit / BIP', () => dateOf(D[c]?.inflation), null, 'IMF-Jahreswerte']
  ])
];

// ---------- Prüfen ------------------------------------------------------------------------
function cmp(pageDate, srcDate) {
  if (!pageDate) return 'alt';
  const p = String(pageDate);
  const s = String(srcDate);
  if (/^\d{4}-\d{2}$/.test(p)) return s.slice(0, 7) > p ? 'alt' : 'ok';
  if (/^\d{4}-\d{2}-\d{2}$/.test(p)) return s > p ? 'alt' : 'ok';
  return 'info';
}

const items = [];
for (const [page, label, pageFn, srcFn, source, opt] of CHECKS) {
  let pageDate = null;
  try { pageDate = pageFn(); } catch {}
  const item = { page, label, pageDate: pageDate || '—', srcDate: '—', source, status: 'info', note: '' };
  if (!srcFn) {
    items.push(item);
    continue;
  }
  try {
    const src = await srcFn();
    item.srcDate = src.date;
    item.status = cmp(pageDate, src.date);
    if (src.note) item.note = src.note;
    if (opt?.tv) {
      const q = await tvQuotes();
      const tvVal = q[opt.tv[0]];
      const pageVal = Number(opt.tv[1]());
      if (Number.isFinite(tvVal) && Number.isFinite(pageVal)) {
        item.note = `Seite ${pageVal.toFixed(3)} · TradingView ${tvVal.toFixed(3)}`;
        if (Math.abs(tvVal - pageVal) > 0.03) item.status = 'alt';
      }
    }
  } catch (e) {
    item.status = 'fehler';
    item.note = `Prüfung fehlgeschlagen: ${e.message}`;
  }
  items.push(item);
}

const summary = items.reduce((s, i) => ((s[i.status] = (s[i.status] || 0) + 1), s), {});
const report = { checkedAt: new Date().toISOString(), today, summary, items };
fs.writeFileSync('freshness.json', JSON.stringify(report, null, 1) + '\n');

const icon = { ok: '✅', alt: '⚠️', info: 'ℹ️', fehler: '❌' };
console.log(`Datenprüfung: ${JSON.stringify(summary)}`);
for (const i of items) console.log(`${icon[i.status]} ${i.page.padEnd(22)} ${i.label.padEnd(36)} Seite ${String(i.pageDate).padEnd(10)} Quelle ${String(i.srcDate).padEnd(10)} ${i.note}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const rows = items.map((i) => `| ${icon[i.status]} | ${i.page} | ${i.label} | ${i.pageDate} | ${i.srcDate} | ${i.source} | ${i.note} |`).join('\n');
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n### Datenprüfung: Seite vs. Quelle\n\n${Object.entries(summary).map(([k, v]) => `${icon[k]} ${k}: ${v}`).join(' · ')}\n\n| | Seite | Daten | Stand Seite | Stand Quelle | Quelle | Hinweis |\n|---|---|---|---|---|---|---|\n${rows}\n`);
}
