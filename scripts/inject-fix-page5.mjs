import fs from 'fs';

/** Fix page 5: faceE was created with class "hidden" and never shown */
let html = fs.readFileSync('index.html', 'utf8');

// Replace paintFhlb faceE creation + ensure visible when page is 4
const newPaintFhlbStart = `function paintFhlb(){
  let faceE=document.querySelector('.usa-face-e');
  const pageNow=(()=>{try{return Number(localStorage.getItem('macrowatch-usa-page')||0)}catch(e){return 0}})();
  if(!faceE){
    const card=[...document.querySelectorAll('.country')].find(c=>c.querySelector('.usa-face-d')||c.querySelector('.usa-face-a'));
    if(card){
      faceE=document.createElement('div');
      faceE.className='metrics usa-face usa-face-e'+(pageNow===4?'':' hidden');
      faceE.innerHTML='<div class="metric has-chart sofr-fwd-panel" id="fhlbPanel"><div class="name">Federal Home Loan Banks · Advances Outstanding</div><div class="value" id="fhlbValue">—</div><div class="date" id="fhlbDate">—</div><div class="sofr-fwd-bp" id="fhlbCards"></div><div id="fhlbAbsChart"></div><div class="sofr-fwd-meta" id="fhlbMeta"></div></div><div class="metric has-chart sofr-fwd-panel" id="fhlbChgPanel"><div class="name">Veränderung · QoQ / YoY</div><div class="value" id="fhlbChgValue">—</div><div class="date"><button type="button" class="fhlb-mode active" data-mode="qoq">QoQ</button> <button type="button" class="fhlb-mode" data-mode="yoy">YoY</button></div><div id="fhlbChgChart"></div><div class="sofr-fwd-meta" id="fhlbChgMeta"></div></div><div class="metric sofr-fwd-panel" id="fhlbNotePanel"><div class="name">Kurzanalyse</div><div class="date" id="fhlbNote" style="white-space:normal;line-height:1.45"></div></div>';
      const d=card.querySelector('.usa-face-d');
      if(d)d.after(faceE); else card.appendChild(faceE);
    }
  }
  if(faceE&&pageNow===4)faceE.classList.remove('hidden');
`;

if (html.includes('function paintFhlb')) {
  const start = html.indexOf('function paintFhlb');
  // cut until first real data fill: const fh=
  const mid = html.indexOf('const fh=(data.USA&&data.USA.fhlbAdv)', start);
  if (start >= 0 && mid > start) {
    html = html.slice(0, start) + newPaintFhlbStart + '\n  ' + html.slice(mid);
    console.log('paintFhlb head replaced');
  } else {
    console.warn('paintFhlb structure unexpected');
  }
}

// Replace paintEffrVol to force show faceE and robust append
const newPaintEffr = `function paintEffrVol(){
  let faceE=document.querySelector('.usa-face-e');
  const pageNow=(()=>{try{return Number(localStorage.getItem('macrowatch-usa-page')||0)}catch(e){return 0}})();
  if(!faceE){
    try{typeof paintFhlb==='function'&&paintFhlb()}catch(e){}
    faceE=document.querySelector('.usa-face-e');
  }
  if(!faceE)return;
  if(pageNow===4)faceE.classList.remove('hidden');
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
      '</div>'+
      '<div class="metric has-chart sofr-fwd-panel" id="effrVolChgPanel">'+
        '<div class="name">Tagesveränderung Volumen %</div>'+
        '<div class="value" id="effrVolChgValue">—</div>'+
        '<div class="date" id="effrVolChgDate">vs. vorheriger Handelstag</div>'+
        '<div id="effrVolChgChart"></div>'+
        '<div class="sofr-fwd-meta" id="effrVolChgMeta"></div>'+
      '</div>'+
      '<div class="metric has-chart sofr-fwd-panel" id="effrRatePanel">'+
        '<div class="name">EFFR Zinssatz (Vergleich)</div>'+
        '<div class="value" id="effrRateValue">—</div>'+
        '<div class="date" id="effrRateDate">Effective Federal Funds Rate</div>'+
        '<div id="effrRateChart"></div>'+
        '<div class="sofr-fwd-meta">Gemeinsam mit Volumen betrachten: Rate vs. Aktivität</div>'+
      '</div>';
    while(box.firstChild) faceE.appendChild(box.firstChild);
  }
  const ev=(data.USA&&data.USA.effrVol)||{};
  const vol=histories['USA-effrVol']||[];
  const chg=histories['USA-effrVolChg']||[];
  const rate=histories['USA-effr']||[];
  const volShow=vol.length>1600?vol.slice(-1300):vol;
  const chgShow=chg.length>1600?chg.slice(-800):chg;
  const rateShow=rate.length>1600?rate.slice(-1300):rate;
  const valEl=document.getElementById('effrVolValue');
  const dateEl=document.getElementById('effrVolDate');
  const cards=document.getElementById('effrVolCards');
  const host=document.getElementById('effrVolChart');
  const meta=document.getElementById('effrVolMeta');
  const chgVal=document.getElementById('effrVolChgValue');
  const chgHost=document.getElementById('effrVolChgChart');
  const chgMeta=document.getElementById('effrVolChgMeta');
  const rateVal=document.getElementById('effrRateValue');
  const rateDate=document.getElementById('effrRateDate');
  const rateHost=document.getElementById('effrRateChart');
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
  if(chgVal)chgVal.textContent=ev.pctChange!=null?((ev.pctChange>=0?'+':'')+fmt(ev.pctChange)+' %'):'—';
  if(chgHost){
    if(!chgShow.length)chgHost.innerHTML='<div class="sparkempty">Keine Veränderung</div>';
    else chgHost.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|effrVolChg|Fed Funds Vol Δ%" title="Chart vergrößern">'+renderLineChart(chgShow,{w:360,h:130})+'</div>';
  }
  if(chgMeta)chgMeta.textContent=ev.alertNote||'Tagesveränderung zum vorherigen verfügbaren Handelstag.';
  if(rateVal)rateVal.textContent=ev.effr!=null?fmt(ev.effr)+' %':(rateShow.length?fmt(rateShow.at(-1).value)+' %':'—');
  if(rateDate)rateDate.textContent=ev.effrDate?('Stand '+ev.effrDate):'Effective Federal Funds Rate';
  if(rateHost){
    if(!rateShow.length)rateHost.innerHTML='<div class="sparkempty">Keine EFFR-Daten</div>';
    else rateHost.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|effr|EFFR" title="Chart vergrößern">'+renderLineChart(rateShow,{w:360,h:130})+'</div>';
  }
}
`;

if (html.includes('function paintEffrVol')) {
  const start = html.indexOf('function paintEffrVol');
  let end = html.indexOf('\nfunction ', start + 10);
  if (end < 0) end = html.indexOf('\nlet _fhlbMode', start);
  // find end of function - next top-level function after paintEffrVol body
  // Prefer next "function " at line start after a large chunk
  const candidates = ['\nfunction paintFhlb', '\nfunction bindUsaPages', '\nfunction openChart', '\nbindUsaPages'];
  end = -1;
  for (const c of ['\nfunction bindUsaPages', '\nbindUsaPages();', '\nfunction openEdit']) {
    const i = html.indexOf(c, start + 50);
    if (i > start && (end < 0 || i < end)) end = i;
  }
  if (start >= 0 && end > start) {
    html = html.slice(0, start) + newPaintEffr + '\n' + html.slice(end);
    console.log('paintEffrVol replaced');
  } else {
    console.warn('could not bound paintEffrVol', start, end);
  }
}

// Ensure setUsaPage calls both paints and removes hidden on e
if (html.includes("if(e)e.classList.toggle('hidden',page!==4)") && !html.includes('paintEffrVol()')) {
  html = html.replace(
    /if\(page===4\)setTimeout\([^;]+;/, 
    "if(page===4)setTimeout(()=>{try{typeof paintFhlb==='function'&&paintFhlb()}catch(e){};try{typeof paintEffrVol==='function'&&paintEffrVol()}catch(e){}},50);"
  );
}
// Stronger: always ensure call string exists near page===4
if (!html.includes("typeof paintEffrVol==='function'&&paintEffrVol()")) {
  html = html.replace(
    /if\(page===4\)setTimeout\(\(\)=>\{try\{typeof paintFhlb==='function'&&paintFhlb\(\)\}catch\(e\)\{\}\},50\);/,
    "if(page===4)setTimeout(()=>{try{typeof paintFhlb==='function'&&paintFhlb()}catch(e){};try{typeof paintEffrVol==='function'&&paintEffrVol()}catch(e){}},50);"
  );
}

fs.writeFileSync('index.html', html);
console.log('done', html.length, 'unhide', html.includes('pageNow===4'), 'effr append', html.includes("faceE.appendChild(box.firstChild)"));
