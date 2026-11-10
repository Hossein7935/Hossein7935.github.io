import fs from 'fs';
let html = fs.readFileSync('index.html', 'utf8');

// Store pts/ovPts when painting (if old meta assignment exists)
html = html.replace(
  /window\.__sofrTenorMeta=\{id,label:cat\.label\|\|id,symbol:cat\.symbol,ovKey,ovLabel:ov\.label\|\|''\};/g,
  "window.__sofrTenorMeta={id,label:cat.label||id,symbol:cat.symbol,ovKey,ovLabel:ov.label||'',pts:pts.slice(),ovPts:ovPts.slice()};"
);

// Replace broken sofrTenorHist enlarge block
const histRe = /if\(key==='sofrTenorHist'\)\{[\s\S]*?return;\n  \}/;
const histFn =
  "if(key==='sofrTenorHist'){\n" +
  "    const tm=window.__sofrTenorMeta||{};\n" +
  "    let pts=(tm.pts&&tm.pts.length)?tm.pts.slice():(histories['USA-sofrTenor-'+(tm.id||'')]||[]);\n" +
  "    if(typeof filterByRange==='function'){const p2=filterByRange(pts,range); if(p2.length) pts=p2;}\n" +
  "    let ov=[];\n" +
  "    if(tm.ovPts&&tm.ovPts.length){ov=tm.ovPts.slice();}\n" +
  "    else if(tm.ovKey&&typeof resolveSofRSeries==='function'){ov=(resolveSofRSeries(tm.ovKey).pts||[]).slice();}\n" +
  "    else if(tm.ovKey){ov=histories['USA-'+tm.ovKey]||[];}\n" +
  "    if(typeof filterByRange==='function'&&ov.length){const o2=filterByRange(ov,range); if(o2.length) ov=o2;}\n" +
  "    if(!pts.length){body.innerHTML='<div class=\"sparkempty\">Keine Daten</div>';if(meta)meta.textContent='';return;}\n" +
  "    if(typeof renderDiffOverlayChart==='function'&&ov.length>=2){body.innerHTML=renderDiffOverlayChart(pts,ov,{w:720,h:320,big:true})+'<div class=\"chart-tip-inline\" id=\"chartDlgTip\"></div>';}\n" +
  "    else{body.innerHTML=renderLineChart(pts,{w:720,h:300,big:true})+'<div class=\"chart-tip-inline\" id=\"chartDlgTip\"></div>';}\n" +
  "    if(typeof bindBigChartHover==='function')bindBigChartHover(body);\n" +
  "    if(meta)meta.textContent=(tm.label||'SOFR')+(tm.ovLabel?(' · rot: '+tm.ovLabel):'')+' · '+rLabel+' · '+pts.length+(ov.length?('/'+ov.length):'')+' Punkte';\n" +
  "    return;\n" +
  "  }";

if (html.includes("key==='sofrTenorHist'") && histRe.test(html)) {
  html = html.replace(histRe, histFn);
  console.log('sofrTenorHist enlarge fixed');
} else {
  console.log('sofrTenorHist pattern not matched');
}

fs.writeFileSync('index.html', html);
console.log('done', html.includes('tm.ovPts'), html.includes('resolveSofRSeries'));
