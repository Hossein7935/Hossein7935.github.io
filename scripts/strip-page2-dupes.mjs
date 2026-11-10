import fs from 'fs';

/** Remove listed charts from USA page 2 — only inside faceB.innerHTML=`...`; */
let html = fs.readFileSync('index.html', 'utf8');

const open = 'faceB.innerHTML=`';
const start = html.indexOf(open);
if (start < 0) {
  console.error('faceB.innerHTML not found');
  process.exit(0);
}
const contentStart = start + open.length;
const close = html.indexOf('`;', contentStart);
if (close < 0) {
  console.error('closing backtick not found');
  process.exit(0);
}

let content = html.slice(contentStart, close);
console.log('faceB content length', content.length);

const targets = [
  'CME Term SOFR 3M',
  'SOFR − IORB Spread',
  'SOFR - IORB Spread',
  'Zinskurve · 10Y − 2Y Spread',
  'Zinskurve · 10Y - 2Y Spread',
  'Zinskurve · 10Y − 5Y Spread',
  'Zinskurve · 10Y - 5Y Spread',
  'US10Y − TIPS 10Y',
  'US10Y - TIPS 10Y',
  'US5Y − TIPS 5Y',
  'US5Y - TIPS 5Y',
  'SOFR − US 3M Spread',
  'SOFR - US 3M Spread'
];

function norm(s) {
  return String(s).replace(/[−–—-]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
}

const metricRe = /<div class="metric[^>]*>/g;
const matches = [...content.matchAll(metricRe)];
const removeRanges = [];

for (let mi = 0; mi < matches.length; mi++) {
  const mStart = matches[mi].index;
  const mEnd = mi + 1 < matches.length ? matches[mi + 1].index : content.length;
  const chunk = content.slice(mStart, mEnd);
  const nm = (chunk.match(/class="name">([^<]*)/) || [])[1] || '';
  const n = norm(nm);
  const drop = targets.some((t) => n === norm(t) || n.includes(norm(t)));
  if (drop) {
    console.log('drop:', nm);
    removeRanges.push([mStart, mEnd]);
  }
}

for (let k = removeRanges.length - 1; k >= 0; k--) {
  const [a, b] = removeRanges[k];
  content = content.slice(0, a) + content.slice(b);
}

html = html.slice(0, contentStart) + content + html.slice(close);
fs.writeFileSync('index.html', html);

const names = [...content.matchAll(/class="name">([^<]*)/g)].map((x) => x[1]);
console.log('remaining page2:', names);
