import fs from 'fs';

/** Remove orphan branches and duplicate declarations that break parse */
let html = fs.readFileSync('index.html', 'utf8');

// Collapse multiple let _rateDiffOrder=[]; to one
const rateDecl = 'let _rateDiffOrder=[];';
let first = html.indexOf(rateDecl);
if (first >= 0) {
  let pos = first + rateDecl.length;
  let removed = 0;
  while (true) {
    const n = html.indexOf(rateDecl, pos);
    if (n < 0) break;
    html = html.slice(0, n) + html.slice(n + rateDecl.length);
    removed++;
    pos = n;
  }
  if (removed) console.log('removed duplicate _rateDiffOrder', removed);
}

// Same for _yieldDiffOrder
const yDecl = 'let _yieldDiffOrder=[];';
first = html.indexOf(yDecl);
if (first >= 0) {
  let pos = first + yDecl.length;
  let removed = 0;
  while (true) {
    const n = html.indexOf(yDecl, pos);
    if (n < 0) break;
    html = html.slice(0, n) + html.slice(n + yDecl.length);
    removed++;
    pos = n;
  }
  if (removed) console.log('removed duplicate _yieldDiffOrder', removed);
}

// Existing orphan cleanup for us2ySofrDual if any
const orphan =
  /\n\s*body\.innerHTML=renderUs2ySofrChart[\s\S]*?return;\s*\n\s*\}/;
if (orphan.test(html)) {
  html = html.replace(orphan, '\n}');
  console.log('removed orphan us2y branch');
}

fs.writeFileSync('index.html', html);

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const js = scripts.join('\n');
try {
  new Function(js);
  console.log('js ok');
} catch (e) {
  console.warn('js still broken:', e.message);
}
console.log('done', html.length);
