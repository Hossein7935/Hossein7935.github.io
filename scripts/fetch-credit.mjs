import fs from 'node:fs';

/**
 * USA Seite „Credit Vergabe“
 *
 * Credit Supply  – SLOOS Kreditstandards (FRED), Bankkredite H.8 (FRED), Kreditlinien (SLOOS)
 * Credit Demand  – SLOOS Kreditnachfrage + Kreditanfragen (FRED)
 * Credit Stress  – SKSI aus dem eigenen Repository Hossein7935/sksi-credit-stress-index
 *                  + seine vier Bausteine (HY-OAS, IG-OAS, Baa−Aaa, NFCI) von FRED
 *
 * Jede Reihe einzeln abgesichert: fällt eine aus, bleibt ihr letzter Stand erhalten.
 */

const UA = { 'User-Agent': 'MacroWatch/1.8 (+https://hossein7935.github.io/)' };
const SKSI_RAW = 'https://raw.githubusercontent.com/Hossein7935/sksi-credit-stress-index/main';

async function getText(url, accept = 'text/csv', timeoutMs = 45000) {
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { ...UA, Accept: accept }, signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      last = e;
      if (/HTTP 4\d\d/.test(e.message)) break; // unknown series → no retry
      await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
    }
  }
  throw last;
}

async function fred(id, start = '1990-01-01') {
  const text = await getText(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${start}`);
  if (text.trim().startsWith('<')) throw new Error(`${id}: keine CSV`);
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

const round = (v, n = 3) => Math.round(v * 10 ** n) / 10 ** n;

/** Tagesreihen: letzte 3 Jahre vollständig, davor ein Wert pro Woche (hält data.json klein). */
function thinDaily(points) {
  const cut = new Date();
  cut.setUTCFullYear(cut.getUTCFullYear() - 3);
  const c = cut.toISOString().slice(0, 10);
  const out = [];
  let lastWeek = null;
  for (const p of points) {
    if (p.period >= c) { out.push(p); continue; }
    const t = Date.parse(`${p.period}T00:00:00Z`);
    const week = Math.floor((t / 86400000 + 3) / 7); // Wochen ab Donnerstag 1970 → Mo–So
    if (week === lastWeek) out[out.length - 1] = p; else out.push(p);
    lastWeek = week;
  }
  return out;
}

function yoy(points, lagDays = 364, tolDays = 4) {
  const byTime = points.map((p) => ({ t: Date.parse(`${p.period}T00:00:00Z`), ...p }));
  const out = [];
  let j = 0;
  for (const p of byTime) {
    const target = p.t - lagDays * 86400000;
    while (j < byTime.length - 1 && byTime[j + 1].t <= target + tolDays * 86400000) j++;
    const base = byTime[j];
    if (base && Math.abs(base.t - target) <= tolDays * 86400000 && base.value) {
      out.push({ period: p.period, value: round((p.value / base.value - 1) * 100, 2) });
    }
  }
  return out;
}

// --- SLOOS „Kreditanfragen“: ID per Kandidaten + FRED-Suche ermitteln ---------------
async function findInquiriesSeries(knownId, knownTitle) {
  if (knownId) {
    try {
      const pts = await fred(knownId);
      if (pts.length > 8) return { id: knownId, pts, how: 'gespeichert', title: knownTitle || '' };
    } catch {}
  }
  const candidates = ['SUBLPDCIINQNQ', 'SUBLPDCIINNQ', 'SUBLPDCIIQNQ', 'SUBLPDCINQNQ', 'SUBLPDCIINQLGNQ', 'SUBLPDCIIQLGNQ'];
  for (const id of candidates) {
    try {
      const pts = await fred(id);
      if (pts.length > 8) return { id, pts, how: 'Kandidat', title: '' };
    } catch {}
  }
  for (const q of ['Increased Number of Inquiries for Commercial and Industrial', 'inquiries credit lines domestic banks']) {
    try {
      const html = await getText(`https://fred.stlouisfed.org/searchresults/?st=${encodeURIComponent(q)}`, 'text/html');
      const ids = new Map();
      const re = /\/series\/([A-Z0-9]{6,20})["'?#][^>]*>([^<]*)</g;
      let m;
      while ((m = re.exec(html))) {
        if (/inquir/i.test(m[2]) && !/foreign/i.test(m[2])) ids.set(m[1], m[2].replace(/&amp;/g, '&').trim());
      }
      // falls der Titel nicht direkt im Link steht: alle SUBLP…-IDs mit „inquir“ in der Nähe
      if (!ids.size) {
        const re2 = /\/series\/(SUBLP[A-Z0-9]+)/g;
        while ((m = re2.exec(html))) {
          const near = html.slice(Math.max(0, m.index - 400), m.index + 400);
          if (/inquir/i.test(near) && !/foreign/i.test(near) && !ids.has(m[1])) ids.set(m[1], '');
        }
      }
      for (const [id, title] of ids) {
        try {
          const pts = await fred(id);
          if (pts.length > 8) return { id, pts, how: 'FRED-Suche', title };
        } catch {}
      }
    } catch {}
  }
  throw new Error('Reihe für Kreditanfragen nicht gefunden');
}

const SERIES = [
  // Credit Supply
  { key: 'sloosCiLarge', id: 'DRTSCILM', group: 'supply', unit: 'pct', label: 'Kreditstandards C&I · große/mittlere Firmen', note: 'SLOOS · Netto-% der Banken, die Standards verschärfen' },
  { key: 'sloosCiSmall', id: 'DRTSCIS', group: 'supply', unit: 'pct', label: 'Kreditstandards C&I · kleine Firmen', note: 'SLOOS · Netto-% verschärfen' },
  { key: 'sloosCards', id: 'DRTSCLCC', group: 'supply', unit: 'pct', label: 'Kreditstandards Kreditkarten', note: 'SLOOS · Netto-% verschärfen' },
  { key: 'bankCreditYoy', id: 'TOTBKCR', group: 'supply', unit: 'pct', label: 'Bankkredite gesamt · Wachstum J/J', note: 'H.8 wöchentlich · alle Geschäftsbanken', transform: 'yoy', levelKey: 'bankCredit', start: '1999-01-01' },
  { key: 'ciLoansYoy', id: 'TOTCI', group: 'supply', unit: 'pct', label: 'Unternehmenskredite (C&I) · Wachstum J/J', note: 'H.8 wöchentlich · alle Geschäftsbanken', transform: 'yoy', levelKey: 'ciLoans', start: '1999-01-01' },
  { key: 'sloosLinesLarge', id: 'SUBLPDCILTMNQ', group: 'supply', unit: 'pct', label: 'Kreditlinien · max. Größe gekürzt (große Firmen)', note: 'SLOOS · Netto-% reduzieren Kreditlinien' },
  { key: 'sloosLinesSmall', id: 'SUBLPDCISTMNQ', group: 'supply', unit: 'pct', label: 'Kreditlinien · max. Größe gekürzt (kleine Firmen)', note: 'SLOOS · Netto-% reduzieren Kreditlinien' },
  // Credit Demand
  { key: 'sloosDemLarge', id: 'DRSDCILM', group: 'demand', unit: 'pct', label: 'Kreditnachfrage C&I · große/mittlere Firmen', note: 'SLOOS · Netto-% melden stärkere Nachfrage' },
  { key: 'sloosDemSmall', id: 'DRSDCIS', group: 'demand', unit: 'pct', label: 'Kreditnachfrage C&I · kleine Firmen', note: 'SLOOS · Netto-% melden stärkere Nachfrage' },
  { key: 'sloosInquiries', id: null, group: 'demand', unit: 'pct', label: 'Kreditanfragen · Unternehmenskredite (C&I)', note: 'SLOOS · Netto-% melden mehr Anfragen', discover: findInquiriesSeries },
  // Credit Stress – Bausteine des SKSI
  { key: 'hyOas', id: 'BAMLH0A0HYM2', group: 'stress', unit: 'pct', label: 'High-Yield-OAS', note: 'ICE BofA via FRED · Angst vor Ausfällen schwacher Firmen', comp: 'hy', start: '2015-01-01', daily: true },
  { key: 'igOas', id: 'BAMLC0A0CM', group: 'stress', unit: 'pct', label: 'Investment-Grade-OAS', note: 'ICE BofA via FRED · Stress greift auf solide Firmen über', comp: 'ig', start: '2015-01-01', daily: true },
  { key: 'baaAaa', id: null, group: 'stress', unit: 'pct', label: 'Ausfallprämie Baa − Aaa', note: "Moody's via FRED · Preis für Ausfallrisiko", comp: 'def', daily: true },
  { key: 'nfci', id: 'NFCI', group: 'stress', unit: 'index', label: 'NFCI · Finanzierungsbedingungen', note: 'Chicago Fed · >0 = enger als normal', comp: 'nfci', start: '2000-01-01' }
];

const payload = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const histories = payload.histories || (payload.histories = {});
const data = payload.data || (payload.data = {});
data.USA = data.USA || {};
const prev = data.USA.credit || {};
const credit = { updatedAt: new Date().toISOString(), items: { ...(prev.items || {}) }, sksi: prev.sksi || null, groups: { supply: 'Credit Supply · Kreditangebot', demand: 'Credit Demand · Kreditnachfrage', stress: 'Credit Stress · SKSI' } };
const errors = [];

let calibration = null;
try {
  calibration = JSON.parse(await getText(`${SKSI_RAW}/sksi/calibration.json`, 'application/json'));
} catch (e) {
  errors.push(`Credit SKSI calibration: ${e.message}`);
}
const stateFromZ = (z) => (z < -0.5 ? 'niedrig' : z < 0.75 ? 'normal' : z < 1.5 ? 'erhöht' : 'stark');

for (const s of SERIES) {
  try {
    let pts;
    let id = s.id;
    if (s.key === 'baaAaa') {
      const [baa, aaa] = await Promise.all([fred('DBAA', '2005-01-01'), fred('DAAA', '2005-01-01')]);
      const m = new Map(aaa.map((p) => [p.period, p.value]));
      pts = baa.filter((p) => m.has(p.period)).map((p) => ({ period: p.period, value: round(p.value - m.get(p.period), 3) }));
      id = 'DBAA − DAAA';
    } else if (s.discover) {
      const known = (prev.items || {})[s.key] || {};
      const found = await s.discover(known.seriesId, known.seriesTitle);
      pts = found.pts;
      id = found.id;
      s.seriesId = found.id;
      s.seriesTitle = found.title || '';
      console.log(`${s.key}: ${found.id} (${found.how}) ${found.title || ''}`);
    } else {
      pts = await fred(s.id, s.start || '1990-01-01');
    }
    let level = null;
    if (s.transform === 'yoy') {
      level = pts.at(-1);
      pts = yoy(pts).filter((p) => p.period >= '2000-01-01');
    }
    if (s.daily) pts = thinDaily(pts);
    pts = pts.map((p) => ({ period: p.period, value: round(p.value, 3) }));
    if (pts.length < 4) throw new Error(`nur ${pts.length} Punkte`);
    histories[`USA-${s.key}`] = pts;
    const last = pts.at(-1);
    const item = {
      value: last.value,
      date: last.period,
      prev: pts.length > 1 ? pts.at(-2).value : null,
      label: s.label,
      note: s.note,
      unit: s.unit,
      group: s.group,
      source: s.discover ? `FRED ${id}` : `FRED ${id}`
    };
    if (s.seriesId) {
      item.seriesId = s.seriesId;
      item.seriesTitle = s.seriesTitle;
      if (s.seriesTitle) item.note = `SLOOS · ${s.seriesTitle}`;
    }
    if (level) {
      item.level = round(level.value / 1000, 3); // Mrd. → Bio. $
      item.levelDate = level.period;
      item.levelUnit = 'Bio. $';
    }
    if (s.comp && calibration?.components?.[s.comp]) {
      const c = calibration.components[s.comp];
      const z = (last.value - Number(c.median)) / Number(c.scale);
      item.z = round(z, 2);
      item.state = stateFromZ(z);
    }
    credit.items[s.key] = item;
    console.log(`${s.key.padEnd(16)} ${String(id).padEnd(16)} ${pts.length} Punkte · ${last.period} = ${last.value}`);
  } catch (e) {
    errors.push(`Credit ${s.label}: ${e.message}`);
    console.warn(`${s.key}: ${e.message}`);
  }
}

// --- SKSI-Index aus dem eigenen Repository ------------------------------------------
try {
  const csv = await getText(`${SKSI_RAW}/data/sksi_weekly.csv`);
  const rows = csv.trim().split(/\r?\n/).slice(1).map((l) => l.split(','));
  const pts = rows
    .filter((r) => r[0] && Number.isFinite(Number(r[1])))
    .map((r) => ({ period: r[0].slice(0, 10), value: Number(r[1]) }));
  if (pts.length < 50) throw new Error(`nur ${pts.length} Wochen`);
  histories['USA-sksi'] = pts;
  let latest = {};
  try { latest = JSON.parse(await getText(`${SKSI_RAW}/data/latest.json`, 'application/json')); } catch {}
  const last = pts.at(-1);
  credit.sksi = {
    value: last.value,
    date: last.period,
    regime: latest.regime || rows.at(-1)[2] || '',
    quorum: !!(latest.quorum ?? rows.at(-1)[3] === '1'),
    summary: latest.summary || '',
    components: latest.components || null,
    source: 'SKSI · github.com/Hossein7935/sksi-credit-stress-index'
  };
  credit.items.sksi = { value: last.value, date: last.period, prev: pts.at(-2)?.value ?? null, label: 'SKSI · Synchronisierter Kreditstress-Index', note: credit.sksi.summary || '0–100 · <48 ruhig · 48–68 erhöht · 68–84 Stress · ≥84 schwer', unit: 'score', group: 'stress', source: credit.sksi.source };
  console.log(`sksi             ${pts.length} Wochen · ${last.period} = ${last.value} (${credit.sksi.regime})`);
} catch (e) {
  errors.push(`Credit SKSI: ${e.message}`);
  console.warn('sksi:', e.message);
}

// index.html übernimmt nur Objekte mit „value“ aus data.json → Leitwert = SKSI-Score
const lead = credit.items.sksi || Object.values(credit.items)[0];
credit.value = lead ? lead.value : 0;
credit.date = lead ? lead.date : credit.updatedAt.slice(0, 10);
credit.source = 'Credit Vergabe · SLOOS, H.8, SKSI';
data.USA.credit = credit;
payload.errors = [...(payload.errors || []).filter((e) => !String(e).startsWith('Credit ')), ...errors];
fs.writeFileSync('data.json', JSON.stringify(payload));
console.log(`done credit · ${Object.keys(credit.items).length} Reihen · ${errors.length} Fehler`);
