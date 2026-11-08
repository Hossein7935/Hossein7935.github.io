import fs from 'fs';

/** USA page 6: dual chart IORB (red) + US 1Y (blue) */
let html = fs.readFileSync('index.html', 'utf8');

// Page button
if (!html.includes('Seite 6')) {
  html = html.replace(
    /(data-page="4">Seite 5[^<]*<\/button>)/,
    '$1<button type="button" data-page="5">Seite 6 · IORB/1Y</button>'
  );
  console.log('page 6 button');
}

// Raise max page index to 5
html = html.replace(/Math\.min\(4,Number\(page\)\|\|0\)/g, 'Math.min(5,Number(page)||0)');
html = html.replace(/Math\.min\(5,Number\(page\)\|\|0\)/g, 'Math.min(5,Number(page)||0)');

// setUsaPage: face-f toggle
if (!html.includes("querySelector('.usa-face-f')")) {
  html = html.replace(
    /const e=card\.querySelector\('\.usa-face-e'\);/,
    "const e=card.querySelector('.usa-face-e');\n    const f=card.querySelector('.usa-face-f');"
  );
  html = html.replace(
    /if\(e\)e\.classList\.toggle\('hidden',page!==4\);/,
    "if(e)e.classList.toggle('hidden',page!==4);\n    if(f)f.classList.toggle('hidden',page!==5);"
  );
}

if (!html.includes('paintIorbUs1y()')) {
  html = html.replace(
    /if\(page===4\)setTimeout\(\(\)=>\{try\{typeof paintFhlb/,
    "if(page===5)setTimeout(()=>{try{typeof paintIorbUs1y==='function'&&paintIorbUs1y()}catch(e){}},50);\n  if(page===4)setTimeout(()=>{try{typeof paintFhlb"
  );
}

if (!html.includes('function renderIorbUs1yChart')) {
  const fn = `
function renderIorbUs1yChart(iorb,us1y,opts){
  opts=opts||{};
  const w=opts.w||360,h=opts.h||(opts.big?300:160);
  // align by date — use union of last N points for readability
  const im=new Map((iorb||[]).map(p=>[p.period,Number(p.value)]));
  const um=new Map((us1y||[]).map(p=>[p.period,Number(p.value)]));
  let dates=[...new Set([...im.keys(),...um.keys()])].sort();
  if(!opts.big && dates.length>900) dates=dates.slice(-900);
  if(opts.big && dates.length>1800) dates=dates.slice(-1800);
  const vals=[];
  for(const d of dates){
    const a=im.get(d),b=um.get(d);
    if(Number.isFinite(a))vals.push(a);
    if(Number.isFinite(b))vals.push(b);
  }
  if(vals.length<2)return '<div class="sparkempty">Keine Daten</div>';
  let min=Math.min(...vals),max=Math.max(...vals);
  const pad=(max-min)*0.12||0.1;min-=pad;max+=pad;
  const l=opts.big?36:28,r=10,t=14,b=28,iw=w-l-r,ih=h-t-b;
  const xAt=i=>l+(dates.length===1?iw/2:(i/(dates.length-1))*iw);
  const yAt=v=>t+ih-((v-min)/(max-min||1))*ih;
  function pathOf(map){
    const pts=[];
    dates.forEach((d,i)=>{const v=map.get(d);if(Number.isFinite(v))pts.push([xAt(i),yAt(v),d,v]);});
    if(pts.length<2)return {d:'',dots:pts};
    return {d:'M'+pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' L'),dots:pts};
  }
  const pi=pathOf(im), pu=pathOf(um);
  // sparse x labels
  const labelIdx=[0,Math.floor(dates.length/2),dates.length-1].filter((v,i,a)=>a.indexOf(v)===i);
  const xLabs=labelIdx.map(i=>{
    const d=dates[i];
    return '<text x="'+xAt(i).toFixed(1)+'" y="'+(h-6)+'" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.65">'+String(d).slice(0,7)+'</text>';
  }).join('');
  const yLabs=[max,(max+min)/2,min].map(v=>{
    const y=yAt(v);
    return '<text x="4" y="'+(y+3).toFixed(1)+'" font-size="9" fill="currentColor" opacity="0.55">'+Number(v).toFixed(2)+'</text>';
  }).join('');
  // hit points: prefer denser series for crosshair — sample every k
  const step=Math.max(1,Math.floor(dates.length/120));
  const hits=[];
  dates.forEach((d,i)=>{
    if(i%step&&i!==dates.length-1)return;
    const iv=im.get(d),uv=um.get(d);
    if(Number.isFinite(uv)) hits.push('<circle class="hit" cx="'+xAt(i).toFixed(1)+'" cy="'+yAt(uv).toFixed(1)+'" r="'+(opts.big?12:8)+'" fill="transparent" data-period="'+d+' US1Y" data-value="'+Number(uv).toFixed(2)+'"/>');
    if(Number.isFinite(iv)) hits.push('<circle class="hit" cx="'+xAt(i).toFixed(1)+'" cy="'+yAt(iv).toFixed(1)+'" r="'+(opts.big?12:8)+'" fill="transparent" data-period="'+d+' IORB" data-value="'+Number(iv).toFixed(2)+'"/>');
  });
  return '<svg class="chart-hover" viewBox="0 0 '+w+' '+h+'" width="'+w+'" height="'+h+'" style="max-width:100%;height:auto;cursor:crosshair" role="img">'+
    '<line x1="'+l+'" y1="'+t+'" x2="'+l+'" y2="'+(t+ih)+'" stroke="currentColor" opacity="0.12"/>'+
    '<line x1="'+l+'" y1="'+(t+ih)+'" x2="'+(l+iw)+'" y2="'+(t+ih)+'" stroke="currentColor" opacity="0.12"/>'+
    yLabs+xLabs+
    (pu.d?'<path d="'+pu.d+'" fill="none" stroke="#4a9eed" stroke-width="'+(opts.big?2.6:2.1)+'"/>':'')+
    (pi.d?'<path d="'+pi.d+'" fill="none" stroke="#e74c3c" stroke-width="'+(opts.big?2.6:2.1)+'"/>':'')+
    hits.join('')+
    '<text x="'+(l+4)+'" y="12" font-size="10" fill="#4a9eed">US 1Y</text>'+
    '<text x="'+(l+60)+'" y="12" font-size="10" fill="#e74c3c">IORB</text>'+
    '</svg>';
}
function paintIorbUs1y(){
  let faceF=document.querySelector('.usa-face-f');
  const pageNow=(()=>{try{return Number(localStorage.getItem('macrowatch-usa-page')||0)}catch(e){return 0}})();
  if(!faceF){
    const card=[...document.querySelectorAll('.country')].find(c=>c.querySelector('.usa-face-a'));
    if(!card)return;
    faceF=document.createElement('div');
    faceF.className='metrics usa-face usa-face-f'+(pageNow===5?'':' hidden');
    faceF.innerHTML=
      '<div class="metric has-chart sofr-fwd-panel" id="iorbUs1yPanel">'+
        '<div class="name">IORB (rot) · US 1Y Treasury (blau)</div>'+
        '<div class="value" id="iorbUs1yValue">—</div>'+
        '<div class="date" id="iorbUs1yDate">—</div>'+
        '<div class="sofr-fwd-bp" id="iorbUs1yCards"></div>'+
        '<div id="iorbUs1yChart"></div>'+
        '<div class="sofr-fwd-meta" id="iorbUs1yMeta">FRED IORB + DGS1 · Maus im Großchart = Crosshair</div>'+
      '</div>';
    const e=card.querySelector('.usa-face-e');
    if(e)e.after(faceF); else card.appendChild(faceF);
  }
  if(pageNow===5)faceF.classList.remove('hidden');
  const meta=(data.USA&&data.USA.iorbUs1y)||{};
  const iorb=histories['USA-iorb']||[];
  const us1y=histories['USA-us1y']||[];
  const valEl=document.getElementById('iorbUs1yValue');
  const dateEl=document.getElementById('iorbUs1yDate');
  const cards=document.getElementById('iorbUs1yCards');
  const host=document.getElementById('iorbUs1yChart');
  const metaEl=document.getElementById('iorbUs1yMeta');
  if(valEl){
    const a=meta.us1y!=null?fmt(meta.us1y):'—';
    const b=meta.iorb!=null?fmt(meta.iorb):'—';
    valEl.innerHTML='<span style="color:#4a9eed">'+a+'</span> · <span style="color:#e74c3c">'+b+'</span>';
  }
  if(dateEl){
    const ts=meta.updatedAt?meta.updatedAt.replace('T',' ').slice(0,16)+' UTC':'';
    dateEl.textContent='1Y '+(meta.us1yDate||'—')+' · IORB '+(meta.iorbDate||'—')+(ts?(' · '+ts):'');
  }
  if(cards){
    cards.innerHTML=
      '<span style="color:#4a9eed"><b>US 1Y</b> '+(meta.us1y!=null?fmt(meta.us1y)+' %':'—')+'</span>'+
      '<span style="color:#e74c3c"><b>IORB</b> '+(meta.iorb!=null?fmt(meta.iorb)+' %':'—')+'</span>'+
      '<span><b>Spread</b> '+(meta.spread!=null?((meta.spread>=0?'+':'')+fmt(meta.spread)+' pp'):'—')+'</span>';
  }
  if(host){
    if(!iorb.length&&!us1y.length)host.innerHTML='<div class="sparkempty">Keine Daten</div>';
    else host.innerHTML='<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|iorbUs1yDual|IORB + US 1Y" title="Chart vergrößern">'+renderIorbUs1yChart(iorb,us1y,{w:360,h:170})+'</div>';
  }
  if(metaEl)metaEl.textContent=(meta.source||'FRED IORB + DGS1')+' · '+(meta.iorbPoints||iorb.length)+' / '+(meta.us1yPoints||us1y.length)+' Punkte · Klick = vergrößern mit Crosshair';
}
`;
  const idx = html.lastIndexOf('bindUsaPages();');
  if (idx >= 0) {
    html = html.slice(0, idx) + fn + '\n' + html.slice(idx);
    console.log('paintIorbUs1y injected');
  }
}

// paintChartDlg support for dual key
if (html.includes('function paintChartDlg') && !html.includes("key==='iorbUs1yDual'")) {
  html = html.replace(
    "const isCurve=key==='sofrFwd'||key==='ustCurve'||key==='tipsCurve'||key==='diff';",
    "const isCurve=key==='sofrFwd'||key==='ustCurve'||key==='tipsCurve'||key==='diff'||key==='iorbUs1yDual';"
  );
  // inject dual render branch before sofrFwd handling / after ustCurve block
  const marker = "// Dual UST + TIPS";
  const branch = `
  if(key==='iorbUs1yDual'&&typeof renderIorbUs1yChart==='function'){
    const iorb=histories['USA-iorb']||[];
    const us1y=histories['USA-us1y']||[];
    if(!iorb.length&&!us1y.length){
      body.innerHTML='<div class="sparkempty">Keine Daten</div>';
      if(meta)meta.textContent='';
      return;
    }
    body.innerHTML=renderIorbUs1yChart(iorb,us1y,{w:720,h:320,big:true})+'<div class="chart-tip-inline" id="chartDlgTip"></div>';
    bindBigChartHover(body);
    if(meta)meta.textContent='IORB rot · US 1Y blau · Maus bewegen für Crosshair · '+(iorb.length)+'/'+(us1y.length)+' Punkte';
    return;
  }
`;
  if (html.includes("if(key==='ustCurve'")) {
    html = html.replace("if(key==='ustCurve'", branch + "if(key==='ustCurve'");
    console.log('dlg dual branch');
  }
}

if (!html.includes("'iorbUs1yDual'")) {
  html = html.replace(/ALL_KEYS=\[([^\]]+)\]/, (m, inner) => {
    if (inner.includes('iorbUs1yDual')) return m;
    return `ALL_KEYS=[${inner},'iorb','us1y','iorbUs1yDual']`;
  });
}
if (!html.includes('iorbUs1yDual:')) {
  html = html.replace(/extraLabels=\{([^}]*)\}/, (m, inner) => {
    if (inner.includes('iorbUs1yDual')) return m;
    return `extraLabels={${inner},iorb:'IORB',us1y:'US 1Y',iorbUs1yDual:'IORB + US 1Y'}`;
  });
}

fs.writeFileSync('index.html', html);
console.log(
  'done', html.length,
  'Seite6', html.includes('Seite 6'),
  'paint', html.includes('function paintIorbUs1y'),
  'max5', html.includes('Math.min(5')
);
