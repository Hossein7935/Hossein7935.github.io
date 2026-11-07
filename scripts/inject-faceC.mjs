import fs from 'fs';

/** Safe pass: restore-index.mjs now owns USA page 3. Only fill gaps. */
let html = fs.readFileSync('index.html', 'utf8');
console.log('base', html.length);

if (!html.includes('usa-page-select')) {
  const css =
    '.usa-flip-toggle{flex-wrap:wrap;gap:8px 12px}' +
    '.usa-page-select{display:flex;gap:6px;flex-wrap:wrap;align-items:center}' +
    '.usa-page-select button{padding:6px 10px;border-radius:8px;border:1px solid var(--control-line);background:var(--control);color:var(--text);font:inherit;cursor:pointer}' +
    '.usa-page-select button.active{background:var(--accent);color:#09211e;border-color:var(--accent);font-weight:700}' +
    '.diff-pick{display:inline-flex;align-items:center;gap:6px;margin-top:6px;font-size:11px;color:var(--muted);cursor:pointer;user-select:none}' +
    '.diff-pick input{width:14px;height:14px;accent-color:var(--accent)}' +
    '.diff-panel{grid-column:1/-1;border:1px dashed var(--line);border-radius:10px;padding:10px;background:var(--metric)}' +
    '.diff-hint{font-size:11px;color:var(--muted);margin-top:4px}';
  html = html.replace('</style>', css + '</style>');
}

// Do not re-inject faceC if already present — prevents duplicate/broken JS
if (html.includes('usa-face-c') && html.includes('function setUsaPage') && html.includes('paintRateDiff')) {
  fs.writeFileSync('index.html', html);
  console.log('faceC already present — skip');
  process.exit(0);
}

console.warn('faceC missing after restore — structure may be incomplete');
fs.writeFileSync('index.html', html);
console.log(
  'faceC', html.includes('usa-face-c'),
  'pageSelect', html.includes('usaPageSelect'),
  'setUsaPage', html.includes('function setUsaPage')
);
