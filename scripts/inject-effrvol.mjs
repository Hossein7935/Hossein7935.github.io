import fs from 'fs';

/** Add Federal Funds Market Volume panels to USA page 5 (faceE) */
let html = fs.readFileSync('index.html', 'utf8');

// CSS alert badge
if (!html.includes('.effrvol-alert')) {
  const css =
    '.effrvol-alert{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;margin-left:6px}' +
    '.effrvol-alert.normal{background:rgba(116,212,196,.2);color:var(--accent)}' +
    '.effrvol-alert.watch{background:rgba(255,193,7,.2);color:#e6a700}' +
    '.effrvol-alert.high{background:rgba(231,76,60,.2);color:#e74c3c}';
  html = html.replace('</style>', css + '</style>');
}

// Ensure paintEffrVol exists and is called on page 5
if (!html.includes('function paintEffrVol')) {
  const fn = `
function paintEffrVol(){
  let faceE=document.querySelector('.usa-face-e');
  if(!faceE)return;
  // inject panel once
  if(!document.getElementById('effrVolPanel')){
    const wrap=document.createElement('div');
    wrap.innerHTML=
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
    // insert after fhlb panels if present, else append
    const after=document.getElementById('fhlbNotePanel')||document.getElementById('fhlbChgPanel')||faceE.lastElementChild;
    if(after&&after.parentNode===faceE) after.insertAdjacentElement('afterend', wrap.firstChild);
    // append all children from wrap
    while(wrap.firstChild){
      const el=wrap.firstChild;
      if(!document.getElementById(el.id)) faceE.appendChild(el);
      else wrap.removeChild(el);
    }
  }
  const ev=(data.USA&&data.USA.effrVol)||{};
  const vol=histories['USA-effrVol']||[];
  const chg=histories['USA-effrVolChg']||[];
  const rate=histories['USA-effr']||[];
  // sample for display speed: last ~5y daily is fine for renderLineChart; use full series, chart scales
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
  if(meta)meta.textContent=(ev.source||'FRED EFFRVOL')+' · '+(ev.points||vol.length)+' Handelstage · COVID-03/2020 · SVB-03/2023 im Verlauf sichtbar';
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
  const idx = html.lastIndexOf('bindUsaPages();');
  if (idx >= 0) {
    html = html.slice(0, idx) + fn + '\n' + html.slice(idx);
    console.log('paintEffrVol injected');
  }
}

// Call on page 5 with paintFhlb
if (html.includes('paintFhlb') && !html.includes('paintEffrVol()')) {
  html = html.replace(
    /if\(page===4\)setTimeout\(\(\)=>\{try\{typeof paintFhlb==='function'&&paintFhlb\(\)\}catch\(e\)\{\}\},50\);/,
    "if(page===4)setTimeout(()=>{try{typeof paintFhlb==='function'&&paintFhlb()}catch(e){};try{typeof paintEffrVol==='function'&&paintEffrVol()}catch(e){}},50);"
  );
  // also if pattern different
  if (!html.includes('paintEffrVol()')) {
    html = html.replace(
      /typeof paintFhlb==='function'&&paintFhlb\(\)/,
      "typeof paintFhlb==='function'&&paintFhlb();typeof paintEffrVol==='function'&&paintEffrVol()"
    );
  }
}

if (!html.includes("'effrVol'")) {
  html = html.replace(/ALL_KEYS=\[([^\]]+)\]/, (m, inner) => {
    if (inner.includes('effrVol')) return m;
    return `ALL_KEYS=[${inner},'effrVol','effrVolChg','effr']`;
  });
}
if (!html.includes('effrVol:')) {
  html = html.replace(/extraLabels=\{([^}]*)\}/, (m, inner) => {
    if (inner.includes('effrVol')) return m;
    return `extraLabels={${inner},effrVol:'Fed Funds Volume',effrVolChg:'Fed Funds Vol Δ%',effr:'EFFR'}`;
  });
}

fs.writeFileSync('index.html', html);
console.log('done', html.length, 'paintEffrVol', html.includes('function paintEffrVol'), 'call', html.includes('paintEffrVol()'));
