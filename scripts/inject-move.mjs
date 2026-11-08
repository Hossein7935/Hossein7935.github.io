import fs from 'fs';

/** Add MOVE Index panel to USA page 6 (faceF) */
let html = fs.readFileSync('index.html', 'utf8');

if (!html.includes('function paintMove')) {
  const fn = `
function paintMove(){
  let faceF=document.querySelector('.usa-face-f');
  const pageNow=(()=>{try{return Number(localStorage.getItem('macrowatch-usa-page')||0)}catch(e){return 0}})();
  if(!faceF){
    try{typeof paintIorbUs1y==='function'&&paintIorbUs1y()}catch(e){}
    faceF=document.querySelector('.usa-face-f');
  }
  if(!faceF)return;
  if(pageNow===5)faceF.classList.remove('hidden');
  if(!document.getElementById('movePanel')){
    const box=document.createElement('div');
    box.innerHTML=
      '<div class="metric has-chart sofr-fwd-panel" id="movePanel">'+
        '<div class="name">MOVE Index · Bond Volatility</div>'+
        '<div class="value" id="moveValue">—</div>'+
        '<div class="date" id="moveDate">ICE BofA · Treasury options IV</div>'+
        '<div class="sofr-fwd-bp" id="moveCards"></div>'+
        '<div id="moveChart"></div>'+
        '<div class="sofr-fwd-meta" id="moveMeta">Yahoo ^MOVE · Historie ab 2002 · Klick = Crosshair</div>'+
      '</div>';
    while(box.firstChild) faceF.appendChild(box.firstChild);
  }
  const mv=(data.USA&&data.USA.move)||{};
  const ser=histories['USA-move']||[];
  // show long history in small chart (sample last ~15y for performance if huge)
  const show=ser.length>4000?ser.slice(-3800):ser;
  const valEl=document.getElementById('moveValue');
  const dateEl=document.getElementById('moveDate');
  const cards=document.getElementById('moveCards');
  const host=document.getElementById('moveChart');
  const meta=document.getElementById('moveMeta');
  if(valEl)valEl.textContent=mv.value!=null?fmt(mv.value):'—';
  if(dateEl){
    const ts=mv.updatedAt?mv.updatedAt.replace('T',' ').slice(0,16)+' UTC':'';
    dateEl.textContent=(mv.date?('Stand '+mv.date):'—')+(ts?(' · '+ts):'')+' · bp ann.';
  }
  if(cards){
    const p=mv.pctChange,a=mv.absChange;
    cards.innerHTML=
      '<span><b>Δ</b> '+(a!=null?((a>=0?'+':'')+fmt(a)):'—')+'</span>'+
      '<span><b>Δ %</b> '+(p!=null?((p>=0?'+':'')+fmt(p)+' %'):'—')+'</span>'+
      '<span><b>Punkte</b> '+(mv.points||ser.length)+'</span>';
  }
  if(host){
    if(!show.length)host.innerHTML='<div class="sparkempty">Keine MOVE-Daten</div>';
    else host.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|move|MOVE Index" title="Chart vergrößern">'+renderLineChart(show,{w:360,h:160})+'</div>';
  }
  if(meta)meta.textContent=(mv.source||'Yahoo ^MOVE')+' · '+(mv.points||ser.length)+' Handelstage ab 2002 · implizite Treasury-Volatilität';
}
`;
  const idx = html.lastIndexOf('bindUsaPages();');
  if (idx >= 0) {
    html = html.slice(0, idx) + fn + '\n' + html.slice(idx);
    console.log('paintMove injected');
  }
}

// call with page 6 paints
if (!html.includes("typeof paintMove==='function'&&paintMove()")) {
  if (html.includes('paintIorbUs1y()')) {
    html = html.replace(
      /typeof paintIorbUs1y==='function'&&paintIorbUs1y\(\)/g,
      "typeof paintIorbUs1y==='function'&&paintIorbUs1y();typeof paintMove==='function'&&paintMove()"
    );
    console.log('paintMove call hooked');
  } else if (html.includes('if(page===5)')) {
    html = html.replace(
      /if\(page===5\)setTimeout\(\(\)=>\{try\{typeof paintIorbUs1y==='function'&&paintIorbUs1y\(\)\}catch\(e\)\{\}\},50\);/,
      "if(page===5)setTimeout(()=>{try{typeof paintIorbUs1y==='function'&&paintIorbUs1y()}catch(e){};try{typeof paintMove==='function'&&paintMove()}catch(e){}},50);"
    );
  }
}

if (!html.includes("'move'")) {
  html = html.replace(/ALL_KEYS=\[([^\]]+)\]/, (m, inner) => {
    if (inner.includes("'move'")) return m;
    return `ALL_KEYS=[${inner},'move']`;
  });
}
if (!html.includes('move:')) {
  html = html.replace(/extraLabels=\{([^}]*)\}/, (m, inner) => {
    if (inner.includes('move:')) return m;
    return `extraLabels={${inner},move:'MOVE Index'}`;
  });
}

fs.writeFileSync('index.html', html);
console.log('done', html.length, 'paintMove', html.includes('function paintMove'), 'call', html.includes('paintMove()'));
