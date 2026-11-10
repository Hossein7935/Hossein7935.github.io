import fs from 'fs';

/** Page 4: SOFR tenor picker + full overlay + A−B diff */
let html = fs.readFileSync('index.html', 'utf8');

const block = `
const SOFR_USA_CHART_CATALOG=[
  {key:'us3m',label:'US 3M',hist:'USA-us3m'},
  {key:'us1y',label:'US 1Y',hist:'USA-us1y'},
  {key:'us2y',label:'US 2Y',hist:'USA-us2y'},
  {key:'us5y',label:'US 5Y',hist:'USA-us5y'},
  {key:'us10y',label:'US 10Y',hist:'USA-us10y'},
  {key:'us30y',label:'US 30Y',hist:'USA-us30y'},
  {key:'dfii5',label:'TIPS 5Y',hist:'USA-dfii5'},
  {key:'dfii10',label:'TIPS 10Y',hist:'USA-dfii10'},
  {key:'effr',label:'EFFR',hist:'USA-effr'},
  {key:'sofr',label:'SOFR',hist:'USA-sofr'},
  {key:'iorb',label:'IORB',hist:'USA-iorb'},
  {key:'sofrIorb',label:'SOFR−IORB',hist:'USA-sofrIorb'},
  {key:'t10y2y',label:'10Y−2Y',hist:'USA-t10y2y'},
  {key:'t10y5y',label:'10Y−5Y',hist:'USA-t10y5y'},
  {key:'us5yTips',label:'5Y BEI',hist:'USA-us5yTips'},
  {key:'us10yTips',label:'10Y BEI',hist:'USA-us10yTips'},
  {key:'move',label:'MOVE',hist:'USA-move'},
  {key:'dxy',label:'DXY',hist:'USA-dxy'},
  {key:'wresbal',label:'WRESBAL',hist:'USA-wresbal'},
  {key:'effrVol',label:'EFFR Volume',hist:'USA-effrVol'},
  {key:'cuAu',label:'Copper/Gold',hist:'USA-cuAu'},
  {key:'rate',label:'Policy Rate',hist:'USA-rate'},
  {key:'inflation',label:'Inflation',hist:'USA-inflation'},
  {key:'gdp',label:'GDP Growth',hist:'USA-gdp'},
  {key:'fhlb',label:'FHLB Advances',hist:'USA-fhlb'}
];
function getSofRTenorCatalog(){
  const fwd=(data.USA&&data.USA.sofrFwd)||{};
  return fwd.catalog||data.USA.sofrTenorCatalog||[];
}
function buildSofRSeriesList(){
  const list=[];
  for(const c of getSofRTenorCatalog()){
    list.push({key:'tenor:'+c.id,label:'SOFR · '+c.label,hist:'USA-sofrTenor-'+c.id});
  }
  for(const c of SOFR_USA_CHART_CATALOG){
    list.push({key:'usa:'+c.key,label:c.label,hist:c.hist});
  }
  return list;
}
function resolveSofRSeries(key){
  if(!key)return {pts:[],label:''};
  const list=buildSofRSeriesList();
  const hit=list.find(x=>x.key===key);
  if(hit)return {pts:histories[hit.hist]||[],label:hit.label,hist:hit.hist};
  if(key.startsWith('tenor:')){
    const id=key.slice(6);
    return {pts:histories['USA-sofrTenor-'+id]||[],label:id,hist:'USA-sofrTenor-'+id};
  }
  if(key.startsWith('usa:')){
    const k=key.slice(4);
    return {pts:histories['USA-'+k]||[],label:k,hist:'USA-'+k};
  }
  return {pts:histories['USA-'+key]||[],label:key,hist:'USA-'+key};
}
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
function getSofRDiffA(){
  try{return localStorage.getItem('macrowatch-sofr-diff-a')||''}catch(e){return ''}
}
function getSofRDiffB(){
  try{return localStorage.getItem('macrowatch-sofr-diff-b')||''}catch(e){return ''}
}
function setSofRDiffA(k){
  try{localStorage.setItem('macrowatch-sofr-diff-a',k||'')}catch(e){}
  try{typeof paintSofRTenor==='function'&&paintSofRTenor()}catch(e){}
}
function setSofRDiffB(k){
  try{localStorage.setItem('macrowatch-sofr-diff-b',k||'')}catch(e){}
  try{typeof paintSofRTenor==='function'&&paintSofRTenor()}catch(e){}
}
function alignDiffSeries(a,b){
  const mb=new Map((b||[]).map(p=>[String(p.period),Number(p.value)]));
  const out=[];
  for(const p of a||[]){
    const bv=mb.get(String(p.period));
    if(!Number.isFinite(Number(p.value))||!Number.isFinite(bv))continue;
    out.push({period:String(p.period),value:Number(p.value)-bv});
  }
  return out;
}
function fillSofRSelect(sel,list,cur){
  if(!sel)return;
  sel.innerHTML=['<option value="">— keines —</option>'].concat(
    list.map(s=>'<option value="'+s.key+'">'+s.label+'</option>')
  ).join('');
  if(cur)sel.value=cur;
}
function ensureSofRTenorPanel(){
  const face=document.querySelector('.usa-face-d');
  if(!face)return null;
  let panel=document.getElementById('sofrTenorPanel');
  if(panel){
    // ensure diff controls exist (upgrade old panel)
    if(!document.getElementById('sofrDiffA')){
      panel.insertAdjacentHTML('beforeend',
        '<div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--line)">'+
          '<div class="name" style="margin-bottom:6px">Differenz · Chart A − Chart B</div>'+
          '<div class="sofr-fwd-bp" style="gap:10px;flex-wrap:wrap;align-items:center;margin:6px 0">'+
            '<label style="font-size:13px">A: <select id="sofrDiffA" style="margin-left:6px;min-width:200px;padding:4px 6px"></select></label>'+
            '<label style="font-size:13px">B: <select id="sofrDiffB" style="margin-left:6px;min-width:200px;padding:4px 6px"></select></label>'+
          '</div>'+
          '<div class="value" id="sofrDiffValue">—</div>'+
          '<div id="sofrDiffChart"></div>'+
          '<div class="sofr-fwd-meta" id="sofrDiffMeta">Wähle zwei Serien</div>'+
        '</div>');
    }
    return panel;
  }
  const box=document.createElement('div');
  box.innerHTML=
    '<div class="metric has-chart sofr-fwd-panel" id="sofrTenorPanel" style="grid-column:1/-1">'+
      '<div class="name">SOFR Futures · Laufzeit wählen</div>'+
      '<div class="value" id="sofrTenorValue">—</div>'+
      '<div class="date" id="sofrTenorDate">CME SR1/SR3 · Historie · Vergleich · Differenz</div>'+
      '<div class="sofr-fwd-bp" id="sofrTenorControls" style="gap:10px;flex-wrap:wrap;align-items:center;margin:6px 0">'+
        '<label style="font-size:13px">Laufzeit: <select id="sofrTenorSelect" style="margin-left:6px;min-width:180px;padding:4px 6px"></select></label>'+
        '<label style="font-size:13px">Rot-Overlay: <select id="sofrTenorOverlay" style="margin-left:6px;min-width:200px;padding:4px 6px"></select></label>'+
      '</div>'+
      '<div id="sofrTenorChart"></div>'+
      '<div class="sofr-fwd-meta" id="sofrTenorMeta">Laufzeit + Overlay (alle SOFR + alle USA-Charts)</div>'+
      '<div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--line)">'+
        '<div class="name" style="margin-bottom:6px">Differenz · Chart A − Chart B</div>'+
        '<div class="sofr-fwd-bp" style="gap:10px;flex-wrap:wrap;align-items:center;margin:6px 0">'+
          '<label style="font-size:13px">A: <select id="sofrDiffA" style="margin-left:6px;min-width:200px;padding:4px 6px"></select></label>'+
          '<label style="font-size:13px">B: <select id="sofrDiffB" style="margin-left:6px;min-width:200px;padding:4px 6px"></select></label>'+
        '</div>'+
        '<div class="value" id="sofrDiffValue">—</div>'+
        '<div id="sofrDiffChart"></div>'+
        '<div class="sofr-fwd-meta" id="sofrDiffMeta">Wähle zwei Serien · gleiche Historie · 6M/1J/3J beim Vergrößern</div>'+
      '</div>'+
    '</div>';
  face.appendChild(box.firstChild);
  return document.getElementById('sofrTenorPanel');
}
function paintSofRTenor(){
  const panel=ensureSofRTenorPanel();
  if(!panel)return;
  const catalog=getSofRTenorCatalog();
  const seriesList=buildSofRSeriesList();
  const sel=document.getElementById('sofrTenorSelect');
  const ovSel=document.getElementById('sofrTenorOverlay');
  const diffA=document.getElementById('sofrDiffA');
  const diffB=document.getElementById('sofrDiffB');
  const valEl=document.getElementById('sofrTenorValue');
  const dateEl=document.getElementById('sofrTenorDate');
  const host=document.getElementById('sofrTenorChart');
  const meta=document.getElementById('sofrTenorMeta');
  const diffHost=document.getElementById('sofrDiffChart');
  const diffVal=document.getElementById('sofrDiffValue');
  const diffMeta=document.getElementById('sofrDiffMeta');
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

  fillSofRSelect(ovSel,seriesList,getSofRTenorOverlay());
  fillSofRSelect(diffA,seriesList,getSofRDiffA());
  fillSofRSelect(diffB,seriesList,getSofRDiffB());
  if(ovSel&&!ovSel.dataset.bound){
    ovSel.dataset.bound='1';
    ovSel.addEventListener('change',()=>setSofRTenorOverlay(ovSel.value||''));
  }
  if(diffA&&!diffA.dataset.bound){
    diffA.dataset.bound='1';
    diffA.addEventListener('change',()=>setSofRDiffA(diffA.value||''));
  }
  if(diffB&&!diffB.dataset.bound){
    diffB.dataset.bound='1';
    diffB.addEventListener('change',()=>setSofRDiffB(diffB.value||''));
  }

  const id=sel.value||getSofRTenorId();
  if(!id){
    host.innerHTML='';
    if(valEl)valEl.textContent='—';
    if(meta)meta.textContent=catalog.length?('Katalog: '+catalog.length+' · Liste: '+seriesList.length):'Keine Laufzeit';
  }else{
    const cat=catalog.find(c=>c.id===id)||{label:id,symbol:id};
    let pts=(histories['USA-sofrTenor-'+id]||[]).slice();
    if(!pts.length&&cat.lastRate!=null){
      pts=[{period:new Date().toISOString().slice(0,10),value:Number(cat.lastRate)}];
    }
    if(pts.length===1){
      const p=pts[0];
      const d=new Date(String(p.period)+'T00:00:00Z');
      d.setUTCDate(d.getUTCDate()-30);
      pts=[{period:d.toISOString().slice(0,10),value:p.value},p];
    }
    const last=pts.length?pts.at(-1):null;
    if(valEl)valEl.textContent=last?fmt(last.value):(cat.lastRate!=null?fmt(cat.lastRate):'—');
    if(dateEl)dateEl.textContent=(cat.label||id)+(last?(' · Stand '+last.period+' · '+pts.length+' Punkte'):'');

    const ovKey=getSofRTenorOverlay();
    const ov=resolveSofRSeries(ovKey);
    let ovPts=ov.pts||[];
    if(pts.length&&ovPts.length){
      const t0=String(pts[0].period), t1=String(pts.at(-1).period);
      ovPts=ovPts.filter(p=>String(p.period)>=t0&&String(p.period)<=t1);
    }
    window.__sofrTenorMeta={id,label:cat.label||id,symbol:cat.symbol,ovKey,ovLabel:ov.label||''};

    if(!pts.length){
      host.innerHTML='<div class="sparkempty">Keine Historie</div>';
    }else if(typeof renderDiffOverlayChart==='function'&&ovPts.length>=2){
      host.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|sofrTenorHist|'+(cat.label||id)+'" title="Vergrößern">'+renderDiffOverlayChart(pts,ovPts,{w:360,h:180})+'</div>';
    }else if(typeof renderLineChart==='function'){
      host.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|sofrTenorHist|'+(cat.label||id)+'" title="Vergrößern">'+renderLineChart(pts,{w:360,h:160})+'</div>';
    }
    if(meta)meta.textContent=(cat.symbol||'')+' · '+pts.length+' Punkte'+(ov.label?(' · rot: '+ov.label):'')+' · Liste: '+seriesList.length;
  }

  if(diffHost){
    const ka=getSofRDiffA(), kb=getSofRDiffB();
    if(!ka||!kb){
      diffHost.innerHTML='';
      if(diffVal)diffVal.textContent='—';
      if(diffMeta)diffMeta.textContent='Wähle A und B · alle SOFR + alle USA-Charts ('+seriesList.length+')';
      window.__sofrDiffMeta=null;
    }else{
      const A=resolveSofRSeries(ka);
      const B=resolveSofRSeries(kb);
      const diff=alignDiffSeries(A.pts,B.pts);
      window.__sofrDiffMeta={labelA:A.label,labelB:B.label,keyA:ka,keyB:kb,pts:diff};
      if(diff.length>=2){
        const last=diff.at(-1);
        if(diffVal)diffVal.textContent=(last.value>=0?'+':'')+fmt(last.value);
        if(typeof renderLineChart==='function'){
          diffHost.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|sofrTenorDiff|'+(A.label)+' − '+(B.label)+'" title="Differenz vergrößern (6M/1J/3J)">'+renderLineChart(diff,{w:360,h:160})+'</div>';
        }
        if(diffMeta)diffMeta.textContent=A.label+' − '+B.label+' · '+diff.length+' Punkte · Tippen · 6M/1J/3J';
      }else{
        diffHost.innerHTML='<div class="sparkempty">Keine überlappende Historie</div>';
        if(diffVal)diffVal.textContent='—';
        if(diffMeta)diffMeta.textContent=A.label+' − '+B.label+' · zu wenig gemeinsame Datenpunkte';
      }
    }
  }
}
`;

if (html.includes('function paintSofRTenor')) {
  const markers = ['const SOFR_PAGE_OVERLAY_CATALOG', 'const SOFR_USA_CHART_CATALOG', 'function getSofRTenorId', 'function ensureSofRTenorPanel', 'function paintSofRTenor'];
  let start = -1;
  for (const m of markers) {
    const i = html.indexOf(m);
    if (i >= 0 && (start < 0 || i < start)) start = i;
  }
  const pStart = html.indexOf('function paintSofRTenor');
  if (pStart >= 0) {
    let i = pStart, depth = 0, started = false, end = -1;
    for (; i < html.length; i++) {
      if (html[i] === '{') { depth++; started = true; }
      else if (html[i] === '}') { depth--; if (started && depth === 0) { end = i; break; } }
    }
    if (end > 0 && start >= 0 && start < end) {
      html = html.slice(0, start) + block + '\n' + html.slice(end + 1);
      console.log('replaced SOFR tenor block');
    } else if (end > pStart) {
      html = html.slice(0, pStart) + block + '\n' + html.slice(end + 1);
      console.log('replaced paintSofRTenor only');
    }
  }
} else if (html.includes('function paintSofRFwd')) {
  html = html.replace('function paintSofRFwd', block + '\nfunction paintSofRFwd');
} else if (html.includes('function bindUsaPages')) {
  html = html.replace('function bindUsaPages', block + '\nfunction bindUsaPages');
}

if (!html.includes("typeof paintSofRTenor==='function'&&paintSofRTenor()")) {
  html = html.replace(
    /typeof paintSofRFwd==='function'&&paintSofRFwd\(\)/g,
    "typeof paintSofRFwd==='function'&&paintSofRFwd();typeof paintSofRTenor==='function'&&paintSofRTenor()"
  );
}
if (html.includes('function paintSofRFwd')) {
  const s = html.indexOf('function paintSofRFwd');
  let i = s, depth = 0, started = false, end = -1;
  for (; i < html.length; i++) {
    if (html[i] === '{') { depth++; started = true; }
    else if (html[i] === '}') { depth--; if (started && depth === 0) { end = i; break; } }
  }
  if (end > s) {
    const body = html.slice(s, end);
    if (!body.includes('paintSofRTenor()')) {
      html = html.slice(0, end) + "\n  try{typeof paintSofRTenor==='function'&&paintSofRTenor()}catch(e){}\n" + html.slice(end);
    }
  }
}

// Enlarge support for sofrTenorDiff
if (!html.includes("key==='sofrTenorDiff'")) {
  const marker = "if(key==='sofrTenorHist')";
  const idx = html.indexOf(marker);
  if (idx >= 0) {
    const inject =
      "if(key==='sofrTenorDiff'){\n" +
      "    const dm=window.__sofrDiffMeta||{};\n" +
      "    let pts=dm.pts||[];\n" +
      "    if(typeof filterByRange==='function'){const p2=filterByRange(pts,range); if(p2.length) pts=p2;}\n" +
      "    if(!pts.length){body.innerHTML='<div class=\\\"sparkempty\\\">Keine Daten</div>';if(meta)meta.textContent='';return;}\n" +
      "    body.innerHTML=renderLineChart(pts,{w:720,h:300,big:true})+'<div class=\\\"chart-tip-inline\\\" id=\\\"chartDlgTip\\\"></div>';\n" +
      "    if(typeof bindBigChartHover==='function')bindBigChartHover(body);\n" +
      "    if(meta)meta.textContent=(dm.labelA||'A')+' − '+(dm.labelB||'B')+' · '+rLabel+' · '+pts.length+' Punkte';\n" +
      "    return;\n" +
      "  }\n  ";
    html = html.slice(0, idx) + inject + html.slice(idx);
    console.log('sofrTenorDiff enlarge');
  }
}

fs.writeFileSync('index.html', html);
console.log('done', html.includes('sofrDiffA'), html.includes('buildSofRSeriesList'), html.includes("key==='sofrTenorDiff'"));
