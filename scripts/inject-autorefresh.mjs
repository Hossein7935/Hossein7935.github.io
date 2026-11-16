import fs from 'node:fs';
import crypto from 'node:crypto';

/**
 * Binds autorefresh.js into index.html (idempotent). The ?v= hash changes with
 * the file content, so browsers always load the current version.
 */
const html0 = fs.readFileSync('index.html', 'utf8');
const js = fs.readFileSync('autorefresh.js');
const v = crypto.createHash('sha1').update(js).digest('hex').slice(0, 10);
const tag = `<script src="autorefresh.js?v=${v}"></script>`;

let html = html0.replace(/<script src="autorefresh\.js[^"]*"><\/script>\n?/g, '');
const idx = html.lastIndexOf('</body>');
if (idx < 0) throw new Error('</body> not found');
html = html.slice(0, idx) + tag + '\n' + html.slice(idx);

if (html !== html0) fs.writeFileSync('index.html', html);
console.log('autorefresh', html !== html0 ? 'eingebunden' : 'unverändert', v);
