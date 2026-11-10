import fs from 'fs';

/** Remove listed charts from USA page 2 faceB only (bounded by faceA.after) */
let html = fs.readFileSync('index.html', 'utf8');

const start = html.indexOf('faceB.innerHTML=');
if (start < 0) {
  console.error('faceB.innerHTML not found');
  process.exit(0);
}
const endMarker = 'faceA.after(faceB)';
const end = html.indexOf(endMarker, start);
if (end < 0) {
  console.error('faceA.after(faceB) not found');
  process.exit(0);
}

let block = html.slice(start, end);
console.log('faceB block length', block.length);

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
const targetNorm = new Set(targets.map(norm));

// Remove metric divs by walking from each <div class="metric
const metricRe = /<div class="metric[^>]*>/g;
const matches = [...block.matchAll(metricRe)];
const toRemove = [];

for (let mi = 0; mi < matches.length; mi++) {
  const mStart = matches[mi].index;
  const mEnd = mi + 1 < matches.length ? matches[mi + 1].index : block.length;
  const chunk = block.slice(mStart, mEnd);
  const nm = (chunk.match(/class="name">([^<]*)/) || [])[1] || '';
  if (targetNorm.has(norm(nm)) || targets.some((t) => norm(nm).includes(norm(t)))) {
    console.log('drop:', nm);
    toRemove.push([mStart, mEnd]);
  }
}

// Apply removals from end to start
for (let k = toRemove.length - 1; k >= 0; k--) {
  const [a, b] = toRemove[k];
  block = block.slice(0, a) + block.slice(b);
}

html = html.slice(0, start) + block + html.slice(end);
fs.writeFileSync('index.html', html);

// Report remaining names in faceB block
const s2 = html.indexOf('faceB.innerHTML=');
const e2 = html.indexOf('faceA.after(faceB)', s2);
const b2 = html.slice(s2, e2);
const names = [...b2.matchAll(/class="name">([^<]*)/g)].map((x) => x[1]);
console.log('remaining page2:', names);
