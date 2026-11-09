import fs from 'fs';

/** USA page 1 (face-a): DXY panel with full history */
let html = fs.readFileSync('index.html', 'utf8');

if (!html.includes('function paintDxy')) {
  const fn = `
function paintDxy(){
  const faceA=document.querySelector('.usa-face-a');
  if(!faceA)return;
  if(!document.getElementById('dxyPanel')){
    const box=document.createElement('div');
    box.innerHTML=
      '<div class="metric has-chart" id="dxyPanel" style="grid-column:1/-1">'+
        '<div class="name">DXY · US Dollar Index</div>'+
        '<div class="value" id="dxyValue">—</div>'+
        '<div class="date" id="dxyDate">Yahoo DX-Y.NYB</div>'+
        '<div class="sofr-fwd-bp" id="dxyCards"></div>'+
        '<div id="dxyChart"></div>'+
        '<div class="sofr-fwd-meta" id="dxyMeta">ICE USD Index · volle Historie</div>'+
      '</div>';
    faceA.appendChild(box.firstChild);
  }
  const ser=histories['USA-dxy']||[];
  const dx=(data.USA&&data.USA.dxy)||{};
  const valEl=document.getElementById('dxyValue');
  const dateEl=document.getElementById('dxyDate');
  const cards=document.getElementById('dxyCards');
  const host=document.getElementById('dxyChart');
  const meta=document.getElementById('dxyMeta');
  const last=ser.length?ser.at(-1):null;
  if(valEl)valEl.textContent=last?fmt(last.value):(dx.value!=null?fmt(dx.value):'—');
  if(dateEl){
    const ts=dx.updatedAt?dx.updatedAt.replace('T',' ').slice(0,16)+' UTC':'';
    dateEl.textContent=(last?('Stand '+last.period):(dx.date?('Stand '+dx.date):'—'))+(ts?(' · '+ts):'');
  }
  if(cards){
    const p=dx.pctChange,a=dx.absChange;
    cards.innerHTML=
      '<span><b>Δ</b> '+(a!=null?((a>=0?'+':'')+fmt(a)):'—')+'</span>'+
      '<span><b>Δ %</b> '+(p!=null?((p>=0?'+':'')+fmt(p)+' %'):'—')+'</span>'+
      '<span><b>Punkte</b> '+(dx.points||ser.length)+(ser[0]?(' ab '+ser[0].period):'')+'</span>';
  }
  if(host){
    if(!ser.length)host.innerHTML='<div class="sparkempty">Keine DXY-Daten</div>';
    else if(typeof renderLineChart==='function'){
      host.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|dxy|DXY" title="Chart vergrößern">'+renderLineChart(ser,{w:360,h:160})+'</div>';
    }
  }
  if(meta)meta.textContent=(dx.source||'Yahoo DXY')+' · '+(ser.length)+' Tage'+(ser[0]?(' ab '+ser[0].period):'')+' · USD-Korb';
}
`;
  if (html.includes('function bindUsaPages')) {
    html = html.replace('function bindUsaPages', fn + '\nfunction bindUsaPages');
    console.log('paintDxy inserted');
  } else if (html.includes('bindUsaPages();')) {
    html = html.replace('bindUsaPages();', fn + '\nbindUsaPages();');
  }
}

// Always ensure page-0 call in setUsaPage
if (!html.includes('typeof paintDxy===\'function\'&&paintDxy()') && !html.includes("typeof paintDxy==='function'&&paintDxy()")) {
  // noop - check below with simpler includes
}
if (!html.includes("page===0)setTimeout(()=>{try{typeof paintDxy")) {
  if (html.includes('if(page===1)setTimeout')) {
    html = html.replace(
      'if(page===1)setTimeout',
      "if(page===0)setTimeout(()=>{try{typeof paintDxy==='function'&&paintDxy()}catch(e){}},50);\n  if(page===1)setTimeout"
    );
    console.log('page0 paintDxy hooked');
  }
}

if (html.includes('faceB.after(faceC)') && !html.includes("faceB.after(faceC);try{typeof paintDxy")) {
  html = html.replace(
    'faceB.after(faceC);',
    "faceB.after(faceC);try{typeof paintDxy==='function'&&paintDxy()}catch(e){}"
  );
  console.log('faceC after paintDxy');
}

if (!html.includes("'dxy'")) {
  html = html.replace(/ALL_KEYS=\[([^\]]+)\]/, (m, inner) => {
    if (inner.includes("'dxy'")) return m;
    return `ALL_KEYS=[${inner},'dxy']`;
  });
}
if (!html.includes('dxy:')) {
  html = html.replace(/extraLabels=\{([^}]*)\}/, (m, inner) => {
    if (inner.includes('dxy:')) return m;
    return `extraLabels={${inner},dxy:'DXY'}`;
  });
}

fs.writeFileSync('index.html', html);
console.log(
  'done',
  html.length,
  'paintDxy',
  html.includes('function paintDxy'),
  'page0',
  html.includes('page===0') && html.includes('paintDxy')
);
