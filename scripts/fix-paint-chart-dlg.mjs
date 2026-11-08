import fs from 'fs';

/** Replace broken paintChartDlg with a clean, complete implementation */
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
  const isCurve=key==='sofrFwd'||key==='ustCurve'||key==='tipsCurve'||key==='iorbUs1yDual';
  const rangeBar=document.querySelector('#chartRange');
  if(rangeBar)rangeBar.style.display=isCurve?'none':'flex';

  const body=document.querySelector('#chartBody');
  const meta=document.querySelector('#chartMeta');
  if(!body)return;

  if(key==='us2ySofrDual'&&typeof renderUs2ySofrChart==='function'){
    let us2y=histories['USA-us2y']||[];
    let sofr=histories['USA-sofr']||[];
    const range=chartCtx.range||'3y';
    if(typeof filterByRange==='function'){
      const u2=filterByRange(us2y,range); if(u2.length) us2y=u2;
      const s2=filterByRange(sofr,range); if(s2.length) sofr=s2;
    }
    if(!us2y.length&&!sofr.length){
      body.innerHTML='<div class="sparkempty">Keine Daten</div>';
      if(meta)meta.textContent='';
      return;
    }
    body.innerHTML=renderUs2ySofrChart(us2y,sofr,{w:720,h:320,big:true})+'<div class="chart-tip-inline" id="chartDlgTip"></div>';
    bindBigChartHover(body);
    const rLabel={'6m':'6 Monate','1y':'1 Jahr','3y':'3 Jahre'}[range]||range;
    if(meta)meta.textContent='US 2Y blau · SOFR rot · '+rLabel+' · Crosshair · '+(us2y.length)+'/'+(sofr.length)+' Punkte';
    return;
  }

  if(key==='iorbUs1yDual'&&typeof renderIorbUs1yChart==='function'){
    const iorb=histories['USA-iorb']||[];
    const us1y=histories['USA-us1y']||[];
    if(!iorb.length&&!us1y.length){
      body.innerHTML='<div class="sparkempty">Keine Daten</div>';
      if(meta)meta.textContent='';
      return;
    }
    body.innerHTML=renderIorbUs1yChart(iorb,us1y,{w:720,h:320,big:true})+'<div class="chart-tip-inline" id="chartDlgTip"></div>';
    bindBigChartHover(body);
    if(meta)meta.textContent='IORB rot · US 1Y blau · Crosshair · '+(iorb.length)+'/'+(us1y.length)+' Punkte';
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
    const svg=body.querySelector('svg');
    if(svg&&!svg.querySelector('.hit')){
      svg.querySelectorAll('circle').forEach(c=>{
        if(c.classList.contains('chart-crosshair-dot'))return;
        c.classList.add('hit');
        const title=c.querySelector('title');
        if(title){
          const t=title.textContent||'';
          const m=t.match(/^(\\S+)\\s+(Nominal|TIPS)\\s+([\\d.]+)/);
          if(m){c.setAttribute('data-period',m[1]+' '+m[2]);c.setAttribute('data-value',m[3]);}
        }
      });
    }
    bindBigChartHover(body);
    if(meta)meta.textContent=nom.length+' Nominal-Punkte · TIPS rot · Crosshair';
    return;
  }

  if(key==='sofrFwd'&&typeof renderSofRFwdChart==='function'){
    const pts=histories['USA-sofrFwd']||((data.USA&&data.USA.sofrFwd&&data.USA.sofrFwd.points)||[]);
    if(!pts.length){
      body.innerHTML='<div class="sparkempty">Keine Daten</div>';
      if(meta)meta.textContent='';
      return;
    }
    body.innerHTML=renderSofRFwdChart(pts,{w:720,h:320,big:true})+'<div class="chart-tip-inline" id="chartDlgTip"></div>';
    bindBigChartHover(body);
    if(meta)meta.textContent=pts.length+' Forward-Punkte · Crosshair';
    return;
  }

  const full=histories[chartCtx.country+'-'+chartCtx.key]||[];
  let arr;
  if(isCurve){
    arr=full.slice();
  }else{
    arr=typeof filterByRange==='function'?filterByRange(full,chartCtx.range):full.slice();
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
    if(meta)meta.textContent=pts.length+' Punkte · '+pts.map(p=>p.period).join(' · ')+' · Crosshair';
  }else{
    const rLabel={'6m':'6 Monate','1y':'1 Jahr','3y':'3 Jahre'}[chartCtx.range]||chartCtx.range;
    if(meta)meta.textContent=pts.length+' Punkte · '+rLabel+' · '+esc(String(pts[0].period))+' → '+esc(String(pts.at(-1).period));
  }
}

`;

html = html.slice(0, start) + fn + html.slice(end);
fs.writeFileSync('index.html', html);

// validate
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
console.log('paintChartDlg restored', 'depth', depth, 'min', min, 'len', html.length);
if (depth !== 0 || min < 0) {
  console.error('unbalanced');
  process.exit(1);
}
