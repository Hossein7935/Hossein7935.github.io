import fs from 'fs';
import { execSync } from 'child_process';

const BLOB = 'a6caa893a71d4a120f53ca5f6b639b22bacd7414';
let raw = execSync(`curl -sL https://api.github.com/repos/Hossein7935/Hossein7935.github.io/git/blobs/${BLOB}`, {encoding:'utf8'});
const j = JSON.parse(raw);
let html = Buffer.from(j.content, 'base64').toString('utf8');
console.log('blob', html.length);

const oldNotice = 'TIPS/Bankreserven nur USA. USA: Umschalter dreht die Karte → Term SOFR 3M & 10Y–2Y.';
const newNotice = 'TIPS/Bankreserven nur USA. USA: Umschalter → SOFR, Spreads, Schulden & <b>Kupfer/Gold Ratio</b> (Live, &gt;20 Jahre).';
if (!html.includes(oldNotice)) throw new Error('notice not found');
html = html.replace(oldNotice, newNotice);

const cu = '<div class="metric has-chart" style="grid-column:1/-1;min-height:320px"><div class="name">Kupfer / Gold Ratio (HG1! / GC1!)</div><div class="value" id="cuAuLiveLabel">Live · TradingView</div><div class="date">Historie &gt; 20 Jahre · live / bei „Aktualisieren“ · <a href="https://www.tradingview.com/chart/?symbol=HG1%21%2FGC1%21" target="_blank" rel="noopener" style="color:var(--accent)">TradingView ↗</a></div><div id="tradingview_cu_au" style="height:260px;margin-top:8px;border-radius:8px;overflow:hidden"></div></div>';
const marker = "${historyHTML('USA','bofaCcc')}</div>";
if (!html.includes(marker)) throw new Error('marker not found');
html = html.replace(marker, marker + cu);

const tv = `
function loadCuAuChart(){
  const el=document.getElementById('tradingview_cu_au');
  if(!el)return;
  el.innerHTML='';
  if(typeof TradingView==='undefined'){
    const s=document.createElement('script');
    s.src='https://s3.tradingview.com/tv.js';
    s.onload=()=>loadCuAuChart();
    document.head.appendChild(s);
    return;
  }
  const isLight=document.documentElement.dataset.theme==='light';
  new TradingView.widget({
    container_id:'tradingview_cu_au',
    symbol:'HG1!/GC1!',
    interval:'W',
    timezone:'Europe/Berlin',
    theme:isLight?'light':'dark',
    style:'1',
    locale:'de',
    toolbar_bg:isLight?'#f1f3f6':'#1e222d',
    enable_publishing:false,
    hide_top_toolbar:false,
    hide_legend:false,
    save_image:false,
    height:260,
    width:'100%',
    range:'120M',
    details:true,
    hotlist:false,
    calendar:false,
    withdateranges:true,
    allow_symbol_change:false
  });
}
function ensureCuAuOnFlip(){
  const b=document.querySelector('.usa-face-b');
  if(b && !b.classList.contains('hidden')) loadCuAuChart();
}
document.addEventListener('DOMContentLoaded',()=>{setTimeout(ensureCuAuOnFlip,500)});
document.querySelector('#refresh')?.addEventListener('click',()=>{setTimeout(loadCuAuChart,900)});
document.addEventListener('change',e=>{
  if(e.target && e.target.id==='usaExtraToggle') setTimeout(ensureCuAuOnFlip,250);
});
`;

const idx = html.lastIndexOf('refresh();');
if (idx < 0) throw new Error('refresh not found');
html = html.slice(0, idx) + tv + '\n' + html.slice(idx);

const oldT = "document.querySelector('#themeToggle').addEventListener('click',()=>{const t=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=t;try{localStorage.setItem('macrowatch-theme',t)}catch(e){};document.querySelector('#themeToggle').textContent=t==='light'?'🌙 Dunkles Design':'☀️ Helles Design'});";
const newT = "document.querySelector('#themeToggle').addEventListener('click',()=>{const t=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=t;try{localStorage.setItem('macrowatch-theme',t)}catch(e){};document.querySelector('#themeToggle').textContent=t==='light'?'🌙 Dunkles Design':'☀️ Helles Design';setTimeout(loadCuAuChart,350)});";
if (html.includes(oldT)) html = html.replace(oldT, newT);

fs.writeFileSync('index.html', html);
console.log('written', html.length, 'hasCuAu', html.includes('tradingview_cu_au'));
