import fs from 'fs';

/** Remove listed duplicate charts from USA page 2 (faceB.innerHTML only) */
let html = fs.readFileSync('index.html', 'utf8');

const startToken = 'faceB.innerHTML=`';
const start = html.indexOf(startToken);
if (start < 0) {
  console.error('faceB.innerHTML not found');
  process.exit(0);
}

// Find the matching closing `; after the opening backtick of the template literal
// Scan: inside template, skip ${...} expressions which may contain backticks rarely
let i = start + startToken.length;
let depth = 0; // ${ } depth
let end = -1;
while (i < html.length) {
  const ch = html[i];
  if (depth === 0 && ch === '`') {
    // end of template literal
    if (html[i + 1] === ';') {
      end = i;
      break;
    }
  }
  if (ch === '$' && html[i + 1] === '{') {
    depth++;
    i += 2;
    continue;
  }
  if (depth > 0 && ch === '{') depth++;
  if (depth > 0 && ch === '}') depth--;
  i++;
}

if (end < 0) {
  console.error('could not find end of faceB.innerHTML template');
  process.exit(0);
}

const before = html.slice(0, start + startToken.length);
const content = html.slice(start + startToken.length, end);
const after = html.slice(end);

const removeNames = [
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

// Split by metric div starts
const chunks = content.split(/(?=<div class="metric)/);
const kept = [];
for (const chunk of chunks) {
  if (!chunk.includes('class="metric')) {
    kept.push(chunk);
    continue;
  }
  const nm = (chunk.match(/class="name">([^<]*)/) || [])[1] || '';
  const drop = removeNames.some((n) => nm.includes(n.replace(/[−-]/g, '')) || nm === n
    || removeNames.some((n) => nm.replace(/[−-]/g, '-') === n.replace(/[−-]/g, '-')));
  // simpler: normalize dashes
  const norm = (s) => s.replace(/[−–—-]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
  const drop2 = removeNames.some((n) => norm(nm) === norm(n) || norm(nm).includes(norm(n)));
  if (drop2) {
    console.log('drop:', nm);
    continue;
  }
  kept.push(chunk);
}

const newContent = kept.join('');
html = before + newContent + after;
fs.writeFileSync('index.html', html);

// report remaining names in faceB only
const s2 = html.indexOf(startToken) + startToken.length;
let j = s2, d = 0, e2 = -1;
while (j < html.length) {
  if (d === 0 && html[j] === '`' && html[j + 1] === ';') { e2 = j; break; }
  if (html[j] === '$' && html[j + 1] === '{') { d++; j += 2; continue; }
  if (d > 0 && html[j] === '{') d++;
  if (d > 0 && html[j] === '}') d--;
  j++;
}
const c2 = html.slice(s2, e2);
const names = [...c2.matchAll(/class="name">([^<]*)/g)].map((x) => x[1]);
console.log('remaining page2:', names);
