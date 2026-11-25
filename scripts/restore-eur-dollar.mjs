import { execSync } from 'node:child_process';
import fs from 'node:fs';

// Prefer full assembly from base64 parts (includes hover)
try {
  execSync('node scripts/assemble-eur-dollar.mjs', { stdio: 'inherit' });
  const t = fs.readFileSync('eur-dollar.js', 'utf8');
  if (t.length > 20000 && t.includes('bindExtraChartHover')) {
    console.log('restore-eur-dollar: assembled OK');
    process.exit(0);
  }
} catch (e) {
  console.warn('assemble failed', e.message);
}

// Fallback: git show last good
const GOOD = 'ae437b10c991cc366d75263621ff989632c6bc5e';
try {
  const t = execSync('git show ' + GOOD + ':eur-dollar.js', {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });
  fs.writeFileSync('eur-dollar.js', t);
  console.log('restore-eur-dollar: git show fallback', t.length);
} catch (e) {
  console.error('restore failed', e.message);
  process.exit(1);
}
