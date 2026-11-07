import fs from 'fs';
import { execSync } from 'child_process';

// Known-good base before page-3 inject experiments
const GOOD = 'b9d928f1168a1077691008e344d5968c636056a6';

function loadBase() {
  try { execSync(`git show ${GOOD}:index.html > index.html`, { stdio: 'pipe' }); }
  catch {
    execSync(`curl -sL https://raw.githubusercontent.com/Hossein7935/Hossein7935.github.io/${GOOD}/index.html -o index.html`);
  }
  return fs.readFileSync('index.html', 'utf8');
}

let html = fs.existsSync('index.html') ? fs.readFileSync('index.html', 'utf8') : '';
if (html.length < 20000 || !html.includes('defs.map') || !html.includes('usa-face-a') || !html.includes('function render')) {
  html = loadBase();
  console.log('restored base', html.length);
}

// Force clean if prior injects left broken tokens
if ((html.match(/faceA\.after\(faceB\)/g) || []).length > 1 || html.includes('}grid.querySelectorAll') || html.includes('PLACEHOLDER')) {
  html = loadBase();
  console.log('force-clean base', html.length);
}

// Page-select CSS
if (!html.includes('usa-page-select')) {
  const css = '.usa-page-select{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.usa-page-select button{padding:6px 10px;border-radius:8px;border:1px solid var(--control-line);background:var(--control);color:var(--text);font:inherit;cursor:pointer}.usa-page-select button.active{background:var(--accent);color:#09211e;border-color:var(--accent);font-weight:700}.diff-pick{display:inline-flex;align-items:center;gap:6px;margin-top:6px;font-size:11px;color:var(--muted);cursor:pointer}.diff-pick input{width:14px;height:14px;accent-color:var(--accent)}.diff-panel{grid-column:1/-1;border:1px dashed var(--line);border-radius:10px;padding:10px;background:var(--metric)}.diff-hint{font-size:11px;color:var(--muted);margin-top:4px}';
  html = html.replace('</style>', css + '</style>');
}

// Replace checkbox toggle with 3-page selector
if (html.includes('usaExtraToggle') && !html.includes('usaPageSelect')) {
  html = html.replace(
    /\$\{c\.id==='USA'\?`<div class="usa-flip-toggle"><label><input type="checkbox" id="usaExtraToggle">[^`]*<\/label><\/div>`:''\}/,
    "${c.id==='USA'?`<div class=\"usa-flip-toggle\"><div class=\"usa-page-select\" id=\"usaPageSelect\"><button type=\"button\" data-page=\"0\" class=\"active\">Seite 1</button><button type=\"button\" data-page=\"1\">Seite 2</button><button type=\"button\" data-page=\"2\">Seite 3 · Rates</button></div></div>`:''}"
  );
}

// Broaden chart keys slightly
html = html.replaceAll(
  "key==='y10'||key==='rate'",
  "key==='y10'||key==='t10y2y'||key==='rate'"
);

// Replace old flip handlers with page selector logic (do not leave orphans)
html = html.replace(
  /const flipped=localStorage\.getItem\('macrowatch-usa-extra'\)==='1';[\s\S]*?faceB\.classList\.toggle\('hidden',!flipped\);/g,
  '/* pages via setUsaPage */'
);
html = html.replace(
  /if\(document\.querySelector\('#usaExtraToggle'\)\)\{[\s\S]*?\}\)/g,
  '/* no checkbox toggle */'
);

// Ensure faceA.after(faceB) is followed by faceC once
if (!html.includes('usa-face-c') && html.includes('faceA.after(faceB)')) {
  const faceC = [
    "{",
    "const faceC=document.createElement('div');",
    "faceC.className='metrics usa-face usa-face-c hidden';",
    "const _e=(histories['USA-effr']||[]).at(-1);",
    "const _s=(histories['USA-sofr']||[]).at(-1);",
    "const _i=(histories['USA-iorb']||[]).at(-1);",
    "faceC.innerHTML=",
    "'<div class=\"metric has-chart\"><div class=\"name\">EFFR · Effective Fed Funds</div><div class=\"value\">'+( _e?fmt(_e.value):(data.USA&&data.USA.effr?fmt(data.USA.effr.value):'—'))+'</div><div class=\"date\">FRED EFFR</div>'+historyHTML('USA','effr')+'<label class=\"diff-pick\"><input type=\"checkbox\" class=\"rate-diff-cb\" data-key=\"effr\"> für Differenz wählen</label></div>'+",
    "'<div class=\"metric has-chart\"><div class=\"name\">SOFR · Secured Overnight Financing</div><div class=\"value\">'+( _s?fmt(_s.value):(data.USA&&data.USA.sofr?fmt(data.USA.sofr.value):'—'))+'</div><div class=\"date\">FRED SOFR</div>'+historyHTML('USA','sofr')+'<label class=\"diff-pick\"><input type=\"checkbox\" class=\"rate-diff-cb\" data-key=\"sofr\"> für Differenz wählen</label></div>'+",
    "'<div class=\"metric has-chart\"><div class=\"name\">IORB · Interest on Reserve Balances</div><div class=\"value\">'+( _i?fmt(_i.value):(data.USA&&data.USA.iorb?fmt(data.USA.iorb.value):'—'))+'</div><div class=\"date\">FRED IORB</div>'+historyHTML('USA','iorb')+'<label class=\"diff-pick\"><input type=\"checkbox\" class=\"rate-diff-cb\" data-key=\"iorb\"> für Differenz wählen</label></div>'+",
    "'<div class=\"metric has-chart diff-panel\" id=\"rateDiffPanel\"><div class=\"name\" id=\"rateDiffTitle\">Differenz · 2 Serien wählen</div><div class=\"value\" id=\"rateDiffValue\">—</div><div class=\"date\" id=\"rateDiffDate\">Kästchen: erste − zweite</div><div id=\"rateDiffChart\"></div><div class=\"diff-hint\" id=\"rateDiffHint\">Noch keine Auswahl</div></div>';",
    "faceA.after(faceB);",
    "faceB.after(faceC);",
    "}"
  ].join('\n    ');
  html = html.replace('faceA.after(faceB);', faceC);
  if (!html.includes('usa-face-c')) html = html.replace('faceA.after(faceB)', faceC);
}

// Page logic: event delegation survives render(); re-apply page after every render
const pageLogic = `
function setUsaPage(page){
  page=Math.max(0,Math.min(2,Number(page)||0));
  try{localStorage.setItem('macrowatch-usa-page',String(page))}catch(e){}
  document.querySelectorAll('.country').forEach(card=>{
    if(!card.querySelector('.usa-face-a'))return;
    const a=card.querySelector('.usa-face-a');
    const b=card.querySelector('.usa-face-b');
    const c=card.querySelector('.usa-face-c');
    if(a)a.classList.toggle('hidden',page!==0);
    if(b)b.classList.toggle('hidden',page!==1);
    if(c)c.classList.toggle('hidden',page!==2);
    const sel=card.querySelector('#usaPageSelect');
    if(sel)sel.querySelectorAll('button').forEach(btn=>btn.classList.toggle('active',Number(btn.dataset.page)===page));
  });
  if(page===1)setTimeout(()=>{try{typeof paintCuAu==='function'&&paintCuAu()}catch(e){}},50);
  if(page===2)setTimeout(()=>{try{typeof paintRateDiff==='function'&&paintRateDiff()}catch(e){}},50);
}
function bindUsaPages(){
  // Event delegation — buttons are recreated on every render()
  if(!window.__usaPageClickBound){
    window.__usaPageClickBound=true;
    document.addEventListener('click',e=>{
      const btn=e.target&&e.target.closest&&e.target.closest('#usaPageSelect button');
      if(!btn)return;
      e.preventDefault();
      setUsaPage(btn.dataset.page);
    });
  }
  setUsaPage(Number((()=>{try{return localStorage.getItem('macrowatch-usa-page')||'0'}catch(e){return '0'}})()));
}
// Re-apply face visibility after each render (faces are rebuilt hidden by default)
if(!window.__usaRenderPatched){
  window.__usaRenderPatched=true;
  const _render=render;
  render=function(){
    const r=_render.apply(this,arguments);
    try{setUsaPage(Number(localStorage.getItem('macrowatch-usa-page')||'0'))}catch(e){}
    return r;
  };
}
let _rateDiffOrder=[];
function paintRateDiff(){
  const labels={effr:'EFFR',sofr:'SOFR',iorb:'IORB'};
  const title=document.getElementById('rateDiffTitle');
  const valEl=document.getElementById('rateDiffValue');
  const dateEl=document.getElementById('rateDiffDate');
  const host=document.getElementById('rateDiffChart');
  const hint=document.getElementById('rateDiffHint');
  if(!host)return;
  const boxes=[...document.querySelectorAll('.rate-diff-cb')];
  const checked=boxes.filter(b=>b.checked).map(b=>b.dataset.key);
  _rateDiffOrder=_rateDiffOrder.filter(k=>checked.includes(k));
  for(const k of checked){if(!_rateDiffOrder.includes(k))_rateDiffOrder.push(k)}
  while(_rateDiffOrder.length>2){
    const drop=_rateDiffOrder.shift();
    const box=boxes.find(b=>b.dataset.key===drop);
    if(box)box.checked=false;
  }
  if(_rateDiffOrder.length<2){
    if(title)title.textContent='Differenz · 2 Serien wählen';
    if(valEl)valEl.textContent='—';
    if(dateEl)dateEl.textContent='Kästchen: erste − zweite';
    host.innerHTML='';
    if(hint)hint.textContent=_rateDiffOrder.length===1?('Gewählt: '+labels[_rateDiffOrder[0]]):'Noch keine Auswahl';
    return;
  }
  const [k1,k2]=_rateDiffOrder;
  const a1=histories['USA-'+k1]||[];
  const a2=histories['USA-'+k2]||[];
  const map2=new Map(a2.map(p=>[String(p.period),Number(p.value)]));
  const pts=[];
  for(const p of a1){
    const v2=map2.get(String(p.period));
    if(v2==null||!Number.isFinite(Number(p.value))||!Number.isFinite(v2))continue;
    pts.push({period:String(p.period),value:Math.round((Number(p.value)-v2)*10000)/10000});
  }
  const name=labels[k1]+' − '+labels[k2];
  if(title)title.textContent='Differenz · '+name;
  if(!pts.length){if(valEl)valEl.textContent='—';host.innerHTML='<div class="sparkempty">Keine gemeinsamen Punkte</div>';return;}
  const last=pts.at(-1);
  if(valEl)valEl.textContent=fmt(last.value);
  if(dateEl)dateEl.textContent='Stand '+last.period+' · '+pts.length+' Punkte';
  host.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|diff|'+name+'" title="Chart vergrößern">'+renderLineChart(pts,{w:220,h:58})+'</div>';
  histories['USA-diff']=pts;
  if(hint)hint.textContent='Berechnet: '+name;
}
document.addEventListener('change',e=>{if(e.target&&e.target.classList&&e.target.classList.contains('rate-diff-cb'))paintRateDiff()});
bindUsaPages();
`;

// Replace old page logic if present, else inject
if (html.includes('function setUsaPage')) {
  const start = html.indexOf('function setUsaPage');
  const end = html.indexOf('bindUsaPages();', start);
  if (start >= 0 && end > start) {
    html = html.slice(0, start) + pageLogic + html.slice(end + 'bindUsaPages();'.length);
    console.log('page logic replaced');
  }
} else {
  const idx = html.lastIndexOf('refresh();');
  if (idx >= 0) {
    html = html.slice(0, idx) + pageLogic + '\n' + html.slice(idx);
    console.log('page logic injected');
  }
}

// Hygiene
html = html.replace(/\/\* old usaExtraToggle removed \*\/[\s;]*/g, '');
html = html.replace(/\}grid\.querySelectorAll/g, 'grid.querySelectorAll');
html = html.replace(/PLACEHOLDER_WILL_FAIL/g, '');

fs.writeFileSync('index.html', html);
console.log('done', html.length, 'faceC', html.includes('usa-face-c'), 'pages', html.includes('usaPageSelect'), 'delegation', html.includes('__usaPageClickBound'));
