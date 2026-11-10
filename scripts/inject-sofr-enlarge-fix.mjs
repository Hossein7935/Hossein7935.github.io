import fs from 'fs';
let html = fs.readFileSync('index.html', 'utf8');

// Store pts/ovPts when painting
html = html.replace(
  /window\.__sofrTenorMeta=\{id,label:cat\.label\|\|id,symbol:cat\.symbol,ovKey,ovLabel:ov\.label\|\|''\};/g,
  "window.__sofrTenorMeta={id,label:cat.label||id,symbol:cat.symbol,ovKey,ovLabel:ov.label||'',pts:pts.slice(),ovPts:ovPts.slice()};"
);

// Replace sofrTenorHist enlarge: always re-resolve from selectors / localStorage
const histRe = /if\(key==='sofrTenorHist'\)\{[\s\S]*?return;\n  \}/;
const histFn =
  "if(key==='sofrTenorHist'){\n" +
  "    const tm=window.__sofrTenorMeta||{};\n" +
  "    const id=(typeof getSofRTenorId==='function'&&getSofRTenorId())||tm.id||'';\n" +
  "    const ovKey=(typeof getSofRTenorOverlay==='function'&&getSofRTenorOverlay())||tm.ovKey||'';\n" +
  "    let pts=[];\n" +
  "    if(id) pts=(histories['USA-sofrTenor-'+id]||[]).slice();\n" +
  "    if((!pts||!pts.length)&&tm.pts&&tm.pts.length) pts=tm.pts.slice();\n" +
  "    if(typeof filterByRange==='function'){const p2=filterByRange(pts,range); if(p2.length) pts=p2;}\n" +
  "    let ov=[]; let ovLabel=tm.ovLabel||'';\n" +
  "    if(ovKey&&typeof resolveSofRSeries==='function'){\n" +
  "      const r=resolveSofRSeries(ovKey);\n" +
  "      ov=(r.pts||[]).slice();\n" +
  "      ovLabel=r.label||ovLabel;\n" +
  "    } else if(tm.ovPts&&tm.ovPts.length){\n" +
  "      ov=tm.ovPts.slice();\n" +
  "    } else if(ovKey){\n" +
  "      ov=(histories['USA-'+ovKey]||[]).slice();\n" +
  "    }\n" +
  "    if(typeof filterByRange==='function'&&ov.length){const o2=filterByRange(ov,range); if(o2.length) ov=o2;}\n" +
  "    if(!pts.length){body.innerHTML='<div class=\"sparkempty\">Keine Daten</div>';if(meta)meta.textContent='';return;}\n" +
  "    if(typeof renderDiffOverlayChart==='function'&&ov.length>=1){\n" +
  "      body.innerHTML=renderDiffOverlayChart(pts,ov,{w:720,h:320,big:true})+'<div class=\"chart-tip-inline\" id=\"chartDlgTip\"></div>';\n" +
  "    } else {\n" +
  "      body.innerHTML=renderLineChart(pts,{w:720,h:300,big:true})+'<div class=\"chart-tip-inline\" id=\"chartDlgTip\"></div>';\n" +
  "    }\n" +
  "    if(typeof bindBigChartHover==='function')bindBigChartHover(body);\n" +
  "    const lab=tm.label||id||'SOFR';\n" +
  "    if(meta)meta.textContent=lab+(ovLabel?(' · rot: '+ovLabel):'')+' · '+rLabel+' · '+pts.length+(ov.length?('/'+ov.length):'')+' Punkte';\n" +
  "    return;\n" +
  "  }";

if (html.includes("key==='sofrTenorHist'") && histRe.test(html)) {
  html = html.replace(histRe, histFn);
  console.log('sofrTenorHist enlarge re-resolve fixed');
} else {
  console.log('sofrTenorHist pattern NOT matched — manual insert');
  // try looser match
  const i = html.indexOf("key==='sofrTenorHist'");
  if (i >= 0) {
    // find matching closing of this if block roughly
    let depth = 0, started = false, end = -1;
    for (let j = i; j < html.length && j < i + 2500; j++) {
      if (html[j] === '{') { depth++; started = true; }
      else if (html[j] === '}') {
        depth--;
        if (started && depth === 0) { end = j; break; }
      }
    }
    if (end > i) {
      // include leading 'if('
      let start = i;
      while (start > 0 && html.slice(start, start + 2) !== 'if') start--;
      html = html.slice(0, start) + histFn + html.slice(end + 1);
      console.log('replaced by brace scan');
    }
  }
}

// Also patch fix-paint template if present as string in scripts (no-op on index)

fs.writeFileSync('index.html', html);
console.log('done',
  html.includes('getSofRTenorOverlay'),
  html.includes('resolveSofRSeries(ovKey)'),
  html.includes('ov.length>=1')
);
