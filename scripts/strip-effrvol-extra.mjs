import fs from 'fs';

/** Remove extra EFFRVOL panels if present; never fail the build */
let html = fs.readFileSync('index.html', 'utf8');
const before = html.length;

// Soft cleanup patterns — ignore if markers missing
const patterns = [
  /<div[^>]*id="effrVolChgPanel"[\s\S]*?<\/div>\s*/g,
  /<div[^>]*id="effrVolEffrPanel"[\s\S]*?<\/div>\s*/g,
  /function paintEffrVolChg[\s\S]*?(?=\nfunction |\nconst |\n\/\/|$)/,
];

for (const re of patterns) {
  try {
    html = html.replace(re, '');
  } catch (e) {
    console.warn('pattern skip', e.message);
  }
}

fs.writeFileSync('index.html', html);
console.log('strip-effrvol done', before, '->', html.length);
