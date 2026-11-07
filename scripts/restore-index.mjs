import fs from 'fs';
import { execSync } from 'child_process';

const GOOD = 'b9d928f1168a1077691008e344d5968c636056a6';
let html = fs.existsSync('index.html') ? fs.readFileSync('index.html', 'utf8') : '';
if (html.length < 15000 || !html.includes('defs.map') || !html.includes('usa-face-a')) {
  try { execSync(`git show ${GOOD}:index.html > index.html`); }
  catch { execSync(`curl -sL https://raw.githubusercontent.com/Hossein7935/Hossein7935.github.io/${GOOD}/index.html -o index.html`); }
  html = fs.readFileSync('index.html', 'utf8');
  console.log('restored', html.length);
}

// If previous injects corrupted the script (duplicate faceA.after / broken tokens), force clean base
if ((html.match(/faceA\.after\(faceB\)/g) || []).length > 1 || html.includes('}grid.querySelectorAll') || html.includes('/* old usaExtraToggle removed */;')) {
  try { execSync(`git show ${GOOD}:index.html > index.html`); }
  catch { execSync(`curl -sL https://raw.githubusercontent.com/Hossein7935/Hossein7935.github.io/${GOOD}/index.html -o index.html`); }
  html = fs.readFileSync('index.html', 'utf8');
  console.log('force-clean base', html.length);
}

if (!html.includes('chart-hover')) {
  html = html.replace('class="${cls}" viewBox', 'class="${cls} chart-hover" viewBox');
  html = html.replace('r="${opts.big?12:9}"', 'r="${opts.big?14:11}"');
}

if (!html.includes('chart-crosshair-v')) {
  const inject = `svg.chart-hover{cursor:crosshair}.chart-crosshair-v,.chart-crosshair-h{stroke:var(--muted);stroke-width:1;stroke-dasharray:4 3;opacity:.7;pointer-events:none}.chart-crosshair-dot{fill:var(--accent);stroke:var(--panel);stroke-width:2;pointer-events:none}#chartDlg .chart-big{min-height:260px}#chartDlg .chart-tip-inline{position:absolute;z-index:5;background:var(--panel);border:1px solid var(--line);color:var(--text);padding:8px 12px;border-radius:10px;font-size:13px;line-height:1.4;box-shadow:0 8px 24px #0005;pointer-events:none;opacity:0;white-space:nowrap}#chartDlg .chart-tip-inline.show{opacity:1}#chartDlg #chartBody{position:relative}.usa-flip-toggle{flex-wrap:wrap;gap:8px 12px}.usa-page-select{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.usa-page-select button{padding:6px 10px;border-radius:8px;border:1px solid var(--control-line);background:var(--control);color:var(--text);font:inherit;cursor:pointer}.usa-page-select button.active{background:var(--accent);color:#09211e;border-color:var(--accent);font-weight:700}.diff-pick{display:inline-flex;align-items:center;gap:6px;margin-top:6px;font-size:11px;color:var(--muted);cursor:pointer;user-select:none}.diff-pick input{width:14px;height:14px;accent-color:var(--accent)}.diff-panel{grid-column:1/-1;border:1px dashed var(--line);border-radius:10px;padding:10px;background:var(--metric)}.diff-panel .name{min-height:auto}.diff-hint{font-size:11px;color:var(--muted);margin-top:4px}`;
  if (html.includes('</style>')) html = html.replace('</style>', inject + '</style>');
} else if (!html.includes('usa-page-select')) {
  const css = `.usa-flip-toggle{flex-wrap:wrap;gap:8px 12px}.usa-page-select{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.usa-page-select button{padding:6px 10px;border-radius:8px;border:1px solid var(--control-line);background:var(--control);color:var(--text);font:inherit;cursor:pointer}.usa-page-select button.active{background:var(--accent);color:#09211e;border-color:var(--accent);font-weight:700}.diff-pick{display:inline-flex;align-items:center;gap:6px;margin-top:6px;font-size:11px;color:var(--muted);cursor:pointer;user-select:none}.diff-pick input{width:14px;height:14px;accent-color:var(--accent)}.diff-panel{grid-column:1/-1;border:1px dashed var(--line);border-radius:10px;padding:10px;background:var(--metric)}.diff-panel .name{min-height:auto}.diff-hint{font-size:11px;color:var(--muted);margin-top:4px}`;
  html = html.replace('</style>', css + '</style>');
}

if (!html.includes('bindBigChartHover')) {
  const needle = 'body.innerHTML=renderLineChart(pts,{w:640,h:180,big:true});';
  const repl = "body.innerHTML=renderLineChart(pts,{w:720,h:280,big:true})+'<div class=\"chart-tip-inline\" id=\"chartDlgTip\"></div>';bindBigChartHover(body);";
  if (html.includes(needle)) {
    html = html.replace(needle, repl);
    const fn = `\nfunction bindBigChartHover(body){\n  const svg=body.querySelector('svg.chart-hover')||body.querySelector('svg');\n  const tip=body.querySelector('#chartDlgTip');\n  if(!svg||!tip)return;\n  const ns='http://www.w3.org/2000/svg';\n  let v=svg.querySelector('.chart-crosshair-v'),h=svg.querySelector('.chart-crosshair-h'),d=svg.querySelector('.chart-crosshair-dot');\n  if(!v){v=document.createElementNS(ns,'line');v.setAttribute('class','chart-crosshair-v');h=document.createElementNS(ns,'line');h.setAttribute('class','chart-crosshair-h');d=document.createElementNS(ns,'circle');d.setAttribute('class','chart-crosshair-dot');d.setAttribute('r','5');svg.appendChild(v);svg.appendChild(h);svg.appendChild(d);}\n  const hits=[...svg.querySelectorAll('.hit')];\n  const vb=svg.viewBox.baseVal;\n  svg.onmousemove=(e)=>{\n    if(!hits.length)return;\n    const rect=svg.getBoundingClientRect();\n    const mx=(e.clientX-rect.left)*(vb.width/(rect.width||1));\n    let best=hits[0],bd=1e9;\n    for(const x of hits){const dd=Math.abs(+x.getAttribute('cx')-mx);if(dd<bd){bd=dd;best=x;}}\n    const cx=+best.getAttribute('cx'),cy=+best.getAttribute('cy');\n    v.setAttribute('x1',cx);v.setAttribute('x2',cx);v.setAttribute('y1',0);v.setAttribute('y2',vb.height);\n    h.setAttribute('y1',cy);h.setAttribute('y2',cy);h.setAttribute('x1',0);h.setAttribute('x2',vb.width);\n    d.setAttribute('cx',cx);d.setAttribute('cy',cy);\n    tip.innerHTML='<b>'+best.dataset.period+'</b><br>'+best.dataset.value;tip.classList.add('show');\n    const br=body.getBoundingClientRect();\n    let left=e.clientX-br.left+14,top=e.clientY-br.top-10;\n    if(left+140>br.width)left=e.clientX-br.left-150;if(top<0)top=8;\n    tip.style.left=left+'px';tip.style.top=top+'px';\n  };\n  svg.onmouseleave=()=>{tip.classList.remove('show');v.setAttribute('x1',-9);v.setAttribute('x2',-9);h.setAttribute('y1',-9);h.setAttribute('y2',-9);d.setAttribute('cx',-9);d.setAttribute('cy',-9);};\n}\n`;
    html = html.replace('function historyHTML', fn + 'function historyHTML');
  }
}

if (!/\['t10y2y'/.test(html)) {
  html = html.replace(
    "['y10','Staatsanleihen · 10 Jahre','TradingView']",
    "['y10','Staatsanleihen · 10 Jahre','TradingView'],['t10y2y','Zinskurve · 10Y − 2Y','TradingView / FRED']"
  );
}

html = html.replaceAll(
  "key==='y10'||key==='rate'",
  "key==='y10'||key==='t10y2y'||key==='rate'"
);
html = html.replaceAll(
  "key==='y10'||key==='t10y2y'||key==='t10y2y'||key==='rate'",
  "key==='y10'||key==='t10y2y'||key==='rate'"
);

// Broad chart key whitelist
html = html.replace(
  /\|\|key==='sofr3m'\|\|key==='t10y2y'(\|\|key==='[^']+')*/,
  "||key==='sofr3m'||key==='t10y2y'||key==='t10y5y'||key==='hhDebt'||key==='bizDebt'||key==='sofrUs3mSpread'||key==='bofaCcc'||key==='us10yTips'||key==='us5yTips'||key==='sofrIorb'||key==='wresbal'||key==='effr'||key==='sofr'||key==='iorb'||key==='cuAu'||key==='diff'"
);

if (html.includes('extraLabels={')) {
  html = html.replace(
    /extraLabels=\{[^}]*\}/,
    "extraLabels={sofr3m:'CME Term SOFR 3M',t10y2y:'10Y − 2Y Spread',t10y5y:'10Y − 5Y Spread',hhDebt:'Households Debt Growth',bizDebt:'Business Debt Growth',sofrUs3mSpread:'SOFR − US 3M Spread',bofaCcc:'BofA CCC Yield',us10yTips:'US10Y − TIPS10Y',us5yTips:'US5Y − TIPS5Y',sofrIorb:'SOFR − IORB',wresbal:'Bankreserven (WRESBAL)',effr:'EFFR',sofr:'SOFR',iorb:'IORB',cuAu:'Kupfer / Gold Ratio',diff:'Differenz'}"
  );
}

// Page selector instead of old checkbox
if (html.includes('usaExtraToggle') && !html.includes('usaPageSelect')) {
  html = html.replace(
    /\$\{c\.id==='USA'\?`<div class="usa-flip-toggle"><label><input type="checkbox" id="usaExtraToggle">[^`]*<\/label><\/div>`:''\}/,
    "${c.id==='USA'?`<div class=\"usa-flip-toggle\"><div class=\"usa-page-select\" id=\"usaPageSelect\"><button type=\"button\" data-page=\"0\" class=\"active\">Seite 1</button><button type=\"button\" data-page=\"1\">Seite 2</button><button type=\"button\" data-page=\"2\">Seite 3 · Rates</button></div></div>`:''}"
  );
}

const newRefresh = `async function refresh(){const btn=document.querySelector('#refresh'),status=document.querySelector('#status');btn.disabled=true;status.textContent='Lade alle Daten …';try{const r=await fetch('./data.json?refresh='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('data.json HTTP '+r.status);const payload=await r.json();if(!payload||!payload.data)throw Error('data.json ungültig');const ALL_KEYS=['inflation','rate','y2','y10','t10y2y','t10y5y','tips5','tips10','reservesGdp','deficit','gdp','sofr3m','us3m','sofrUs3mSpread','bofaCcc','us10yTips','us5yTips','hhDebt','bizDebt','sofrIorb','wresbal','effr','sofr','iorb','cuAu'];for(const c of countries){const incoming=payload.data[c.id]||{};const next={};const prev=data[c.id]||{};for(const key of ALL_KEYS){if(incoming[key])next[key]=incoming[key];else if(prev[key]&&prev[key].source==='Manuell')next[key]=prev[key]}for(const key of Object.keys(incoming)){if(!next[key]&&incoming[key]&&typeof incoming[key]==='object'&&incoming[key].value!=null)next[key]=incoming[key]}data[c.id]=next}if(payload.histories&&typeof payload.histories==='object'){histories={...payload.histories}}const year=String(document.querySelector('#year').value);for(const c of countries){const v=payload.forecasts?.[c.id]?.[year];if(v!=null&&Number.isFinite(Number(v)))setValue(c.id,'gdp',Number(v),'IMF WEO · '+year,'IMF DataMapper · NGDP_RPCH')}persist();render();const counts={inflation:countries.filter(c=>!!data[c.id]?.inflation).length,y2:countries.filter(c=>!!data[c.id]?.y2).length,y10:countries.filter(c=>!!data[c.id]?.y10).length,t10y2y:countries.filter(c=>!!data[c.id]?.t10y2y).length,rate:countries.filter(c=>!!data[c.id]?.rate).length,tips10:countries.filter(c=>!!data[c.id]?.tips10).length};const stamp=payload.updatedAt?new Date(payload.updatedAt).toLocaleString('de-DE'):'?';const e=Array.isArray(payload.errors)?payload.errors:[];const histN=Object.keys(histories||{}).length;status.innerHTML='Datenstand: '+esc(stamp)+'. Inflation '+counts.inflation+'/6 · Leitzins '+counts.rate+'/6 · 2J '+counts.y2+'/6 · 10J '+counts.y10+'/6 · 10Y−2Y '+counts.t10y2y+'/6 · TIPS '+counts.tips10+'/6 · Charts '+histN+'.'+(e.length?'<br><span class="err">'+e.length+' Hinweise</span>':'');}catch(e){status.innerHTML='<span class="err">'+esc(e.message||e)+'</span>'}finally{btn.disabled=false}}`;

const refStart = html.indexOf('async function refresh()');
const refEnd = html.indexOf('function openEdit', refStart);
if (refStart >= 0 && refEnd > refStart) {
  html = html.slice(0, refStart) + newRefresh + '\n' + html.slice(refEnd);
  console.log('refresh() replaced');
}

const faceBBody = [
  '<div class="metric has-chart"><div class="name">CME Term SOFR 3M</div>',
  "<div class=\"value\">${sofr?fmt(sofr.value):'—'}</div>",
  '<div class="date">global-rates · CME Term SOFR 3M</div>',
  "${historyHTML('USA','sofr3m')}</div>",
  '<div class="metric has-chart"><div class="name">SOFR − IORB Spread</div>',
  "<div class=\"value\">${(()=>{const a=histories['USA-sofrIorb']||[];const last=a.at(-1);return last?fmt(last.value):(data.USA&&data.USA.sofrIorb?fmt(data.USA.sofrIorb.value):'—')})()}</div>",
  '<div class="date">Overnight funding · FRED SOFR − IORB</div>',
  "${historyHTML('USA','sofrIorb')}</div>",
  '<div class="metric has-chart"><div class="name">Bankreserven (WRESBAL)</div>',
  "<div class=\"value\">${(()=>{const a=histories['USA-wresbal']||[];const last=a.at(-1);if(!last&&!(data.USA&&data.USA.wresbal))return '—';const v=last?last.value:data.USA.wresbal.value;return Number(v).toLocaleString('de-DE',{maximumFractionDigits:3})+' T$'})()}</div>",
  '<div class="date">Fed H.4.1 · Wochenmittel · FRED WRESBAL</div>',
  "${historyHTML('USA','wresbal')}</div>",
  '<div class="metric has-chart"><div class="name">Zinskurve · 10Y − 2Y Spread</div>',
  "<div class=\"value\">${spr?fmt(spr.value):'—'}</div>",
  '<div class="date">FRED · T10Y2Y · 10 Jahre</div>',
  "${historyHTML('USA','t10y2y')}</div>",
  '<div class="metric has-chart"><div class="name">Zinskurve · 10Y − 5Y Spread</div>',
  "<div class=\"value\">${(()=>{const a=histories['USA-t10y5y']||[];const last=a.at(-1);return last?fmt(last.value):(data.USA&&data.USA.t10y5y?fmt(data.USA.t10y5y.value):'—')})()}</div>",
  '<div class="date">FRED · DGS10 − DGS5 · US10Y − US5Y</div>',
  "${historyHTML('USA','t10y5y')}</div>",
  '<div class="metric has-chart"><div class="name">US10Y − TIPS 10Y</div>',
  "<div class=\"value\">${(()=>{const a=histories['USA-us10yTips']||[];const last=a.at(-1);return last?fmt(last.value):'—'})()}</div>",
  '<div class="date">Breakeven · FRED T10YIE</div>',
  "${historyHTML('USA','us10yTips')}</div>",
  '<div class="metric has-chart"><div class="name">US5Y − TIPS 5Y</div>',
  "<div class=\"value\">${(()=>{const a=histories['USA-us5yTips']||[];const last=a.at(-1);return last?fmt(last.value):'—'})()}</div>",
  '<div class="date">Breakeven · FRED T5YIE</div>',
  "${historyHTML('USA','us5yTips')}</div>",
  '<div class="metric has-chart"><div class="name">Households & Nonprofits Debt Growth</div>',
  "<div class=\"value\">${(()=>{const a=histories['USA-hhDebt']||[];const last=a.at(-1);return last?fmt(last.value):'—'})()}</div>",
  '<div class="date">Fed Z.1 · SAAR</div>',
  "${historyHTML('USA','hhDebt')}</div>",
  '<div class="metric has-chart"><div class="name">Nonfinancial Business Debt Growth</div>',
  "<div class=\"value\">${(()=>{const a=histories['USA-bizDebt']||[];const last=a.at(-1);return last?fmt(last.value):'—'})()}</div>",
  '<div class="date">Fed Z.1 · SAAR</div>',
  "${historyHTML('USA','bizDebt')}</div>",
  '<div class="metric has-chart"><div class="name">SOFR − US 3M Spread</div>',
  "<div class=\"value\">${(()=>{const a=histories['USA-sofrUs3mSpread']||[];const last=a.at(-1);return last?fmt(last.value):'—'})()}</div>",
  '<div class="date">Term SOFR 3M − TVC:US03MY</div>',
  "${historyHTML('USA','sofrUs3mSpread')}</div>",
  '<div class="metric has-chart"><div class="name">BofA CCC High Yield</div>',
  "<div class=\"value\">${(()=>{const a=histories['USA-bofaCcc']||[];const last=a.at(-1);return last?fmt(last.value):'—'})()}</div>",
  '<div class="date">ICE BofA CCC · FRED/TradingView</div>',
  "${historyHTML('USA','bofaCcc')}</div>"
].join('');

// faceC body built at runtime with string concat (no nested template eval)
const faceCRuntime = `{\n    const faceC=document.createElement('div');\n    faceC.className='metrics usa-face usa-face-c hidden';\n    const _e=(histories['USA-effr']||[]).at(-1);\n    const _s=(histories['USA-sofr']||[]).at(-1);\n    const _i=(histories['USA-iorb']||[]).at(-1);\n    faceC.innerHTML=\n      '<div class="metric has-chart" data-rate-key="effr"><div class="name">EFFR · Effective Fed Funds</div><div class="value">'+(_e?fmt(_e.value):(data.USA&&data.USA.effr?fmt(data.USA.effr.value):'—'))+'</div><div class="date">FRED EFFR · täglich</div>'+historyHTML('USA','effr')+'<label class="diff-pick"><input type="checkbox" class="rate-diff-cb" data-key="effr"> für Differenz wählen</label></div>'+\n      '<div class="metric has-chart" data-rate-key="sofr"><div class="name">SOFR · Secured Overnight Financing</div><div class="value">'+(_s?fmt(_s.value):(data.USA&&data.USA.sofr?fmt(data.USA.sofr.value):'—'))+'</div><div class="date">FRED SOFR · täglich</div>'+historyHTML('USA','sofr')+'<label class="diff-pick"><input type="checkbox" class="rate-diff-cb" data-key="sofr"> für Differenz wählen</label></div>'+\n      '<div class="metric has-chart" data-rate-key="iorb"><div class="name">IORB · Interest on Reserve Balances</div><div class="value">'+(_i?fmt(_i.value):(data.USA&&data.USA.iorb?fmt(data.USA.iorb.value):'—'))+'</div><div class="date">FRED IORB · täglich</div>'+historyHTML('USA','iorb')+'<label class="diff-pick"><input type="checkbox" class="rate-diff-cb" data-key="iorb"> für Differenz wählen</label></div>'+\n      '<div class="metric has-chart diff-panel" id="rateDiffPanel"><div class="name" id="rateDiffTitle">Differenz · 2 Serien wählen</div><div class="value" id="rateDiffValue">—</div><div class="date" id="rateDiffDate">Kästchen bei zwei Charts anhaken (Reihenfolge: erste − zweite)</div><div id="rateDiffChart"></div><div class="diff-hint" id="rateDiffHint">Noch keine Auswahl</div></div>';\n    faceA.after(faceB);\n    faceB.after(faceC);\n    }`;

const markerStart = 'faceB.innerHTML=`';
const markerEnd = 'faceA.after(faceB)';
const s = html.indexOf(markerStart);
const e = html.indexOf(markerEnd);
if (s >= 0 && e > s) {
  html = html.slice(0, s) + markerStart + faceBBody + '`;\n    ' + faceCRuntime + '\n    ' + html.slice(e + markerEnd.length);
  console.log('faceB+faceC replaced');
} else {
  console.log('markers not found', s, e);
}

// Remove old 2-way flip handlers if present; inject page + diff logic once
html = html.replace(
  /const flipped=localStorage\.getItem\('macrowatch-usa-extra'\)==='1';[\s\S]*?faceB\.classList\.toggle\('hidden',!flipped\);/g,
  '/* usa pages via setUsaPage */'
);
html = html.replace(
  /if\(document\.querySelector\('#usaExtraToggle'\)\)\{[\s\S]*?\}\)/g,
  '/* old usaExtraToggle removed */'
);

if (!html.includes('function setUsaPage')) {
  const pageLogic = `\nfunction setUsaPage(page){\n  page=Math.max(0,Math.min(2,Number(page)||0));\n  localStorage.setItem('macrowatch-usa-page',String(page));\n  document.querySelectorAll('.country').forEach(card=>{\n    if(!card.querySelector('.usa-face-a'))return;\n    const a=card.querySelector('.usa-face-a');\n    const b=card.querySelector('.usa-face-b');\n    const c=card.querySelector('.usa-face-c');\n    if(a)a.classList.toggle('hidden',page!==0);\n    if(b)b.classList.toggle('hidden',page!==1);\n    if(c)c.classList.toggle('hidden',page!==2);\n    const sel=card.querySelector('#usaPageSelect');\n    if(sel)sel.querySelectorAll('button').forEach(btn=>btn.classList.toggle('active',Number(btn.dataset.page)===page));\n  });\n  if(page===1)setTimeout(()=>{try{paintCuAu&&paintCuAu()}catch(e){}},50);\n  if(page===2)setTimeout(()=>{try{paintRateDiff&&paintRateDiff()}catch(e){}},50);\n}\nfunction bindUsaPages(){\n  document.querySelectorAll('#usaPageSelect button').forEach(btn=>{\n    btn.addEventListener('click',()=>setUsaPage(btn.dataset.page));\n  });\n  setUsaPage(Number(localStorage.getItem('macrowatch-usa-page')||'0'));\n}\nlet _rateDiffOrder=[];\nfunction paintRateDiff(){\n  const labels={effr:'EFFR',sofr:'SOFR',iorb:'IORB'};\n  const title=document.getElementById('rateDiffTitle');\n  const valEl=document.getElementById('rateDiffValue');\n  const dateEl=document.getElementById('rateDiffDate');\n  const host=document.getElementById('rateDiffChart');\n  const hint=document.getElementById('rateDiffHint');\n  if(!host)return;\n  const boxes=[...document.querySelectorAll('.rate-diff-cb')];\n  const checked=boxes.filter(b=>b.checked).map(b=>b.dataset.key);\n  _rateDiffOrder=_rateDiffOrder.filter(k=>checked.includes(k));\n  for(const k of checked){if(!_rateDiffOrder.includes(k))_rateDiffOrder.push(k)}\n  while(_rateDiffOrder.length>2){\n    const drop=_rateDiffOrder.shift();\n    const box=boxes.find(b=>b.dataset.key===drop);\n    if(box)box.checked=false;\n  }\n  if(_rateDiffOrder.length<2){\n    if(title)title.textContent='Differenz · 2 Serien wählen';\n    if(valEl)valEl.textContent='—';\n    if(dateEl)dateEl.textContent='Kästchen bei zwei Charts anhaken (Reihenfolge: erste − zweite)';\n    host.innerHTML='';\n    if(hint)hint.textContent=_rateDiffOrder.length===1?('Gewählt: '+labels[_rateDiffOrder[0]]+' · bitte zweite Serie'):'Noch keine Auswahl';\n    return;\n  }\n  const [k1,k2]=_rateDiffOrder;\n  const a1=histories['USA-'+k1]||[];\n  const a2=histories['USA-'+k2]||[];\n  const map2=new Map(a2.map(p=>[String(p.period),Number(p.value)]));\n  const pts=[];\n  for(const p of a1){\n    const v2=map2.get(String(p.period));\n    if(v2==null||!Number.isFinite(Number(p.value))||!Number.isFinite(v2))continue;\n    pts.push({period:String(p.period),value:Math.round((Number(p.value)-v2)*10000)/10000});\n  }\n  const name=labels[k1]+' − '+labels[k2];\n  if(title)title.textContent='Differenz · '+name;\n  if(!pts.length){\n    if(valEl)valEl.textContent='—';\n    host.innerHTML='<div class="sparkempty">Keine gemeinsamen Datenpunkte</div>';\n    if(hint)hint.textContent='Historie überlappt nicht ausreichend';\n    return;\n  }\n  const last=pts.at(-1);\n  if(valEl)valEl.textContent=fmt(last.value);\n  if(dateEl)dateEl.textContent='Stand '+last.period+' · '+pts.length+' Punkte · FRED';\n  host.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|diff|'+name+'" title="Chart vergrößern">'+renderLineChart(pts,{w:220,h:58})+'</div>';\n  histories['USA-diff']=pts;\n  if(hint)hint.textContent='Berechnet: '+name+' (Auswahlreihenfolge)';\n}\ndocument.addEventListener('change',e=>{if(e.target&&e.target.classList&&e.target.classList.contains('rate-diff-cb'))paintRateDiff()});\nbindUsaPages();\n`;
  const idx = html.lastIndexOf('refresh();');
  if (idx >= 0) html = html.slice(0, idx) + pageLogic + '\n' + html.slice(idx);
}

fs.writeFileSync('index.html', html);
console.log(
  'done', html.length,
  'faceC', html.includes('usa-face-c'),
  'pageSelect', html.includes('usaPageSelect'),
  'setUsaPage', html.includes('function setUsaPage'),
  't10y5y', html.includes('t10y5y'),
  'wresbal', html.includes('wresbal')
);
