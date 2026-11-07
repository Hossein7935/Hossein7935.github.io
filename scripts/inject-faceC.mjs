import fs from 'fs';

/**
 * USA page 3: EFFR, SOFR, IORB + checkbox difference chart.
 * Replaces 2-way checkbox flip with 3-page selector.
 */
let html = fs.readFileSync('index.html', 'utf8');
console.log('base', html.length);

// CSS for page selector + diff boxes
if (!html.includes('usa-page-select')) {
  const css = `.usa-flip-toggle{flex-wrap:wrap;gap:8px 12px}.usa-page-select{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.usa-page-select button{padding:6px 10px;border-radius:8px;border:1px solid var(--control-line);background:var(--control);color:var(--text);font:inherit;cursor:pointer}.usa-page-select button.active{background:var(--accent);color:#09211e;border-color:var(--accent);font-weight:700}.diff-pick{display:inline-flex;align-items:center;gap:6px;margin-top:6px;font-size:11px;color:var(--muted);cursor:pointer;user-select:none}.diff-pick input{width:14px;height:14px;accent-color:var(--accent)}.diff-panel{grid-column:1/-1;border:1px dashed var(--line);border-radius:10px;padding:10px;background:var(--metric)}.diff-panel .name{min-height:auto}.diff-hint{font-size:11px;color:var(--muted);margin-top:4px}`;
  html = html.replace('</style>', css + '</style>');
}

// Replace checkbox toggle with 3-page buttons
const oldToggle = '`<div class="usa-flip-toggle"><label><input type="checkbox" id="usaExtraToggle"> Rückseite: Term SOFR 3M & 10Y–2Y</label></div>`';
const newToggle = '`<div class="usa-flip-toggle"><div class="usa-page-select" id="usaPageSelect"><button type="button" data-page="0" class="active">Seite 1</button><button type="button" data-page="1">Seite 2</button><button type="button" data-page="2">Seite 3 · Rates</button></div></div>`';
if (html.includes('usaExtraToggle') && !html.includes('usaPageSelect')) {
  html = html.replace(oldToggle, newToggle);
  // also looser replace
  if (html.includes('usaExtraToggle') && !html.includes('usaPageSelect')) {
    html = html.replace(
      /\$\{c\.id==='USA'\?`<div class="usa-flip-toggle">[\s\S]*?<\/div>`:''\}/,
      newToggle.replace('`', '${c.id===\'USA\'?`').replace(/`$/, '`:\'\'}')
    );
  }
}
if (html.includes('id="usaExtraToggle"') && !html.includes('usaPageSelect')) {
  html = html.replace(
    /<div class="usa-flip-toggle"><label><input type="checkbox" id="usaExtraToggle">[^<]*<\/label><\/div>/,
    '<div class="usa-flip-toggle"><div class="usa-page-select" id="usaPageSelect"><button type="button" data-page="0" class="active">Seite 1</button><button type="button" data-page="1">Seite 2</button><button type="button" data-page="2">Seite 3 · Rates</button></div></div>'
  );
}

// Build faceC HTML after faceB creation block
const faceCJs = `
    const faceC=document.createElement('div');
    faceC.className='metrics usa-face usa-face-c hidden';
    faceC.innerHTML=\
      '<div class="metric has-chart" data-rate-key="effr"><div class="name">EFFR · Effective Fed Funds</div>' +
      "<div class=\"value\">${(()=>{const a=histories['USA-effr']||[];const last=a.at(-1);return last?fmt(last.value):(data.USA&&data.USA.effr?fmt(data.USA.effr.value):'—')})()}</div>" +
      '<div class="date">FRED EFFR · täglich · <a href="https://fred.stlouisfed.org/series/EFFR" target="_blank" rel="noopener" style="color:var(--accent)">FRED ↗</a></div>' +
      "${historyHTML('USA','effr')}" +
      '<label class="diff-pick"><input type="checkbox" class="rate-diff-cb" data-key="effr"> für Differenz wählen</label></div>' +
      '<div class="metric has-chart" data-rate-key="sofr"><div class="name">SOFR · Secured Overnight Financing</div>' +
      "<div class=\"value\">${(()=>{const a=histories['USA-sofr']||[];const last=a.at(-1);return last?fmt(last.value):(data.USA&&data.USA.sofr?fmt(data.USA.sofr.value):'—')})()}</div>" +
      '<div class="date">FRED SOFR · täglich · <a href="https://fred.stlouisfed.org/series/SOFR" target="_blank" rel="noopener" style="color:var(--accent)">FRED ↗</a></div>' +
      "${historyHTML('USA','sofr')}" +
      '<label class="diff-pick"><input type="checkbox" class="rate-diff-cb" data-key="sofr"> für Differenz wählen</label></div>' +
      '<div class="metric has-chart" data-rate-key="iorb"><div class="name">IORB · Interest on Reserve Balances</div>' +
      "<div class=\"value\">${(()=>{const a=histories['USA-iorb']||[];const last=a.at(-1);return last?fmt(last.value):(data.USA&&data.USA.iorb?fmt(data.USA.iorb.value):'—')})()}</div>" +
      '<div class="date">FRED IORB · täglich · <a href="https://fred.stlouisfed.org/series/IORB" target="_blank" rel="noopener" style="color:var(--accent)">FRED ↗</a></div>' +
      "${historyHTML('USA','iorb')}" +
      '<label class="diff-pick"><input type="checkbox" class="rate-diff-cb" data-key="iorb"> für Differenz wählen</label></div>' +
      '<div class="metric has-chart diff-panel" id="rateDiffPanel"><div class="name" id="rateDiffTitle">Differenz · 2 Serien wählen</div><div class="value" id="rateDiffValue">—</div><div class="date" id="rateDiffDate">Kästchen bei zwei Charts anhaken (Reihenfolge: erste − zweite)</div><div id="rateDiffChart"></div><div class="diff-hint" id="rateDiffHint">Noch keine Auswahl</div></div>';
    faceA.after(faceB);
    faceB.after(faceC);
`;

// Replace faceA.after(faceB) pattern to also add faceC
if (!html.includes('usa-face-c')) {
  // restore-index writes: faceB.innerHTML=...`; then faceA.after(faceB)
  if (html.includes('faceA.after(faceB)')) {
    // Insert faceC creation before after, then after both
    html = html.replace(
      'faceA.after(faceB)',
      faceCJs.replace('faceA.after(faceB);\n    faceB.after(faceC);', 'faceA.after(faceB); faceB.after(faceC)')
    );
    // The faceCJs already contains after calls - clean up if double
    if (!html.includes('usa-face-c')) {
      // Try alternate: after faceB.innerHTML block
      const marker = 'faceA.after(faceB)';
      if (html.includes(marker)) {
        html = html.replace(marker, faceCJs);
      }
    }
  }
}

// Fix potential double faceCJs issues - ensure single usa-face-c
if ((html.match(/usa-face-c/g) || []).length === 0) {
  console.warn('faceC not injected via after — trying alternate');
  const needle = 'faceA.after(faceB)';
  if (html.includes(needle)) {
    html = html.replace(
      needle,
      `{
    const faceC=document.createElement('div');
    faceC.className='metrics usa-face usa-face-c hidden';
    const _e=(histories['USA-effr']||[]).at(-1);
    const _s=(histories['USA-sofr']||[]).at(-1);
    const _i=(histories['USA-iorb']||[]).at(-1);
    faceC.innerHTML=\
      '<div class="metric has-chart" data-rate-key="effr"><div class="name">EFFR · Effective Fed Funds</div><div class="value">'+(_e?fmt(_e.value):(data.USA&&data.USA.effr?fmt(data.USA.effr.value):'—'))+'</div><div class="date">FRED EFFR · täglich · <a href="https://fred.stlouisfed.org/series/EFFR" target="_blank" rel="noopener" style="color:var(--accent)">FRED ↗</a></div>'+historyHTML('USA','effr')+'<label class="diff-pick"><input type="checkbox" class="rate-diff-cb" data-key="effr"> für Differenz wählen</label></div>'+
      '<div class="metric has-chart" data-rate-key="sofr"><div class="name">SOFR · Secured Overnight Financing</div><div class="value">'+(_s?fmt(_s.value):(data.USA&&data.USA.sofr?fmt(data.USA.sofr.value):'—'))+'</div><div class="date">FRED SOFR · täglich · <a href="https://fred.stlouisfed.org/series/SOFR" target="_blank" rel="noopener" style="color:var(--accent)">FRED ↗</a></div>'+historyHTML('USA','sofr')+'<label class="diff-pick"><input type="checkbox" class="rate-diff-cb" data-key="sofr"> für Differenz wählen</label></div>'+
      '<div class="metric has-chart" data-rate-key="iorb"><div class="name">IORB · Interest on Reserve Balances</div><div class="value">'+(_i?fmt(_i.value):(data.USA&&data.USA.iorb?fmt(data.USA.iorb.value):'—'))+'</div><div class="date">FRED IORB · täglich · <a href="https://fred.stlouisfed.org/series/IORB" target="_blank" rel="noopener" style="color:var(--accent)">FRED ↗</a></div>'+historyHTML('USA','iorb')+'<label class="diff-pick"><input type="checkbox" class="rate-diff-cb" data-key="iorb"> für Differenz wählen</label></div>'+
      '<div class="metric has-chart diff-panel" id="rateDiffPanel"><div class="name" id="rateDiffTitle">Differenz · 2 Serien wählen</div><div class="value" id="rateDiffValue">—</div><div class="date" id="rateDiffDate">Kästchen bei zwei Charts anhaken (Reihenfolge: erste − zweite)</div><div id="rateDiffChart"></div><div class="diff-hint" id="rateDiffHint">Noch keine Auswahl</div></div>';
    faceA.after(faceB);
    faceB.after(faceC);
    }`
    );
  }
}

// Replace old flip localStorage logic with page selector
const pageLogic = `
function setUsaPage(page){
  page=Math.max(0,Math.min(2,Number(page)||0));
  localStorage.setItem('macrowatch-usa-page',String(page));
  const card=document.querySelector('.country');
  // USA card: find faces within USA country card
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
  if(page===1)setTimeout(()=>{try{paintCuAu()}catch(e){}},50);
  if(page===2)setTimeout(paintRateDiff,50);
}
function bindUsaPages(){
  document.querySelectorAll('#usaPageSelect button').forEach(btn=>{
    btn.addEventListener('click',()=>setUsaPage(btn.dataset.page));
  });
  const saved=Number(localStorage.getItem('macrowatch-usa-page')||'0');
  setUsaPage(saved);
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
  // sync order from checked boxes
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
    if(dateEl)dateEl.textContent='Kästchen bei zwei Charts anhaken (Reihenfolge: erste − zweite)';
    host.innerHTML='';
    if(hint)hint.textContent=_rateDiffOrder.length===1?('Gewählt: '+labels[_rateDiffOrder[0]]+' · bitte zweite Serie'):'Noch keine Auswahl';
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
  if(!pts.length){
    if(valEl)valEl.textContent='—';
    host.innerHTML='<div class="sparkempty">Keine gemeinsamen Datenpunkte</div>';
    if(hint)hint.textContent='Historie überlappt nicht ausreichend';
    return;
  }
  const last=pts.at(-1);
  if(valEl)valEl.textContent=fmt(last.value);
  if(dateEl)dateEl.textContent='Stand '+last.period+' · '+pts.length+' Punkte · FRED';
  host.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|diff|'+name+'" title="Chart vergrößern">'+renderLineChart(pts,{w:220,h:58})+'</div>';
  // stash for big chart
  histories['USA-diff']=pts;
  if(hint)hint.textContent='Berechnet: '+name+' (Auswahlreihenfolge)';
}
document.addEventListener('change',e=>{
  if(e.target&&e.target.classList&&e.target.classList.contains('rate-diff-cb')){
    const boxes=[...document.querySelectorAll('.rate-diff-cb')];
    const checked=boxes.filter(b=>b.checked);
    if(checked.length>2){
      // keep only last two clicks via order
      e.target.checked=true;
      paintRateDiff();
      return;
    }
    paintRateDiff();
  }
});
`;

// Remove old checkbox flip handlers and inject new logic
if (!html.includes('function setUsaPage')) {
  // neutralize old flip
  html = html.replace(
    /const flipped=localStorage\.getItem\('macrowatch-usa-extra'\)==='1';[\s\S]*?faceB\.classList\.toggle\('hidden',!flipped\);/,
    '/* usa page set by setUsaPage */'
  );
  html = html.replace(
    /if\(document\.querySelector\('#usaExtraToggle'\)\)\{[\s\S]*?\}\)/,
    '/* old usaExtraToggle removed */'
  );
  const idx = html.lastIndexOf('refresh();');
  if (idx >= 0) {
    html = html.slice(0, idx) + pageLogic + '\nbindUsaPages();\n' + html.slice(idx);
  }
}

// ALL_KEYS + chart whitelist
for (const key of ['effr', 'sofr', 'iorb']) {
  if (!html.includes(`key==='${key}'`)) {
    html = html.replace("key==='us5yTips'){", `key==='us5yTips'||key==='${key}'){`);
    html = html.replace("key==='wresbal'){", `key==='wresbal'||key==='${key}'){`);
    html = html.replace("key==='t10y5y'){", `key==='t10y5y'||key==='${key}'){`);
  }
}
if (!html.includes("'effr'")) {
  html = html.replace("'hhDebt','bizDebt'", "'hhDebt','bizDebt','effr','sofr','iorb'");
  html = html.replace("'wresbal','cuAu']", "'wresbal','effr','sofr','iorb','cuAu']");
  html = html.replace("'wresbal']", "'wresbal','effr','sofr','iorb']");
}
if (!html.includes("effr:'EFFR")) {
  html = html.replace("us5yTips:'US5Y − TIPS5Y'}", "us5yTips:'US5Y − TIPS5Y',effr:'EFFR',sofr:'SOFR',iorb:'IORB'}");
  html = html.replace("wresbal:'Bankreserven (WRESBAL)'}", "wresbal:'Bankreserven (WRESBAL)',effr:'EFFR',sofr:'SOFR',iorb:'IORB'}");
}

fs.writeFileSync('index.html', html);
console.log(
  'faceC', html.includes('usa-face-c'),
  'pageSelect', html.includes('usaPageSelect'),
  'setUsaPage', html.includes('function setUsaPage'),
  'effr', html.includes("'effr'"),
  'diff', html.includes('paintRateDiff')
);
