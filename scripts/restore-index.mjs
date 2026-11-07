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

if ((html.match(/faceA\.after\(faceB\)/g) || []).length > 1 || html.includes('}grid.querySelectorAll') || html.includes('PLACEHOLDER')) {
  html = loadBase();
  console.log('force-clean base', html.length);
}

// CSS: page select + SOFR fwd
if (!html.includes('usa-page-select')) {
  const css = '.usa-page-select{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.usa-page-select button{padding:6px 10px;border-radius:8px;border:1px solid var(--control-line);background:var(--control);color:var(--text);font:inherit;cursor:pointer}.usa-page-select button.active{background:var(--accent);color:#09211e;border-color:var(--accent);font-weight:700}.diff-pick{display:inline-flex;align-items:center;gap:6px;margin-top:6px;font-size:11px;color:var(--muted);cursor:pointer}.diff-pick input{width:14px;height:14px;accent-color:var(--accent)}.diff-panel{grid-column:1/-1;border:1px dashed var(--line);border-radius:10px;padding:10px;background:var(--metric)}.diff-hint{font-size:11px;color:var(--muted);margin-top:4px}.sofr-fwd-panel{grid-column:1/-1}#sofrFwdChart .yield-chart-wrap svg,#sofrFwdHistChart .yield-chart-wrap svg{width:100%;max-width:100%;height:auto}.sofr-fwd-meta{font-size:11px;color:var(--muted);margin-top:6px;line-height:1.4}.sofr-fwd-bp{font-size:12px;margin-top:4px}.sofr-fwd-bp span{margin-right:10px}';
  html = html.replace('</style>', css + '</style>');
} else if (!html.includes('sofr-fwd-panel')) {
  const css = '.sofr-fwd-panel{grid-column:1/-1}#sofrFwdChart .yield-chart-wrap svg,#sofrFwdHistChart .yield-chart-wrap svg{width:100%;max-width:100%;height:auto}.sofr-fwd-meta{font-size:11px;color:var(--muted);margin-top:6px;line-height:1.4}.sofr-fwd-bp{font-size:12px;margin-top:4px}.sofr-fwd-bp span{margin-right:10px}';
  html = html.replace('</style>', css + '</style>');
} else if (!html.includes('#sofrFwdChart .yield-chart-wrap svg')) {
  html = html.replace(
    '.sofr-fwd-panel{grid-column:1/-1}',
    '.sofr-fwd-panel{grid-column:1/-1}#sofrFwdChart .yield-chart-wrap svg,#sofrFwdHistChart .yield-chart-wrap svg{width:100%;max-width:100%;height:auto}'
  );
}

// Page selector: 4 pages
if (html.includes('usaExtraToggle') && !html.includes('usaPageSelect')) {
  html = html.replace(
    /\$\{c\.id==='USA'\?`<div class="usa-flip-toggle"><label><input type="checkbox" id="usaExtraToggle">[^`]*<\/label><\/div>`:''\}/,
    "${c.id==='USA'?`<div class=\"usa-flip-toggle\"><div class=\"usa-page-select\" id=\"usaPageSelect\"><button type=\"button\" data-page=\"0\" class=\"active\">Seite 1</button><button type=\"button\" data-page=\"1\">Seite 2</button><button type=\"button\" data-page=\"2\">Seite 3 · Rates</button><button type=\"button\" data-page=\"3\">Seite 4 · SOFR Fwd</button></div></div>`:''}"
  );
}
if (html.includes('usaPageSelect') && !html.includes('Seite 4 · SOFR Fwd')) {
  html = html.replace(
    /(<div class=\"usa-page-select\" id=\"usaPageSelect\">[\s\S]*?Seite 3 · Rates<\/button>)(<\/div>)/,
    '$1<button type=\"button\" data-page=\"3\">Seite 4 · SOFR Fwd</button>$2'
  );
  html = html.replace(
    /(id="usaPageSelect">[\s\S]*?Seite 3 · Rates<\/button>)(<\/div>)/,
    '$1<button type="button" data-page="3">Seite 4 · SOFR Fwd</button>$2'
  );
}

html = html.replaceAll(
  "key==='y10'||key==='rate'",
  "key==='y10'||key==='t10y2y'||key==='rate'"
);

html = html.replace(
  /const flipped=localStorage\.getItem\('macrowatch-usa-extra'\)==='1';[\s\S]*?faceB\.classList\.toggle\('hidden',!flipped\);/g,
  '/* pages via setUsaPage */'
);
html = html.replace(
  /if\(document\.querySelector\('#usaExtraToggle'\)\)\{[\s\S]*?\}\)/g,
  '/* no checkbox toggle */'
);

// faceC once
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

// faceD: SOFR forward curve (page 4)
if (!html.includes('usa-face-d') && html.includes('usa-face-c')) {
  const faceD = `
    const faceD=document.createElement('div');
    faceD.className='metrics usa-face usa-face-d hidden';
    const _fwd=(data.USA&&data.USA.sofrFwd)||{};
    const _fwdPts=histories['USA-sofrFwd']||_fwd.curve||[];
    const _fwdLast=_fwdPts.length?_fwdPts[_fwdPts.length-1]:null;
    faceD.innerHTML=
      '<div class="metric has-chart sofr-fwd-panel" id="sofrFwdPanel">'+
        '<div class="name">SOFR-Erwartungskurve · marktimpliziert</div>'+
        '<div class="value" id="sofrFwdValue">'+(_fwdLast?fmt(_fwdLast.value):(_fwd.value!=null?fmt(_fwd.value):'—'))+'</div>'+
        '<div class="date" id="sofrFwdDate">'+(_fwd.updatedAt?('Stand '+_fwd.updatedAt.replace('T',' ').slice(0,16)+' UTC'):(_fwd.date||'—'))+' · 12m-Horizont</div>'+
        '<div id="sofrFwdChart"></div>'+
        '<div class="sofr-fwd-bp" id="sofrFwdBp"></div>'+
        '<div class="sofr-fwd-meta" id="sofrFwdMeta">Erwarteter Monatsdurchschnitt SOFR aus CME SR1 (Price=100−R). Spot: NY Fed SOFR. Keine Prognose der Fed — nur marktimplizierte Erwartung.</div>'+
      '</div>'+
      '<div class="metric has-chart sofr-fwd-panel" id="sofrFwdHistPanel">'+
        '<div class="name">Kurvenvergleich · heute vs. vor 30/90 Tagen</div>'+
        '<div class="value" id="sofrFwdHistValue">—</div>'+
        '<div class="date">Gespeicherte Tages-Snapshots</div>'+
        '<div id="sofrFwdHistChart"></div>'+
        '<div class="sofr-fwd-meta" id="sofrFwdHistMeta">Sobald mehrere Tage gespeichert sind, erscheinen ältere Kurven zum Vergleich.</div>'+
      '</div>';
    const _anchor=card.querySelector('.usa-face-c')||faceC;
    if(_anchor&&_anchor.parentNode)_anchor.after(faceD);
`;
  if (html.includes("faceB.after(faceC);")) {
    html = html.replace("faceB.after(faceC);", "faceB.after(faceC);\n" + faceD);
  } else if (html.includes('usa-face-c')) {
    const marker = "/* pages via setUsaPage */";
    if (html.includes(marker)) {
      html = html.replace(marker, faceD + '\n    ' + marker);
    }
  }
}

if (html.includes("ALL_KEYS=") && !html.includes("'sofrFwd'")) {
  html = html.replace(
    /ALL_KEYS=\[([^\]]+)\]/,
    (m, inner) => {
      if (inner.includes('sofrFwd')) return m;
      return `ALL_KEYS=[${inner},'sofrFwd']`;
    }
  );
}
if (html.includes('extraLabels=') && !html.includes("sofrFwd:")) {
  html = html.replace(
    /extraLabels=\{([^}]*)\}/,
    (m, inner) => {
      if (inner.includes('sofrFwd')) return m;
      return `extraLabels={${inner},sofrFwd:'SOFR Erwartungskurve'}`;
    }
  );
}

const pageLogic = `
function setUsaPage(page){
  page=Math.max(0,Math.min(3,Number(page)||0));
  try{localStorage.setItem('macrowatch-usa-page',String(page))}catch(e){}
  document.querySelectorAll('.country').forEach(card=>{
    if(!card.querySelector('.usa-face-a'))return;
    const a=card.querySelector('.usa-face-a');
    const b=card.querySelector('.usa-face-b');
    const c=card.querySelector('.usa-face-c');
    const d=card.querySelector('.usa-face-d');
    if(a)a.classList.toggle('hidden',page!==0);
    if(b)b.classList.toggle('hidden',page!==1);
    if(c)c.classList.toggle('hidden',page!==2);
    if(d)d.classList.toggle('hidden',page!==3);
    const sel=card.querySelector('#usaPageSelect');
    if(sel)sel.querySelectorAll('button').forEach(btn=>btn.classList.toggle('active',Number(btn.dataset.page)===page));
  });
  if(page===1)setTimeout(()=>{try{typeof paintCuAu==='function'&&paintCuAu()}catch(e){}},50);
  if(page===2)setTimeout(()=>{try{typeof paintRateDiff==='function'&&paintRateDiff()}catch(e){}},50);
  if(page===3)setTimeout(()=>{try{typeof paintSofRFwd==='function'&&paintSofRFwd()}catch(e){}},50);
}
function bindUsaPages(){
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
  const map2=new Map(a2.map(p=>[String(p.period)]));
  const map2v=new Map(a2.map(p=>[String(p.period),Number(p.value)]));
  const pts=[];
  for(const p of a1){
    const v2=map2v.get(String(p.period));
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

function paintSofRFwd(){
  const host=document.getElementById('sofrFwdChart');
  const valEl=document.getElementById('sofrFwdValue');
  const dateEl=document.getElementById('sofrFwdDate');
  const bpEl=document.getElementById('sofrFwdBp');
  const metaEl=document.getElementById('sofrFwdMeta');
  const histHost=document.getElementById('sofrFwdHistChart');
  const histVal=document.getElementById('sofrFwdHistValue');
  const histMeta=document.getElementById('sofrFwdHistMeta');
  if(!host)return;
  const fwd=(data.USA&&data.USA.sofrFwd)||{};
  let pts=histories['USA-sofrFwd']||fwd.curve||[];
  if((!pts||!pts.length)&&fwd.detail){
    pts=fwd.detail.map(p=>({period:p.tenor,value:p.value}));
  }
  if(!pts||!pts.length){
    host.innerHTML='<div class="sparkempty">Keine Forward-Daten</div>';
    if(metaEl)metaEl.textContent='Warte auf nächsten Datenlauf (GitHub Actions · stündlich).';
    return;
  }
  const last=pts.at(-1);
  if(valEl)valEl.textContent=fmt(last.value);
  if(dateEl){
    const ts=fwd.updatedAt?fwd.updatedAt.replace('T',' ').slice(0,16)+' UTC':(fwd.date||'');
    dateEl.textContent=(ts?('Stand '+ts+' · '):'')+'12m-Horizont · '+pts.map(p=>p.period).join(' / ');
  }
  // main curve chart — larger for readability
  host.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|sofrFwd|SOFR Fwd" title="Chart vergrößern">'+renderLineChart(pts,{w:360,h:160})+'</div>';
  if(bpEl){
    const spot=pts.find(p=>p.period==='Heute');
    if(spot){
      bpEl.innerHTML=pts.filter(p=>p.period!=='Heute').map(p=>{
        const bp=Math.round((Number(p.value)-Number(spot.value))*100);
        const sign=bp>0?'+':'';
        return '<span><b>'+p.period+'</b> '+fmt(p.value)+'% ('+sign+bp+' bp)</span>';
      }).join('');
    } else bpEl.innerHTML='';
  }
  if(metaEl){
    const det=fwd.detail||[];
    const legs=det.filter(p=>p.contracts).map(p=>p.tenor+': '+(p.contracts||[]).join('+')).join(' · ');
    metaEl.textContent='Quelle: '+(fwd.source||'NY Fed + CME SR1')+'. '+(legs?('Kontrakte '+legs+'. '):'')+'SR1: R=100−Price = erwarteter Monatsdurchschnitt SOFR. Keine Fed-Prognose.';
  }
  if(histHost){
    const snaps=histories['USA-sofrFwdSnapshots']||[];
    function closest(daysAgo){
      if(!snaps.length)return null;
      const target=Date.now()-daysAgo*864e5;
      let best=null,bestAbs=Infinity;
      for(const s of snaps){
        const t=Date.parse(s.asOf||s.spotDate||'');
        if(!Number.isFinite(t))continue;
        const abs=Math.abs(t-target);
        if(abs<bestAbs){bestAbs=abs;best=s;}
      }
      if(!best)return null;
      if(daysAgo>0 && bestAbs>20*864e5)return null;
      return best;
    }
    const today=snaps.at(-1)||{points:(fwd.detail||pts.map(p=>({tenor:p.period,value:p.value}))),asOf:fwd.updatedAt};
    const s30=closest(30);
    const s90=closest(90);
    const series=[];
    if(today&&today.points) series.push({label:'Heute',pts:today.points.map(p=>({period:p.tenor||p.period,value:Number(p.value)}))});
    if(s30&&s30!==today) series.push({label:'≈30d',pts:s30.points.map(p=>({period:p.tenor||p.period,value:Number(p.value)}))});
    if(s90&&s90!==today&&s90!==s30) series.push({label:'≈90d',pts:s90.points.map(p=>({period:p.tenor||p.period,value:Number(p.value)}))});
    if(series.length<=1){
      histHost.innerHTML='<div class="sparkempty">Vergleich ab 2+ gespeicherten Tagen</div>';
      if(histVal)histVal.textContent='—';
      if(histMeta)histMeta.textContent='Snapshots: '+snaps.length+' Tag(e). Vergleich erscheint automatisch nach weiteren Datenläufen.';
    } else {
      histHost.innerHTML=series.map(s=>
        '<div style="margin-top:8px"><div style="font-size:11px;color:var(--muted);margin-bottom:2px">'+s.label+(s.label==='≈30d'&&s30?' · '+String(s30.asOf).slice(0,10):'')+(s.label==='≈90d'&&s90?' · '+String(s90.asOf).slice(0,10):'')+'</div>'+
        '<div class="yield-chart-wrap">'+renderLineChart(s.pts,{w:360,h:100})+'</div></div>'
      ).join('');
      const t12=(today.points.find(p=>(p.tenor||p.period)==='12m')||{}).value;
      const p12=s30?(s30.points.find(p=>(p.tenor||p.period)==='12m')||{}).value:null;
      if(histVal&&t12!=null&&p12!=null){
        const bp=Math.round((t12-p12)*100);
        histVal.textContent=fmt(t12)+'  ('+(bp>=0?'+':'')+bp+' bp vs. 30d)';
      } else if(histVal&&t12!=null) histVal.textContent=fmt(t12);
      if(histMeta){
        histMeta.textContent='Heute: '+(today.asOf||'').toString().slice(0,16)+' · Snapshots: '+snaps.length+
          (s30?' · 30d-Ref: '+String(s30.asOf).slice(0,10):'')+
          (s90?' · 90d-Ref: '+String(s90.asOf).slice(0,10):'')+
          '. Verschiebung der 12m-Erwartung in bp.';
      }
    }
  }
}
bindUsaPages();
`;

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

html = html.replace(/\/\* old usaExtraToggle removed \*\/[\s;]*/g, '');
html = html.replace(/\}grid\.querySelectorAll/g, 'grid.querySelectorAll');
html = html.replace(/PLACEHOLDER_WILL_FAIL/g, '');

fs.writeFileSync('index.html', html);
console.log(
  'done', html.length,
  'faceC', html.includes('usa-face-c'),
  'faceD', html.includes('usa-face-d'),
  'page4', html.includes('Seite 4 · SOFR Fwd'),
  'paintSofRFwd', html.includes('paintSofRFwd'),
  'h160', html.includes('h:160')
);
