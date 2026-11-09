import fs from 'fs';

/** Remove duplicate declarations; do NOT strip valid dual-chart render code */
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

// Only remove TRUE orphan: body.innerHTML=renderUs2ySofrChart that appears
// AFTER a return/closing of the us2y branch, not the legitimate render call.
// Disabled aggressive orphan strip — it was deleting the enlarge render path.

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
