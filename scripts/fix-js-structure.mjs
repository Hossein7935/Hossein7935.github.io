import fs from 'fs';

/** Fix known broken patterns left by toggle/faceC replacements. */
let html = fs.readFileSync('index.html', 'utf8');
const before = html.length;

// 1) orphan "}; /* usa pages */" after faceC block → keep closing only once
html = html.replace(
  /faceB\.after\(faceC\);\s*\}\s*;\s*\/\* usa pages via setUsaPage \*\/\s*\}\s*\}\s*grid\.append\(card\)\}/,
  'faceB.after(faceC);\n    }\n  }\n}\ngrid.append(card)}'
);

// 2) leftover toggle removal fragment that ate the next statement
html = html.replace(
  /\/\* old usaExtraToggle removed \*\/;\s*\}?\s*grid\.querySelectorAll/,
  'grid.querySelectorAll'
);

// 3) any remaining "/* old usaExtraToggle removed */" followed by stray braces
html = html.replace(/\/\* old usaExtraToggle removed \*\/;?\s*/g, '');

// 4) double semicolons / orphan "};" before grid.append
html = html.replace(/\}\s*;\s*\n\s*\/\* usa pages via setUsaPage \*\//g, '}\n    /* usa pages via setUsaPage */');
html = html.replace(/\/\* usa pages via setUsaPage \*\/\s*\}\s*\}\s*grid\.append\(card\)\}/g, '}\n}\ngrid.append(card)}');

// 5) ensure grid.querySelectorAll data-edit exists once after grid.append
if (!html.includes("grid.querySelectorAll('[data-edit]')") && !html.includes('grid.querySelectorAll("[data-edit]")')) {
  html = html.replace(
    'grid.append(card)}',
    "grid.append(card)}\ngrid.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openEdit(b.dataset.edit)))}"
  );
}

// 6) duplicate bindUsaPages calls → keep one near end is fine; remove empty ones
const binds = (html.match(/bindUsaPages\(\);/g) || []).length;
if (binds > 2) {
  let n = 0;
  html = html.replace(/bindUsaPages\(\);/g, () => (++n === binds ? 'bindUsaPages();' : '/* bindUsaPages once */'));
}

fs.writeFileSync('index.html', html);
console.log(
  'fixed', before, '→', html.length,
  'broken?', html.includes('}grid.querySelectorAll'),
  'faceC', html.includes('usa-face-c'),
  'setUsaPage', html.includes('function setUsaPage')
);
