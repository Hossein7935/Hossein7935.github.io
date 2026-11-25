import fs from 'node:fs';
const parts = [
  fs.readFileSync('scripts/ed-b64-0.txt','utf8'),
  fs.readFileSync('scripts/ed-b64-1.txt','utf8'),
  fs.readFileSync('scripts/ed-b64-2.txt','utf8')
];
const buf = Buffer.from(parts.join(''), 'base64');
fs.writeFileSync('eur-dollar.js', buf);
const t = buf.toString('utf8');
console.log('assembled eur-dollar.js', t.length, t.includes('bindExtraChartHover'), t.includes('extraChartsHtml'));
