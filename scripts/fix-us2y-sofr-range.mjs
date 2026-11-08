import fs from 'fs';

/** Enable 6m/1y/3y range toolbar for US2Y+SOFR dual chart dialog */
let html = fs.readFileSync('index.html', 'utf8');

// 1) Remove us2ySofrDual from isCurve so range bar shows
html = html.replace(/\|\|key==='us2ySofrDual'/g, '');
html = html.replace(/key==='us2ySofrDual'\|\|/g, '');

// 2) Replace dual-chart dialog branch to honor chartCtx.range
const oldBranch = `if(key==='us2ySofrDual'&&typeof renderUs2ySofrChart==='function'){\n    const us2y=histories['USA-us2y']||[];\n    const sofr=histories['USA-sofr']||[];\n    if(!us2y.length&&!sofr.length){body.innerHTML='<div class="sparkempty">Keine Daten</div>';if(meta)meta.textContent='';return;}\n    body.innerHTML=renderUs2ySofrChart(us2y,sofr,{w:720,h:320,big:true})+'<div class="chart-tip-inline" id="chartDlgTip"></div>';\n    bindBigChartHover(body);\n    if(meta)meta.textContent='US 2Y blau · SOFR rot · Crosshair · '+(us2y.length)+'/'+(sofr.length)+' Punkte';\n    return;\n  }`;

const newBranch = `if(key==='us2ySofrDual'&&typeof renderUs2ySofrChart==='function'){\n    let us2y=histories['USA-us2y']||[];\n    let sofr=histories['USA-sofr']||[];\n    const range=chartCtx.range||'3y';\n    if(typeof filterByRange==='function'){\n      const u2=filterByRange(us2y,range); if(u2.length) us2y=u2;\n      const s2=filterByRange(sofr,range); if(s2.length) sofr=s2;\n    }\n    if(!us2y.length&&!sofr.length){body.innerHTML='<div class="sparkempty">Keine Daten</div>';if(meta)meta.textContent='';return;}\n    body.innerHTML=renderUs2ySofrChart(us2y,sofr,{w:720,h:320,big:true})+'<div class="chart-tip-inline" id="chartDlgTip"></div>';\n    bindBigChartHover(body);\n    const rLabel={'6m':'6 Monate','1y':'1 Jahr','3y':'3 Jahre'}[range]||range;\n    if(meta)meta.textContent='US 2Y blau · SOFR rot · '+rLabel+' · Crosshair · '+(us2y.length)+'/'+(sofr.length)+' Punkte';\n    return;\n  }`;

if (html.includes("key==='us2ySofrDual'&&typeof renderUs2ySofrChart")) {
  // flexible replace: from if(key==='us2ySofrDual' to the return; that closes it
  const start = html.indexOf("if(key==='us2ySofrDual'&&typeof renderUs2ySofrChart");
  if (start >= 0) {
    const ret = html.indexOf('return;', start);
    const end = ret >= 0 ? ret + 'return;'.length : -1;
    // include following closing brace if present
    let end2 = end;
    if (end > 0 && html.slice(end, end + 10).includes('}')) {
      const brace = html.indexOf('}', end);
      if (brace > 0) end2 = brace + 1;
    }
    if (end2 > start) {
      html = html.slice(0, start) + newBranch + html.slice(end2);
      console.log('us2ySofrDual branch replaced');
    }
  }
} else {
  console.warn('us2ySofrDual branch not found');
}

fs.writeFileSync('index.html', html);
const m = html.match(/const isCurve=([^;]+)/);
console.log('isCurve', m ? m[1].slice(0, 180) : null);
console.log('us2y in isCurve', m ? m[1].includes('us2ySofrDual') : null);
console.log('filter in branch', html.includes("filterByRange(us2y,range)"));
console.log('done', html.length);
