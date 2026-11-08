import fs from 'fs';

/** Remove duplicated us2ySofrDual dialog branch that breaks entire page JS */
let html = fs.readFileSync('index.html', 'utf8');

// Pattern: after a complete us2ySofrDual block (ending return; }), a second orphan
// body.innerHTML=renderUs2ySofrChart... return; } appears.
const marker = "if(key==='us2ySofrDual'&&typeof renderUs2ySofrChart==='function')";
const first = html.indexOf(marker);
if (first < 0) {
  console.log('no us2ySofrDual branch');
} else {
  const second = html.indexOf(marker, first + 1);
  // Also handle orphan without second if: after first return;} leftover lines
  const afterFirst = html.indexOf('return;', first);
  // find closing of first block
  let p = afterFirst;
  // walk to the } after return;
  const close1 = html.indexOf('}', afterFirst);
  const next = html.slice(close1 + 1, close1 + 80).trimStart();
  if (next.startsWith('body.innerHTML=renderUs2ySofrChart') || next.startsWith('body.innerHTML=renderUs2ySofrChart')) {
    // remove from after close1 until next if(key=
    const nextIf = html.indexOf("if(key==='iorbUs1yDual'", close1);
    const nextIf2 = html.indexOf("if(key==='ustCurve'", close1);
    const cutEnd = [nextIf, nextIf2].filter(x => x > close1).sort((a, b) => a - b)[0];
    if (cutEnd > close1) {
      html = html.slice(0, close1 + 1) + '\n  ' + html.slice(cutEnd);
      console.log('removed orphan us2ySofrDual tail');
    }
  }
  if (second > 0) {
    console.log('second full branch at', second);
  }
}

// Broader cleanup: collapse double consecutive us2y blocks
const dup =
  /if\(key==='us2ySofrDual'&&typeof renderUs2ySofrChart==='function'\)\{[\s\S]*?return;\s*\}\s*body\.innerHTML=renderUs2ySofrChart[\s\S]*?return;\s*\}/;
if (dup.test(html)) {
  html = html.replace(
    dup,
    (m) => {
      // keep only first complete if-block
      const endFirst = m.indexOf('return;');
      const brace = m.indexOf('}', endFirst);
      return m.slice(0, brace + 1);
    }
  );
  console.log('regex orphan stripped');
}

fs.writeFileSync('index.html', html);

// Validate JS extracted from script tags
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const js = scripts.join('\n');
fs.writeFileSync('/tmp/site-check.js', js);
console.log('wrote /tmp/site-check.js', js.length);

// brace balance
let depth = 0, min = 0;
for (const ch of js) {
  if (ch === '{') depth++;
  else if (ch === '}') {
    depth--;
    if (depth < min) min = depth;
  }
}
console.log('brace depth', depth, 'min', min);
console.log('orphan renderUs2y after return count', (html.match(/return;\s*\}\s*body\.innerHTML=renderUs2ySofrChart/g) || []).length);
console.log('done', html.length);
