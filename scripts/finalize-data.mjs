import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Last step after all fetchers:
 *  - computes a content hash of the data (ignoring pure time stamps)
 *  - keeps the old "Datenstand" if nothing really changed
 *  - writes version.json (tiny file the browser polls to detect new data)
 *  - writes data.json compactly
 *  - removes the blank lines the inject scripts keep adding to index.html
 *  - reports changed=true|false to the workflow
 */

const TMP = process.env.RUNNER_TEMP || os.tmpdir();
const LIVE_VERSION_FILE = path.join(TMP, 'mw-live-version.json');
const VOLATILE = new Set(['updatedAt', 'asOf', 'generatedAt']);

function stripVolatile(v) {
  if (Array.isArray(v)) return v.map(stripVolatile);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) if (!VOLATILE.has(k)) out[k] = stripVolatile(v[k]);
    return out;
  }
  return v;
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

const payload = readJson('data.json');
if (!payload || typeof payload.data !== 'object' || typeof payload.histories !== 'object') {
  console.error('data.json ungültig');
  process.exit(1);
}

const freshness = readJson('freshness.json');
const content = {
  data: payload.data,
  histories: payload.histories,
  forecasts: payload.forecasts || null,
  forecastYears: payload.forecastYears || null,
  // Ergebnis der Datenprüfung (ohne Zeitstempel) – damit eine geänderte Prüfung auch veröffentlicht wird
  freshness: freshness && Array.isArray(freshness.items) ? freshness.items.map((i) => [i.label, i.pageDate, i.srcDate, i.status]) : null
};
const hash = crypto.createHash('sha256').update(JSON.stringify(stripVolatile(content))).digest('hex').slice(0, 16);

const prev = readJson(LIVE_VERSION_FILE) || readJson('version.json');
const changed = !prev || prev.version !== hash;
const now = new Date().toISOString();

payload.updatedAt = !changed && prev.updatedAt ? prev.updatedAt : now;

const version = {
  version: hash,
  updatedAt: payload.updatedAt,
  generatedAt: now
};

fs.writeFileSync('data.json', JSON.stringify(payload) + '\n');
fs.writeFileSync('version.json', JSON.stringify(version, null, 2) + '\n');

// index.html: collapse runs of blank lines (pure whitespace, no behaviour change)
try {
  const html = fs.readFileSync('index.html', 'utf8');
  const clean = html.replace(/\n{3,}/g, '\n\n');
  if (clean !== html) fs.writeFileSync('index.html', clean);
} catch {}

console.log(`Datenstand ${changed ? 'NEU' : 'unverändert'}: ${hash} · updatedAt ${payload.updatedAt}${prev ? ` (vorher ${prev.version})` : ''}`);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
