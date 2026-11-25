import fs from 'node:fs';
import { execSync } from 'node:child_process';

const path = 'eur-dollar.js';
const GOOD = 'ae437b10c991cc366d75263621ff989632c6bc5e';

function read() {
  try {
    return fs.readFileSync(path, 'utf8');
  } catch (e) {
    return '';
  }
}

let t = read();

if (t.length < 5000 || !t.includes('function renderCurveBlock') || !t.includes('extraChartsHtml')) {
  console.log('eur-dollar.js broken (len=' + t.length + ') — restore from', GOOD);
  t = execSync('git show ' + GOOD + ':eur-dollar.js', {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });
  fs.writeFileSync(path, t);
  console.log('restored bytes', t.length);
}

// Apply follow-up patches if present
for (const script of [
  'scripts/patch-eur-dollar-spread-ui.mjs',
  'scripts/patch-extra-hover-fix.mjs',
  'scripts/patch-extra-time-window.mjs'
]) {
  if (fs.existsSync(script)) {
    try {
      execSync('node ' + script, { stdio: 'inherit' });
    } catch (e) {
      console.warn('patch failed', script, e.message);
    }
  }
}

t = read();
console.log('restore-eur-dollar final', t.length, 'window=', t.includes('windowPts'), 'hover=', t.includes('bindExtraChartHover'));
