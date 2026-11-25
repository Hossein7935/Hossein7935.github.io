import fs from 'node:fs';
const parts = [0, 1, 2].map((i) => fs.readFileSync('scripts/ed-b64-' + i + '.txt', 'utf8'));
const buf = Buffer.from(parts.join(''), 'base64');
fs.writeFileSync('eur-dollar.js', buf);
const t = buf.toString('utf8');
if (t.length < 10000 || !t.includes("openChart('USA', 'usDeCurve'")) {
  throw new Error('assembled file invalid len=' + t.length);
}
console.log('assembled eur-dollar.js', t.length, 'openChart=ok');
