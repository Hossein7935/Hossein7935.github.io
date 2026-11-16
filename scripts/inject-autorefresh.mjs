import fs from 'node:fs';
import crypto from 'node:crypto';

/**
 * Binds the extra browser scripts into index.html (idempotent):
 *   credit.js       – USA-Seite „Credit Vergabe“ (wraps setUsaPage etc., must come after the inline script)
 *   autorefresh.js  – automatic data refresh
 * The ?v= hash changes with the file content, so browsers always load the current version.
 */
const FILES = ['credit.js', 'autorefresh.js'];
const html0 = fs.readFileSync('index.html', 'utf8');
let html = html0;
const tags = [];
for (const f of FILES) {
  const esc = f.replace(/\./g, '\\.');
  html = html.replace(new RegExp(`<script src="${esc}[^"]*"></script>\\n?`, 'g'), '');
  if (!fs.existsSync(f)) continue;
  const v = crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0, 10);
  tags.push(`<script src="${f}?v=${v}"></script>`);
}
const idx = html.lastIndexOf('</body>');
if (idx < 0) throw new Error('</body> not found');
html = html.slice(0, idx) + tags.join('') + '\n' + html.slice(idx);

if (html !== html0) fs.writeFileSync('index.html', html);
console.log('scripts', html !== html0 ? 'eingebunden' : 'unverändert', tags.join(' '));
