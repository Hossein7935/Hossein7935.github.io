import fs from 'fs';

/** Fix broken paintChartDlg (orphan us2y branch + missing closing brace) */
let html = fs.readFileSync('index.html', 'utf8');

// 1) Remove orphan tail after a complete us2ySofrDual block
const marker = "if(key==='us2ySofrDual'&&typeof renderUs2ySofrChart==='function')";
const first = html.indexOf(marker);
if (first >= 0) {
  const afterReturn = html.indexOf('return;', first);
  const close1 = afterReturn >= 0 ? html.indexOf('}', afterReturn) : -1;
  if (close1 > 0) {
    const next = html.slice(close1 + 1, close1 + 120).replace(/^\s+/, '');
    if (next.startsWith('body.innerHTML=renderUs2ySofrChart')) {
      const nextIf =
        ['if(key==\'iorbUs1yDual\'', 'if(key==\'ustCurve\'', 'const full=histories']
          .map(s => html.indexOf(s, close1))
          .filter(x => x > close1)
          .sort((a, b) => a - b)[0];
      if (nextIf > close1) {
        html = html.slice(0, close1 + 1) + '\n  ' + html.slice(nextIf);
        console.log('removed orphan us2ySofrDual tail');
      }
    }
  }
}

// 2) Ensure paintChartDlg is closed before bindBigChartHover
const dlg = html.indexOf('function paintChartDlg');
const bind = html.indexOf('function bindBigChartHover');
if (dlg >= 0 && bind > dlg) {
  const between = html.slice(dlg, bind);
  let depth = 0;
  for (const ch of between) {
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
  }
  console.log('paintChartDlg region depth before fix', depth);
  if (depth > 0) {
    // insert missing closing braces just before bindBigChartHover
    const pad = '\n' + '}'.repeat(depth) + '\n';
    html = html.slice(0, bind) + pad + html.slice(bind);
    console.log('inserted', depth, 'closing brace(s) before bindBigChartHover');
  } else if (depth < 0) {
    // too many closers in region — leave for now
    console.log('warning: extra closers in paintChartDlg region');
  }
}

fs.writeFileSync('index.html', html);

// Validate extracted scripts
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const js = scripts.join('\n');
let depth = 0, min = 0;
for (const ch of js) {
  if (ch === '{') depth++;
  else if (ch === '}') {
    depth--;
    if (depth < min) min = depth;
  }
}
console.log('final brace depth', depth, 'min', min);
console.log('orphan left', (html.match(/return;\s*\}\s*body\.innerHTML=renderUs2ySofrChart/g) || []).length);
console.log('done', html.length);

if (depth !== 0 || min < 0) {
  console.error('JS still unbalanced');
  process.exitCode = 1;
}
