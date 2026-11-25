import fs from 'node:fs';
import { execSync } from 'node:child_process';

// 1) Prefer assembled full fixed file
if (fs.existsSync('scripts/ed-b64-0.txt') && fs.existsSync('scripts/assemble-eur-dollar.mjs')) {
  try {
    execSync('node scripts/assemble-eur-dollar.mjs', { stdio: 'inherit' });
    const t = fs.readFileSync('eur-dollar.js', 'utf8');
    if (t.includes("openChart('USA', 'usDeCurve'")) {
      console.log('restore-eur-dollar: assembled fixed file');
      process.exit(0);
    }
  } catch (e) {
    console.warn('assemble failed', e.message);
  }
}

const path = 'eur-dollar.js';
const GOOD = 'ae437b10c991cc366d75263621ff989632c6bc5e';
let t = '';
try {
  t = fs.readFileSync(path, 'utf8');
} catch (e) {}

if (t.length < 5000 || !t.includes('function renderCurveBlock')) {
  t = execSync('git show ' + GOOD + ':eur-dollar.js', {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });
  fs.writeFileSync(path, t);
}

for (const script of [
  'scripts/patch-eur-dollar-spread-ui.mjs',
  'scripts/patch-extra-time-window.mjs',
  'scripts/patch-fix-curve-open.mjs',
  'scripts/patch-curve-enlarge-click.mjs'
]) {
  if (fs.existsSync(script)) {
    try {
      execSync('node ' + script, { stdio: 'inherit' });
    } catch (e) {
      console.warn(script, e.message);
    }
  }
}
console.log('restore-eur-dollar final', fs.statSync(path).size);
