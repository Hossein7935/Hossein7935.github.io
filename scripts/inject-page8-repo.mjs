import fs from 'fs';

/** USA Seite 8 / face-h: Repo-Markt — DO NOT wipe USA page-select template */
let html = fs.readFileSync('index.html', 'utf8');

// NEVER replace the USA ternary with empty string.
// Only remove a standalone empty face-h div if present, keep flip-toggle.
html = html.replace(
  /<div class="usa-face-h hidden" data-usa-face="7"><\/div>\s*(?=<div class="usa-flip-toggle")/g,
  ''
);

// Deduplicate Repo-Markt buttons only
html = html.replace(
  /(<button type="button" data-page="7">Repo-Markt<\/button>)(\s*<button type="button" data-page="7">Repo-Markt<\/button>)+/g,
  '$1'
);
html = html.replace(
  /(<button type=\"button\" data-page=\"7\">Repo-Markt<\/button>)(\s*<button type=\"button\" data-page=\"7\">Repo-Markt<\/button>)+/g,
  '$1'
);

// Ensure Repo-Markt button exists inside usaPageSelect
if (html.includes('usaPageSelect') && !html.includes('>Repo-Markt</button>') && !html.includes('>Repo-Markt<\\/button>')) {
  html = html.replace(
    /(data-page="6"[^>]*>)([^<]*)(<\/button>)/,
    '$1$2$3<button type="button" data-page="7">Repo-Markt</button>'
  );
}

const block = `
const REPO_PAGE_CATALOG=[
  {key:'mmfTot',label:'MMF Total ($T)'},
  {key:'mmfRepo',label:'MMF Repo ($T)'},
  {key:'repoTriVol',label:'Repo TRI Vol ($B)'},
  {key:'repoDvpVol',label:'Repo DVP Vol ($B)'},
  {key:'repoVolSum',label:'Repo Vol Summe ($B)'},
  {key:'repoTriRate',label:'Repo TRI Rate %'},
  {key:'repoDvpRate',label:'Repo DVP Rate %'},
  {key:'us3m',label:'US 3M'},{key:'us1y',label:'US 1Y'},{key:'us2y',label:'US 2Y'},
  {key:'us5y',label:'US 5Y'},{key:'us10y',label:'US 10Y'},{key:'us30y',label:'US 30Y'},
  {key:'dfii5',label:'TIPS 5Y'},{key:'dfii10',label:'TIPS 10Y'},
  {key:'effr',label:'EFFR'},{key:'sofr',label:'SOFR'},{key:'iorb',label:'IORB'},
  {key:'sofrIorb',label:'SOFR−IORB'},{key:'t10y2y',label:'10Y−2Y'},{key:'t10y5y',label:'10Y−5Y'},
  {key:'move',label:'MOVE'},{key:'dxy',label:'DXY'},{key:'wresbal',label:'WRESBAL'},
  {key:'effrVol',label:'EFFR Volume'},{key:'cuAu',label:'Copper/Gold'},
  {key:'rate',label:'Policy Rate'},{key:'inflation',label:'Inflation'}
];
function repoCatOptions(){
  return '<option value="">— keines —</option>'+REPO_PAGE_CATALOG.map(c=>'<option value="'+c.key+'">'+c.label+'</option>').join('');
}
function getRepoLS(k){try{return localStorage.getItem(k)||''}catch(e){return ''}}
function setRepoLS(k,v,repaint){
  try{localStorage.setItem(k,v||'')}catch(e){}
  if(repaint){try{typeof paintRepoPage==='function'&&paintRepoPage()}catch(e){}}
}
function getRepoToggle(k, def){
  try{
    const v=localStorage.getItem(k);
    if(v===null||v===undefined||v==='')return !!def;
    return v==='1'||v==='true';
  }catch(e){return !!def}
}
function setRepoToggle(k,on){
  try{localStorage.setItem(k,on?'1':'0')}catch(e){}
  try{typeof paintRepoPage==='function'&&paintRepoPage()}catch(e){}
}
function alignRepoDiff(a,b){
  const mb=new Map((b||[]).map(p=>[String(p.period),Number(p.value)]));
  const out=[];
  for(const p of a||[]){
    const bv=mb.get(String(p.period));
    if(!Number.isFinite(Number(p.value))||!Number.isFinite(bv))continue;
    out.push({period:String(p.period),value:Number(p.value)-bv});
  }
  return out;
}
function repoLegendHtml(items){
  return '<div class="repo-legend" style="display:flex;flex-direction:column;gap:8px;margin:10px 0;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:rgba(127,127,127,0.08);font-size:13px">'+
    '<div style="font-weight:600;margin-bottom:2px">Farben · Linie ein/aus</div>'+
    items.map(it=>{
      const sw='<span style="display:inline-block;width:22px;height:4px;background:'+it.color+';border-radius:2px;margin-right:8px"></span>';
      return '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;min-height:28px">'+
        '<input type="checkbox" id="'+it.toggleId+'" '+(it.on?'checked':'')+' style="width:18px;height:18px;margin:0;flex-shrink:0">'+
        sw+'<span>'+it.label+'</span></label>';
    }).join('')+
  '</div>';
}
function bindRepoToggle(id, lsKey){
  const el=document.getElementById(id);
  if(!el||el.dataset.bound)return;
  el.dataset.bound='1';
  el.addEventListener('change',()=>setRepoToggle(lsKey, !!el.checked));
}
function ensureRepoPage(){
  const card=document.querySelector('.country .usa-face-a')
    ? document.querySelector('.country .usa-face-a').closest('.country')
    : null;
  if(!card){
    const cards=[...document.querySelectorAll('.country')];
    const usa=cards.find(c=>c.querySelector('.code')&&c.querySelector('.code').textContent==='USA');
    if(!usa)return null;
    return ensureRepoPageInCard(usa);
  }
  return ensureRepoPageInCard(card);
}
function ensureRepoPageInCard(card){
  let face=card.querySelector('.usa-face-h');
  if(!face){
    face=document.createElement('div');
    face.className='metrics usa-face usa-face-h hidden';
    face.setAttribute('data-usa-face','7');
    const g=card.querySelector('.usa-face-g');
    if(g&&g.parentNode)g.after(face);
    else{
      const toggle=card.querySelector('.usa-flip-toggle');
      if(toggle&&toggle.parentNode)toggle.after(face);
      else card.appendChild(face);
    }
  }else{
    face.classList.add('metrics','usa-face','usa-face-h');
  }
  face.innerHTML=
    '<div class="metric has-chart" id="repoMmfPanel" style="grid-column:1/-1">'+
      '<div class="namediv class="name">Repo-Markt · MMF Vermögen & Repo-Anteil</div>'+
      '<div class="value" id="repoMmfValue">—</div>'+
      '<div class="date" id="repoMmfDate">OFR · Farben · Linien abwählbar</div>'+
      '<div id="repoMmfLegend"></div>'+
      '<div class="sofr-fwd-bp" style="gap:8px;flex-wrap:wrap;margin:6px 0">'+
        '<label style="font-size:12px">Rot-Overlay <select id="repoMmfRed">'+repoCatOptions()+'</select></label>'+
        '<label style="font-size:12px">Grün Diff A <select id="repoMmfGa">'+repoCatOptions()+'</select></label>'+
        '<label style="font-size:12px">− B <select id="repoMmfGb">'+repoCatOptions()+'</select></label>'+
      '</div>'+
      '<div id="repoMmfChart"></div>'+
      '<div class="sofr-fwd-meta" id="repoMmfMeta">Blau = MMF Total · Rot = MMF Repo / Overlay</div>'+
    '</div>'+
    '<div class="metric has-chart" id="repoVolPanel" style="grid-column:1/-1">'+
      '<div class="name">Repo-Markt · Volumen & Konditionen</div>'+
      '<div class="value" id="repoVolValue">—</div>'+
      '<div class="date" id="repoVolDate">OFR · Farben · Linien abwählbar</div>'+
      '<div id="repoVolLegend"></div>'+
      '<div class="sofr-fwd-bp" style="gap:8px;flex-wrap:wrap;margin:6px 0">'+
        '<label style="font-size:12px">Rot-Overlay <select id="repoVolRed">'+repoCatOptions()+'</select></label>'+
        '<label style="font-size:12px">Grün Diff A <select id="repoVolGa">'+repoCatOptions()+'</select></label>'+
        '<label style="font-size:12px">− B <select id="repoVolGb">'+repoCatOptions()+'</select></label>'+
      '</div>'+
      '<div id="repoVolChart"></div>'+
      '<div class="sofr-fwd-meta" id="repoVolMeta">Blau = TRI Volumen · Rot = TRI Satz / Overlay</div>'+
    '</div>';
  return face;
}
function bindRepoSelect(id, lsKey){
  const el=document.getElementById(id);
  if(!el||el.dataset.bound)return;
  el.dataset.bound='1';
  el.value=getRepoLS(lsKey);
  el.addEventListener('change',()=>setRepoLS(lsKey,el.value,true));
}
function paintRepoPage(){
  const face=ensureRepoPage();
  if(!face)return;
  ['repoMmfRed','repoMmfGa','repoMmfGb','repoVolRed','repoVolGa','repoVolGb'].forEach((id,i)=>{
    const keys=['macrowatch-repo-mmf-red','macrowatch-repo-mmf-ga','macrowatch-repo-mmf-gb','macrowatch-repo-vol-red','macrowatch-repo-vol-ga','macrowatch-repo-vol-gb'];
    bindRepoSelect(id, keys[i]);
    const el=document.getElementById(id);
    if(el)el.value=getRepoLS(keys[i]);
  });

  const mmfTot=histories['USA-mmfTot']||[];
  const mmfRepo=histories['USA-mmfRepo']||[];
  const info=(data.USA&&data.USA.repoMmf)||{};
  const vEl=document.getElementById('repoMmfValue');
  const dEl=document.getElementById('repoMmfDate');
  const host=document.getElementById('repoMmfChart');
  const meta=document.getElementById('repoMmfMeta');
  const legEl=document.getElementById('repoMmfLegend');
  if(vEl){
    const t=mmfTot.at(-1), r=mmfRepo.at(-1);
    vEl.textContent=(t?fmt(t.value)+'T':'—')+' · Repo '+(r?fmt(r.value)+'T':'—');
  }
  if(dEl)dEl.textContent='Stand '+(info.mmfTotLast&&info.mmfTotLast.period||'')+' · OFR monatlich';

  const showBlue=getRepoToggle('macrowatch-repo-mmf-blue', true);
  const showSec=getRepoToggle('macrowatch-repo-mmf-sec', true);
  const showGreen=getRepoToggle('macrowatch-repo-mmf-green', true);
  const redKey=getRepoLS('macrowatch-repo-mmf-red');
  let redPts=redKey?(histories['USA-'+redKey]||[]):[];
  const ga=getRepoLS('macrowatch-repo-mmf-ga'), gb=getRepoLS('macrowatch-repo-mmf-gb');
  let greenPts=[];
  if(ga&&gb) greenPts=alignRepoDiff(histories['USA-'+ga]||[], histories['USA-'+gb]||[]);
  const secLabel=redKey?(((REPO_PAGE_CATALOG.find(c=>c.key===redKey)||{}).label)||redKey):'MMF Repo ($T)';
  const secPts=redKey?redPts:mmfRepo;

  if(legEl){
    const items=[
      {color:'#3b82f6',label:'BLAU = MMF Total Assets ($ Billionen)',toggleId:'repoMmfBlueTog',on:showBlue},
      {color:'#ef4444',label:'ROT = '+secLabel,toggleId:'repoMmfSecTog',on:showSec}
    ];
    if(ga&&gb){
      const la=((REPO_PAGE_CATALOG.find(c=>c.key===ga)||{}).label)||ga;
      const lb=((REPO_PAGE_CATALOG.find(c=>c.key===gb)||{}).label)||gb;
      items.push({color:'#22c55e',label:'GRÜN = Diff '+la+' − '+lb,toggleId:'repoMmfGreenTog',on:showGreen});
    }
    legEl.innerHTML=repoLegendHtml(items);
    bindRepoToggle('repoMmfBlueTog','macrowatch-repo-mmf-blue');
    bindRepoToggle('repoMmfSecTog','macrowatch-repo-mmf-sec');
    bindRepoToggle('repoMmfGreenTog','macrowatch-repo-mmf-green');
  }

  let base=showBlue?mmfTot.slice():[];
  let ov=showSec?secPts.slice():[];
  let gr=showGreen?greenPts.slice():[];
  if(!base.length&&ov.length){base=ov;ov=[];}
  window.__repoMmfMeta={redKey,ga,gb,greenPts:gr,redPts:ov,mmfTot:base,mmfRepo:ov};

  if(host){
    if(typeof renderDiffOverlayChart==='function'&&base.length){
      host.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|repoMmfDual|MMF Total / Repo" title="Vergrößern">'+renderDiffOverlayChart(base,ov,{w:360,h:180,greenPts:gr})+'</div>';
    }else if(typeof renderLineChart==='function'&&base.length){
      host.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|repoMmfDual|MMF" title="Vergrößern">'+renderLineChart(base,{w:360,h:160})+'</div>';
    }else host.innerHTML='<div class="sparkempty">Keine Linie aktiv</div>';
  }
  if(meta)meta.textContent='BLAU=MMF Total · ROT='+secLabel+(ga&&gb?' · GRÜN=Diff':'');

  const triVol=histories['USA-repoTriVol']||[];
  const triRate=histories['USA-repoTriRate']||[];
  const sofr=histories['USA-sofr']||[];
  const vv=document.getElementById('repoVolValue');
  const vd=document.getElementById('repoVolDate');
  const vhost=document.getElementById('repoVolChart');
  const vmeta=document.getElementById('repoVolMeta');
  const vleg=document.getElementById('repoVolLegend');
  if(vv){
    const tv=triVol.at(-1), tr=triRate.at(-1);
    vv.textContent=(tv?fmt(tv.value)+'B':'—')+' · '+(tr?fmt(tr.value)+'%':'—');
  }
  if(vd)vd.textContent='TRI Overnight · Stand '+(triVol.at(-1)||{}).period;

  const vShowBlue=getRepoToggle('macrowatch-repo-vol-blue', true);
  const vShowSec=getRepoToggle('macrowatch-repo-vol-sec', true);
  const vShowGreen=getRepoToggle('macrowatch-repo-vol-green', true);
  const vRed=getRepoLS('macrowatch-repo-vol-red');
  let vRedPts=vRed?(histories['USA-'+vRed]||[]):[];
  const vga=getRepoLS('macrowatch-repo-vol-ga'), vgb=getRepoLS('macrowatch-repo-vol-gb');
  let vGreen=[];
  if(vga&&vgb) vGreen=alignRepoDiff(histories['USA-'+vga]||[], histories['USA-'+vgb]||[]);
  const vSecLabel=vRed?(((REPO_PAGE_CATALOG.find(c=>c.key===vRed)||{}).label)||vRed):'TRI Overnight-Satz (%)';
  const vSecPts=vRed?vRedPts:(triRate.length?triRate:sofr);

  if(vleg){
    const items=[
      {color:'#3b82f6',label:'BLAU = TRI Repo-Volumen ($ Milliarden)',toggleId:'repoVolBlueTog',on:vShowBlue},
      {color:'#ef4444',label:'ROT = '+vSecLabel,toggleId:'repoVolSecTog',on:vShowSec}
    ];
    if(vga&&vgb){
      const la=((REPO_PAGE_CATALOG.find(c=>c.key===vga)||{}).label)||vga;
      const lb=((REPO_PAGE_CATALOG.find(c=>c.key===vgb)||{}).label)||vgb;
      items.push({color:'#22c55e',label:'GRÜN = Diff '+la+' − '+lb,toggleId:'repoVolGreenTog',on:vShowGreen});
    }
    vleg.innerHTML=repoLegendHtml(items);
    bindRepoToggle('repoVolBlueTog','macrowatch-repo-vol-blue');
    bindRepoToggle('repoVolSecTog','macrowatch-repo-vol-sec');
    bindRepoToggle('repoVolGreenTog','macrowatch-repo-vol-green');
  }

  let baseVol=vShowBlue?(triVol.length?triVol.slice():(histories['USA-repoVolSum']||[]).slice()):[];
  let rateLine=vShowSec?vSecPts.slice():[];
  let vGr=vShowGreen?vGreen.slice():[];
  if(!baseVol.length&&rateLine.length){baseVol=rateLine;rateLine=[];}
  window.__repoVolMeta={redKey:vRed,ga:vga,gb:vgb,greenPts:vGr,baseVol,rateLine,redPts:rateLine};

  if(vhost){
    if(typeof renderDiffOverlayChart==='function'&&baseVol.length){
      vhost.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|repoVolDual|Repo Vol / Rate" title="Vergrößern">'+renderDiffOverlayChart(baseVol,rateLine,{w:360,h:180,greenPts:vGr})+'</div>';
    }else if(typeof renderLineChart==='function'&&baseVol.length){
      vhost.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|repoVolDual|Repo" title="Vergrößern">'+renderLineChart(baseVol,{w:360,h:160})+'</div>';
    }else vhost.innerHTML='<div class="sparkempty">Keine Linie aktiv</div>';
  }
  if(vmeta)vmeta.textContent='BLAU=TRI Volumen · ROT='+vSecLabel+(vga&&vgb?' · GRÜN=Diff':'');
}
`;

if (html.includes('function paintRepoPage')) {
  const markers = ['const REPO_PAGE_CATALOG', 'function paintRepoPage', 'function ensureRepoPage', 'function getRepoLS', 'function getRepoToggle'];
  let start = -1;
  for (const m of markers) {
    const i = html.indexOf(m);
    if (i >= 0 && (start < 0 || i < start)) start = i;
  }
  const pStart = html.indexOf('function paintRepoPage');
  if (pStart >= 0) {
    let i = pStart, depth = 0, started = false, end = -1;
    for (; i < html.length; i++) {
      if (html[i] === '{') { depth++; started = true; }
      else if (html[i] === '}') { depth--; if (started && depth === 0) { end = i; break; } }
    }
    if (end > 0 && start >= 0 && start < end) {
      html = html.slice(0, start) + block + '\n' + html.slice(end + 1);
      console.log('replaced repo page block');
    } else if (end > pStart) {
      html = html.slice(0, pStart) + block + '\n' + html.slice(end + 1);
      console.log('replaced paintRepoPage only');
    }
  }
} else if (html.includes('function bindUsaPages')) {
  html = html.replace('function bindUsaPages', block + '\nfunction bindUsaPages');
}

// Ensure setUsaPage knows page 7
html = html.replace(/page=Math\.max\(0,Math\.min\(6,Number\(page\)\|\|0\)\)/g, 'page=Math.max(0,Math.min(7,Number(page)||0))');
if (!html.includes(".usa-face-h'")) {
  html = html.replace(
    "const faces=['.usa-face-a','.usa-face-b','.usa-face-c','.usa-face-d','.usa-face-e','.usa-face-f','.usa-face-g']",
    "const faces=['.usa-face-a','.usa-face-b','.usa-face-c','.usa-face-d','.usa-face-e','.usa-face-f','.usa-face-g','.usa-face-h']"
  );
}
if (!html.includes('page===7')) {
  html = html.replace(
    /if\(page===6\)setTimeout\(\(\)=>\{try\{typeof paintYieldPage7==='function'&&paintYieldPage7\(\)\}catch\(e\)\{\}\},50\);/,
    "if(page===6)setTimeout(()=>{try{typeof paintYieldPage7==='function'&&paintYieldPage7()}catch(e){}},50);\n  if(page===7)setTimeout(()=>{try{typeof paintRepoPage==='function'&&paintRepoPage()}catch(e){}},50);"
  );
}

if (!html.includes("key==='repoMmfDual'")) {
  const marker = "if(key==='sofrTenorHist')";
  const idx = html.indexOf(marker);
  if (idx >= 0) {
    const inject =
      "if(key==='repoMmfDual'||key==='repoVolDual'){\n" +
      "    const rm=key==='repoMmfDual'?(window.__repoMmfMeta||{}):(window.__repoVolMeta||{});\n" +
      "    let base=key==='repoMmfDual'?(rm.mmfTot||histories['USA-mmfTot']||[]):(rm.baseVol||histories['USA-repoTriVol']||[]);\n" +
      "    let ov=rm.redPts&&rm.redPts.length?rm.redPts:(key==='repoMmfDual'?(rm.mmfRepo||histories['USA-mmfRepo']||[]):(rm.rateLine||histories['USA-repoTriRate']||[]));\n" +
      "    let gr=rm.greenPts||[];\n" +
      "    if(typeof filterByRange==='function'){\n" +
      "      const b2=filterByRange(base,range); if(b2.length) base=b2;\n" +
      "      const o2=filterByRange(ov,range); if(o2.length) ov=o2;\n" +
      "      const g2=filterByRange(gr,range); if(g2.length) gr=g2;\n" +
      "    }\n" +
      "    if(!base.length){body.innerHTML='<div class=\"sparkempty\">Keine Daten</div>';if(meta)meta.textContent='';return;}\n" +
      "    if(typeof renderDiffOverlayChart==='function'){\n" +
      "      body.innerHTML=renderDiffOverlayChart(base,ov,{w:720,h:320,big:true,greenPts:gr})+'<div class=\"chart-tip-inline\" id=\"chartDlgTip\"></div>';\n" +
      "    } else body.innerHTML=renderLineChart(base,{w:720,h:300,big:true})+'<div class=\"chart-tip-inline\" id=\"chartDlgTip\"></div>';\n" +
      "    if(typeof bindBigChartHover==='function')bindBigChartHover(body);\n" +
      "    if(meta)meta.textContent=(key==='repoMmfDual'?'MMF':'Repo')+' · '+rLabel;\n" +
      "    return;\n" +
      "  }\n  ";
    html = html.slice(0, idx) + inject + html.slice(idx);
  }
}

// Safety: if USA template still empty, restore toggle
if (html.includes("${c.id==='USA'?``:''}")) {
  const good = "${c.id==='USA'?`<div class=\"usa-flip-toggle\"><div class=\"usa-page-select\" id=\"usaPageSelect\"><button type=\"button\" data-page=\"0\">Seite 1</button><button type=\"button\" data-page=\"1\">Seite 2</button><button type=\"button\" data-page=\"2\">Seite 3</button><button type=\"button\" data-page=\"3\">Seite 4</button><button type=\"button\" data-page=\"4\">Seite 5</button><button type=\"button\" data-page=\"5\">Seite 6</button><button type=\"button\" data-page=\"6\">Seite 7</button><button type=\"button\" data-page=\"7\">Repo-Markt</button></div></div>`:''}";
  html = html.replace("${c.id==='USA'?``:''}", good);
  console.log('restored USA page-select template');
}

fs.writeFileSync('index.html', html);
console.log('done', html.includes('paintRepoPage'), html.includes('usaPageSelect'), html.includes("${c.id==='USA'?``:''}")===false);
