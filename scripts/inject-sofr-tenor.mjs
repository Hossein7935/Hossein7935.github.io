import fs from 'fs';

/** Page 4: SOFR tenor picker history + red overlay from all USA charts */
let html = fs.readFileSync('index.html', 'utf8');

const block = `
const SOFR_PAGE_OVERLAY_CATALOG=[
  {key:'us3m',label:'US 3M'},{key:'us1y',label:'US 1Y'},{key:'us2y',label:'US 2Y'},
  {key:'us5y',label:'US 5Y'},{key:'us10y',label:'US 10Y'},{key:'us30y',label:'US 30Y'},
  {key:'dfii5',label:'TIPS 5Y'},{key:'dfii10',label:'TIPS 10Y'},
  {key:'effr',label:'EFFR'},{key:'sofr',label:'SOFR'},{key:'iorb',label:'IORB'},
  {key:'sofrIorb',label:'SOFR−IORB'},{key:'t10y2y',label:'10Y−2Y'},{key:'t10y5y',label:'10Y−5Y'},
  {key:'move',label:'MOVE'},{key:'dxy',label:'DXY'},{key:'wresbal',label:'WRESBAL'},
  {key:'effrVol',label:'EFFR Volume'},{key:'cuAu',label:'Copper/Gold'},{key:'rate',label:'Policy Rate'},
  {key:'inflation',label:'Inflation'}
];
function getSofRTenorId(){
  try{return localStorage.getItem('macrowatch-sofr-tenor')||''}catch(e){return ''}
}
function setSofRTenorId(id){
  try{localStorage.setItem('macrowatch-sofr-tenor',id||'')}catch(e){}
  try{typeof paintSofRTenor==='function'&&paintSofRTenor()}catch(e){}
}
function getSofRTenorOverlay(){
  try{return localStorage.getItem('macrowatch-sofr-tenor-ov')||''}catch(e){return ''}
}
function setSofRTenorOverlay(k){
  try{localStorage.setItem('macrowatch-sofr-tenor-ov',k||'')}catch(e){}
  try{typeof paintSofRTenor==='function'&&paintSofRTenor()}catch(e){}
}
function ensureSofRTenorPanel(){
  const face=document.querySelector('.usa-face-d');
  if(!face)return null;
  if(document.getElementById('sofrTenorPanel'))return document.getElementById('sofrTenorPanel');
  const box=document.createElement('div');
  box.innerHTML=
    '<div class="metric has-chart sofr-fwd-panel" id="sofrTenorPanel" style="grid-column:1/-1">'+
      '<div class="name">SOFR Futures · Laufzeit wählen</div>'+
      '<div class="value" id="sofrTenorValue">—</div>'+
      '<div class="date" id="sofrTenorDate">CME SR1/SR3 · Historie</div>'+
      '<div class="sofr-fwd-bp" id="sofrTenorControls" style="gap:10px;flex-wrap:wrap;align-items:center;margin:6px 0">'+
        '<label style="font-size:13px">Laufzeit: <select id="sofrTenorSelect" style="margin-left:6px;min-width:180px;padding:4px 6px"></select></label>'+
        '<label style="font-size:13px">Rot-Overlay: <select id="sofrTenorOverlay" style="margin-left:6px;min-width:160px;padding:4px 6px">'+
          '<option value="">— keines —</option>'+
          SOFR_PAGE_OVERLAY_CATALOG.map(s=>'<option value="'+s.key+'">'+s.label+'</option>').join('')+
        '</select></label>'+
      '</div>'+
      '<div id="sofrTenorChart"></div>'+
      '<div class="sofr-fwd-meta" id="sofrTenorMeta">Wähle einen SR1/SR3-Kontrakt · volle Historie · Overlay aus allen USA-Seiten</div>'+
    '</div>';
  face.appendChild(box.firstChild);
  return document.getElementById('sofrTenorPanel');
}
function paintSofRTenor(){
  const panel=ensureSofRTenorPanel();
  if(!panel)return;
  const fwd=(data.USA&&data.USA.sofrFwd)||{};
  const catalog=fwd.catalog||data.USA.sofrTenorCatalog||[];
  const sel=document.getElementById('sofrTenorSelect');
  const ovSel=document.getElementById('sofrTenorOverlay');
  const valEl=document.getElementById('sofrTenorValue');
  const dateEl=document.getElementById('sofrTenorDate');
  const host=document.getElementById('sofrTenorChart');
  const meta=document.getElementById('sofrTenorMeta');
  if(!sel||!host)return;

  if(sel.options.length!==catalog.length+1){
    const cur=getSofRTenorId();
    sel.innerHTML='<option value="">— wählen —</option>'+
      catalog.map(c=>'<option value="'+c.id+'">'+c.label+(c.lastRate!=null?(' · '+Number(c.lastRate).toFixed(3)+'%'):'')+'</option>').join('');
    if(cur)sel.value=cur;
    else if(catalog[0]){sel.value=catalog[0].id;setSofRTenorId(catalog[0].id);}
  }
  if(!sel.dataset.bound){
    sel.dataset.bound='1';
    sel.addEventListener('change',()=>setSofRTenorId(sel.value||''));
  }
  if(ovSel){
    const ov=getSofRTenorOverlay();
    if(ovSel.value!==ov)ovSel.value=ov;
    if(!ovSel.dataset.bound){
      ovSel.dataset.bound='1';
      ovSel.addEventListener('change',()=>setSofRTenorOverlay(ovSel.value||''));
    }
  }

  const id=sel.value||getSofRTenorId();
  if(!id){
    host.innerHTML='';
    if(valEl)valEl.textContent='—';
    if(meta)meta.textContent='Keine Laufzeit gewählt';
    return;
  }
  const cat=catalog.find(c=>c.id===id)||{label:id,symbol:id};
  let pts=histories['USA-sofrTenor-'+id]||[];
  const last=pts.length?pts.at(-1):null;
  if(valEl)valEl.textContent=last?fmt(last.value):(cat.lastRate!=null?fmt(cat.lastRate):'—');
  if(dateEl)dateEl.textContent=(cat.label||id)+(last?(' · Stand '+last.period+' · '+pts.length+' Tage'):'');

  const ovKey=getSofRTenorOverlay();
  let ovPts=[];
  let ovLabel='';
  if(ovKey){
    ovPts=histories['USA-'+ovKey]||[];
    const c=SOFR_PAGE_OVERLAY_CATALOG.find(x=>x.key===ovKey);
    ovLabel=c?c.label:ovKey;
    if(pts.length&&ovPts.length){
      const t0=String(pts[0].period), t1=String(pts.at(-1).period);
      ovPts=ovPts.filter(p=>String(p.period)>=t0&&String(p.period)<=t1);
    }
  }
  window.__sofrTenorMeta={id,label:cat.label||id,symbol:cat.symbol,ovKey,ovLabel};

  if(!pts.length){
    host.innerHTML='<div class="sparkempty">Keine Historie für diesen Kontrakt</div>';
  }else if(typeof renderDiffOverlayChart==='function'&&ovPts.length){
    // reuse dual renderer: blue=tenor, red=overlay (as "diff" axis + right)
    host.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|sofrTenorHist|'+esc(cat.label||id)+'" title="Chart vergrößern (6M/1J/3J)">'+renderDiffOverlayChart(pts,ovPts,{w:360,h:180})+'</div>';
  }else if(typeof renderLineChart==='function'){
    host.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|sofrTenorHist|'+esc(cat.label||id)+'" title="Chart vergrößern (6M/1J/3J)">'+renderLineChart(pts,{w:360,h:160})+'</div>';
  }
  if(meta)meta.textContent=(cat.symbol||'')+' · '+(pts.length)+' Punkte'+(ovLabel?(' · rot: '+ovLabel):'')+' · Tippen · 6M/1J/3J';
}
`;

if (!html.includes('function paintSofRTenor')) {
  // insert before paintSofRFwd if present, else before bindUsaPages
  if (html.includes('function paintSofRFwd')) {
    html = html.replace('function paintSofRFwd', block + '\nfunction paintSofRFwd');
    console.log('tenor before paintSofRFwd');
  } else if (html.includes('function bindUsaPages')) {
    html = html.replace('function bindUsaPages', block + '\nfunction bindUsaPages');
  }
}

// Call from paintSofRFwd end or setUsaPage page 3
if (!html.includes("typeof paintSofRTenor==='function'&&paintSofRTenor()")) {
  html = html.replace(
    /typeof paintSofRFwd==='function'&&paintSofRFwd\(\)/g,
    "typeof paintSofRFwd==='function'&&paintSofRFwd();typeof paintSofRTenor==='function'&&paintSofRTenor()"
  );
  // also after paintSofRFwd body ends if we can find a unique return path
  if (html.includes('function paintSofRFwd') && !html.includes('paintSofRTenor();\n}')) {
    // append call inside setUsaPage page===3 already covered by replace above
  }
}

// paintChartDlg branch for sofrTenorHist
if (!html.includes("key==='sofrTenorHist'")) {
  const start = html.indexOf('function paintChartDlg');
  const end = html.indexOf('function bindBigChartHover');
  if (start >= 0 && end > start) {
    let region = html.slice(start, end);
    const inject =
      "\n  if(key==='sofrTenorHist'){\n" +
      "    const tm=window.__sofrTenorMeta||{};\n" +
      "    let pts=histories['USA-sofrTenor-'+(tm.id||'') ]||[];\n" +
      "    if(typeof filterByRange==='function'){const p2=filterByRange(pts,range); if(p2.length) pts=p2;}\n" +
      "    let ov=[];\n" +
      "    if(tm.ovKey){ov=histories['USA-'+tm.ovKey]||[]; if(typeof filterByRange==='function'){const o2=filterByRange(ov,range); if(o2.length) ov=o2;}}\n" +
      "    if(!pts.length){body.innerHTML='<div class=\\\"sparkempty\\\">Keine Daten</div>';if(meta)meta.textContent='';return;}\n" +
      "    if(typeof renderDiffOverlayChart==='function'&&ov.length){body.innerHTML=renderDiffOverlayChart(pts,ov,{w:720,h:320,big:true})+'<div class=\\\"chart-tip-inline\\\" id=\\\"chartDlgTip\\\"></div>';}\n" +
      "    else{body.innerHTML=renderLineChart(pts,{w:720,h:300,big:true})+'<div class=\\\"chart-tip-inline\\\" id=\\\"chartDlgTip\\\"></div>';}\n" +
      "    if(typeof bindBigChartHover==='function')bindBigChartHover(body);\n" +
      "    if(meta)meta.textContent=(tm.label||'SOFR Tenor')+' · '+rLabel+' · '+pts.length+' Punkte'+(tm.ovLabel?(' · rot: '+tm.ovLabel):'');\n" +
      "    return;\n" +
      "  }\n";
    // insert after rateOverlayDual or at start of try after range setup
    if (region.includes("key==='rateOverlayDual'")) {
      const k = region.indexOf("key==='rateOverlayDual'");
      // find end of that if block — after "return;\n  }"
      const ret = region.indexOf('return;', k);
      const close = region.indexOf('}', ret);
      region = region.slice(0, close + 1) + inject + region.slice(close + 1);
    } else {
      region = region.replace(
        'const rLabel=',
        inject + 'const rLabel='
      );
    }
    html = html.slice(0, start) + region + html.slice(end);
    console.log('paintChartDlg sofrTenorHist');
  }
}

fs.writeFileSync('index.html', html);
console.log('done', html.includes('function paintSofRTenor'), html.includes('sofrTenorHist'));
