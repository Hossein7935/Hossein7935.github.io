import fs from 'fs';

/** paintChartDlg: dual charts with full render (US2Y+SOFR/IORB/EFFR, IORB+1Y, etc.) */
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
  const range=chartCtx.range||'3y';
  const rLabel={'6m':'6 Monate','1y':'1 Jahr','3y':'3 Jahre'}[range]||range;

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
}

`;

html = html.slice(0, start) + fn + html.slice(end);
fs.writeFileSync('index.html', html);

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const js = scripts.join('\n');
try {
  new Function(js);
  console.log('js ok');
} catch (e) {
  console.warn('js warn', e.message);
}
const hasRender =
  html.includes("key==='us2ySofrDual'") &&
  html.includes('renderUs2ySofrChart(us2y,red');
console.log('paintChartDlg ok', 'us2y render', hasRender);
if (!hasRender) process.exit(1);
