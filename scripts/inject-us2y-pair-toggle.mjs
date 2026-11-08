import fs from 'fs';

/** USA page 3: US 2Y dual — toggle red series SOFR (default) / IORB / EFFR */
let html = fs.readFileSync('index.html', 'utf8');

if (!html.includes('function getUs2yPairKey')) {
  const helper = `
function getUs2yPairKey(){
  try{
    const v=localStorage.getItem('macrowatch-us2y-pair');
    if(v==='iorb'||v==='sofr'||v==='effr')return v;
  }catch(e){}
  return 'sofr';
}
function setUs2yPairKey(k){
  if(k!=='iorb'&&k!=='sofr'&&k!=='effr')k='sofr';
  try{localStorage.setItem('macrowatch-us2y-pair',k)}catch(e){}
  try{typeof paintUs2ySofr==='function'&&paintUs2ySofr()}catch(e){}
}
`;
  const idx = html.indexOf('function paintUs2ySofr');
  if (idx >= 0) html = html.slice(0, idx) + helper + html.slice(idx);
  else {
    const i2 = html.lastIndexOf('bindUsaPages();');
    if (i2 >= 0) html = html.slice(0, i2) + helper + html.slice(i2);
  }
  console.log('helper inserted');
} else {
  // widen allowed keys if helper already present
  html = html.replace(
    "if(v==='iorb'||v==='sofr')return v;",
    "if(v==='iorb'||v==='sofr'||v==='effr')return v;"
  );
  html = html.replace(
    "if(k!=='iorb'&&k!=='sofr')k='sofr';",
    "if(k!=='iorb'&&k!=='sofr'&&k!=='effr')k='sofr';"
  );
}

if (html.includes('function paintUs2ySofr')) {
  const start = html.indexOf('function paintUs2ySofr');
  const candidates = ['function paintMove', 'function paintIorbUs1y', 'function paintRateDiff', 'function bindUsaPages', 'function paintChartDlg'];
  let end = -1;
  for (const n of candidates) {
    const p = html.indexOf(n, start + 10);
    if (p > start && (end < 0 || p < end)) end = p;
  }
  if (end < 0) {
    const p = html.indexOf('\nfunction ', start + 20);
    if (p > start) end = p;
  }

  const newFn = `function paintUs2ySofr(){
  const faceC=document.querySelector('.usa-face-c');
  if(!faceC)return;
  if(!document.getElementById('us2ySofrPanel')){
    const box=document.createElement('div');
    box.innerHTML=
      '<div class="metric has-chart sofr-fwd-panel" id="us2ySofrPanel">'+
        '<div class="name">US 2Y (blau) · <span id="us2yPairRedName">SOFR</span> (rot)</div>'+
        '<div class="value" id="us2ySofrValue">—</div>'+
        '<div class="date" id="us2ySofrDate">ohne Differenz-Funktion</div>'+
        '<div class="sofr-fwd-bp" id="us2yPairToggle" style="gap:8px;flex-wrap:wrap">'+
          '<button type="button" class="us2y-pair-btn" data-pair="sofr" style="padding:4px 10px;border-radius:8px;border:1px solid rgba(127,127,127,.35);background:transparent;color:inherit;cursor:pointer">SOFR</button>'+
          '<button type="button" class="us2y-pair-btn" data-pair="iorb" style="padding:4px 10px;border-radius:8px;border:1px solid rgba(127,127,127,.35);background:transparent;color:inherit;cursor:pointer">IORB</button>'+
          '<button type="button" class="us2y-pair-btn" data-pair="effr" style="padding:4px 10px;border-radius:8px;border:1px solid rgba(127,127,127,.35);background:transparent;color:inherit;cursor:pointer">EFFR</button>'+
        '</div>'+
        '<div class="sofr-fwd-bp" id="us2ySofrCards"></div>'+
        '<div id="us2ySofrChart"></div>'+
        '<div class="sofr-fwd-meta" id="us2ySofrMeta">US 2Y blau · rot: SOFR / IORB / EFFR</div>'+
      '</div>';
    const diff=document.getElementById('rateDiffPanel');
    if(diff&&diff.parentNode===faceC) diff.insertAdjacentElement('afterend', box.firstChild);
    else while(box.firstChild) faceC.appendChild(box.firstChild);
  } else {
    // ensure EFFR button exists on older panels
    const tog=document.getElementById('us2yPairToggle');
    if(tog&&!tog.querySelector('[data-pair="effr"]')){
      const b=document.createElement('button');
      b.type='button';b.className='us2y-pair-btn';b.setAttribute('data-pair','effr');
      b.style.cssText='padding:4px 10px;border-radius:8px;border:1px solid rgba(127,127,127,.35);background:transparent;color:inherit;cursor:pointer';
      b.textContent='EFFR';
      tog.appendChild(b);
    }
  }
  const tog=document.getElementById('us2yPairToggle');
  if(tog&&!tog.dataset.bound){
    tog.dataset.bound='1';
    tog.addEventListener('click',e=>{
      const b=e.target.closest('[data-pair]');
      if(!b)return;
      setUs2yPairKey(b.getAttribute('data-pair'));
    });
  }
  const pair=typeof getUs2yPairKey==='function'?getUs2yPairKey():'sofr';
  const redKey=(pair==='iorb'||pair==='effr')?pair:'sofr';
  const redLabel=redKey==='iorb'?'IORB':(redKey==='effr'?'EFFR':'SOFR');
  document.querySelectorAll('.us2y-pair-btn').forEach(btn=>{
    const on=btn.getAttribute('data-pair')===redKey;
    btn.style.background=on?'rgba(231,76,60,.2)':'transparent';
    btn.style.borderColor=on?'#e74c3c':'rgba(127,127,127,.35)';
    btn.style.fontWeight=on?'600':'400';
  });
  const nameEl=document.getElementById('us2yPairRedName');
  if(nameEl)nameEl.textContent=redLabel;

  const meta=(data.USA&&data.USA.us2ySofr)||{};
  const us2y=histories['USA-us2y']||[];
  const red=histories['USA-'+redKey]||[];
  const valEl=document.getElementById('us2ySofrValue');
  const dateEl=document.getElementById('us2ySofrDate');
  const cards=document.getElementById('us2ySofrCards');
  const host=document.getElementById('us2ySofrChart');
  const metaEl=document.getElementById('us2ySofrMeta');
  const lastU=us2y.length?us2y.at(-1):null;
  const lastR=red.length?red.at(-1):null;
  const uVal=lastU?lastU.value:(meta.us2y!=null?meta.us2y:null);
  const rVal=lastR?lastR.value:null;
  if(valEl){
    valEl.innerHTML='<span style="color:#4a9eed">'+(uVal!=null?fmt(uVal):'—')+'</span> · <span style="color:#e74c3c">'+(rVal!=null?fmt(rVal):'—')+'</span>';
  }
  if(dateEl){
    dateEl.textContent='2Y '+(lastU?lastU.period:(meta.us2yDate||'—'))+' · '+redLabel+' '+(lastR?lastR.period:'—')+' · ohne Diff-Kästchen';
  }
  if(cards){
    const spr=(uVal!=null&&rVal!=null)?(Math.round((uVal-rVal)*10000)/10000):null;
    cards.innerHTML=
      '<span style="color:#4a9eed"><b>US 2Y</b> '+(uVal!=null?fmt(uVal)+' %':'—')+'</span>'+
      '<span style="color:#e74c3c"><b>'+redLabel+'</b> '+(rVal!=null?fmt(rVal)+' %':'—')+'</span>'+
      '<span><b>Spread</b> '+(spr!=null?((spr>=0?'+':'')+fmt(spr)+' pp'):'—')+'</span>';
  }
  if(host){
    if(!us2y.length&&!red.length)host.innerHTML='<div class="sparkempty">Keine Daten</div>';
    else if(typeof renderUs2ySofrChart==='function'){
      host.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|us2ySofrDual|US 2Y + '+redLabel+'" title="Chart vergrößern">'+renderUs2ySofrChart(us2y,red,{w:360,h:160,redLabel:redLabel})+'</div>';
    }
  }
  if(metaEl){
    const note=redKey==='iorb'?' (IORB+IOER Historie)':'';
    metaEl.textContent='US 2Y blau · '+redLabel+' rot'+note+' · '+(us2y.length)+' / '+(red.length)+' Punkte';
  }
}
`;

  if (end > start) {
    html = html.slice(0, start) + newFn + '\n' + html.slice(end);
    console.log('paintUs2ySofr replaced');
  } else console.warn('could not find end of paintUs2ySofr');
}

fs.writeFileSync('index.html', html);
console.log('done', html.length, 'pair', html.includes('function getUs2yPairKey'), 'effr btn', html.includes('data-pair="effr"'));
