import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * FHLBank Advances Outstanding — system-wide (all 11 FHLBanks)
 * Source: FHLBanks Office of Finance Combined Operating Highlights (PDF)
 * Metric: Advances line in Combined Financial Condition (USD millions)
 *
 * Seed history extracted from official OF PDFs (2016Q1–2026Q3).
 * Each run re-fetches recent quarters and merges if parse succeeds.
 */

// Official extractions (millions USD) — period = quarter-end date
const SEED = [
  ['2016-03-31', 618136], ['2016-06-30', 689792], ['2016-09-30', 688597], ['2016-12-31', 705225],
  ['2017-03-31', 660740], ['2017-06-30', 706849], ['2017-09-30', 719387], ['2017-12-31', 731544],
  ['2018-03-31', 697066], ['2018-06-30', 734457], ['2018-09-30', 706005],
  ['2019-12-31', 641519],
  ['2020-03-31', 806944], ['2020-06-30', 557547], ['2020-09-30', 479019], ['2020-12-31', 422639],
  ['2021-03-31', 399074], ['2021-06-30', 370352], ['2021-09-30', 350041], ['2021-12-31', 351278],
  ['2022-03-31', 374570], ['2022-06-30', 518883], ['2022-09-30', 655032], ['2022-12-31', 819121],
  ['2023-03-31', 1044614], ['2023-06-30', 882057], ['2023-09-30', 826945], ['2023-12-31', 809571],
  ['2024-03-31', 762908], ['2024-06-30', 780757], ['2024-09-30', 756465], ['2024-12-31', 736713],
  ['2025-03-31', 694000], ['2025-06-30', 742848], ['2025-09-30', 693475], ['2025-12-31', 676711],
  ['2026-03-31', 734267], ['2026-06-30', 810715], ['2026-09-30', 798428]
];

function quarterEnd(y, q) {
  return { 1: `${y}-03-31`, 2: `${y}-06-30`, 3: `${y}-09-30`, 4: `${y}-12-31` }[q];
}

function pdfUrl(y, q) {
  return `https://cdn.fhlb-of.com/files/${y}/${y}Q${q}FHLBCombinedOperatingHighlights.pdf`;
}

async function downloadPdf(url, dest) {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'MacroWatch/1.0 (+https://hossein7935.github.io/)', Accept: 'application/pdf' },
    signal: AbortSignal.timeout(60000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 2000) throw new Error('PDF too small');
  writeFileSync(dest, buf);
  return dest;
}

function parseAdvancesMillions(pdfPath) {
  let text;
  try {
    text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      timeout: 30000
    });
  } catch (e) {
    throw new Error(`pdftotext failed: ${e.message}`);
  }
  // Table row: Advances   798,428   676,711   ...
  const m = text.match(/Advances\s+([\d,]+)\s+([\d,]+)/);
  if (m) {
    const v = Number(m[1].replace(/,/g, ''));
    if (v > 50_000 && v < 3_000_000) return v;
  }
  const m2 = text.match(/Advances totaled\s*\$([0-9.]+)\s*billion/i);
  if (m2) {
    const v = Math.round(Number(m2[1]) * 1000);
    if (v > 50_000 && v < 3_000_000) return v;
  }
  throw new Error('Advances line not found');
}

async function fetchRecentQuarters(map) {
  const now = new Date();
  const years = [now.getUTCFullYear(), now.getUTCFullYear() - 1, now.getUTCFullYear() - 2];
  const dir = join(tmpdir(), 'macrowatch-fhlb');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const notes = [];
  for (const y of years) {
    for (let q = 1; q <= 4; q++) {
      if (y === now.getUTCFullYear() && q > Math.floor(now.getUTCMonth() / 3) + 1) continue;
      const period = quarterEnd(y, q);
      const url = pdfUrl(y, q);
      const dest = join(dir, `${y}Q${q}.pdf`);
      try {
        await downloadPdf(url, dest);
        const millions = parseAdvancesMillions(dest);
        map.set(period, millions);
        notes.push(`${y}Q${q}=${millions}`);
        console.log('OF PDF', y + 'Q' + q, millions, 'millions');
      } catch (e) {
        console.warn('skip', y + 'Q' + q, e.message);
      }
    }
  }
  return notes;
}

function toBillions(millions) {
  return Math.round((millions / 1000) * 1000) / 1000; // 3 decimals in $B
}

function pctChange(cur, prev) {
  if (prev == null || prev === 0 || cur == null) return null;
  return Math.round(((cur / prev) - 1) * 10000) / 100; // 2 dp percent
}

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || {};
const data = payload.data || {};
data.USA = data.USA || {};
const errors = Array.isArray(payload.errors)
  ? payload.errors.filter(e => !String(e).startsWith('USA FHLB'))
  : [];
const asOf = new Date().toISOString();

try {
  const map = new Map(SEED.map(([p, v]) => [p, v]));
  // merge any previously saved history (prefer existing if PDF temporarily fails)
  for (const p of histories['USA-fhlbAdv'] || []) {
    if (p?.period && Number.isFinite(Number(p.valueRaw))) {
      // value stored in billions; keep raw millions side channel if present
    }
  }
  for (const p of histories['USA-fhlbAdvRaw'] || []) {
    if (p?.period && Number.isFinite(Number(p.value))) map.set(String(p.period), Number(p.value));
  }

  let liveNotes = [];
  try {
    liveNotes = await fetchRecentQuarters(map);
  } catch (e) {
    console.warn('live fetch batch failed', e.message);
    errors.push(`USA FHLB live: ${e.message}`);
  }

  const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const seriesB = sorted.map(([period, millions]) => ({
    period,
    value: toBillions(millions),
    valueRaw: millions
  }));

  // QoQ % series
  const qoq = [];
  for (let i = 1; i < seriesB.length; i++) {
    const c = seriesB[i];
    const p = seriesB[i - 1];
    const ch = pctChange(c.valueRaw, p.valueRaw);
    if (ch != null) qoq.push({ period: c.period, value: ch });
  }

  // YoY % series (same quarter previous year ≈ 4 steps if complete)
  const byPeriod = new Map(seriesB.map(p => [p.period, p]));
  const yoy = [];
  for (const p of seriesB) {
    const [y, m, d] = p.period.split('-').map(Number);
    const prev = `${y - 1}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const prevPt = byPeriod.get(prev);
    if (!prevPt) continue;
    const ch = pctChange(p.valueRaw, prevPt.valueRaw);
    if (ch != null) yoy.push({ period: p.period, value: ch });
  }

  histories['USA-fhlbAdv'] = seriesB.map(({ period, value }) => ({ period, value }));
  histories['USA-fhlbAdvRaw'] = seriesB.map(({ period, valueRaw }) => ({ period, value: valueRaw }));
  histories['USA-fhlbAdvQoq'] = qoq;
  histories['USA-fhlbAdvYoy'] = yoy;

  const last = seriesB.at(-1);
  const prev = seriesB.length > 1 ? seriesB.at(-2) : null;
  const absChg = prev ? Math.round((last.value - prev.value) * 1000) / 1000 : null;
  const pctChg = prev ? pctChange(last.valueRaw, prev.valueRaw) : null;
  const yoyPt = yoy.find(p => p.period === last.period);

  // Auto narrative (neutral)
  let note = 'Quartalsdaten aus den Combined Operating Highlights der FHLBanks Office of Finance.';
  if (pctChg != null) {
    if (pctChg >= 5) note = `Advances steigen deutlich gegenüber dem Vorquartal (+${pctChg} %). Höhere Kreditnachfrage der Mitgliedsbanken — kein automatischer Hinweis auf Stress.`;
    else if (pctChg <= -5) note = `Advances fallen deutlich gegenüber dem Vorquartal (${pctChg} %). Rückgang der Inanspruchnahme durch Mitgliedsbanken.`;
    else if (pctChg >= 0) note = `Advances leicht höher als im Vorquartal (+${pctChg} %).`;
    else note = `Advances leicht niedriger als im Vorquartal (${pctChg} %).`;
  }
  if (yoyPt && Math.abs(yoyPt.value) >= 5) {
    note += ` YoY: ${yoyPt.value >= 0 ? '+' : ''}${yoyPt.value} %.`;
  }

  data.USA.fhlbAdv = {
    value: last.value,
    valueRaw: last.valueRaw,
    date: last.period,
    updatedAt: asOf,
    source: 'FHLBanks Office of Finance · Combined Operating Highlights',
    sourceUrl: 'https://www.fhlb-of.com/',
    absChangeQoq: absChg,
    pctChangeQoq: pctChg,
    pctChangeYoy: yoyPt ? yoyPt.value : null,
    unit: 'USD Milliarden',
    note,
    liveFetched: liveNotes,
    points: seriesB.length
  };

  console.log(
    'FHLB Advances:',
    last.period,
    last.value + 'B',
    'QoQ',
    pctChg,
    'n=',
    seriesB.length,
    'live',
    liveNotes.join(', ') || 'none'
  );
} catch (e) {
  errors.push(`USA FHLB: ${e.message}`);
  console.error('FHLB failed:', e.message);
}

payload.histories = histories;
payload.data = data;
payload.errors = errors;
payload.updatedAt = asOf;
fs.writeFileSync('data.json', JSON.stringify(payload));
console.log('done');
