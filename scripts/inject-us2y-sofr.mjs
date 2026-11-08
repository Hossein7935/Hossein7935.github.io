import fs from 'fs';

/** USA page 3: dual US 2Y (blue) + SOFR (red) — no rate-diff checkboxes; enlarge supports 6m/1y/3y */
let html = fs.readFileSync('index.html', 'utf8');

if (!html.includes('function renderUs2ySofrChart')) {
  const fn = `
function renderUs2ySofrChart(us2y,sofr,opts){
  opts=opts||{};
  const w=opts.w||360,h=opts.h||(opts.big?300:160);
  const um=new Map((us2y||[]).map(p=>[p.period,Number(p.value)]));
  const sm=new Map((sofr||[]).map(p=>[p.period,Number(p.value)]));
  let dates=[...new Set([...um.keys(),...sm.keys()])].sort();
  if(!opts.big && dates.length>1000) dates=dates.slice(-1000);
  if(opts.big && dates.length>2000) dates=dates.slice(-2000);
  const vals=[];
  for(const d of dates){
    const a=um.get(d),b=sm.get(d);
    if(Number.isFinite(a))vals.push(a);
    if(Number.isFinite(b))vals.push(b);
  }
  if(vals.length<2)return '<div class="sparkempty">Keine Daten</div>';
  let min=Math.min(...vals),max=Math.max(...vals);
  const pad=(max-min)*0.12||0.1;min-=pad;max+=pad;
  const l=opts.big?36:28,r=10,t=14,b=28,iw=w-l-r,ih=h-t-b;
  const xAt=i=>l+(dates.length===1?iw/2:(i/(dates.length-1))*iw);
  const yAt=v=>t+ih-((v-min)/(max-min||1))*ih;
  function pathOf(map){
    const pts=[];
    dates.forEach((d,i)=>{const v=map.get(d);if(Number.isFinite(v))pts.push([xAt(i),yAt(v),d,v]);});
    if(pts.length<2)return {d:'',dots:pts};
    return {d:'M'+pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' L'),dots:pts};
  }
  const pu=pathOf(um), ps=pathOf(sm);
  const labelIdx=[0,Math.floor(dates.length/2),dates.length-1].filter((v,i,a)=>a.indexOf(v)===i);
  const xLabs=labelIdx.map(i=>'<text x="'+xAt(i).toFixed(1)+'" y="'+(h-6)+'" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.65">'+String(dates[i]).slice(0,7)+'</text>').join('');
  const yLabs=[max,(max+min)/2,min].map(v=>{
    const y=yAt(v);
    return '<text x="4" y="'+(y+3).toFixed(1)+'" font-size="9" fill="currentColor" opacity="0.55">'+Number(v).toFixed(2)+'</text>';
  }).join('');
  const step=Math.max(1,Math.floor(dates.length/120));
  const hits=[];
  dates.forEach((d,i)=>{
    if(i%step&&i!==dates.length-1)return;
    const uv=um.get(d),sv=sm.get(d);
    if(Number.isFinite(uv)) hits.push('<circle class="hit" cx="'+xAt(i).toFixed(1)+'" cy="'+yAt(uv).toFixed(1)+'" r="'+(opts.big?12:8)+'" fill="transparent" data-period="'+d+' US2Y" data-value="'+Number(uv).toFixed(2)+'"/>');
    if(Number.isFinite(sv)) hits.push('<circle class="hit" cx="'+xAt(i).toFixed(1)+'" cy="'+yAt(sv).toFixed(1)+'" r="'+(opts.big?12:8)+'" fill="transparent" data-period="'+d+' SOFR" data-value="'+Number(sv).toFixed(2)+'"/>');
  });
  return '<svg class="chart-hover" viewBox="0 0 '+w+' '+h+'" width="'+w+'" height="'+h+'" style="max-width:100%;height:auto;cursor:crosshair" role="img">'+
    '<line x1="'+l+'" y1="'+t+'" x2="'+l+'" y2="'+(t+ih)+'" stroke="currentColor" opacity="0.12"/>'+
    '<line x1="'+l+'" y1="'+(t+ih)+'" x2="'+(l+iw)+'" y2="'+(t+ih)+'" stroke="currentColor" opacity="0.12"/>'+
    yLabs+xLabs+
    (pu.d?'<path d="'+pu.d+'" fill="none" stroke="#4a9eed" stroke-width="'+(opts.big?2.6:2.1)+'"/>':'')+
    (ps.d?'<path d="'+ps.d+'" fill="none" stroke="#e74c3c" stroke-width="'+(opts.big?2.6:2.1)+'"/>':'')+
    hits.join('')+
    '<text x="'+(l+4)+'" y="12" font-size="10" fill="#4a9eed">US 2Y</text>'+
    '<text x="'+(l+60)+'" y="12" font-size="10" fill="#e74c3c">SOFR</text>'+
    '</svg>';
}
function paintUs2ySofr(){
  const faceC=document.querySelector('.usa-face-c');
  if(!faceC)return;
  if(!document.getElementById('us2ySofrPanel')){
    const box=document.createElement('div');
    box.innerHTML=
      '<div class="metric has-chart sofr-fwd-panel" id="us2ySofrPanel">'+
        '<div class="name">US 2Y (blau) · SOFR (rot)</div>'+
        '<div class="value" id="us2ySofrValue">—</div>'+
        '<div class="date" id="us2ySofrDate">ohne Differenz-Funktion</div>'+
        '<div class="sofr-fwd-bp" id="us2ySofrCards"></div>'+
        '<div id="us2ySofrChart"></div>'+
        '<div class="sofr-fwd-meta" id="us2ySofrMeta">FRED DGS2 + SOFR · nicht in Δ-Auswahl</div>'+
      '</div>';
    const diff=document.getElementById('rateDiffPanel');
    if(diff&&diff.parentNode===faceC) diff.insertAdjacentElement('afterend', box.firstChild);
    else while(box.firstChild) faceC.appendChild(box.firstChild);
  }
  const meta=(data.USA&&data.USA.us2ySofr)||{};
  const us2y=histories['USA-us2y']||[];
  const sofr=histories['USA-sofr']||[];
  const valEl=document.getElementById('us2ySofrValue');
  const dateEl=document.getElementById('us2ySofrDate');
  const cards=document.getElementById('us2ySofrCards');
  const host=document.getElementById('us2ySofrChart');
  const metaEl=document.getElementById('us2ySofrMeta');
  if(valEl){
    const a=meta.us2y!=null?fmt(meta.us2y):(us2y.length?fmt(us2y.at(-1).value):'—');
    const b=meta.sofr!=null?fmt(meta.sofr):(sofr.length?fmt(sofr.at(-1).value):'—');
    valEl.innerHTML='<span style="color:#4a9eed">'+a+'</span> · <span style="color:#e74c3c">'+b+'</span>';
  }
  if(dateEl){
    dateEl.textContent='2Y '+(meta.us2yDate||(us2y.at(-1)||{}).period||'—')+' · SOFR '+(meta.sofrDate||(sofr.at(-1)||{}).period||'—')+' · ohne Diff-Kästchen';
  }
  if(cards){
    cards.innerHTML=
      '<span style="color:#4a9eed"><b>US 2Y</b> '+(meta.us2y!=null?fmt(meta.us2y)+' %':'—')+'</span>'+
      '<span style="color:#e74c3c"><b>SOFR</b> '+(meta.sofr!=null?fmt(meta.sofr)+' %':'—')+'</span>'+
      '<span><b>Spread</b> '+(meta.spread!=null?((meta.spread>=0?'+':'')+fmt(meta.spread)+' pp'):'—')+'</span>';
  }
  if(host){
    if(!us2y.length&&!sofr.length)host.innerHTML='<div class="sparkempty">Keine Daten</div>';
    else host.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|us2ySofrDual|US 2Y + SOFR" title="Chart vergrößern">'+renderUs2ySofrChart(us2y,sofr,{w:360,h:160})+'</div>';
  }
  if(metaEl)metaEl.textContent=(meta.source||'FRED DGS2 + SOFR')+' · '+(meta.us2yPoints||us2y.length)+' / '+(meta.sofrPoints||sofr.length)+' Punkte · nicht in der Differenz-Funktion';
}
`;
  const idx = html.lastIndexOf('bindUsaPages();');
  if (idx >= 0) {
    html = html.slice(0, idx) + fn + '\n' + html.slice(idx);
    console.log('paintUs2ySofr injected');
  }
}

if (!html.includes("typeof paintUs2ySofr==='function'&&paintUs2ySofr()")) {
  html = html.replace(
    /typeof paintRateDiff==='function'&&paintRateDiff\(\)/g,
    "typeof paintRateDiff==='function'&&paintRateDiff();typeof paintUs2ySofr==='function'&&paintUs2ySofr()"
  );
  console.log('paintUs2ySofr hooked');
}

// Dialog branch with range support — do NOT add to isCurve (range bar must stay visible)
if (html.includes('function paintChartDlg') && !html.includes("key==='us2ySofrDual'")) {
  if (html.includes("key==='iorbUs1yDual'")) {
    html = html.replace(
      "if(key==='iorbUs1yDual'",
      `if(key==='us2ySofrDual'&&typeof renderUs2ySofrChart==='function'){\n    let us2y=histories['USA-us2y']||[];\n    let sofr=histories['USA-sofr']||[];\n    const range=chartCtx.range||'3y';\n    if(typeof filterByRange==='function'){const u2=filterByRange(us2y,range);if(u2.length)us2y=u2;const s2=filterByRange(sofr,range);if(s2.length)sofr=s2;}\n    if(!us2y.length&&!sofr.length){body.innerHTML='<div class="sparkempty">Keine Daten</div>';if(meta)meta.textContent='';return;}\n    body.innerHTML=renderUs2ySofrChart(us2y,sofr,{w:720,h:320,big:true})+'<div class="chart-tip-inline" id="chartDlgTip"></div>';\n    bindBigChartHover(body);\n    const rLabel={'6m':'6 Monate','1y':'1 Jahr','3y':'3 Jahre'}[range]||range;\n    if(meta)meta.textContent='US 2Y blau · SOFR rot · '+rLabel+' · Crosshair · '+(us2y.length)+'/'+(sofr.length)+' Punkte';\n    return;\n  }\n  if(key==='iorbUs1yDual'`
    );
    console.log('dlg us2ySofr with range');
  }
}

if (!html.includes("'us2ySofrDual'")) {
  html = html.replace(/ALL_KEYS=\[([^\]]+)\]/, (m, inner) => {
    if (inner.includes('us2ySofrDual')) return m;
    return `ALL_KEYS=[${inner},'us2y','us2ySofrDual']`;
  });
}
if (!html.includes('us2ySofrDual:')) {
  html = html.replace(/extraLabels=\{([^}]*)\}/, (m, inner) => {
    if (inner.includes('us2ySofrDual')) return m;
    return `extraLabels={${inner},us2y:'US 2Y',us2ySofrDual:'US 2Y + SOFR'}`;
  });
}

fs.writeFileSync('index.html', html);
console.log('done', html.length, 'paint', html.includes('function paintUs2ySofr'), 'call', html.includes('paintUs2ySofr()'));
