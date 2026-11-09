import fs from 'fs';

/** USA page 7: yields + diff + red overlay + green third series */
let html = fs.readFileSync('index.html', 'utf8');

const setUsaPageFn = `function setUsaPage(page){\n  page=Math.max(0,Math.min(6,Number(page)||0));\n  try{localStorage.setItem('macrowatch-usa-page',String(page))}catch(e){}\n  document.querySelectorAll('.country').forEach(card=>{\n    if(!card.querySelector('.usa-face-a'))return;\n    const faces=['.usa-face-a','.usa-face-b','.usa-face-c','.usa-face-d','.usa-face-e','.usa-face-f','.usa-face-g'];\n    faces.forEach((sel,i)=>{\n      const el=card.querySelector(sel);\n      if(el)el.classList.toggle('hidden',page!==i);\n    });\n    const sel=card.querySelector('#usaPageSelect');\n    if(sel)sel.querySelectorAll('button').forEach(btn=>btn.classList.toggle('active',Number(btn.dataset.page)===page));\n  });\n  if(page===1)setTimeout(()=>{try{typeof paintCuAu==='function'&&paintCuAu()}catch(e){}},50);\n  if(page===2)setTimeout(()=>{try{typeof paintRateDiff==='function'&&paintRateDiff();typeof paintRateOverlay==='function'&&paintRateOverlay();typeof paintUs2ySofr==='function'&&paintUs2ySofr()}catch(e){}},50);\n  if(page===3)setTimeout(()=>{try{typeof paintSofRFwd==='function'&&paintSofRFwd()}catch(e){};try{typeof paintUstCurve==='function'&&paintUstCurve()}catch(e){}},50);\n  if(page===4)setTimeout(()=>{try{typeof paintFhlb==='function'&&paintFhlb()}catch(e){};try{typeof paintEffrVol==='function'&&paintEffrVol()}catch(e){}},50);\n  if(page===5)setTimeout(()=>{try{typeof paintIorbUs1y==='function'&&paintIorbUs1y();typeof paintMove==='function'&&paintMove()}catch(e){}},50);\n  if(page===6)setTimeout(()=>{try{typeof paintYieldPage7==='function'&&paintYieldPage7()}catch(e){}},50);\n}\n`;

if (html.includes('function setUsaPage')) {
  const s = html.indexOf('function setUsaPage');
  const e = html.indexOf('function bindUsaPages', s);
  if (e > s) {
    html = html.slice(0, s) + setUsaPageFn + '\n' + html.slice(e);
    console.log('setUsaPage replaced');
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
const USA_OVERLAY_CATALOG=[
  {key:'us3m',label:'US 3M'},
  {key:'us1y',label:'US 1Y'},
  {key:'us2y',label:'US 2Y'},
  {key:'us5y',label:'US 5Y'},
  {key:'us10y',label:'US 10Y'},
  {key:'us30y',label:'US 30Y'},
  {key:'dfii5',label:'TIPS 5Y'},
  {key:'dfii10',label:'TIPS 10Y'},
  {key:'effr',label:'EFFR'},
  {key:'sofr',label:'SOFR'},
  {key:'iorb',label:'IORB'},
  {key:'sofrIorb',label:'SOFR−IORB'},
  {key:'t10y2y',label:'10Y−2Y'},
  {key:'t10y5y',label:'10Y−5Y'},
  {key:'us5yTips',label:'5Y BEI (Tips)'},
  {key:'us10yTips',label:'10Y BEI (Tips)'},
  {key:'move',label:'MOVE Index'},
  {key:'wresbal',label:'WRESBAL Reserves'},
  {key:'effrVol',label:'EFFR Volume'},
  {key:'bofaCcc',label:'BofA CCC HY'},
  {key:'cuAu',label:'Copper/Gold'},
  {key:'rate',label:'Policy Rate'},
  {key:'inflation',label:'Inflation'}
];
function getYield7OverlayKey(){
  try{return localStorage.getItem('macrowatch-yield7-overlay')||''}catch(e){return ''}
}
function setYield7OverlayKey(k){
  try{localStorage.setItem('macrowatch-yield7-overlay',k||'')}catch(e){}
  try{typeof paintYield7Diff==='function'&&paintYield7Diff()}catch(e){}
}
function getYield7GreenKey(){
  try{return localStorage.getItem('macrowatch-yield7-green')||''}catch(e){return ''}
}
function setYield7GreenKey(k){
  try{localStorage.setItem('macrowatch-yield7-green',k||'')}catch(e){}
  try{typeof paintYield7Diff==='function'&&paintYield7Diff()}catch(e){}
}
function renderDiffOverlayChart(diffPts,ovPts,opts){
  try{
  opts=opts||{};
  const w=opts.w||360,h=opts.h||180,big=!!opts.big;
  const greenPts=opts.greenPts||[];
  const hasOv=(ovPts&&ovPts.length)||(greenPts&&greenPts.length);
  const pad={t:20,r:hasOv?48:12,b:24,l:42};
  const iw=w-pad.l-pad.r, ih=h-pad.t-pad.b;
  const d=(diffPts||[]).filter(p=>Number.isFinite(Number(p.value)));
  const o=(ovPts||[]).filter(p=>Number.isFinite(Number(p.value)));
  const g=(greenPts||[]).filter(p=>Number.isFinite(Number(p.value)));
  if(!d.length)return '<div class="sparkempty">Keine Daten</div>';
  let allDates=[...new Set([...d,...o,...g].map(p=>String(p.period)))].sort();
  if(big && allDates.length>2500) allDates=allDates.slice(-2500);
  if(!big && allDates.length>1200) allDates=allDates.slice(-1200);
  const dateSet=new Set(allDates);
  const d2=d.filter(p=>dateSet.has(String(p.period)));
  const o2=o.filter(p=>dateSet.has(String(p.period)));
  const g2=g.filter(p=>dateSet.has(String(p.period)));
  const xOf=i=>pad.l+(allDates.length<=1?iw/2:(i/(allDates.length-1))*iw);
  const dateIdx=new Map(allDates.map((dd,i)=>[dd,i]));
  const dMin=Math.min(...d2.map(p=>Number(p.value)));
  const dMax=Math.max(...d2.map(p=>Number(p.value)));
  const dSpan=(dMax-dMin)||1;
  const rightVals=[...o2,...g2].map(p=>Number(p.value));
  const oMin=rightVals.length?Math.min(...rightVals):0;
  const oMax=rightVals.length?Math.max(...rightVals):1;
  const oSpan=(oMax-oMin)||1;
  const yD=v=>pad.t+ih-(Number(v)-dMin)/dSpan*ih;
  const yO=v=>pad.t+ih-(Number(v)-oMin)/oSpan*ih;
  const pathOf=(pts,yFn)=>{
    let s='';
    pts.forEach(p=>{
      const xi=dateIdx.get(String(p.period)); if(xi==null)return;
      s+=(s?'L':'M')+xOf(xi).toFixed(1)+','+yFn(p.value).toFixed(1);
    });
    return s;
  };
  const pd=pathOf(d2,yD);
  const po=o2.length?pathOf(o2,yO):'';
  const pg=g2.length?pathOf(g2,yO):'';
  let hits='';
  const step=big?Math.max(1,Math.floor(d2.length/400)):Math.max(1,Math.floor(d2.length/200));
  d2.forEach((p,i)=>{if(i%step&&i!==d2.length-1)return; const xi=dateIdx.get(String(p.period)); if(xi==null)return;
    hits+='<circle class="hit" cx="'+xOf(xi).toFixed(1)+'" cy="'+yD(p.value).toFixed(1)+'" r="'+(big?6:4)+'" fill="transparent" data-period="'+String(p.period)+' Diff" data-value="'+Number(p.value).toFixed(4)+'"></circle>';});
  o2.forEach((p,i)=>{if(i%step&&i!==o2.length-1)return; const xi=dateIdx.get(String(p.period)); if(xi==null)return;
    hits+='<circle class="hit" cx="'+xOf(xi).toFixed(1)+'" cy="'+yO(p.value).toFixed(1)+'" r="'+(big?6:4)+'" fill="transparent" data-period="'+String(p.period)+' Rot" data-value="'+Number(p.value).toFixed(4)+'"></circle>';});
  g2.forEach((p,i)=>{if(i%step&&i!==g2.length-1)return; const xi=dateIdx.get(String(p.period)); if(xi==null)return;
    hits+='<circle class="hit" cx="'+xOf(xi).toFixed(1)+'" cy="'+yO(p.value).toFixed(1)+'" r="'+(big?6:4)+'" fill="transparent" data-period="'+String(p.period)+' Grün" data-value="'+Number(p.value).toFixed(4)+'"></circle>';});
  const grid=[];
  for(let i=0;i<=4;i++){
    const yy=pad.t+(ih*i)/4;
    grid.push('<line x1="'+pad.l+'" y1="'+yy+'" x2="'+(pad.l+iw)+'" y2="'+yy+'" stroke="rgba(127,127,127,.22)" stroke-width="1"/>');
    const dv=dMax-(dSpan*i)/4;
    grid.push('<text x="'+(pad.l-4)+'" y="'+(yy+3)+'" text-anchor="end" font-size="9" fill="#4a9eed">'+dv.toFixed(2)+'</text>');
    if(rightVals.length){
      const ov=oMax-(oSpan*i)/4;
      grid.push('<text x="'+(pad.l+iw+4)+'" y="'+(yy+3)+'" text-anchor="start" font-size="9" fill="#888">'+ov.toFixed(2)+'</text>');
    }
  }
  let leg='<text x="'+pad.l+'" y="14" font-size="10" fill="#4a9eed">Differenz</text>';
  let lx=pad.l+70;
  if(o2.length){leg+='<text x="'+lx+'" y="14" font-size="10" fill="#e74c3c">Rot</text>';lx+=40;}
  if(g2.length){leg+='<text x="'+lx+'" y="14" font-size="10" fill="#2ecc71">Grün</text>';}
  return '<svg class="chart-big chart-hover" viewBox="0 0 '+w+' '+h+'" width="'+w+'" height="'+h+'" style="max-width:100%;height:auto;min-height:'+(big?260:120)+'px;display:block" preserveAspectRatio="xMidYMid meet">'+grid.join('')+leg+
    '<path d="'+pd+'" fill="none" stroke="#4a9eed" stroke-width="'+(big?2.3:1.6)+'"/>'+
    (po?('<path d="'+po+'" fill="none" stroke="#e74c3c" stroke-width="'+(big?2.3:1.6)+'"/>'):'')+
    (pg?('<path d="'+pg+'" fill="none" stroke="#2ecc71" stroke-width="'+(big?2.3:1.6)+'"/>'):'')+
    hits+'</svg>';
  }catch(err){
    return '<div class="sparkempty">Chart-Fehler: '+(err&&err.message?err.message:err)+'</div>';
  }
}
function _yield7OverlayOptionsHtml(){
  return ['<option value="">— keines —</option>']
    .concat(USA_OVERLAY_CATALOG.map(s=>'<option value="'+s.key+'">'+s.label+'</option>')).join('');
}
function ensureUsaFaceG(){
  const faceA=document.querySelector('.usa-face-a');
  const card=faceA?faceA.closest('.country'):null;
  if(!card)return null;
  let g=card.querySelector('.usa-face-g');
  if(g){
    if(!document.getElementById('yield7OverlaySelect')||!document.getElementById('yield7GreenSelect')){
      const panel=document.getElementById('yield7DiffPanel');
      if(panel){
        let row=document.getElementById('yield7OverlayRow');
        if(!row){
          row=document.createElement('div');
          row.className='sofr-fwd-bp';
          row.id='yield7OverlayRow';
          row.style.cssText='gap:10px;flex-wrap:wrap;align-items:center;margin:6px 0';
          const chart=document.getElementById('yield7DiffChart');
          if(chart)panel.insertBefore(row,chart); else panel.appendChild(row);
        }
        row.innerHTML=
          '<label style="font-size:13px">Rot-Overlay: <select id="yield7OverlaySelect" style="margin-left:6px;min-width:160px;padding:4px 6px">'+_yield7OverlayOptionsHtml()+'</select></label>'+
          '<label style="font-size:13px">Grün (3.): <select id="yield7GreenSelect" style="margin-left:6px;min-width:160px;padding:4px 6px">'+_yield7OverlayOptionsHtml()+'</select></label>';
      }
    }
    return g;
  }
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
  const opts=_yield7OverlayOptionsHtml();
  g.innerHTML=panels
    +'<div class="metric has-chart diff-panel" id="yield7DiffPanel" style="grid-column:1/-1">'
    +'<div class="name" id="yield7DiffTitle">Differenz · 2 Serien wählen</div>'
    +'<div class="value" id="yield7DiffValue">—</div>'
    +'<div class="date" id="yield7DiffDate">Kästchen: erste − zweite · gleiche Historie</div>'
    +'<div class="sofr-fwd-bp" id="yield7OverlayRow" style="gap:10px;flex-wrap:wrap;align-items:center;margin:6px 0">'
    +'<label style="font-size:13px">Rot-Overlay: <select id="yield7OverlaySelect" style="margin-left:6px;min-width:160px;padding:4px 6px">'+opts+'</select></label>'
    +'<label style="font-size:13px">Grün (3. Chart): <select id="yield7GreenSelect" style="margin-left:6px;min-width:160px;padding:4px 6px">'+opts+'</select></label>'
    +'</div>'
    +'<div id="yield7DiffChart"></div>'
    +'<div class="diff-hint" id="yield7DiffHint">Noch keine Auswahl</div>'
    +'</div>';
  const f=card.querySelector('.usa-face-f');
  if(f&&f.parentNode)f.after(g);
  else{
    const e=card.querySelector('.usa-face-e');
    if(e&&e.parentNode)e.after(g);
    else{
      const d=card.querySelector('.usa-face-d');
      if(d&&d.parentNode)d.after(g);
      else card.appendChild(g);
    }
  }
  if(!window.__yield7DiffBound){
    window.__yield7DiffBound=true;
    document.addEventListener('change',e=>{
      if(e.target&&e.target.classList&&e.target.classList.contains('yield7-diff-cb')){
        paintYield7Diff();
      }
      if(e.target&&e.target.id==='yield7OverlaySelect'){
        setYield7OverlayKey(e.target.value||'');
      }
      if(e.target&&e.target.id==='yield7GreenSelect'){
        setYield7GreenKey(e.target.value||'');
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
  const sel=document.getElementById('yield7OverlaySelect');
  const selG=document.getElementById('yield7GreenSelect');
  if(sel){
    const cur=getYield7OverlayKey();
    if(sel.value!==cur)sel.value=cur;
    if(!sel.dataset.bound){
      sel.dataset.bound='1';
      sel.addEventListener('change',()=>setYield7OverlayKey(sel.value||''));
    }
  }
  if(selG){
    const curG=getYield7GreenKey();
    if(selG.value!==curG)selG.value=curG;
    if(!selG.dataset.bound){
      selG.dataset.bound='1';
      selG.addEventListener('change',()=>setYield7GreenKey(selG.value||''));
    }
  }
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

  const ovKey=getYield7OverlayKey();
  let ovPts=[];
  let ovLabel='';
  if(ovKey){
    ovPts=histories['USA-'+ovKey]||[];
    const cat=USA_OVERLAY_CATALOG.find(x=>x.key===ovKey);
    ovLabel=cat?cat.label:ovKey;
    if(pts.length&&ovPts.length){
      const t0=String(pts[0].period), t1=String(pts.at(-1).period);
      ovPts=ovPts.filter(p=>String(p.period)>=t0&&String(p.period)<=t1);
    }
  }
  const grKey=getYield7GreenKey();
  let grPts=[];
  let grLabel='';
  if(grKey){
    grPts=histories['USA-'+grKey]||[];
    const cat=USA_OVERLAY_CATALOG.find(x=>x.key===grKey);
    grLabel=cat?cat.label:grKey;
    if(pts.length&&grPts.length){
      const t0=String(pts[0].period), t1=String(pts.at(-1).period);
      grPts=grPts.filter(p=>String(p.period)>=t0&&String(p.period)<=t1);
    }
  }
  window.__yield7OverlayMeta={key:ovKey,label:ovLabel,pts:ovPts,greenKey:grKey,greenLabel:grLabel,greenPts:grPts};

  if(typeof renderDiffOverlayChart==='function'){
    host.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|yield7Diff|'+name+'" title="Chart vergrößern (6M/1J/3J)">'+renderDiffOverlayChart(pts,ovPts,{w:360,h:190,greenPts:grPts})+'</div>';
  }else if(typeof renderLineChart==='function'){
    host.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|yield7Diff|'+name+'" title="Chart vergrößern">'+renderLineChart(pts,{w:360,h:160})+'</div>';
  }
  const extra=[];
  if(ovLabel)extra.push('rot: '+ovLabel);
  if(grLabel)extra.push('grün: '+grLabel);
  if(hint)hint.textContent=name+(extra.length?(' · '+extra.join(' · ')):'')+' · Tippen · 6M/1J/3J';
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

if (html.includes('function paintYieldPage7')) {
  const start = html.indexOf('let _yieldDiffOrder=[]');
  if (start >= 0) {
    const end = html.indexOf('function paintYieldPage7');
    let i = end;
    let depth = 0;
    let started = false;
    for (; i < html.length; i++) {
      const ch = html[i];
      if (ch === '{') {
        depth++;
        started = true;
      } else if (ch === '}') {
        depth--;
        if (started && depth === 0) {
          i++;
          break;
        }
      }
    }
    html = html.slice(0, start) + block + html.slice(i);
    console.log('page7 block replaced');
  }
} else {
  const after = html.indexOf('let _rateDiffOrder=[];');
  if (after >= 0) {
    const ins = after + 'let _rateDiffOrder=[];'.length;
    html = html.slice(0, ins) + '\n' + block + html.slice(ins);
    console.log('page7 functions inserted');
  }
}

fs.writeFileSync('index.html', html);
console.log('done', html.length, 'green', html.includes('yield7GreenSelect'), 'render greenPts', html.includes('greenPts'));
