import fs from 'fs';

/** USA page 5: FHLBank Advances Monitor */
let html = fs.readFileSync('index.html', 'utf8');

// Upgrade page selector to 5 pages
if (html.includes('usaPageSelect') && !html.includes('Seite 5')) {
  html = html.replaceAll('Seite 4 · Kurven', 'Seite 4 · Kurven');
  // add button after Seite 4
  const patterns = [
    /(data-page="3">Seite 4[^<]*<\/button>)(<\/div>)/,
    /(data-page=\"3\">Seite 4[^<]*<\/button>)(<\/div>)/
  ];
  for (const re of patterns) {
    if (re.test(html)) {
      html = html.replace(re, '$1<button type="button" data-page="4">Seite 5 · FHLB</button>$2');
      console.log('page 5 button added');
      break;
    }
  }
}

// setUsaPage max 4
html = html.replace(/Math\.min\(3,Number\(page\)\|\|0\)/g, 'Math.min(4,Number(page)||0)');

// faceE: FHLB panel after faceD
if (!html.includes('usa-face-e') && html.includes('usa-face-d')) {
  const block = `
    const faceE=document.createElement('div');
    faceE.className='metrics usa-face usa-face-e hidden';
    const _fh=(data.USA&&data.USA.fhlbAdv)||{};
    faceE.innerHTML=
      '<div class="metric has-chart sofr-fwd-panel" id="fhlbPanel">'+
        '<div class="name">Federal Home Loan Banks · Advances Outstanding</div>'+
        '<div class="value" id="fhlbValue">'+(_fh.value!=null?fmt(_fh.value):'—')+'</div>'+
        '<div class="date" id="fhlbDate">'+(_fh.date?('Stand '+_fh.date):'—')+' · Mrd. USD</div>'+
        '<div class="sofr-fwd-bp" id="fhlbCards"></div>'+
        '<div id="fhlbAbsChart"></div>'+
        '<div class="sofr-fwd-meta" id="fhlbMeta">Quelle: FHLBanks Office of Finance · Combined Operating Highlights</div>'+
      '</div>'+
      '<div class="metric has-chart sofr-fwd-panel" id="fhlbChgPanel">'+
        '<div class="name">Veränderung · QoQ / YoY</div>'+
        '<div class="value" id="fhlbChgValue">—</div>'+
        '<div class="date">'+
          '<button type="button" class="fhlb-mode active" data-mode="qoq">QoQ</button> '+
          '<button type="button" class="fhlb-mode" data-mode="yoy">YoY</button>'+
        '</div>'+
        '<div id="fhlbChgChart"></div>'+
        '<div class="sofr-fwd-meta" id="fhlbChgMeta">Prozentuale Veränderung der systemweiten Advances</div>'+
      '</div>'+
      '<div class="metric sofr-fwd-panel" id="fhlbNotePanel">'+
        '<div class="name">Kurzanalyse</div>'+
        '<div class="date" id="fhlbNote" style="white-space:normal;line-height:1.45"></div>'+
      '</div>';
    const _d=card.querySelector('.usa-face-d');
    if(_d&&_d.parentNode)_d.after(faceE);
`;
  // insert before setUsaPage usage after faceD creation - look for faceD anchor after
  if (html.includes("const _anchor=card.querySelector('.usa-face-c')")) {
    html = html.replace(
      "const _anchor=card.querySelector('.usa-face-c')||faceC;",
      block + "\n    const _anchor=card.querySelector('.usa-face-c')||faceC;"
    );
    console.log('faceE inserted near anchor');
  } else if (html.includes('usa-face-d')) {
    // append after faceD.innerHTML += patterns
    const idx = html.indexOf("if(_anchor&&_anchor.parentNode)_anchor.after(faceD)");
    if (idx >= 0) {
      html = html.slice(0, idx) + block + '\n    ' + html.slice(idx);
      console.log('faceE inserted before faceD.after');
    } else {
      // after paintSofRFwd definition area - inject DOM creation via render patch is hard; use Mutation-less: inject into setUsaPage visibility only after ensuring element exists in paintFhlb
      console.warn('faceE DOM insert pattern not found — will create on paint');
    }
  }
}

// Toggle faceE in setUsaPage
if (html.includes('function setUsaPage') && !html.includes("usa-face-e")) {
  // already may have face-e from above
}
if (html.includes('function setUsaPage')) {
  // ensure d and e toggles
  if (!html.includes(".usa-face-e")) {
    html = html.replace(
      /const d=card\.querySelector\('\.usa-face-d'\);/,
      "const d=card.querySelector('.usa-face-d');\n    const e=card.querySelector('.usa-face-e');"
    );
    html = html.replace(
      /if\(d\)d\.classList\.toggle\('hidden',page!==3\);/,
      "if(d)d.classList.toggle('hidden',page!==3);\n    if(e)e.classList.toggle('hidden',page!==4);"
    );
  } else {
    // face-e class exists in html from faceE creation - still need setUsaPage refs
    if (!html.includes("querySelector('.usa-face-e')")) {
      html = html.replace(
        /const d=card\.querySelector\('\.usa-face-d'\);/,
        "const d=card.querySelector('.usa-face-d');\n    const e=card.querySelector('.usa-face-e');"
      );
      html = html.replace(
        /if\(d\)d\.classList\.toggle\('hidden',page!==3\);/,
        "if(d)d.classList.toggle('hidden',page!==3);\n    if(e)e.classList.toggle('hidden',page!==4);"
      );
    }
  }
  if (!html.includes('paintFhlb')) {
    html = html.replace(
      /if\(page===3\)setTimeout\(\(\)=>\{try\{typeof paintSofRFwd/,
      "if(page===4)setTimeout(()=>{try{typeof paintFhlb==='function'&&paintFhlb()}catch(e){}},50);\n  if(page===3)setTimeout(()=>{try{typeof paintSofRFwd"
    );
  }
}

// CSS for mode buttons
if (!html.includes('.fhlb-mode')) {
  const css =
    '.fhlb-mode{padding:4px 10px;border-radius:8px;border:1px solid var(--control-line);background:var(--control);color:var(--text);font:inherit;cursor:pointer;margin-right:4px}' +
    '.fhlb-mode.active{background:var(--accent);color:#09211e;border-color:var(--accent);font-weight:700}';
  html = html.replace('</style>', css + '</style>');
}

// paintFhlb function
if (!html.includes('function paintFhlb')) {
  const fn = `
let _fhlbMode='qoq';
function paintFhlb(){
  // ensure faceE exists even if inject order failed
  let faceE=document.querySelector('.usa-face-e');
  if(!faceE){
    const card=[...document.querySelectorAll('.country')].find(c=>c.querySelector('.usa-face-d'));
    if(card){
      faceE=document.createElement('div');
      faceE.className='metrics usa-face usa-face-e hidden';
      faceE.innerHTML='<div class="metric has-chart sofr-fwd-panel" id="fhlbPanel"><div class="name">Federal Home Loan Banks · Advances Outstanding</div><div class="value" id="fhlbValue">—</div><div class="date" id="fhlbDate">—</div><div class="sofr-fwd-bp" id="fhlbCards"></div><div id="fhlbAbsChart"></div><div class="sofr-fwd-meta" id="fhlbMeta"></div></div><div class="metric has-chart sofr-fwd-panel" id="fhlbChgPanel"><div class="name">Veränderung · QoQ / YoY</div><div class="value" id="fhlbChgValue">—</div><div class="date"><button type="button" class="fhlb-mode active" data-mode="qoq">QoQ</button> <button type="button" class="fhlb-mode" data-mode="yoy">YoY</button></div><div id="fhlbChgChart"></div><div class="sofr-fwd-meta" id="fhlbChgMeta"></div></div><div class="metric sofr-fwd-panel"><div class="name">Kurzanalyse</div><div class="date" id="fhlbNote" style="white-space:normal;line-height:1.45"></div></div>';
      const d=card.querySelector('.usa-face-d');
      if(d)d.after(faceE);
    }
  }
  const fh=(data.USA&&data.USA.fhlbAdv)||{};
  const abs=histories['USA-fhlbAdv']||[];
  const qoq=histories['USA-fhlbAdvQoq']||[];
  const yoy=histories['USA-fhlbAdvYoy']||[];
  const valEl=document.getElementById('fhlbValue');
  const dateEl=document.getElementById('fhlbDate');
  const cards=document.getElementById('fhlbCards');
  const absHost=document.getElementById('fhlbAbsChart');
  const meta=document.getElementById('fhlbMeta');
  const chgVal=document.getElementById('fhlbChgValue');
  const chgHost=document.getElementById('fhlbChgChart');
  const chgMeta=document.getElementById('fhlbChgMeta');
  const noteEl=document.getElementById('fhlbNote');
  if(valEl)valEl.textContent=fh.value!=null?fmt(fh.value):'—';
  if(dateEl){
    const ts=fh.updatedAt?fh.updatedAt.replace('T',' ').slice(0,16)+' UTC':'';
    dateEl.textContent=(fh.date?('Datenstand '+fh.date):'—')+(ts?(' · Update '+ts):'')+' · Mrd. USD';
  }
  if(cards){
    const q=fh.pctChangeQoq,a=fh.absChangeQoq,y=fh.pctChangeYoy;
    cards.innerHTML=
      '<span><b>QoQ</b> '+(q!=null?((q>=0?'+':'')+fmt(q)+' %'):'—')+'</span>'+
      '<span><b>Δ abs</b> '+(a!=null?((a>=0?'+':'')+fmt(a)+' Mrd.'):'—')+'</span>'+
      '<span><b>YoY</b> '+(y!=null?((y>=0?'+':'')+fmt(y)+' %'):'—')+'</span>';
  }
  if(absHost){
    if(!abs.length)absHost.innerHTML='<div class="sparkempty">Keine historischen Advances</div>';
    else absHost.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|fhlbAdv|FHLB Advances" title="Chart vergrößern">'+renderLineChart(abs,{w:360,h:160})+'</div>';
  }
  if(meta)meta.textContent=(fh.source||'FHLBanks Office of Finance')+' · '+(fh.points||abs.length)+' Quartale · Werte in Mrd. USD';
  const modePts=_fhlbMode==='yoy'?yoy:qoq;
  if(chgVal){
    const last=modePts.at(-1);
    chgVal.textContent=last?((last.value>=0?'+':'')+fmt(last.value)+' %'):'—';
  }
  if(chgHost){
    if(!modePts.length)chgHost.innerHTML='<div class="sparkempty">Keine Veränderungsdaten</div>';
    else chgHost.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|fhlbAdv'+(_fhlbMode==='yoy'?'Yoy':'Qoq')+'|FHLB '+_fhlbMode.toUpperCase()+'" title="Chart vergrößern">'+renderLineChart(modePts,{w:360,h:140})+'</div>';
  }
  if(chgMeta)chgMeta.textContent=(_fhlbMode==='yoy'?'Veränderung zum Vorjahresquartal (YoY)':'Veränderung zum Vorquartal (QoQ)')+' · positive/negative Werte möglich';
  if(noteEl)noteEl.textContent=fh.note||'Quartalsdaten der FHLBanks Office of Finance. Ein Anstieg der Advances allein bedeutet keinen Liquiditätsstress.';
  document.querySelectorAll('.fhlb-mode').forEach(b=>{
    b.classList.toggle('active',b.dataset.mode===_fhlbMode);
    b.onclick=()=>{_fhlbMode=b.dataset.mode;paintFhlb();};
  });
}
`;
  const idx = html.lastIndexOf('bindUsaPages();');
  if (idx >= 0) {
    html = html.slice(0, idx) + fn + '\n' + html.slice(idx);
    console.log('paintFhlb injected');
  }
}

// ALL_KEYS
if (!html.includes("'fhlbAdv'")) {
  html = html.replace(/ALL_KEYS=\[([^\]]+)\]/, (m, inner) => {
    if (inner.includes('fhlbAdv')) return m;
    return `ALL_KEYS=[${inner},'fhlbAdv','fhlbAdvQoq','fhlbAdvYoy']`;
  });
}
if (!html.includes('fhlbAdv:')) {
  html = html.replace(/extraLabels=\{([^}]*)\}/, (m, inner) => {
    if (inner.includes('fhlbAdv')) return m;
    return `extraLabels={${inner},fhlbAdv:'FHLB Advances',fhlbAdvQoq:'FHLB Advances QoQ %',fhlbAdvYoy:'FHLB Advances YoY %'}`;
  });
}

fs.writeFileSync('index.html', html);
console.log(
  'done', html.length,
  'page5', html.includes('Seite 5 · FHLB'),
  'faceE', html.includes('usa-face-e'),
  'paintFhlb', html.includes('function paintFhlb'),
  'max4', html.includes('Math.min(4')
);
