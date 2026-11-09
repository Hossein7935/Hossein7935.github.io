import fs from 'fs';

/** USA page 3: overlay checkboxes for EFFR/SOFR/IORB dual full-history chart */
let html = fs.readFileSync('index.html', 'utf8');

// Overlay checkboxes after each Differenz-label
if (!html.includes('rate-overlay-cb')) {
  html = html.replace(
    /class=\"rate-diff-cb\" data-key=\"(effr|sofr|iorb)\"> für Differenz wählen<\/label><\/div>/g,
    'class=\"rate-diff-cb\" data-key=\"$1\"> für Differenz wählen</label><label class=\"diff-pick\"><input type=\"checkbox\" class=\"rate-overlay-cb\" data-key=\"$1\"> für Overlay wählen</label></div>'
  );
  html = html.replace(
    /class="rate-diff-cb" data-key="(effr|sofr|iorb)"> für Differenz wählen<\/label><\/div>/g,
    'class="rate-diff-cb" data-key="$1"> für Differenz wählen</label><label class="diff-pick"><input type="checkbox" class="rate-overlay-cb" data-key="$1"> für Overlay wählen</label></div>'
  );
  console.log('overlay cbs', (html.match(/rate-overlay-cb/g) || []).length);
}

if (!html.includes('rateOverlayPanel')) {
  const needle =
    'id=\"rateDiffHint\">Noch keine Auswahl</div></div>\'';
  const add =
    "id=\"rateDiffHint\">Noch keine Auswahl</div></div>'+\n      '<div class=\"metric has-chart diff-panel\" id=\"rateOverlayPanel\"><div class=\"name\" id=\"rateOverlayTitle\">Overlay · 2 Serien (blau / rot)</div><div class=\"value\" id=\"rateOverlayValue\">—</div><div class=\"date\" id=\"rateOverlayDate\">Separates Kästchen · erste blau, zweite rot · volle Historie</div><div id=\"rateOverlayChart\"></div><div class=\"diff-hint\" id=\"rateOverlayHint\">Noch keine Overlay-Auswahl</div></div>'";
  if (html.includes(needle)) {
    html = html.replace(needle, add);
    console.log('panel in template');
  }
}

// Always refresh paintRateOverlay + renderer (replace if present)
const fn = `
let _rateOverlayOrder=[];
function renderRateOverlayChart(bluePts,redPts,opts){
  try{
  opts=opts||{};
  const w=opts.w||360,h=opts.h||180,big=!!opts.big;
  const blueLabel=opts.blueLabel||'Blau', redLabel=opts.redLabel||'Rot';
  const pad={t:20,r:14,b:24,l:42};
  const iw=w-pad.l-pad.r, ih=h-pad.t-pad.b;
  const b=(bluePts||[]).filter(p=>Number.isFinite(Number(p.value)));
  const r=(redPts||[]).filter(p=>Number.isFinite(Number(p.value)));
  if(!b.length&&!r.length)return '<div class="sparkempty">Keine Daten</div>';
  let allDates=[...new Set([...b,...r].map(p=>String(p.period)))].sort();
  // keep enlarge responsive
  if(big && allDates.length>2500) allDates=allDates.slice(-2500);
  if(!big && allDates.length>1200) allDates=allDates.slice(-1200);
  const dateSet=new Set(allDates);
  const b2=b.filter(p=>dateSet.has(String(p.period)));
  const r2=r.filter(p=>dateSet.has(String(p.period)));
  const xOf=i=>pad.l+(allDates.length<=1?iw/2:(i/(allDates.length-1))*iw);
  const dateIdx=new Map(allDates.map((d,i)=>[d,i]));
  const vals=[...b2,...r2].map(p=>Number(p.value));
  if(!vals.length)return '<div class="sparkempty">Keine Daten</div>';
  let vmin=Math.min(...vals), vmax=Math.max(...vals);
  const padV=(vmax-vmin)*0.12||0.1; vmin-=padV; vmax+=padV;
  const span=(vmax-vmin)||1;
  const yOf=v=>pad.t+ih-(Number(v)-vmin)/span*ih;
  const pathOf=pts=>{
    let d='';
    pts.forEach(p=>{
      const xi=dateIdx.get(String(p.period)); if(xi==null)return;
      d+=(d?'L':'M')+xOf(xi).toFixed(1)+','+yOf(p.value).toFixed(1);
    });
    return d;
  };
  const dB=pathOf(b2), dR=pathOf(r2);
  let hits='';
  // fewer hit targets when large
  const step=big?Math.max(1,Math.floor(b2.length/400)):Math.max(1,Math.floor(b2.length/200));
  b2.forEach((p,i)=>{if(i%step&&i!==b2.length-1)return; const xi=dateIdx.get(String(p.period)); if(xi==null)return;
    hits+='<circle class="hit" cx="'+xOf(xi).toFixed(1)+'" cy="'+yOf(p.value).toFixed(1)+'" r="'+(big?6:4)+'" fill="transparent" data-period="'+String(p.period)+' '+blueLabel+'" data-value="'+Number(p.value).toFixed(4)+'"></circle>';});
  r2.forEach((p,i)=>{if(i%step&&i!==r2.length-1)return; const xi=dateIdx.get(String(p.period)); if(xi==null)return;
    hits+='<circle class="hit" cx="'+xOf(xi).toFixed(1)+'" cy="'+yOf(p.value).toFixed(1)+'" r="'+(big?6:4)+'" fill="transparent" data-period="'+String(p.period)+' '+redLabel+'" data-value="'+Number(p.value).toFixed(4)+'"></circle>';});
  const grid=[];
  for(let i=0;i<=4;i++){
    const yy=pad.t+(ih*i)/4;
    grid.push('<line x1="'+pad.l+'" y1="'+yy+'" x2="'+(pad.l+iw)+'" y2="'+yy+'" stroke="rgba(127,127,127,.25)" stroke-width="1"/>');
    const v=vmax-(span*i)/4;
    grid.push('<text x="'+(pad.l-4)+'" y="'+(yy+3)+'" text-anchor="end" font-size="10" fill="currentColor">'+v.toFixed(2)+'</text>');
  }
  const leg='<text x="'+pad.l+'" y="14" font-size="11" fill="#4a9eed">'+blueLabel+'</text><text x="'+(pad.l+80)+'" y="14" font-size="11" fill="#e74c3c">'+redLabel+'</text>';
  // pixel width+height so dialog always has visible size
  return '<svg class="chart-big chart-hover" viewBox="0 0 '+w+' '+h+'" width="'+w+'" height="'+h+'" style="max-width:100%;height:auto;min-height:'+(big?260:120)+'px;display:block" preserveAspectRatio="xMidYMid meet">'+grid.join('')+leg+
    (dB?('<path d="'+dB+'" fill="none" stroke="#4a9eed" stroke-width="'+(big?2.4:1.7)+'"/>'):'')+
    (dR?('<path d="'+dR+'" fill="none" stroke="#e74c3c" stroke-width="'+(big?2.4:1.7)+'"/>'):'')+
    hits+'</svg>';
  }catch(err){
    return '<div class="sparkempty">Overlay-Chart Fehler: '+(err&&err.message?err.message:err)+'</div>';
  }
}
function paintRateOverlay(){
  let panel=document.getElementById('rateOverlayPanel');
  if(!panel){
    const faceC=document.querySelector('.usa-face-c');
    if(faceC){
      const wrap=document.createElement('div');
      wrap.innerHTML='<div class="metric has-chart diff-panel" id="rateOverlayPanel" style="grid-column:1/-1"><div class="name" id="rateOverlayTitle">Overlay · 2 Serien (blau / rot)</div><div class="value" id="rateOverlayValue">—</div><div class="date" id="rateOverlayDate">Separates Kästchen · volle Historie</div><div id="rateOverlayChart"></div><div class="diff-hint" id="rateOverlayHint">Noch keine Overlay-Auswahl</div></div>';
      faceC.appendChild(wrap.firstChild);
    }
  }
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
  const blue=histories['USA-'+k1]||[];
  const red=histories['USA-'+k2]||[];
  const name=labels[k1]+' / '+labels[k2];
  if(title)title.textContent='Overlay · '+labels[k1]+' (blau) · '+labels[k2]+' (rot)';
  const lastB=blue.length?blue.at(-1):null;
  const lastR=red.length?red.at(-1):null;
  if(valEl)valEl.innerHTML='<span style="color:#4a9eed">'+(lastB?fmt(lastB.value):'—')+'</span> / <span style="color:#e74c3c">'+(lastR?fmt(lastR.value):'—')+'</span>';
  if(dateEl){
    const start=blue[0]?blue[0].period:(red[0]?red[0].period:'');
    dateEl.textContent=(start?('ab '+start+' · '):'')+Math.max(blue.length,red.length)+' Punkte · volle Historie';
  }
  window.__rateOverlayMeta={k1,k2,name};
  // persist for enlarge even if meta is lost
  try{histories['USA-rateOverlayBlue']=blue;histories['USA-rateOverlayRed']=red;}catch(e){}
  if(typeof renderRateOverlayChart==='function'){
    host.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|rateOverlayDual|'+name+'" title="Chart vergrößern">'+renderRateOverlayChart(blue,red,{w:360,h:180,blueLabel:labels[k1],redLabel:labels[k2]})+'</div>';
  }
  if(hint)hint.textContent=labels[k1]+' blau · '+labels[k2]+' rot · Tippen · 6M/1J/3J';
}
if(!window.__rateOverlayBound){
  window.__rateOverlayBound=true;
  document.addEventListener('change',e=>{
    if(e.target&&e.target.classList&&e.target.classList.contains('rate-overlay-cb'))paintRateOverlay();
  });
}
`;

if (html.includes('function paintRateOverlay')) {
  // replace existing block from let _rateOverlayOrder through end of paintRateOverlay binding
  const start = html.indexOf('let _rateOverlayOrder=[]');
  if (start < 0) {
    const s2 = html.indexOf('function renderRateOverlayChart');
    if (s2 >= 0) {
      // find paintRateOverlay end
    }
  }
  const endMarker = 'function paintRateDiff';
  const end = html.indexOf(endMarker, start >= 0 ? start : 0);
  if (start >= 0 && end > start) {
    html = html.slice(0, start) + fn + '\n' + html.slice(end);
    console.log('paintRateOverlay replaced');
  } else if (!html.includes('function renderRateOverlayChart')) {
    html = html.replace('function paintRateDiff', fn + '\nfunction paintRateDiff');
    console.log('paintRateOverlay inserted');
  }
} else {
  if (html.includes('function paintRateDiff')) {
    html = html.replace('function paintRateDiff', fn + '\nfunction paintRateDiff');
    console.log('paintRateOverlay inserted');
  }
}

if (!html.includes("typeof paintRateOverlay==='function'&&paintRateOverlay()")) {
  html = html.replace(
    /typeof paintRateDiff==='function'&&paintRateDiff\(\);typeof paintUs2ySofr==='function'&&paintUs2ySofr\(\)/g,
    "typeof paintRateDiff==='function'&&paintRateDiff();typeof paintRateOverlay==='function'&&paintRateOverlay();typeof paintUs2ySofr==='function'&&paintUs2ySofr()"
  );
}

fs.writeFileSync('index.html', html);
console.log('done', html.length, 'fn', html.includes('function paintRateOverlay'), 'render', html.includes('function renderRateOverlayChart'));
