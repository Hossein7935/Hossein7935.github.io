import fs from 'fs';

/** USA page 3: separate overlay checkboxes for EFFR/SOFR/IORB dual chart */
let html = fs.readFileSync('index.html', 'utf8');

// 1) Extend faceC HTML with overlay checkboxes + panel
const oldFaceC =
  "'<label class=\"diff-pick\"><input type=\"checkbox\" class=\"rate-diff-cb\" data-key=\"effr\"> für Differenz wählen</label></div>'+";
const newEffr =
  "'<label class=\"diff-pick\"><input type=\"checkbox\" class=\"rate-diff-cb\" data-key=\"effr\"> für Differenz wählen</label>"+
  "<label class=\"diff-pick\"><input type=\"checkbox\" class=\"rate-overlay-cb\" data-key=\"effr\"> für Overlay wählen</label></div>'+";

if (html.includes('rate-overlay-cb')) {
  console.log('overlay cbs already present');
} else if (html.includes('rate-diff-cb') && html.includes("data-key=\"effr\"")) {
  // inject overlay label after each rate-diff label for effr/sofr/iorb
  for (const k of ['effr', 'sofr', 'iorb']) {
    const a =
      `<label class="diff-pick"><input type="checkbox" class="rate-diff-cb" data-key="${k}"> für Differenz wählen</label></div>`;
    const b =
      `<label class="diff-pick"><input type="checkbox" class="rate-diff-cb" data-key="${k}"> für Differenz wählen</label>` +
      `<label class="diff-pick"><input type="checkbox" class="rate-overlay-cb" data-key="${k}"> für Overlay wählen</label></div>`;
    // template uses escaped quotes in string
    const aEsc = a
      .replace(/"/g, '\\"')
      .replace(/</g, "'+") // won't work
      ;
  }
  // Direct replace on the JS string form used in index
  html = html.replace(
    /class=\"rate-diff-cb\" data-key=\"(effr|sofr|iorb)\"> für Differenz wählen<\/label><\/div>/g,
    'class=\"rate-diff-cb\" data-key=\"$1\"> für Differenz wählen</label><label class=\"diff-pick\"><input type=\"checkbox\" class=\"rate-overlay-cb\" data-key=\"$1\"> für Overlay wählen</label></div>'
  );
  html = html.replace(
    /class="rate-diff-cb" data-key="(effr|sofr|iorb)"> für Differenz wählen<\/label><\/div>/g,
    'class="rate-diff-cb" data-key="$1"> für Differenz wählen</label><label class="diff-pick"><input type="checkbox" class="rate-overlay-cb" data-key="$1"> für Overlay wählen</label></div>'
  );
  console.log('overlay checkboxes injected', (html.match(/rate-overlay-cb/g) || []).length);
}

// 2) Add overlay panel after rateDiffPanel closing in faceC
if (!html.includes('rateOverlayPanel')) {
  const panel =
    "'<div class=\"metric has-chart diff-panel\" id=\"rateOverlayPanel\"><div class=\"name\" id=\"rateOverlayTitle\">Overlay · 2 Serien wählen (blau / rot)</div><div class=\"value\" id=\"rateOverlayValue\">—</div><div class=\"date\" id=\"rateOverlayDate\">Separates Kästchen: erste blau, zweite rot · volle Historie</div><div id=\"rateOverlayChart\"></div><div class=\"diff-hint\" id=\"rateOverlayHint\">Noch keine Overlay-Auswahl</div></div>'";
  // insert before faceA.after(faceB) after faceC.innerHTML assignment ends with rateDiffPanel
  const marker =
    "id=\"rateDiffHint\">Noch keine Auswahl</div></div>'";
  const marker2 =
    'id=\"rateDiffHint\">Noch keine Auswahl</div></div>\'';
  if (html.includes(marker)) {
    html = html.replace(
      marker,
      marker + '+\n      ' + panel
    );
    console.log('overlay panel inserted (esc)');
  } else if (html.includes("rateDiffHint">Noch keine Auswahl</div></div>'")) {
    html = html.replace(
      "rateDiffHint\">Noch keine Auswahl</div></div>'",
      "rateDiffHint\">Noch keine Auswahl</div></div>'+\n      " +
        panel.replace(/^'/, '').replace(/'$/, "'")
    );
    // simpler approach
  }
}

// Robust panel insert: after rateDiffPanel div closes in the template string
if (!html.includes('rateOverlayPanel')) {
  const needle =
    "id=\"rateDiffHint\">Noch keine Auswahl</div></div>'";
  if (html.includes(needle)) {
    html = html.replace(
      needle,
      "id=\"rateDiffHint\">Noch keine Auswahl</div></div>'+\n      '<div class=\"metric has-chart diff-panel\" id=\"rateOverlayPanel\"><div class=\"name\" id=\"rateOverlayTitle\">Overlay · 2 Serien (blau / rot)</div><div class=\"value\" id=\"rateOverlayValue\">—</div><div class=\"date\" id=\"rateOverlayDate\">Separates Kästchen · erste blau, zweite rot · volle Historie</div><div id=\"rateOverlayChart\"></div><div class=\"diff-hint\" id=\"rateOverlayHint\">Noch keine Overlay-Auswahl</div></div>'"
    );
    console.log('overlay panel inserted');
  } else {
    // try unescaped variant in case restore differs
    const n2 =
      'id="rateDiffHint">Noch keine Auswahl</div></div>\'';
    console.log('panel needle missing, try alt');
  }
}

// 3) Inject paintRateOverlay + dual renderer
if (!html.includes('function paintRateOverlay')) {
  const fn = `
let _rateOverlayOrder=[];
function renderRateOverlayChart(bluePts,redPts,opts){
  opts=opts||{};
  const w=opts.w||360,h=opts.h||180,big=!!opts.big;
  const blueLabel=opts.blueLabel||'Blau', redLabel=opts.redLabel||'Rot';
  const pad={t:18,r:12,b:22,l:40};
  const iw=w-pad.l-pad.r, ih=h-pad.t-pad.b;
  const b=(bluePts||[]).filter(p=>Number.isFinite(Number(p.value)));
  const r=(redPts||[]).filter(p=>Number.isFinite(Number(p.value)));
  if(!b.length&&!r.length)return '<div class="sparkempty">Keine Daten</div>';
  const allDates=[...new Set([...b,...r].map(p=>String(p.period)))].sort();
  const xOf=i=>pad.l+(allDates.length<=1?iw/2:(i/(allDates.length-1))*iw);
  const dateIdx=new Map(allDates.map((d,i)=>[d,i]));
  const vals=[...b,...r].map(p=>Number(p.value));
  const vmin=Math.min(...vals), vmax=Math.max(...vals);
  const span=(vmax-vmin)||1;
  const yOf=v=>pad.t+ih-(Number(v)-vmin)/span*ih;
  const pathOf=pts=>{
    let d='';
    pts.forEach(p=>{
      const xi=dateIdx.get(String(p.period)); if(xi==null)return;
      const x=xOf(xi), y=yOf(p.value);
      d+=(d?'L':'M')+x.toFixed(1)+','+y.toFixed(1);
    });
    return d;
  };
  const dB=pathOf(b), dR=pathOf(r);
  let hits='';
  b.forEach(p=>{const xi=dateIdx.get(String(p.period)); if(xi==null)return;
    hits+='<circle class="hit" cx="'+xOf(xi).toFixed(1)+'" cy="'+yOf(p.value).toFixed(1)+'" r="'+(big?6:4)+'" fill="transparent" data-period="'+String(p.period)+' '+blueLabel+'" data-value="'+Number(p.value).toFixed(4)+'"></circle>';});
  r.forEach(p=>{const xi=dateIdx.get(String(p.period)); if(xi==null)return;
    hits+='<circle class="hit" cx="'+xOf(xi).toFixed(1)+'" cy="'+yOf(p.value).toFixed(1)+'" r="'+(big?6:4)+'" fill="transparent" data-period="'+String(p.period)+' '+redLabel+'" data-value="'+Number(p.value).toFixed(4)+'"></circle>';});
  const grid=[];
  for(let i=0;i<=4;i++){
    const yy=pad.t+(ih*i)/4;
    grid.push('<line x1="'+pad.l+'" y1="'+yy+'" x2="'+(pad.l+iw)+'" y2="'+yy+'" stroke="rgba(127,127,127,.2)" stroke-width="1"/>');
    const v=vmax-(span*i)/4;
    grid.push('<text x="'+(pad.l-4)+'" y="'+(yy+3)+'" text-anchor="end" font-size="9" fill="currentColor">'+v.toFixed(2)+'</text>');
  }
  const leg='<text x="'+pad.l+'" y="12" font-size="10" fill="#4a9eed">'+blueLabel+'</text><text x="'+(pad.l+70)+'" y="12" font-size="10" fill="#e74c3c">'+redLabel+'</text>';
  return '<svg class="chart-hover" viewBox="0 0 '+w+' '+h+'" width="100%" height="'+h+'" preserveAspectRatio="none">'+grid.join('')+leg+
    (dB?('<path d="'+dB+'" fill="none" stroke="#4a9eed" stroke-width="'+(big?2.2:1.6)+'"/>'):'')+
    (dR?('<path d="'+dR+'" fill="none" stroke="#e74c3c" stroke-width="'+(big?2.2:1.6)+'"/>'):'')+
    hits+'</svg>';
}
function paintRateOverlay(){
  // ensure panel exists (for older sessions)
  let panel=document.getElementById('rateOverlayPanel');
  if(!panel){
    const faceC=document.querySelector('.usa-face-c');
    if(faceC){
      const d=document.createElement('div');
      d.innerHTML='<div class="metric has-chart diff-panel" id="rateOverlayPanel" style="grid-column:1/-1"><div class="name" id="rateOverlayTitle">Overlay · 2 Serien (blau / rot)</div><div class="value" id="rateOverlayValue">—</div><div class="date" id="rateOverlayDate">Separates Kästchen · volle Historie</div><div id="rateOverlayChart"></div><div class="diff-hint" id="rateOverlayHint">Noch keine Overlay-Auswahl</div></div>';
      faceC.appendChild(d.firstChild);
      panel=document.getElementById('rateOverlayPanel');
    }
  }
  // ensure overlay checkboxes on each rate card
  ['effr','sofr','iorb'].forEach(k=>{
    const card=document.querySelector('.usa-face-c [data-rate-key="'+k+'"]');
    if(!card)return;
    if(!card.querySelector('.rate-overlay-cb')){
      const lab=document.createElement('label');
      lab.className='diff-pick';
      lab.innerHTML='<input type="checkbox" class="rate-overlay-cb" data-key="'+k+'"> für Overlay wählen';
      card.appendChild(lab);
    }
  });
  const labels={effr:'EFFR',sofr:'SOFR',iorb:'IORB'};
  const title=document.getElementById('rateOverlayTitle');
  const valEl=document.getElementById('rateOverlayValue');
  const dateEl=document.getElementById('rateOverlayDate');
  const host=document.getElementById('rateOverlayChart');
  const hint=document.getElementById('rateOverlayHint');
  if(!host)return;
  const boxes=[...document.querySelectorAll('.rate-overlay-cb')];
  const checked=boxes.filter(b=>b.checked).map(b=>b.dataset.key);
  _rateOverlayOrder=_rateOverlayOrder.filter(k=>checked.includes(k));
  for(const k of checked){if(!_rateOverlayOrder.includes(k))_rateOverlayOrder.push(k)}
  while(_rateOverlayOrder.length>2){
    const drop=_rateOverlayOrder.shift();
    const box=boxes.find(b=>b.dataset.key===drop);
    if(box)box.checked=false;
  }
  if(_rateOverlayOrder.length<2){
    if(title)title.textContent='Overlay · 2 Serien (blau / rot)';
    if(valEl)valEl.textContent='—';
    if(dateEl)dateEl.textContent='Separates Kästchen · erste blau, zweite rot · volle Historie';
    host.innerHTML='';
    if(hint)hint.textContent=_rateOverlayOrder.length===1?('Gewählt: '+labels[_rateOverlayOrder[0]]):'Noch keine Overlay-Auswahl';
    return;
  }
  const [k1,k2]=_rateOverlayOrder;
  // FULL history — no filter
  const blue=histories['USA-'+k1]||[];
  const red=histories['USA-'+k2]||[];
  const name=labels[k1]+' / '+labels[k2];
  if(title)title.textContent='Overlay · '+labels[k1]+' (blau) · '+labels[k2]+' (rot)';
  const lastB=blue.length?blue.at(-1):null;
  const lastR=red.length?red.at(-1):null;
  if(valEl){
    valEl.innerHTML='<span style="color:#4a9eed">'+(lastB?fmt(lastB.value):'—')+'</span> / <span style="color:#e74c3c">'+(lastR?fmt(lastR.value):'—')+'</span>';
  }
  if(dateEl){
    const n=Math.max(blue.length,red.length);
    const start=blue[0]?blue[0].period:(red[0]?red[0].period:'');
    dateEl.textContent=(start?('ab '+start+' · '):'')+n+' Punkte · volle Historie';
  }
  window.__rateOverlayMeta={k1,k2,name};
  if(typeof renderRateOverlayChart==='function'){
    host.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|rateOverlayDual|'+name+'" title="Chart vergrößern">'+renderRateOverlayChart(blue,red,{w:360,h:180,blueLabel:labels[k1],redLabel:labels[k2]})+'</div>';
  }
  if(hint)hint.textContent=labels[k1]+' blau · '+labels[k2]+' rot · Tippen · 6M/1J/3J';
}
if(!window.__rateOverlayBound){
  window.__rateOverlayBound=true;
  document.addEventListener('change',e=>{
    if(e.target&&e.target.classList&&e.target.classList.contains('rate-overlay-cb')){
      paintRateOverlay();
    }
  });
}
`;
  // insert before paintRateDiff or after it
  if (html.includes('function paintRateDiff')) {
    html = html.replace('function paintRateDiff', fn + '\nfunction paintRateDiff');
    console.log('paintRateOverlay inserted');
  }
}

// 4) Call paintRateOverlay with page 3 (index 2)
if (!html.includes('paintRateOverlay()')) {
  html = html.replace(
    /typeof paintRateDiff==='function'&&paintRateDiff\(\);typeof paintUs2ySofr==='function'&&paintUs2ySofr\(\)/g,
    "typeof paintRateDiff==='function'&&paintRateDiff();typeof paintRateOverlay==='function'&&paintRateOverlay();typeof paintUs2ySofr==='function'&&paintUs2ySofr()"
  );
  // also if only paintRateDiff
  html = html.replace(
    /if\(page===2\)setTimeout\(\(\)=>\{try\{typeof paintRateDiff==='function'&&paintRateDiff\(\)\}catch\(e\)\{\}\},50\);/,
    "if(page===2)setTimeout(()=>{try{typeof paintRateDiff==='function'&&paintRateDiff();typeof paintRateOverlay==='function'&&paintRateOverlay();typeof paintUs2ySofr==='function'&&paintUss2ySofr()}catch(e){}},50);"
  );
  // fix typo if introduced
  html = html.replace('paintUs2ySofr', 'paintUs2ySofr');
  html = html.replace('paintUs2ySofr', (m, offset, s) => m); // noop
  console.log('paintRateOverlay hooks', html.includes('paintRateOverlay()'));
}

// Fix any typo paintUs2ySofr
html = html.replace(/paintUs2ySofr/g, 'paintUs2ySofr');

fs.writeFileSync('index.html', html);
console.log('done', html.length, 'overlay-cb', (html.match(/rate-overlay-cb/g)||[]).length, 'panel', html.includes('rateOverlayPanel'), 'fn', html.includes('function paintRateOverlay'));
