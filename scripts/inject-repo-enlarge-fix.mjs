import fs from 'fs';

/** Ensure paintChartDlg can enlarge Repo-Markt dual charts */
let html = fs.readFileSync('index.html', 'utf8');

if (html.includes("key==='repoMmfDual'")) {
  console.log('repo enlarge already present');
} else {
  const markers = [
    "if(key==='sofrTenorDiff')",
    "if(key==='sofrTenorHist')",
    "if(key==='sofrFwd')",
    'const full=histories[chartCtx.country'
  ];
  let idx = -1;
  for (const m of markers) {
    const i = html.indexOf(m);
    if (i >= 0) { idx = i; break; }
  }
  if (idx < 0) {
    console.error('no insert point for repo enlarge');
    process.exit(0);
  }
  const inject =
    "if(key==='repoMmfDual'||key==='repoVolDual'){\n" +
    "    const rm=key==='repoMmfDual'?(window.__repoMmfMeta||{}):(window.__repoVolMeta||{});\n" +
    "    let base=key==='repoMmfDual'?(rm.mmfTot||histories['USA-mmfTot']||[]):(rm.baseVol||histories['USA-repoTriVol']||[]);\n" +
    "    let ov=rm.redPts&&rm.redPts.length?rm.redPts:(key==='repoMmfDual'?(rm.mmfRepo||histories['USA-mmfRepo']||[]):(rm.rateLine||histories['USA-repoTriRate']||[]));\n" +
    "    let gr=rm.greenPts||[];\n" +
    "    if(typeof filterByRange==='function'){\n" +
    "      const b2=filterByRange(base,range); if(b2.length) base=b2;\n" +
    "      const o2=filterByRange(ov,range); if(o2.length) ov=o2;\n" +
    "      const g2=filterByRange(gr,range); if(g2.length) gr=g2;\n" +
    "    }\n" +
    "    if(!base.length){body.innerHTML='<div class=\"sparkempty\">Keine Daten</div>';if(meta)meta.textContent='';return;}\n" +
    "    if(typeof renderDiffOverlayChart==='function'){\n" +
    "      body.innerHTML=renderDiffOverlayChart(base,ov,{w:720,h:320,big:true,greenPts:gr})+'<div class=\"chart-tip-inline\" id=\"chartDlgTip\"></div>';\n" +
    "    } else {\n" +
    "      body.innerHTML=renderLineChart(base,{w:720,h:300,big:true})+'<div class=\"chart-tip-inline\" id=\"chartDlgTip\"></div>';\n" +
    "    }\n" +
    "    if(typeof bindBigChartHover==='function')bindBigChartHover(body);\n" +
    "    if(meta)meta.textContent=(key==='repoMmfDual'?'MMF Total / Repo':'Repo Vol / Rate')+' · '+rLabel+' · '+base.length+(ov.length?('/'+ov.length):'')+' Punkte';\n" +
    "    return;\n" +
    "  }\n  ";
  html = html.slice(0, idx) + inject + html.slice(idx);
  console.log('repo enlarge inserted');
}

fs.writeFileSync('index.html', html);
console.log('ok', html.includes("key==='repoMmfDual'"));
