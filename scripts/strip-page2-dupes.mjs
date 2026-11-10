import fs from 'fs';

/** Remove charts from USA page 2 that the user listed as multi-present */
let html = fs.readFileSync('index.html', 'utf8');

const m = html.match(/faceB\.innerHTML=`([\s\S]*?)`;/);
if (!m) {
  console.error('faceB.innerHTML not found');
  process.exit(0);
}

let content = m[1];

// Remove whole metric blocks whose name or history key matches
const removeIf = [
  /CME Term SOFR 3M/i,
  /SOFR\s*[−\-]\s*IORB/i,
  /Zinskurve\s*·\s*10Y\s*[−\-]\s*2Y/i,
  /Zinskurve\s*·\s*10Y\s*[−\-]\s*5Y/i,
  /US10Y\s*[−\-]\s*TIPS\s*10Y/i,
  /US5Y\s*[−\-]\s*TIPS\s*5Y/i,
  /SOFR\s*[−\-]\s*US\s*3M/i,
  /historyHTML\('USA','sofr3m'\)/,
  /historyHTML\('USA','sofrIorb'\)/,
  /historyHTML\('USA','t10y2y'\)/,
  /historyHTML\('USA','t10y5y'\)/,
  /historyHTML\('USA','us10yTips'\)/,
  /historyHTML\('USA','us5yTips'\)/,
  /historyHTML\('USA','sofrUs3mSpread'\)/,
  /historyHTML\('USA','t10yie'\)/,
  /historyHTML\('USA','t5yie'\)/
];

// Split into metric divs
const parts = content.split(/(?=<div class="metric)/);
const kept = [];
for (const p of parts) {
  if (!p.trim()) continue;
  if (!p.includes('class="metric')) {
    kept.push(p);
    continue;
  }
  const drop = removeIf.some((re) => re.test(p));
  if (drop) {
    console.log('drop', (p.match(/class="name">([^<]+)/) || [])[1] || p.slice(0, 60));
    continue;
  }
  kept.push(p);
}

const newContent = kept.join('');
html = html.replace(m[0], 'faceB.innerHTML=`' + newContent + '`;');

fs.writeFileSync('index.html', html);

// verify
const m2 = html.match(/faceB\.innerHTML=`([\s\S]*?)`;/);
const names = [...(m2[1].matchAll(/class="name">([^<]+)/g))].map((x) => x[1]);
console.log('remaining page2 charts:', names);
