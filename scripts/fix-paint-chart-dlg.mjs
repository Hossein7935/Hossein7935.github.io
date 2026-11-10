import fs from 'fs';

/** paintChartDlg hardened: dual charts + SOFR dual re-resolve on enlarge */
let html = fs.readFileSync('index.html', 'utf8');

const start = html.indexOf('function paintChartDlg');
const end = html.indexOf('function bindBigChartHover');
if (start < 0 || end < 0 || end <= start) {
  console.error('markers not found', start, end);
  process.exit(1);
}

const fn = `function paintChartDlg(){
  if(!chartCtx)return;
  const key=chartCtx.key;
  const isCurve=key==='sofrFwd'||key==='ustCurve'||key==='tipsCurve';
  const rangeBar=document.querySelector('#chartRange');
  if(rangeBar)rangeBar.style.display=isCurve?'none':'flex';

  const body=document.querySelector('#chartBody');
  const meta=document.querySelector('#chartMeta');
  if(!body)return;
  body.style.minHeight='280px';
  const range=chartCtx.range||'3y';
  const rLabel={'6m':'6 Monate','1y':'1 Jahr','3y':'3 Jahre'}[range]||range;

  try{

  if(key==='us2ySofrDual'&&typeof renderUs2ySofrChart==='function'){
    let us2y=histories['USA-us2y']||[];
    const _pair=typeof getUs2yPairKey==='function'?getUs2yPairKey():'sofr';
    const _redKey=(_pair==='iorb'||_pair==='effr')?_pair:'sofr';
    const _redLabel=_redKey==='iorb'?'IORB':(_redKey==='effr'?'EFFR':'SOFR');
    let red=histories['USA-'+_redKey]||[];
    if(typeof filterByRange==='function'){
      const u2=filterByRange(us2y,range); if(u2.length) us2y=u2;
      const s2=filterByRange(red,range); if(s2.length) red=s2;
    }
    if(!us2y.length&&!red.length){
      body.innerHTML='<div class="sparkempty">Keine Daten</div>';
      if(meta)meta.textContent='';
      return;
    }
    body.innerHTML=renderUs2ySofrChart(us2y,red,{w:720,h:320,big:true,redLabel:_redLabel})+'<div class="chart-tip-inline" id="chartDlgTip"></div>';
    if(typeof bindBigChartHover==='function')bindBigChartHover(body);
    if(meta)meta.textContent='US 2Y blau · '+_redLabel+' rot · '+rLabel+' · Crosshair · '+(us2y.length)+'/'+(red.length)+' Punkte';
    return;
  }

  if(key==='iorbUs1yDual'&&typeof renderIorbUs1yChart==='function'){
    let iorb=histories['USA-iorb']||[];
    let us1y=histories['USA-us1y']||[];
    if(typeof filterByRange==='function'){
      const a=filterByRange(iorb,range); if(a.length) iorb=a;
      const b=filterByRange(us1y,range); if(b.length) us1y=b;
    }
    if(!iorb.length&&!us1y.length){
      body.innerHTML='<div class="sparkempty">Keine Daten</div>';
      if(meta)meta.textContent='';
      return;
    }
    body.innerHTML=renderIorbUs1yChart(iorb,us1y,{w:720,h:320,big:true})+'<div class="chart-tip-inline" id="chartDlgTip"></div>';
    if(typeof bindBigChartHover==='function')bindBigChartHover(body);
    if(meta)meta.textContent='IORB/IOER rot · US 1Y blau · '+rLabel+' · Crosshair · '+(iorb.length)+'/'+(us1y.length)+' Punkte';
    return;
  }

  if(key==='ustCurve'&&typeof renderDualTenorChart==='function'){
    const u=(data.USA&&data.USA.ustCurve)||{};
    const nom=histories['USA-ustCurve']||u.nominal||[];
    const tips=histories['USA-tipsCurve']||u.tips||[];
    if(!nom.length){
      body.innerHTML='<div class="sparkempty">Keine Daten</div>';
      if(meta)meta.textContent='';
      return;
    }
    body.innerHTML=renderDualTenorChart(nom,tips,{w:720,h:320,big:true})+'<div class="chart-tip-inline" id="chartDlgTip"></div>';
    if(typeof bindBigChartHover==='function')bindBigChartHover(body);
    if(meta)meta.textContent=nom.length+' Nominal-Punkte · TIPS rot · Crosshair';
    return;
  }

  if(key==='moveDual'&&typeof renderMoveYieldChart==='function'){
    let move=histories['USA-move']||[];
    if(typeof filterByRange==='function'){
      const m2=filterByRange(move,range); if(m2.length) move=m2;
    }
    let yAvg=[];
    if(typeof getMoveShowYieldAvg==='function'&&getMoveShowYieldAvg()&&typeof buildUsYieldAvgSeries==='function'){
      yAvg=buildUsYieldAvgSeries();
      if(typeof filterByRange==='function'){
        const y2=filterByRange(yAvg,range); if(y2.length) yAvg=y2;
      }
    }
    if(!move.length){
      body.innerHTML='<div class="sparkempty">Keine Daten</div>';
      if(meta)meta.textContent='';
      return;
    }
    body.innerHTML=renderMoveYieldChart(move,yAvg,{w:720,h:320,big:true})+'<div class="chart-tip-inline" id="chartDlgTip"></div>';
    if(typeof bindBigChartHover==='function')bindBigChartHover(body);
    if(meta)meta.textContent='MOVE blau · '+(yAvg.length?'Ø Rendite rot · ':'')+rLabel+' · '+move.length+' Punkte';
    return;
  }

  if(key==='rateOverlayDual'){
    const om=window.__rateOverlayMeta||{};
    const k1=om.k1||'effr', k2=om.k2||'sofr';
    const labels={effr:'EFFR',sofr:'SOFR',iorb:'IORB'};
    let blue=histories['USA-'+k1]||histories['USA-rateOverlayBlue']||[];
    let red=histories['USA-'+k2]||histories['USA-rateOverlayRed']||[];
    if(typeof filterByRange==='function'){
      const b2=filterByRange(blue,range); if(b2.length) blue=b2;
      const r2=filterByRange(red,range); if(r2.length) red=r2;
    }
    if(!blue.length&&!red.length){
      body.innerHTML='<div class="sparkempty">Keine Daten</div>';
      if(meta)meta.textContent='';
      return;
    }
    if(typeof renderRateOverlayChart==='function'){
      body.innerHTML=renderRateOverlayChart(blue,red,{w:720,h:320,big:true,blueLabel:labels[k1]||k1,redLabel:labels[k2]||k2})+'<div class="chart-tip-inline" id="chartDlgTip"></div>';
    }else{
      body.innerHTML=renderLineChart(blue,{w:720,h:300,big:true})+'<div class="chart-tip-inline" id="chartDlgTip"></div>';
    }
    if(typeof bindBigChartHover==='function')bindBigChartHover(body);
    if(meta)meta.textContent=(labels[k1]||k1)+' blau · '+(labels[k2]||k2)+' rot · '+rLabel+' · '+blue.length+'/'+red.length+' Punkte';
    return;
  }

  if(key==='diff'||key==='yield7Diff'){
    const histKey=key==='diff'?'USA-diff':'USA-yield7Diff';
    let pts=histories[histKey]||[];
    if(typeof filterByRange==='function'){
      const p2=filterByRange(pts,range); if(p2.length) pts=p2;
    }
    let ov=[];
    let gr=[];
    const metaO=window.__yield7OverlayMeta||{};
    if(key==='yield7Diff'){
      if(metaO.key&&typeof getYield7OverlayKey==='function'&&getYield7OverlayKey()){
        ov=histories['USA-'+metaO.key]||[];
      }
      if(metaO.greenKey&&typeof getYield7GreenKey==='function'&&getYield7GreenKey()){
        gr=histories['USA-'+metaO.greenKey]||metaO.greenPts||[];
      }else if(metaO.greenPts){
        gr=metaO.greenPts;
      }
      if(typeof filterByRange==='function'){
        const o2=filterByRange(ov,range); if(o2.length) ov=o2;
        const g2=filterByRange(gr,range); if(g2.length) gr=g2;
      }
    }
    if(!pts.length){
      body.innerHTML='<div class="sparkempty">Keine Daten</div>';
      if(meta)meta.textContent='';
      return;
    }
    if(key==='yield7Diff'&&typeof renderDiffOverlayChart==='function'){
      body.innerHTML=renderDiffOverlayChart(pts,ov,{w:720,h:320,big:true,greenPts:gr})+'<div class="chart-tip-inline" id="chartDlgTip"></div>';
    }else{
      body.innerHTML=renderLineChart(pts,{w:720,h:300,big:true})+'<div class="chart-tip-inline" id="chartDlgTip"></div>';
    }
    if(typeof bindBigChartHover==='function')bindBigChartHover(body);
    const extra=[];
    if(metaO.label)extra.push('rot: '+metaO.label);
    if(metaO.greenLabel)extra.push('grün: '+metaO.greenLabel);
    if(meta)meta.textContent='Differenz · '+rLabel+' · '+pts.length+' Punkte'+(extra.length?(' · '+extra.join(' · ')):'');
    return;
  }

  if(key==='sofrTenorDiff'){
    const dm=window.__sofrDiffMeta||{};
    let pts=dm.pts||[];
    if(typeof filterByRange==='function'){const p2=filterByRange(pts,range); if(p2.length) pts=p2;}
    if(!pts.length){body.innerHTML='<div class="sparkempty">Keine Daten</div>';if(meta)meta.textContent='';return;}
    body.innerHTML=renderLineChart(pts,{w:720,h:300,big:true})+'<div class="chart-tip-inline" id="chartDlgTip"></div>';
    if(typeof bindBigChartHover==='function')bindBigChartHover(body);
    if(meta)meta.textContent=(dm.labelA||'A')+' − '+(dm.labelB||'B')+' · '+rLabel+' · '+pts.length+' Punkte';
    return;
  }

  if(key==='sofrTenorHist'){
    const tm=window.__sofrTenorMeta||{};
    const id=(typeof getSofRTenorId==='function'&&getSofRTenorId())||tm.id||'';
    const ovKey=(typeof getSofRTenorOverlay==='function'&&getSofRTenorOverlay())||tm.ovKey||'';
    let pts=[];
    if(id) pts=(histories['USA-sofrTenor-'+id]||[]).slice();
    if((!pts||!pts.length)&&tm.pts&&tm.pts.length) pts=tm.pts.slice();
    if(typeof filterByRange==='function'){const p2=filterByRange(pts,range); if(p2.length) pts=p2;}
    let ov=[]; let ovLabel=tm.ovLabel||'';
    if(ovKey&&typeof resolveSofRSeries==='function'){
      const r=resolveSofRSeries(ovKey);
      ov=(r.pts||[]).slice();
      ovLabel=r.label||ovLabel;
    } else if(tm.ovPts&&tm.ovPts.length){
      ov=tm.ovPts.slice();
    } else if(ovKey){
      ov=(histories['USA-'+ovKey]||[]).slice();
    }
    if(typeof filterByRange==='function'&&ov.length){const o2=filterByRange(ov,range); if(o2.length) ov=o2;}
    if(!pts.length){body.innerHTML='<div class="sparkempty">Keine Daten</div>';if(meta)meta.textContent='';return;}
    if(typeof renderDiffOverlayChart==='function'&&ov.length>=1){
      body.innerHTML=renderDiffOverlayChart(pts,ov,{w:720,h:320,big:true})+'<div class="chart-tip-inline" id="chartDlgTip"></div>';
    } else {
      body.innerHTML=renderLineChart(pts,{w:720,h:300,big:true})+'<div class="chart-tip-inline" id="chartDlgTip"></div>';
    }
    if(typeof bindBigChartHover==='function')bindBigChartHover(body);
    const lab=tm.label||id||'SOFR';
    if(meta)meta.textContent=lab+(ovLabel?(' · rot: '+ovLabel):'')+' · '+rLabel+' · '+pts.length+(ov.length?('/'+ov.length):'')+' Punkte';
    return;
  }

  if(key==='sofrFwd'){
    const pts=histories['USA-sofrFwd']||((data.USA&&data.USA.sofrFwd&&data.USA.sofrFwd.points)||[]);
    if(typeof renderSofRFwdChart==='function'&&pts.length){
      body.innerHTML=renderSofRFwdChart(pts,{w:720,h:320,big:true})+'<div class="chart-tip-inline" id="chartDlgTip"></div>';
      if(typeof bindBigChartHover==='function')bindBigChartHover(body);
      if(meta)meta.textContent=pts.length+' Forward-Punkte · Crosshair';
      return;
    }
  }

  const full=histories[chartCtx.country+'-'+chartCtx.key]||[];
  let arr;
  if(isCurve){
    arr=full.slice();
  }else{
    arr=typeof filterByRange==='function'?filterByRange(full,range):full.slice();
    if(!arr.length)arr=full;
  }
  const pts=arr.map(x=>({period:String(x.period),value:Number(x.value)})).filter(x=>Number.isFinite(x.value));
  if(!pts.length){
    body.innerHTML='<div class="sparkempty">Keine Daten für diesen Zeitraum</div>';
    if(meta)meta.textContent='';
    return;
  }
  if(typeof renderLineChart!=='function'){
    body.innerHTML='<div class="sparkempty">Chart-Renderer fehlt</div>';
    return;
  }
  body.innerHTML=renderLineChart(pts,{w:720,h:isCurve?300:280,big:true})+'<div class="chart-tip-inline" id="chartDlgTip"></div>';
  if(typeof bindBigChartHover==='function')bindBigChartHover(body);
  if(isCurve){
    if(meta)meta.textContent=pts.length+' Punkte · Crosshair';
  }else{
    if(meta)meta.textContent=pts.length+' Punkte · '+rLabel+' · '+esc(String(pts[0].period))+' → '+esc(String(pts.at(-1).period));
  }

  }catch(err){
    body.innerHTML='<div class="sparkempty">Chart-Fehler: '+(err&&err.message?err.message:err)+'</div>';
    if(meta)meta.textContent='';
  }
}

`;

html = html.slice(0, start) + fn + html.slice(end);
fs.writeFileSync('index.html', html);

const region = html.slice(html.indexOf('function paintChartDlg'), html.indexOf('function bindBigChartHover'));
const ok = region.includes('getSofRTenorOverlay') && region.includes('resolveSofRSeries');
console.log('paintChartDlg ok', ok);
if (!ok) process.exit(1);
