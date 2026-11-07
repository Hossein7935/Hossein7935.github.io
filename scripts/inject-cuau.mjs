import fs from 'fs';

// Work on the CURRENT index.html produced by restore-index.mjs.
// Do NOT restore from an old git blob — that was wiping newer faceB metrics.
let html = fs.readFileSync('index.html', 'utf8');
console.log('base index.html', html.length);

const oldNotice = 'TIPS/Bankreserven nur USA. USA: Umschalter dreht die Karte → Term SOFR 3M & 10Y–2Y.';
const newNotice = 'TIPS/Bankreserven nur USA. USA: Umschalter → SOFR, Spreads, Schulden, 10Y−5Y & <b>Kupfer/Gold</b> (nativer Chart, auto-Update).';
if (html.includes(oldNotice)) html = html.replace(oldNotice, newNotice);

html = html.replace(/function loadCuAuChart\([\s\S]*?ensureCuAuOnFlip[\s\S]*?usaExtraToggle'\) setTimeout\(ensureCuAuOnFlip,250\);\n\}\);/g, '');
html = html.replace(/<div class="metric has-chart" style="grid-column:1\/-1[\s\S]*?tradingview_cu_au[\s\S]*?<\/div><\/div>/g, '');

const cuMetric = '<div class="metric has-chart"><div class="name">Kupfer / Gold Ratio ×1000</div><div class="value" id="cuAuValue">—</div><div class="date" id="cuAuDate">Yahoo HG=F ÷ GC=F</div><div id="cuAuChartHost"></div></div>';
const marker = "${historyHTML('USA','bofaCcc')}</div>";
if (!html.includes('id="cuAuValue"')) {
  if (!html.includes(marker)) throw new Error('marker missing for cuAu inject');
  html = html.replace(marker, marker + cuMetric);
}

if (!html.includes("key==='cuAu'")) {
  html = html.replace("key==='us5yTips'){", "key==='us5yTips'||key==='cuAu'){");
  html = html.replace("key==='t10y5y'){", "key==='t10y5y'||key==='cuAu'){");
}
if (!html.includes("cuAu:'Kupfer")) {
  html = html.replace("us5yTips:'US5Y − TIPS5Y'}", "us5yTips:'US5Y − TIPS5Y',cuAu:'Kupfer / Gold Ratio'}");
  html = html.replace("t10y5y:'10Y − 5Y Spread'}", "t10y5y:'10Y − 5Y Spread',cuAu:'Kupfer / Gold Ratio'}");
}
if (!html.includes("'cuAu']")) {
  html = html.replace("'hhDebt','bizDebt']", "'hhDebt','bizDebt','cuAu']");
  html = html.replace("'hhDebt','bizDebt','t10y5y']", "'hhDebt','bizDebt','t10y5y','cuAu']");
}

// Ensure t10y5y is in ALL_KEYS if missing
if (!html.includes("'t10y5y'")) {
  html = html.replace("'t10y2y','tips5'", "'t10y2y','t10y5y','tips5'");
}

const js = `
function fmtCuAu(v){return Number(v).toLocaleString('de-DE',{maximumFractionDigits:4,minimumFractionDigits:2})}
function paintCuAu(){
  const host=document.getElementById('cuAuChartHost');
  const valEl=document.getElementById('cuAuValue');
  const dateEl=document.getElementById('cuAuDate');
  if(!host)return;
  const arr=histories['USA-cuAu']||[];
  if(!arr.length){host.innerHTML='<div class="sparkempty">Keine Cu/Au-Daten – Aktualisieren drücken</div>';if(valEl)valEl.textContent='—';return}
  const pts=arr.map(x=>({period:String(x.period),value:Number(x.value)})).filter(x=>Number.isFinite(x.value));
  if(!pts.length){host.innerHTML='<div class="sparkempty">Keine gültigen Werte</div>';return}
  const last=pts.at(-1);
  if(valEl)valEl.textContent=fmtCuAu(last.value);
  if(dateEl)dateEl.innerHTML='Stand '+esc(String(last.period))+' · Ratio×1000 · <a href="https://finance.yahoo.com/quote/HG%3DF" target="_blank" rel="noopener" style="color:var(--accent)">Yahoo ↗</a>';
  const _fmt=fmt; window.fmt=function(v){return fmtCuAu(v)};
  try{
    host.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|cuAu|Kupfer / Gold Ratio" title="Chart vergrößern">'+renderLineChart(pts,{w:220,h:58})+'</div>';
  }finally{window.fmt=_fmt}
}
async function refreshCuAuFromJson(){
  try{
    const r=await fetch('./data.json?cu='+Date.now(),{cache:'no-store'});
    if(!r.ok)return;
    const payload=await r.json();
    if(payload.histories&&payload.histories['USA-cuAu']){
      histories['USA-cuAu']=payload.histories['USA-cuAu'];
      if(payload.data?.USA?.cuAu){data.USA=data.USA||{};data.USA.cuAu=payload.data.USA.cuAu}
      persist(); paintCuAu();
    }
  }catch(e){}
}
let _cuAuTimer=null;
function startCuAuAuto(){
  paintCuAu();
  if(_cuAuTimer)clearInterval(_cuAuTimer);
  _cuAuTimer=setInterval(refreshCuAuFromJson,60000);
}
document.addEventListener('DOMContentLoaded',()=>setTimeout(startCuAuAuto,700));
document.querySelector('#refresh')?.addEventListener('click',()=>setTimeout(()=>{refreshCuAuFromJson();paintCuAu()},1000));
document.addEventListener('change',e=>{if(e.target&&e.target.id==='usaExtraToggle')setTimeout(paintCuAu,250)});
`;

if (!html.includes('function paintCuAu')) {
  const idx = html.lastIndexOf('refresh();');
  if (idx < 0) throw new Error('refresh(); not found');
  html = html.slice(0, idx) + js + '\n' + html.slice(idx);
}

fs.writeFileSync('index.html', html);
console.log(
  'written', html.length,
  'cuAu', html.includes('cuAuValue'),
  't10y5y', html.includes('t10y5y') || html.includes('10Y − 5Y'),
  'paintCuAu', html.includes('paintCuAu')
);
