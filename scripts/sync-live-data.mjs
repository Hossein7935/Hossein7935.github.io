import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Starts the run from the newest state: the deployed site (GitHub Pages) is
 * updated on every run, the repository copy of data.json only every few hours.
 * Uses the live data.json if it is valid and newer than the repository copy.
 * Also stores the live version.json so finalize-data.mjs can tell whether the
 * data really changed. Never fails the workflow.
 */

const TMP = process.env.RUNNER_TEMP || os.tmpdir();
const LIVE_VERSION_FILE = path.join(TMP, 'mw-live-version.json');

function siteBase() {
  const fromEnv = process.env.PAGES_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/*$/, '/');
  const [owner, repo] = String(process.env.GITHUB_REPOSITORY || '').split('/');
  if (!owner) return null;
  const host = `${owner.toLowerCase()}.github.io`;
  return repo && repo.toLowerCase() === host ? `https://${host}/` : `https://${host}/${repo}/`;
}

async function getJson(url) {
  const r = await fetch(`${url}?sync=${Date.now()}`, {
    headers: { 'User-Agent': 'MacroWatch-sync/1.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(60000),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

const ts = (v) => {
  const t = Date.parse(v || '');
  return Number.isFinite(t) ? t : 0;
};

try { fs.rmSync(LIVE_VERSION_FILE, { force: true }); } catch {}

const base = siteBase();
if (!base) {
  console.log('Keine Pages-URL bekannt – nutze data.json aus dem Repository');
  process.exit(0);
}

let local = null;
try { local = JSON.parse(fs.readFileSync('data.json', 'utf8')); } catch {}

try {
  const v = await getJson(`${base}version.json`);
  if (v && v.version) {
    fs.writeFileSync(LIVE_VERSION_FILE, JSON.stringify(v));
    console.log('Live version.json:', v.version, v.updatedAt);
  }
} catch (e) {
  console.log('Live version.json nicht verfügbar:', e.message);
}

try {
  const live = await getJson(`${base}data.json`);
  const valid = live && typeof live.data === 'object' && typeof live.histories === 'object';
  if (!valid) throw new Error('ungültige Struktur');
  const nLive = Object.keys(live.histories).length;
  const nLocal = local?.histories ? Object.keys(local.histories).length : 0;
  if (nLive < nLocal * 0.8) throw new Error(`zu wenige Historien (${nLive} statt ${nLocal})`);
  if (ts(live.updatedAt) > ts(local?.updatedAt)) {
    fs.writeFileSync('data.json', JSON.stringify(live) + '\n');
    console.log(`Live-Stand übernommen: ${live.updatedAt} (Repository: ${local?.updatedAt || '–'})`);
  } else {
    console.log(`Repository-Stand ist aktuell: ${local?.updatedAt} (live: ${live.updatedAt})`);
  }
} catch (e) {
  console.log('Live data.json nicht übernommen:', e.message);
}
