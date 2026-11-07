import fs from 'fs';

/** Add Federal Funds Market Volume panel only (no daily-chg / EFFR charts) to USA page 5 */
let html = fs.readFileSync('index.html', 'utf8');

if (!html.includes('.effrvol-alert')) {
  const css =
    '.effrvol-alert{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;margin-left:6px}' +
    '.effrvol-alert.normal{background:rgba(116,212,196,.2);color:var(--accent)}' +
    '.effrvol-alert.watch{background:rgba(255,193,7,.2);color:#e6a700}' +
    '.effrvol-alert.high{background:rgba(231,76,60,.2);color:#e74c3c}';
  html = html.replace('</style>', css + '</style>');
}

const fn = `
function paintEffrVol(){
  let faceE=document.querySelector('.usa-face-e');
  const pageNow=(()=>{try{return Number(localStorage.getItem('macrowatch-usa-page')||0)}catch(e){return 0}})();
  if(!faceE){
    try{typeof paintFhlb==='function'&&paintFhlb()}catch(e){}
    faceE=document.querySelector('.usa-face-e');
  }
  if(!faceE)return;
  if(pageNow===4)faceE.classList.remove('hidden');
  ['effrVolChgPanel','effrRatePanel'].forEach(id=>{const el=document.getElementById(id);if(el)el.remove();});
  if(!document.getElementById('effrVolPanel')){
    const box=document.createElement('div');
    box.innerHTML=
      '<div class="metric has-chart sofr-fwd-panel" id="effrVolPanel">'+
        '<div class="name">Federal Funds Market · Daily Volume</div>'+
        '<div class="value" id="effrVolValue">—</div>'+
        '<div class="date" id="effrVolDate">—</div>'+
        '<div class="sofr-fwd-bp" id="effrVolCards"></div>'+
        '<div id="effrVolChart"></div>'+
        '<div class="sofr-fwd-meta" id="effrVolMeta">FRED EFFRVOL · NY Fed</div>'+
      '</div>';
    while(box.firstChild) faceE.appendChild(box.firstChild);
  }
  const ev=(data.USA&&data.USA.effrVol)||{};
  const vol=histories['USA-effrVol']||[];
  const volShow=vol.length>1600?vol.slice(-1300):vol;
  const valEl=document.getElementById('effrVolValue');
  const dateEl=document.getElementById('effrVolDate');
  const cards=document.getElementById('effrVolCards');
  const host=document.getElementById('effrVolChart');
  const meta=document.getElementById('effrVolMeta');
  if(valEl){
    const badge=ev.alert?('<span class="effrvol-alert '+ev.alert+'">'+(ev.alert==='high'?'Auffällig':ev.alert==='watch'?'Beobachten':'Normal')+'</span>'):'';
    valEl.innerHTML=(ev.value!=null?fmt(ev.value):'—')+badge;
  }
  if(dateEl){
    const ts=ev.updatedAt?ev.updatedAt.replace('T',' ').slice(0,16)+' UTC':'';
    dateEl.textContent=(ev.date?('Handelstag '+ev.date):'—')+(ts?(' · Abruf '+ts):'')+' · Mrd. USD';
  }
  if(cards){
    const p=ev.pctChange,a=ev.absChange;
    cards.innerHTML=
      '<span><b>Δ %</b> '+(p!=null?((p>=0?'+':'')+fmt(p)+' %'):'—')+'</span>'+
      '<span><b>Δ abs</b> '+(a!=null?((a>=0?'+':'')+fmt(a)+' Mrd.'):'—')+'</span>'+
      '<span><b>Vortag</b> '+(ev.prevValue!=null?fmt(ev.prevValue)+' Mrd.':'—')+'</span>';
  }
  if(host){
    if(!volShow.length)host.innerHTML='<div class="sparkempty">Keine Volumendaten</div>';
    else host.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|effrVol|Fed Funds Volume" title="Chart vergrößern">'+renderLineChart(volShow,{w:360,h:150})+'</div>';
  }
  if(meta)meta.textContent=(ev.source||'FRED EFFRVOL')+' · '+(ev.points||vol.length)+' Handelstage';
}
`;

if (html.includes('function paintEffrVol')) {
  const start = html.indexOf('function paintEffrVol');
  let end = -1;
  for (const c of ['\nfunction bindUsaPages', '\nbindUsaPages();', '\nfunction paintFhlb']) {
    const i = html.indexOf(c, start + 50);
    if (i > start && (end < 0 || i < end)) end = i;
  }
  if (start >= 0 && end > start) {
    html = html.slice(0, start) + fn + '\n' + html.slice(end);
    console.log('paintEffrVol replaced');
  }
} else {
  const idx = html.lastIndexOf('bindUsaPages();');
  if (idx >= 0) {
    html = html.slice(0, idx) + fn + '\n' + html.slice(idx);
    console.log('paintEffrVol inserted');
  }
}

if (!html.includes("typeof paintEffrVol==='function'&&paintEffrVol()")) {
  html = html.replace(
    /if\(page===4\)setTimeout\(\(\)=>\{try\{typeof paintFhlb==='function'&&paintFhlb\(\)\}catch\(e\)\{\}\},50\);/,
    "if(page===4)setTimeout(()=>{try{typeof paintFhlb==='function'&&paintFhlb()}catch(e){};try{typeof paintEffrVol==='function'&&paintEffrVol()}catch(e){}},50);"
  );
}

if (!html.includes("'effrVol'")) {
  html = html.replace(/ALL_KEYS=\[([^\]]+)\]/, (m, inner) => {
    if (inner.includes('effrVol')) return m;
    return `ALL_KEYS=[${inner},'effrVol']`;
  });
}
if (!html.includes('effrVol:')) {
  html = html.replace(/extraLabels=\{([^}]*)\}/, (m, inner) => {
    if (inner.includes('effrVol')) return m;
    return `extraLabels={${inner},effrVol:'Fed Funds Volume'}`;
  });
}

fs.writeFileSync('index.html', html);
console.log('done', html.length, 'paintEffrVol', html.includes('function paintEffrVol'));
