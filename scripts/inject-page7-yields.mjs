import fs from 'fs';

/** USA page 7 (index 6): UST + TIPS charts with checkbox diff */
let html = fs.readFileSync('index.html', 'utf8');

// Dedupe accidental double let _rateDiffOrder
html = html.replace(
  /let _rateDiffOrder=\[\];\s*let _rateDiffOrder=\[\];/g,
  'let _rateDiffOrder=[];'
);

html = html.replace(
  /page=Math\.max\(0,Math\.min\(5,Number\(page\)\|\|0\)\);/g,
  'page=Math.max(0,Math.min(6,Number(page)||0));'
);
html = html.replace(
  /if\(!Number\.isFinite\(start\)\|\|start<0\|\|start>5\)start=0;/g,
  'if(!Number.isFinite(start)||start<0||start>6)start=0;'
);
html = html.replace(
  /if\(!Number\.isFinite\(start\)\|\|start<0\|\|start>6\)start=0;/g,
  'if(!Number.isFinite(start)||start<0||start>6)start=0;'
);

if (html.includes("const f=card.querySelector('.usa-face-f');") && !html.includes("const g=card.querySelector('.usa-face-g');")) {
  html = html.replace(
    "const f=card.querySelector('.usa-face-f');",
    "const f=card.querySelector('.usa-face-f');\n    const g=card.querySelector('.usa-face-g');"
  );
  html = html.replace(
    "if(f)f.classList.toggle('hidden',page!==5);",
    "if(f)f.classList.toggle('hidden',page!==5);\n    if(g)g.classList.toggle('hidden',page!==6);"
  );
}

if (!html.includes('if(page===6)')) {
  const marker =
    "if(page===5)setTimeout(()=>{try{typeof paintIorbUs1y==='function'&&paintIorbUs1y();typeof paintMove==='function'&&paintMove()}catch(e){}},50);";
  if (html.includes(marker)) {
    html = html.replace(
      marker,
      marker +
        "\n  if(page===6)setTimeout(()=>{try{typeof paintYieldPage7==='function'&&paintYieldPage7()}catch(e){}},50);"
    );
  } else if (html.includes('if(page===5)setTimeout')) {
    html = html.replace(
      /(if\(page===5\)setTimeout\([\s\S]*?\},50\);)/,
      "$1\n  if(page===6)setTimeout(()=>{try{typeof paintYieldPage7==='function'&&paintYieldPage7()}catch(e){}},50);"
    );
  }
}

if (!html.includes('data-page=\"6\"') && !html.includes('data-page="6"')) {
  html = html.replace(
    /(<button type=\"button\" data-page=\"5\"[^>]*>)([^<]*)(<\/button>)/,
    '$1$2$3<button type=\"button\" data-page=\"6\">Seite 7</button>'
  );
  html = html.replace(
    /(<button type="button" data-page="5"[^>]*>)([^<]*)(<\/button>)/,
    '$1$2$3<button type="button" data-page="6">Seite 7</button>'
  );
}

const block = `
let _yieldDiffOrder=[];
const YIELD7_KEYS=[
  {key:'us3m',label:'US 3M'},
  {key:'us2y',label:'US 2Y'},
  {key:'us5y',label:'US 5Y'},
  {key:'us10y',label:'US 10Y'},
  {key:'us30y',label:'US 30Y'},
  {key:'dfii5',label:'TIPS 5Y'},
  {key:'dfii10',label:'TIPS 10Y'}
];
function ensureUsaFaceG(){
  const card=document.querySelector('.country');
  if(!card||!card.querySelector('.usa-face-a'))return null;
  let g=card.querySelector('.usa-face-g');
  if(g)return g;
  g=document.createElement('div');
  g.className='metrics usa-face usa-face-g hidden';
  g.id='usaFaceG';
  const panels=YIELD7_KEYS.map(s=>{
    return '<div class="metric has-chart" id="y7-'+s.key+'">'
      +'<div class="name">'+s.label+'</div>'
      +'<div class="value" id="y7-'+s.key+'-val">—</div>'
      +'<div class="date" id="y7-'+s.key+'-date">FRED</div>'
      +'<div id="y7-'+s.key+'-chart"></div>'
      +'<label class="diff-pick"><input type="checkbox" class="yield7-diff-cb" data-key="'+s.key+'"> für Differenz wählen</label>'
      +'</div>';
  }).join('');
  g.innerHTML=panels
    +'<div class="metric has-chart diff-panel" id="yield7DiffPanel" style="grid-column:1/-1">'
    +'<div class="name" id="yield7DiffTitle">Differenz · 2 Serien wählen</div>'
    +'<div class="value" id="yield7DiffValue">—</div>'
    +'<div class="date" id="yield7DiffDate">Kästchen: erste − zweite · gleiche Historie</div>'
    +'<div id="yield7DiffChart"></div>'
    +'<div class="diff-hint" id="yield7DiffHint">Noch keine Auswahl</div>'
    +'</div>';
  const f=card.querySelector('.usa-face-f');
  if(f&&f.parentNode)f.after(g);
  else{
    const e=card.querySelector('.usa-face-e');
    if(e&&e.parentNode)e.after(g);
    else card.appendChild(g);
  }
  if(!window.__yield7DiffBound){
    window.__yield7DiffBound=true;
    document.addEventListener('change',e=>{
      if(e.target&&e.target.classList&&e.target.classList.contains('yield7-diff-cb')){
        paintYield7Diff();
      }
    });
  }
  return g;
}
function paintYield7Diff(){
  const labels=Object.fromEntries(YIELD7_KEYS.map(s=>[s.key,s.label]));
  const title=document.getElementById('yield7DiffTitle');
  const valEl=document.getElementById('yield7DiffValue');
  const dateEl=document.getElementById('yield7DiffDate');
  const host=document.getElementById('yield7DiffChart');
  const hint=document.getElementById('yield7DiffHint');
  if(!host)return;
  const boxes=[...document.querySelectorAll('.yield7-diff-cb')];
  const checked=boxes.filter(b=>b.checked).map(b=>b.dataset.key);
  _yieldDiffOrder=_yieldDiffOrder.filter(k=>checked.includes(k));
  for(const k of checked){if(!_yieldDiffOrder.includes(k))_yieldDiffOrder.push(k)}
  while(_yieldDiffOrder.length>2){
    const drop=_yieldDiffOrder.shift();
    const box=boxes.find(b=>b.dataset.key===drop);
    if(box)box.checked=false;
  }
  if(_yieldDiffOrder.length<2){
    if(title)title.textContent='Differenz · 2 Serien wählen';
    if(valEl)valEl.textContent='—';
    if(dateEl)dateEl.textContent='Kästchen: erste − zweite';
    host.innerHTML='';
    if(hint)hint.textContent=_yieldDiffOrder.length===1?('Gewählt: '+labels[_yieldDiffOrder[0]]):'Noch keine Auswahl';
    return;
  }
  const [k1,k2]=_yieldDiffOrder;
  const a1=histories['USA-'+k1]||[];
  const a2=histories['USA-'+k2]||[];
  const map2v=new Map(a2.map(p=>[String(p.period),Number(p.value)]));
  const pts=[];
  for(const p of a1){
    const v2=map2v.get(String(p.period));
    if(v2==null||!Number.isFinite(Number(p.value))||!Number.isFinite(v2))continue;
    pts.push({period:String(p.period),value:Math.round((Number(p.value)-v2)*10000)/10000});
  }
  const name=(labels[k1]||k1)+' − '+(labels[k2]||k2);
  if(title)title.textContent='Differenz · '+name;
  if(!pts.length){
    if(valEl)valEl.textContent='—';
    host.innerHTML='<div class="sparkempty">Keine gemeinsamen Punkte</div>';
    if(hint)hint.textContent=name;
    return;
  }
  const last=pts.at(-1);
  if(valEl)valEl.textContent=fmt(last.value);
  if(dateEl)dateEl.textContent='Stand '+last.period+' · '+pts.length+' Punkte · erste − zweite';
  histories['USA-yield7Diff']=pts;
  window.__yield7DiffMeta={k1,k2,name};
  if(typeof renderLineChart==='function'){
    host.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|yield7Diff|'+name+'" title="Chart vergrößern (6M/1J/3J)">'+renderLineChart(pts,{w:360,h:160})+'</div>';
  }
  if(hint)hint.textContent=name+' · Tippen zum Vergrößern · 6M/1J/3J';
}
function paintYieldPage7(){
  const g=ensureUsaFaceG();
  if(!g)return;
  const pageNow=(()=>{try{return Number(localStorage.getItem('macrowatch-usa-page')||0)}catch(e){return 0}})();
  if(pageNow===6)g.classList.remove('hidden');
  for(const s of YIELD7_KEYS){
    const pts=histories['USA-'+s.key]||[];
    const valEl=document.getElementById('y7-'+s.key+'-val');
    const dateEl=document.getElementById('y7-'+s.key+'-date');
    const host=document.getElementById('y7-'+s.key+'-chart');
    const last=pts.length?pts.at(-1):null;
    if(valEl)valEl.textContent=last?fmt(last.value):'—';
    if(dateEl)dateEl.textContent=last?('Stand '+last.period+' · FRED · '+pts.length+' Punkte'):'Keine Daten';
    if(host){
      if(!pts.length)host.innerHTML='<div class="sparkempty">Keine Daten</div>';
      else if(typeof renderLineChart==='function'){
        host.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|'+s.key+'|'+s.label+'" title="Chart vergrößern">'+renderLineChart(pts,{w:220,h:58})+'</div>';
      }
    }
  }
  paintYield7Diff();
}
`;

if (!html.includes('function paintYieldPage7')) {
  // Insert after rate-diff order declaration to avoid splitting declarations oddly
  const after = html.indexOf('let _rateDiffOrder=[];');
  if (after >= 0) {
    const ins = after + 'let _rateDiffOrder=[];'.length;
    html = html.slice(0, ins) + '\n' + block + html.slice(ins);
    console.log('page7 after _rateDiffOrder');
  } else {
    const anchor = html.indexOf('function bindUsaPages');
    if (anchor >= 0) {
      html = html.slice(0, anchor) + block + html.slice(anchor);
      console.log('page7 before bindUsaPages');
    }
  }
}

// Dedupe again if inject ran twice in history
html = html.replace(
  /let _rateDiffOrder=\[\];\s*let _rateDiffOrder=\[\];/g,
  'let _rateDiffOrder=[];'
);
html = html.replace(
  /let _yieldDiffOrder=\[\];\s*let _yieldDiffOrder=\[\];/g,
  'let _yieldDiffOrder=[];'
);

fs.writeFileSync('index.html', html);

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const js = scripts.join('\n');
try {
  new Function(js);
  console.log('js ok');
} catch (e) {
  console.warn('js warn', e.message);
  // do not fail build hard — still write file
}
console.log(
  'done',
  html.length,
  'page6',
  html.includes('page===6'),
  'paint',
  html.includes('function paintYieldPage7'),
  'btn6',
  html.includes('data-page=\"6\"') || html.includes('data-page="6"')
);
