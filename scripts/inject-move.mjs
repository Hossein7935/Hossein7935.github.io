import fs from 'fs';

/** MOVE panel on USA page 6: full history + optional US yield average overlay */
let html = fs.readFileSync('index.html', 'utf8');

// Dual-axis renderer for MOVE (left) + yield avg (right)
if (!html.includes('function renderMoveYieldChart')) {
  const renderer = `
function renderMoveYieldChart(movePts, yieldPts, opts){
  opts=opts||{};
  const w=opts.w||360,h=opts.h||160,big=!!opts.big;
  const pad={t:18,r:yieldPts&&yieldPts.length?44:12,b:22,l:40};
  const iw=w-pad.l-pad.r, ih=h-pad.t-pad.b;
  const m=movePts.filter(p=>Number.isFinite(Number(p.value)));
  const y=(yieldPts||[]).filter(p=>Number.isFinite(Number(p.value)));
  if(!m.length)return '<div class="sparkempty">Keine Daten</div>';
  const allDates=[...new Set([...m,...y].map(p=>String(p.period)))].sort();
  const xOf=i=>pad.l+(allDates.length<=1?iw/2:(i/(allDates.length-1))*iw);
  const dateIdx=new Map(allDates.map((d,i)=>[d,i]));
  const mMin=Math.min(...m.map(p=>Number(p.value)));
  const mMax=Math.max(...m.map(p=>Number(p.value)));
  const mSpan=(mMax-mMin)||1;
  const yMin=y.length?Math.min(...y.map(p=>Number(p.value))):0;
  const yMax=y.length?Math.max(...y.map(p=>Number(p.value))):1;
  const ySpan=(yMax-yMin)||1;
  const yM=v=>pad.t+ih-(Number(v)-mMin)/mSpan*ih;
  const yY=v=>pad.t+ih-(Number(v)-yMin)/ySpan*ih;
  const pathOf=(pts,yFn)=>{
    let d='';
    pts.forEach((p,i)=>{
      const xi=dateIdx.get(String(p.period));
      if(xi==null)return;
      const x=xOf(xi), yy=yFn(p.value);
      d+=(d?'L':'M')+x.toFixed(1)+','+yy.toFixed(1);
    });
    return d;
  };
  const dM=pathOf(m,yM);
  const dY=y.length?pathOf(y,yY):'';
  let hits='';
  m.forEach(p=>{
    const xi=dateIdx.get(String(p.period)); if(xi==null)return;
    const x=xOf(xi), yy=yM(p.value);
    hits+='<circle class="hit" cx="'+x.toFixed(1)+'" cy="'+yy.toFixed(1)+'" r="'+(big?6:4)+'" fill="transparent" data-period="'+String(p.period)+' MOVE" data-value="'+Number(p.value).toFixed(2)+'"></circle>';
  });
  y.forEach(p=>{
    const xi=dateIdx.get(String(p.period)); if(xi==null)return;
    const x=xOf(xi), yy=yY(p.value);
    hits+='<circle class="hit" cx="'+x.toFixed(1)+'" cy="'+yy.toFixed(1)+'" r="'+(big?6:4)+'" fill="transparent" data-period="'+String(p.period)+' ØYld" data-value="'+Number(p.value).toFixed(3)+'"></circle>';
  });
  const grid=[];
  for(let i=0;i<=4;i++){
    const yy=pad.t+(ih*i)/4;
    grid.push('<line x1="'+pad.l+'" y1="'+yy+'" x2="'+(pad.l+iw)+'" y2="'+yy+'" stroke="rgba(127,127,127,.2)" stroke-width="1"/>');
    const mv=mMax-(mSpan*i)/4;
    grid.push('<text x="'+(pad.l-4)+'" y="'+(yy+3)+'" text-anchor="end" font-size="9" fill="#4a9eed">'+mv.toFixed(0)+'</text>');
    if(y.length){
      const yv=yMax-(ySpan*i)/4;
      grid.push('<text x="'+(pad.l+iw+4)+'" y="'+(yy+3)+'" text-anchor="start" font-size="9" fill="#e74c3c">'+yv.toFixed(2)+'</text>');
    }
  }
  const legend=y.length
    ?('<text x="'+(pad.l)+'" y="12" font-size="10" fill="#4a9eed">MOVE (bp)</text><text x="'+(pad.l+90)+'" y="12" font-size="10" fill="#e74c3c">Ø US-Rendite %</text>')
    :('<text x="'+(pad.l)+'" y="12" font-size="10" fill="#4a9eed">MOVE (bp)</text>');
  return '<svg class="chart-hover" viewBox="0 0 '+w+' '+h+'" width="100%" height="'+h+'" preserveAspectRatio="none">'+grid.join('')+legend+
    '<path d="'+dM+'" fill="none" stroke="#4a9eed" stroke-width="'+(big?2.2:1.6)+'"/>'+
    (dY?('<path d="'+dY+'" fill="none" stroke="#e74c3c" stroke-width="'+(big?2.2:1.6)+'"/>'):'')+
    hits+'</svg>';
}
function buildUsYieldAvgSeries(){
  const keys=['us3m','us1y','us2y','us5y','us10y','us30y'];
  const maps=keys.map(k=>{
    const arr=histories['USA-'+k]||[];
    return new Map(arr.map(p=>[String(p.period),Number(p.value)]));
  });
  const dates=new Set();
  maps.forEach(m=>m.forEach((_,d)=>dates.add(d)));
  const out=[];
  [...dates].sort().forEach(d=>{
    let sum=0,n=0;
    for(const m of maps){
      const v=m.get(d);
      if(v!=null&&Number.isFinite(v)){sum+=v;n++;}
    }
    if(n>=4) out.push({period:d,value:Math.round((sum/n)*10000)/10000});
  });
  return out;
}
function getMoveShowYieldAvg(){
  try{return localStorage.getItem('macrowatch-move-yield-avg')==='1'}catch(e){return false}
}
function setMoveShowYieldAvg(on){
  try{localStorage.setItem('macrowatch-move-yield-avg',on?'1':'0')}catch(e){}
  try{typeof paintMove==='function'&&paintMove()}catch(e){}
}
`;
  const anchor = html.indexOf('function paintMove');
  if (anchor >= 0) html = html.slice(0, anchor) + renderer + html.slice(anchor);
  else {
    const i2 = html.lastIndexOf('bindUsaPages();');
    if (i2 >= 0) html = html.slice(0, i2) + renderer + html.slice(i2);
  }
  console.log('renderMoveYieldChart inserted');
}

// Replace paintMove
if (html.includes('function paintMove')) {
  const start = html.indexOf('function paintMove');
  const candidates = ['function paintIorbUs1y', 'function paintYieldPage7', 'function bindUsaPages', 'function paintRateDiff', 'function paintUs2ySofr'];
  let end = -1;
  for (const n of candidates) {
    const p = html.indexOf(n, start + 10);
    if (p > start && (end < 0 || p < end)) end = p;
  }
  if (end < 0) end = html.indexOf('\nfunction ', start + 20);

  const newFn = `function paintMove(){
  const faceF=document.querySelector('.usa-face-f')||document.querySelector('.usa-face-a');
  if(!faceF)return;
  if(!document.getElementById('movePanel')){
    const box=document.createElement('div');
    box.innerHTML=
      '<div class="metric has-chart sofr-fwd-panel" id="movePanel" style="grid-column:1/-1">'+
        '<div class="name">MOVE Index <span style="opacity:.7;font-weight:400">(Treasury-Volatilität)</span></div>'+
        '<div class="value" id="moveValue">—</div>'+
        '<div class="date" id="moveDate">Yahoo ^MOVE</div>'+
        '<div class="sofr-fwd-bp" id="moveToggle" style="gap:8px;flex-wrap:wrap;align-items:center">'+
          '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px">'+
            '<input type="checkbox" id="moveYieldAvgCb" style="width:16px;height:16px">'+
            'Ø US-Renditen 3M·1Y·2Y·5Y·10Y·30Y <span style="color:#e74c3c">(rot)</span>'+
          '</label>'+
        '</div>'+
        '<div class="sofr-fwd-bp" id="moveCards"></div>'+
        '<div id="moveChart"></div>'+
        '<div class="sofr-fwd-meta" id="moveMeta">Volle Historie ab Index-Start</div>'+
      '</div>';
    faceF.appendChild(box.firstChild);
  }
  const cb=document.getElementById('moveYieldAvgCb');
  if(cb&&!cb.dataset.bound){
    cb.dataset.bound='1';
    cb.checked=typeof getMoveShowYieldAvg==='function'?getMoveShowYieldAvg():false;
    cb.addEventListener('change',()=>setMoveShowYieldAvg(!!cb.checked));
  }else if(cb){
    cb.checked=typeof getMoveShowYieldAvg==='function'?getMoveShowYieldAvg():false;
  }
  const ser=histories['USA-move']||[];
  // full history — no artificial trim
  const show=ser.slice();
  const mv=(data.USA&&data.USA.move)||{};
  const valEl=document.getElementById('moveValue');
  const dateEl=document.getElementById('moveDate');
  const cards=document.getElementById('moveCards');
  const host=document.getElementById('moveChart');
  const meta=document.getElementById('moveMeta');
  const last=show.length?show.at(-1):null;
  if(valEl)valEl.textContent=last?fmt(last.value):(mv.value!=null?fmt(mv.value):'—');
  if(dateEl){
    const ts=mv.updatedAt?mv.updatedAt.replace('T',' ').slice(0,16)+' UTC':'';
    dateEl.textContent=(last?('Stand '+last.period):(mv.date?('Stand '+mv.date):'—'))+(ts?(' · '+ts):'')+' · bp ann.';
  }
  const showAvg=typeof getMoveShowYieldAvg==='function'?getMoveShowYieldAvg():false;
  let yAvg=[];
  if(showAvg&&typeof buildUsYieldAvgSeries==='function'){
    yAvg=buildUsYieldAvgSeries();
  }
  if(cards){
    const p=mv.pctChange,a=mv.absChange;
    const yLast=yAvg.length?yAvg.at(-1):null;
    cards.innerHTML=
      '<span style="color:#4a9eed"><b>MOVE</b> '+(last?fmt(last.value):'—')+' bp</span>'+
      '<span><b>Δ</b> '+(a!=null?((a>=0?'+':'')+fmt(a)):'—')+'</span>'+
      '<span><b>Δ %</b> '+(p!=null?((p>=0?'+':'')+fmt(p)+' %'):'—')+'</span>'+
      (showAvg?('<span style="color:#e74c3c"><b>Ø Yld</b> '+(yLast?fmt(yLast.value)+' %':'—')+'</span>'):'')+
      '<span><b>Punkte</b> '+show.length+(show.length&&show[0]?' ab '+show[0].period:'')+'</span>';
  }
  if(host){
    if(!show.length)host.innerHTML='<div class="sparkempty">Keine MOVE-Daten</div>';
    else if(typeof renderMoveYieldChart==='function'){
      host.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|moveDual|MOVE'+(showAvg?' + Ø Yld':'')+'" title="Chart vergrößern">'+renderMoveYieldChart(show,showAvg?yAvg:[],{w:360,h:180})+'</div>';
    }else{
      host.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|move|MOVE Index" title="Chart vergrößern">'+renderLineChart(show,{w:360,h:160})+'</div>';
    }
  }
  if(meta){
    meta.textContent=(mv.source||'Yahoo ^MOVE')+' · '+show.length+' Tage'+(show[0]?(' ab '+show[0].period):'')+(showAvg?' · rot: Ø 3M/1Y/2Y/5Y/10Y/30Y':'')+' · duale Achse bei Overlay';
  }
}
`;

  if (end > start) {
    html = html.slice(0, start) + newFn + '\n' + html.slice(end);
    console.log('paintMove replaced');
  }
}

// paintChartDlg support for moveDual
if (html.includes('function paintChartDlg') && !html.includes("key==='moveDual'")) {
  const needle = "if(key==='sofrFwd'){";
  const ins = `
  if(key==='moveDual'&&typeof renderMoveYieldChart==='function'){
    let move=histories['USA-move']||[];
    const range=chartCtx.range||'3y';
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
    const rLabel={'6m':'6 Monate','1y':'1 Jahr','3y':'3 Jahre'}[range]||range;
    if(meta)meta.textContent='MOVE blau · '+(yAvg.length?'Ø Rendite rot · ':'')+rLabel+' · '+move.length+' Punkte';
    return;
  }
`;
  if (html.includes(needle)) {
    html = html.replace(needle, ins + needle);
    console.log('paintChartDlg moveDual');
  }
}

// ensure move is not treated as pure curve without range when dual
// page 6 paint hook already exists via setUsaPage

fs.writeFileSync('index.html', html);
console.log('done', html.length, 'renderMove', html.includes('function renderMoveYieldChart'), 'paintMove', html.includes('function paintMove'));
