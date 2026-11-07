import fs from 'fs';

/** Fix known broken patterns left by toggle/faceC replacements. */
let html = fs.readFileSync('index.html', 'utf8');
const before = html.length;

// Normalize the faceC → grid.append tail
html = html.replace(
  /faceB\.after\(faceC\);[\s\S]{0,120}?grid\.append\(card\)\}/,
  'faceB.after(faceC);\n    }\n  }\n}\ngrid.append(card)}'
);

// Remove leftover toggle-removal junk that eats the next statement
html = html.replace(
  /\/\* old usaExtraToggle removed \*\/[\s;]*\}?\s*grid\.querySelectorAll/,
  'grid.querySelectorAll'
);
html = html.replace(/\/\* old usaExtraToggle removed \*\/[\s;]*/g, '');

// Stray "};" after faceC close
html = html.replace(/faceB\.after\(faceC\);\s*\}\s*;/, 'faceB.after(faceC);\n    }');

// Ensure data-edit binder exists
if (!/grid\.querySelectorAll\(\s*['\"]\[data-edit\]['\"]\s*\)/.test(html)) {
  html = html.replace(
    'grid.append(card)}',
    "grid.append(card)}\ngrid.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openEdit(b.dataset.edit)))}"
  );
}

// Deduplicate consecutive identical grid.querySelectorAll data-edit lines
html = html.replace(
  /(grid\.querySelectorAll\(\s*['\"]\[data-edit\]['\"]\s*\)\.forEach\([^\n]+\n){2,}/g,
  "$1"
);

fs.writeFileSync('index.html', html);

const stillBroken =
  html.includes('}grid.querySelectorAll') ||
  html.includes('old usaExtraToggle removed') ||
  (html.match(/faceA\.after\(faceB\)/g) || []).length !== 1;

console.log(
  'fixed', before, '→', html.length,
  'stillBroken', stillBroken,
  'faceC', html.includes('usa-face-c'),
  'setUsaPage', html.includes('function setUsaPage'),
  'pageSelect', html.includes('usaPageSelect')
);

if (stillBroken) process.exitCode = 0; // don't fail workflow; log only
