import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

/**
 * Runs all data fetchers one after another, isolated from each other:
 *  - every script gets its own time limit (a hanging source cannot block the run)
 *  - data.json is backed up before each script and restored if the script
 *    crashes, times out or leaves invalid JSON behind
 *  - histories that a script accidentally empties are restored from the backup
 *  - one failing source never stops the other updates
 *
 * Exit code is 0 as long as data.json is valid at the end.
 */

const STEPS = [
  ['scripts/update-data.mjs', 'Offizielle Wirtschaftsdaten (OECD/IMF/BIS)', 150],
  ['scripts/fetch-inflation.mjs', 'Inflation'],
  ['scripts/fetch-y2.mjs', '2J-Renditen (TradingView)'],
  ['scripts/fetch-y10.mjs', '10J-Renditen (TradingView)'],
  ['scripts/fetch-country-t10y2y.mjs', '10Y−2Y Länder'],
  ['scripts/fetch-tips.mjs', 'US TIPS'],
  ['scripts/fetch-sofr-term.mjs', 'Term SOFR 3M + T10Y2Y'],
  ['scripts/fetch-sofr-muni-spread.mjs', 'SOFR − US 3M'],
  ['scripts/fetch-bofa-ccc.mjs', 'BofA CCC'],
  ['scripts/fetch-us10y-tips-spread.mjs', 'US10Y − TIPS10Y'],
  ['scripts/fetch-us5y-tips-spread.mjs', 'US5Y − TIPS5Y'],
  ['scripts/fetch-us10y5y.mjs', 'US10Y − US5Y'],
  ['scripts/fetch-sofr-iorb.mjs', 'SOFR − IORB'],
  ['scripts/fetch-wresbal.mjs', 'WRESBAL'],
  ['scripts/fetch-effr-sofr-iorb.mjs', 'EFFR + SOFR + IORB'],
  ['scripts/fetch-sofr-futures.mjs', 'SOFR Forward-Kurve', 150],
  ['scripts/fetch-ust-curve.mjs', 'UST + TIPS Kurve'],
  ['scripts/fetch-fhlb-advances.mjs', 'FHLBank Advances'],
  ['scripts/fetch-effr-volume.mjs', 'Fed Funds Volumen'],
  ['scripts/fetch-iorb-us1y.mjs', 'IORB + US 1Y'],
  ['scripts/fetch-move.mjs', 'MOVE Index'],
  ['scripts/fetch-dxy.mjs', 'DXY'],
  ['scripts/fetch-us2y-sofr.mjs', 'US 2Y + SOFR'],
  ['scripts/fetch-ust-tips-page7.mjs', 'UST + TIPS Seite 7', 180],
  ['scripts/fetch-repo-mmf.mjs', 'Repo + MMF'],
  ['scripts/fetch-nonfin-debt.mjs', 'HH + Business Debt'],
  ['scripts/fetch-cu-au.mjs', 'Kupfer/Gold'],
  ['scripts/fetch-rate-charts.mjs', 'Leitzins-Charts'],
  ['scripts/fetch-inflation-charts.mjs', 'Inflations-Charts'],
  ['scripts/fetch-gdp-charts.mjs', 'BIP-Charts'],
  ['scripts/fetch-reserves-gdp.mjs', 'Reserven/BIP'],
  ['scripts/fetch-deficit.mjs', 'Defizit (IMF)'],
  // must run last: fills FRED-lagged series from Treasury/TradingView/NY Fed
  ['scripts/freshen-derived.mjs', 'Neuere Tage aus Treasury/TV/NY Fed', 60]
];

const DEFAULT_TIMEOUT_S = 120;
// keys that scripts delete on purpose (legacy fields)
const INTENTIONALLY_REMOVED = new Set(['nonfinDebt']);
const FILE = 'data.json';
const gha = !!process.env.GITHUB_ACTIONS;

function readValid() {
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    const j = JSON.parse(raw);
    if (!j || typeof j !== 'object' || typeof j.data !== 'object' || typeof j.histories !== 'object') return null;
    return { raw, json: j };
  } catch {
    return null;
  }
}

function group(name) { if (gha) console.log(`::group::${name}`); else console.log(`\n=== ${name}`); }
function endGroup() { if (gha) console.log('::endgroup::'); }
function warn(msg) { console.log(gha ? `::warning::${msg}` : `WARN ${msg}`); }

const start = readValid();
if (!start) {
  console.error('data.json fehlt oder ist ungültig – Abbruch');
  process.exit(1);
}

const summary = [];
for (const [script, label, timeoutS = DEFAULT_TIMEOUT_S] of STEPS) {
  if (!fs.existsSync(script)) {
    summary.push([label, 'fehlt', 0]);
    continue;
  }
  const before = readValid();
  const t0 = Date.now();
  group(`${label} (${script})`);
  const res = spawnSync(process.execPath, [script], {
    stdio: 'inherit',
    timeout: timeoutS * 1000,
    killSignal: 'SIGKILL',
    env: process.env
  });
  const secs = Math.round((Date.now() - t0) / 100) / 10;
  endGroup();

  let status = 'ok';
  if (res.error && res.error.code === 'ETIMEDOUT') status = `Timeout nach ${timeoutS}s`;
  else if (res.signal) status = `abgebrochen (${res.signal})`;
  else if (res.status !== 0) status = `Exit ${res.status}`;

  const after = readValid();
  if (!after) {
    status = status === 'ok' ? 'ungültiges data.json' : status;
  }

  if (status !== 'ok') {
    // restore the state from before this script
    fs.writeFileSync(FILE, before.raw);
    warn(`${label}: ${status} – vorheriger Stand wiederhergestellt`);
    summary.push([label, status, secs]);
    continue;
  }

  // never let a script wipe an existing history
  const restored = [];
  const oldH = before.json.histories || {};
  const newH = after.json.histories || {};
  for (const [key, oldVal] of Object.entries(oldH)) {
    if (!Array.isArray(oldVal) || oldVal.length < 20) continue;
    const nv = newH[key];
    if (!Array.isArray(nv) || nv.length < 3) {
      newH[key] = oldVal;
      restored.push(`${key} (${oldVal.length}→${Array.isArray(nv) ? nv.length : 0})`);
    }
  }
  // same for the card values (data.<Land>.<Kennzahl>)
  const oldD = before.json.data || {};
  const newD = after.json.data || (after.json.data = {});
  for (const [country, fields] of Object.entries(oldD)) {
    if (!fields || typeof fields !== 'object') continue;
    for (const [key, val] of Object.entries(fields)) {
      if (INTENTIONALLY_REMOVED.has(key) || !val || typeof val !== 'object') continue;
      if (newD[country] && newD[country][key] == null) {
        newD[country][key] = val;
        restored.push(`${country}.${key}`);
      } else if (!newD[country]) {
        newD[country] = { ...fields };
        restored.push(`${country}.*`);
        break;
      }
    }
  }
  if (restored.length) {
    after.json.histories = newH;
    after.json.data = newD;
    fs.writeFileSync(FILE, JSON.stringify(after.json));
    warn(`${label}: geleerte Daten wiederhergestellt: ${restored.join(', ')}`);
  }
  summary.push([label, restored.length ? `ok (${restored.length} Werte geschützt)` : 'ok', secs]);
}

console.log('\nZusammenfassung:');
for (const [label, status, secs] of summary) {
  console.log(`${status === 'ok' ? '✔' : status.startsWith('ok') ? '◐' : '✖'} ${label.padEnd(40)} ${String(secs).padStart(6)}s  ${status}`);
}

if (gha && process.env.GITHUB_STEP_SUMMARY) {
  const rows = summary.map(([l, s, t]) => `| ${l} | ${s} | ${t}s |`).join('\n');
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Datenquellen\n\n| Quelle | Status | Dauer |\n|---|---|---|\n${rows}\n`);
}

if (!readValid()) {
  console.error('data.json ist am Ende ungültig');
  process.exit(1);
}
