import fs from 'fs';

/** Additive: UST + TIPS dual curve on USA page 4 */
let html = fs.readFileSync('index.html', 'utf8');

// Button label
html = html.replaceAll('Seite 4 · SOFR Fwd', 'Seite 4 · Kurven');

// Ensure UST panel in faceD builder
if (!html.includes('ustCurvePanel')) {
  const needle = "erscheinen ältere Kurven zum Vergleich.</div>';";
  const extra =
    "erscheinen ältere Kurven zum Vergleich.</div>'+\n" +
    "      '<div class=\"metric has-chart sofr-fwd-panel\" id=\"ustCurvePanel\">" +
    "<div class=\"name\">US-Zinsstruktur · Nominal + TIPS (rot)</div>" +
    "<div class=\"value\" id=\"ustCurveValue\">—</div>" +
    "<div class=\"date\" id=\"ustCurveDate\">3M · 1Y · 2Y · 5Y · 10Y · 30Y</div>" +
    "<div id=\"ustCurveChart\"></div>" +
    "<div class=\"sofr-fwd-bp\" id=\"ustCurveBp\"></div>" +
    "<div class=\"sofr-fwd-meta\" id=\"ustCurveMeta\">Nominal: FRED DGS*. TIPS (rot): DFII5/10/30.</div></div>';";
  if (html.includes(needle)) {
    html = html.replace(needle, extra);
    console.log('injected ustCurvePanel into faceD');
  } else {
    console.log('needle found?', html.includes(needle));
  }
}

// Call paintUstCurve with paintSofRFwd
if (!html.includes('paintUstCurve')) {
  html = html.replace(
    "if(page===3)setTimeout(()=>{try{typeof paintSofRFwd==='function'&&paintSofRFwd()}catch(e){}},50);",
    "if(page===3)setTimeout(()=>{try{typeof paintSofRFwd==='function'&&paintSofRFwd()}catch(e){};try{typeof paintUstCurve==='function'&&paintUstCurve()}catch(e){}},50);"
  );
}

const paint = `
function renderDualTenorChart(nom,tips,opts){
  opts=opts||{};
  const w=opts.w||360,h=opts.h||160;
  const order=['3M','1Y','2Y','5Y','10Y','30Y'];
  const nmap=new Map((nom||[]).map(p=>[String(p.period),Number(p.value)]));
  const tmap=new Map((tips||[]).map(p=>[String(p.period),Number(p.value)]));
  const vals=[];
  for(const k of order){const a=nmap.get(k),b=tmap.get(k);if(Number.isFinite(a))vals.push(a);if(Number.isFinite(b))vals.push(b);}
  if(!vals.length)return '<div class="sparkempty">Keine Daten</div>';
  let min=Math.min(...vals),max=Math.max(...vals);
  const pad=(max-min)*0.15||0.2;min-=pad;max+=pad;
  const l=28,r=12,tpad=14,b=28,iw=w-l-r,ih=h-tpad-b;
  const xAt=i=>l+(order.length===1?iw/2:(i/(order.length-1))*iw);
  const yAt=v=>tpad+ih-((v-min)/(max-min||1))*ih;
  function pathFor(map){
    const pts=[];
    order.forEach((k,i)=>{const v=map.get(k);if(Number.isFinite(v))pts.push([xAt(i),yAt(v),k,v]);});
    if(pts.length<2)return {d:'',dots:pts};
    return {d:'M'+pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' L'),dots:pts};
  }
  const pn=pathFor(nmap), pt=pathFor(tmap);
  const labels=order.map((k,i)=>'<text x="'+xAt(i).toFixed(1)+'" y="'+(h-8)+'" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">'+k+'</text>').join('');
  const yLabs=[max,(max+min)/2,min].map(v=>{
    const y=yAt(v);
    return '<text x="4" y="'+(y+3).toFixed(1)+'" font-size="9" fill="currentColor" opacity="0.55">'+Number(v).toFixed(2)+'</text>';
  }).join('');
  const dotsN=pn.dots.map(p=>'<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="3.2" fill="var(--accent)"><title>'+p[2]+' Nominal '+Number(p[3]).toFixed(2)+'%</title></circle>').join('');
  const dotsT=pt.dots.map(p=>'<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="3.2" fill="#e74c3c"><title>'+p[2]+' TIPS '+Number(p[3]).toFixed(2)+'%</title></circle>').join('');
  return '<svg viewBox="0 0 '+w+' '+h+'" width="'+w+'" height="'+h+'" style="max-width:100%;height:auto" role="img">'+
    '<line x1="'+l+'" y1="'+tpad+'" x2="'+l+'" y2="'+(tpad+ih)+'" stroke="currentColor" opacity="0.15"/>'+
    '<line x1="'+l+'" y1="'+(tpad+ih)+'" x2="'+(l+iw)+'" y2="'+(tpad+ih)+'" stroke="currentColor" opacity="0.15"/>'+
    yLabs+labels+
    (pn.d?'<path d="'+pn.d+'" fill="none" stroke="var(--accent)" stroke-width="2.2"/>':'')+
    (pt.d?'<path d="'+pt.d+'" fill="none" stroke="#e74c3c" stroke-width="2.2"/>':'')+
    dotsN+dotsT+
    '<text x="'+(l+4)+'" y="12" font-size="10" fill="var(--accent)">Nominal</text>'+
    '<text x="'+(l+70)+'" y="12" font-size="10" fill="#e74c3c">TIPS (real)</text>'+
    '</svg>';
}
function paintUstCurve(){
  const host=document.getElementById('ustCurveChart');
  const valEl=document.getElementById('ustCurveValue');
  const dateEl=document.getElementById('ustCurveDate');
  const bpEl=document.getElementById('ustCurveBp');
  const metaEl=document.getElementById('ustCurveMeta');
  if(!host)return;
  const u=(data.USA&&data.USA.ustCurve)||{};
  const nom=histories['USA-ustCurve']||u.nominal||[];
  const tips=histories['USA-tipsCurve']||u.tips||[];
  if(!nom.length){
    host.innerHTML='<div class="sparkempty">Keine UST-Kurve</div>';
    return;
  }
  const ten10=nom.find(p=>p.period==='10Y')||nom.at(-1);
  if(valEl)valEl.textContent=fmt(ten10.value);
  if(dateEl){
    const ts=u.updatedAt?u.updatedAt.replace('T',' ').slice(0,16)+' UTC':(u.date||'');
    dateEl.textContent=(ts?('Stand '+ts+' · '):'')+'Par Yields · 10Y im Fokus';
  }
  host.innerHTML='<div class="yield-chart-wrap">'+renderDualTenorChart(nom,tips,{w:360,h:160})+'</div>';
  if(bpEl){
    bpEl.innerHTML=nom.map(p=>{
      const tv=(tips.find(t=>t.period===p.period)||{}).value;
      const tip=tv!=null?(' · <span style="color:#e74c3c">TIPS '+fmt(tv)+'%</span>'):'';
      return '<span><b>'+p.period+'</b> '+fmt(p.value)+'%'+tip+'</span>';
    }).join('');
  }
  if(metaEl){
    metaEl.textContent=(u.source||'FRED DGS* + DFII*')+'. '+(u.note||'TIPS nur 5Y/10Y/30Y.')+' Nominal=Par Yield, TIPS=Real Yield.';
  }
}
`;

if (!html.includes('function paintUstCurve')) {
  const idx = html.lastIndexOf('bindUsaPages();');
  if (idx >= 0) {
    html = html.slice(0, idx) + paint + '\n' + html.slice(idx);
    console.log('paintUstCurve injected');
  }
}

// ALL_KEYS
if (!html.includes("'ustCurve'")) {
  html = html.replace(/ALL_KEYS=\[([^\]]+)\]/, (m, inner) => {
    if (inner.includes('ustCurve')) return m;
    return `ALL_KEYS=[${inner},'ustCurve']`;
  });
}
if (!html.includes("ustCurve:")) {
  html = html.replace(/extraLabels=\{([^}]*)\}/, (m, inner) => {
    if (inner.includes('ustCurve')) return m;
    return `extraLabels={${inner},ustCurve:'US Zinsstruktur'}`;
  });
}

fs.writeFileSync('index.html', html);
console.log('done', html.length, 'ustPanel', html.includes('ustCurvePanel'), 'paint', html.includes('paintUstCurve'), 'Kurven', html.includes('Seite 4 · Kurven'));
