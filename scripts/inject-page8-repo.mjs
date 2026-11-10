import fs from 'fs';

/** USA Seite 8 / face-h: Repo-Markt — MMF + Repo OFR charts */
let html = fs.readFileSync('index.html', 'utf8');

// Ensure face-h shell exists inside USA card
if (!html.includes('usa-face-h')) {
  // after face-g closing
  if (html.includes('usa-face-g')) {
    html = html.replace(
      /(<div class="usa-face-g[\s\S]*?<\/div>\s*)(<\/div>\s*<div class="usa-flip-toggle|<\/div>\s*<\/article|<\/div>\s*<\/div>)/,
      '$1<div class="usa-face-h hidden" data-usa-face="7"></div>$2'
    );
    if (!html.includes('usa-face-h')) {
      // simpler: append before usa-flip-toggle if present
      html = html.replace(
        '<div class="usa-flip-toggle"',
        '<div class="usa-face-h hidden" data-usa-face="7"></div>\n<div class="usa-flip-toggle"'
      );
    }
    console.log('face-h added', html.includes('usa-face-h'));
  }
}

// Seite 8 button
if (!html.includes('data-page="7"') && !html.includes("data-page=\"7\"")) {
  html = html.replace(
    /(data-page="6"[^>]*>)([^<]*)(<\/button>)/,
    '$1$2$3<button type="button" data-page="7">Repo-Markt</button>'
  );
  html = html.replace(
    /(data-page=\"6\"[^>]*>)([^<]*)(<\/button>)/,
    '$1$2$3<button type=\"button\" data-page=\"7\">Repo-Markt</button>'
  );
  console.log('button 7', html.includes('data-page="7"') || html.includes('data-page=\"7\"'));
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
function ensureRepoPage(){
  const face=document.querySelector('.usa-face-h');
  if(!face)return null;
  if(document.getElementById('repoMmfPanel'))return face;
  face.innerHTML=
    '<div class="metric has-chart" id="repoMmfPanel" style="grid-column:1/-1">'+
      '<div class="name">Repo-Markt · MMF Vermögen & Repo-Anteil</div>'+
      '<div class="value" id="repoMmfValue">—</div>'+
      '<div class="date" id="repoMmfDate">OFR · MMF Total (blau) · MMF Repo (türkis)</div>'+
      '<div class="sofr-fwd-bp" style="gap:8px;flex-wrap:wrap;margin:6px 0">'+
        '<label style="font-size:12px">Rot-Overlay <select id="repoMmfRed">'+repoCatOptions()+'</select></label>'+
        '<label style="font-size:12px">Grün Diff A <select id="repoMmfGa">'+repoCatOptions()+'</select></label>'+
        '<label style="font-size:12px">− B <select id="repoMmfGb">'+repoCatOptions()+'</select></label>'+
      '</div>'+
      '<div id="repoMmfChart"></div>'+
      '<div class="sofr-fwd-meta" id="repoMmfMeta">OFR MMF-MMF_TOT-M / MMF-MMF_RP_TOT-M · $ Billionen</div>'+
    '</div>'+
    '<div class="metric has-chart" id="repoVolPanel" style="grid-column:1/-1">'+
      '<div class="name">Repo-Markt · Volumen & Konditionen</div>'+
      '<div class="value" id="repoVolValue">—</div>'+
      '<div class="date" id="repoVolDate">OFR · TRI/DVP Overnight Volumen + Sätze · SOFR</div>'+
      '<div class="sofr-fwd-bp" style="gap:8px;flex-wrap:wrap;margin:6px 0">'+
        '<label style="font-size:12px">Rot-Overlay <select id="repoVolRed">'+repoCatOptions()+'</select></label>'+
        '<label style="font-size:12px">Grün Diff A <select id="repoVolGa">'+repoCatOptions()+'</select></label>'+
        '<label style="font-size:12px">− B <select id="repoVolGb">'+repoCatOptions()+'</select></label>'+
      '</div>'+
      '<div id="repoVolChart"></div>'+
      '<div class="sofr-fwd-meta" id="repoVolMeta">OFR REPO-TRI/DVP · Volumen $B · Sätze %</div>'+
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
  if(vEl){
    const t=mmfTot.at(-1), r=mmfRepo.at(-1);
    vEl.textContent=(t?fmt(t.value)+'T':'—')+' · Repo '+(r?fmt(r.value)+'T':'—');
  }
  if(dEl)dEl.textContent='Stand '+(info.mmfTotLast&&info.mmfTotLast.period||'')+' · OFR monatlich';

  const redKey=getRepoLS('macrowatch-repo-mmf-red');
  let redPts=redKey?(histories['USA-'+redKey]||[]):[];
  const ga=getRepoLS('macrowatch-repo-mmf-ga'), gb=getRepoLS('macrowatch-repo-mmf-gb');
  let greenPts=[];
  if(ga&&gb) greenPts=alignRepoDiff(histories['USA-'+ga]||[], histories['USA-'+gb]||[]);
  window.__repoMmfMeta={redKey,ga,gb,greenPts,redPts,mmfTot,mmfRepo};

  if(host){
    if(typeof renderDiffOverlayChart==='function'&&(mmfTot.length||mmfRepo.length)){
      // blue=mmfTot as "diff" axis, red=overlay or mmfRepo, green=diff
      const base=mmfTot.length?mmfTot:mmfRepo;
      const ov=redPts.length?redPts:mmfRepo;
      host.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|repoMmfDual|MMF Total / Repo" title="Vergrößern">'+
        renderDiffOverlayChart(base,ov,{w:360,h:180,greenPts:greenPts})+'</div>';
    }else if(typeof renderLineChart==='function'){
      host.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|repoMmfDual|MMF" title="Vergrößern">'+renderLineChart(mmfTot,{w:360,h:160})+'</div>';
    }
  }
  if(meta){
    const bits=['OFR MMF Total blau'];
    if(redKey)bits.push('rot: '+(REPO_PAGE_CATALOG.find(c=>c.key===redKey)||{}).label||redKey);
    else bits.push('türkis/rot: MMF Repo');
    if(ga&&gb)bits.push('grün: Diff');
    meta.textContent=bits.join(' · ')+' · $T';
  }

  // Volume / rates panel
  const triVol=histories['USA-repoTriVol']||[];
  const triRate=histories['USA-repoTriRate']||[];
  const sofr=histories['USA-sofr']||[];
  const vv=document.getElementById('repoVolValue');
  const vd=document.getElementById('repoVolDate');
  const vhost=document.getElementById('repoVolChart');
  const vmeta=document.getElementById('repoVolMeta');
  if(vv){
    const tv=triVol.at(-1), tr=triRate.at(-1);
    vv.textContent=(tv?fmt(tv.value)+'B':'—')+' · '+(tr?fmt(tr.value)+'%':'—');
  }
  if(vd)vd.textContent='TRI Overnight · Stand '+(triVol.at(-1)||{}).period;

  const vRed=getRepoLS('macrowatch-repo-vol-red');
  let vRedPts=vRed?(histories['USA-'+vRed]||[]):[];
  const vga=getRepoLS('macrowatch-repo-vol-ga'), vgb=getRepoLS('macrowatch-repo-vol-gb');
  let vGreen=[];
  if(vga&&vgb) vGreen=alignRepoDiff(histories['USA-'+vga]||[], histories['USA-'+vgb]||[]);
  // default dual: volume blue, tri rate as red if no overlay
  const baseVol=triVol.length?triVol:(histories['USA-repoVolSum']||[]);
  const rateLine=vRedPts.length?vRedPts:(triRate.length?triRate:sofr);
  window.__repoVolMeta={redKey:vRed,ga:vga,gb:vgb,greenPts:vGreen,baseVol,rateLine};

  if(vhost){
    if(typeof renderDiffOverlayChart==='function'&&baseVol.length){
      vhost.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|repoVolDual|Repo Vol / Rate" title="Vergrößern">'+
        renderDiffOverlayChart(baseVol,rateLine,{w:360,h:180,greenPts:vGreen})+'</div>';
    }else if(typeof renderLineChart==='function'){
      vhost.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|repoVolDual|Repo" title="Vergrößern">'+renderLineChart(baseVol,{w:360,h:160})+'</div>';
    }
  }
  if(vmeta){
    const bits=['TRI Vol $B blau'];
    bits.push(vRed?('rot: '+((REPO_PAGE_CATALOG.find(c=>c.key===vRed)||{}).label||vRed)):'rot: TRI Rate %');
    if(vga&&vgb)bits.push('grün: Diff');
    vmeta.textContent=bits.join(' · ')+' · OFR täglich';
  }
}
`;

if (!html.includes('function paintRepoPage')) {
  if (html.includes('function bindUsaPages')) {
    html = html.replace('function bindUsaPages', block + '\nfunction bindUsaPages');
  } else if (html.includes('function setUsaPage')) {
    html = html.replace('function setUsaPage', block + '\nfunction setUsaPage');
  }
  console.log('paintRepoPage injected');
}

// Expand setUsaPage to page 7
html = html.replace(
  /page=Math\.max\(0,Math\.min\(6,Number\(page\)\|\|0\)\)/g,
  'page=Math.max(0,Math.min(7,Number(page)||0))'
);
html = html.replace(
  /const faces=\['\.usa-face-a',\.usa-face-b',\.usa-face-c',\.usa-face-d',\.usa-face-e',\.usa-face-f',\.usa-face-g'\]/g,
  "const faces=['.usa-face-a','.usa-face-b','.usa-face-c','.usa-face-d','.usa-face-e','.usa-face-f','.usa-face-g','.usa-face-h']"
);
// fix typo if replace failed - do explicit
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
html = html.replace(/start>6/g, 'start>7');
html = html.replace(/start>6\)/g, 'start>7)');
html = html.replace(/start<0\|\|start>6/g, 'start<0||start>7');

// paintChartDlg enlarge for repo duals
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
      "    } else {\n" +
      "      body.innerHTML=renderLineChart(base,{w:720,h:300,big:true})+'<div class=\"chart-tip-inline\" id=\"chartDlgTip\"></div>';\n" +
      "    }\n" +
      "    if(typeof bindBigChartHover==='function')bindBigChartHover(body);\n" +
      "    if(meta)meta.textContent=(key==='repoMmfDual'?'MMF Total/Repo':'Repo Vol/Rate')+' · '+rLabel+' · '+base.length+' Punkte';\n" +
      "    return;\n" +
      "  }\n  ";
    html = html.slice(0, idx) + inject + html.slice(idx);
    console.log('repo enlarge');
  }
}

fs.writeFileSync('index.html', html);
console.log('done', html.includes('paintRepoPage'), html.includes('usa-face-h'), html.includes('repoMmfDual'));
