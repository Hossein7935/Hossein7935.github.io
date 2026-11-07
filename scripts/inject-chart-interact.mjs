import fs from 'fs';

/**
 * Enhance enlarged chart dialog for curve charts (SOFR Fwd, UST/TIPS):
 * - click-to-enlarge works for categorical curves
 * - crosshair follows mouse on X and Y
 * - axis-style readout (period + value) like TradingView
 */
let html = fs.readFileSync('index.html', 'utf8');

// CSS for axis labels on big chart
if (!html.includes('chart-axis-x')) {
  const css =
    '.chart-axis-x,.chart-axis-y{font-size:11px;fill:var(--text);opacity:.9;pointer-events:none}' +
    '.chart-tip-inline{position:absolute;pointer-events:none;background:var(--panel);border:1px solid var(--line);' +
    'padding:6px 10px;border-radius:8px;font-size:12px;box-shadow:0 4px 16px #0005;opacity:0;transition:opacity .1s;z-index:5;white-space:nowrap}' +
    '.chart-tip-inline.show{opacity:1}' +
    '#chartBody{position:relative}' +
    'dialog#chartDlg .chart-big{min-height:260px;cursor:crosshair}' +
    '.chart-crosshair-v,.chart-crosshair-h{stroke:var(--muted);stroke-width:1.2;stroke-dasharray:4 3;opacity:.85;pointer-events:none}' +
    '.chart-crosshair-dot{fill:var(--accent);stroke:var(--panel);stroke-width:2;pointer-events:none}';
  html = html.replace('</style>', css + '</style>');
  console.log('chart interact CSS added');
}

// Replace paintChartDlg to support curve keys + dual UST
const newPaintChartDlg = `function paintChartDlg(){
  if(!chartCtx)return;
  const key=chartCtx.key;
  const isCurve=key==='sofrFwd'||key==='ustCurve'||key==='tipsCurve'||key==='diff';
  const rangeBar=document.querySelector('#chartRange');
  if(rangeBar)rangeBar.style.display=isCurve?'none':'flex';

  const body=document.querySelector('#chartBody');
  const meta=document.querySelector('#chartMeta');

  // Dual UST + TIPS
  if(key==='ustCurve'&&typeof renderDualTenorChart==='function'){
    const u=(data.USA&&data.USA.ustCurve)||{};
    const nom=histories['USA-ustCurve']||u.nominal||[];
    const tips=histories['USA-tipsCurve']||u.tips||[];
    if(!nom.length){
      body.innerHTML='<div class="sparkempty">Keine Daten</div>';
      if(meta)meta.textContent='';
      return;
    }
    body.innerHTML=renderDualTenorChart(nom,tips,{w:720,h:320,big:true})+'<div class="chart-tip-inline" id="chartDlgTip"></div>';
    // ensure hits exist on dual chart
    const svg=body.querySelector('svg');
    if(svg&&!svg.querySelector('.hit')){
      svg.querySelectorAll('circle').forEach(c=>{
        if(c.classList.contains('chart-crosshair-dot'))return;
        c.classList.add('hit');
        const title=c.querySelector('title');
        if(title){
          const t=title.textContent||'';
          const m=t.match(/^(\S+)\s+(Nominal|TIPS)\s+([\d.]+)/);
          if(m){c.setAttribute('data-period',m[1]+' '+m[2]);c.setAttribute('data-value',m[3]);}
        }
      });
    }
    bindBigChartHover(body);
    if(meta)meta.textContent=nom.length+' Nominal-Punkte · TIPS rot · Maus bewegen für Crosshair';
    return;
  }

  const full=histories[chartCtx.country+'-'+chartCtx.key]||[];
  let arr;
  if(isCurve){
    arr=full.slice();
  }else{
    arr=filterByRange(full,chartCtx.range);
    if(!arr.length)arr=full;
  }
  const pts=arr.map(x=>({period:String(x.period),value:Number(x.value)})).filter(x=>Number.isFinite(x.value));
  if(!pts.length){
    body.innerHTML='<div class="sparkempty">Keine Daten für diesen Zeitraum</div>';
    if(meta)meta.textContent='';
    return;
  }
  body.innerHTML=renderLineChart(pts,{w:720,h:isCurve?300:280,big:true})+'<div class="chart-tip-inline" id="chartDlgTip"></div>';
  bindBigChartHover(body);
  if(isCurve){
    if(meta)meta.textContent=pts.length+' Punkte · '+pts.map(p=>p.period).join(' · ')+' · Maus bewegen für Crosshair';
  }else{
    const rLabel={'6m':'6 Monate','1y':'1 Jahr','3y':'3 Jahre'}[chartCtx.range]||chartCtx.range;
    if(meta)meta.textContent=pts.length+' Punkte · '+rLabel+' · '+esc(String(pts[0].period))+' → '+esc(String(pts.at(-1).period));
  }
}
`;

if (html.includes('function paintChartDlg()')) {
  const start = html.indexOf('function paintChartDlg()');
  // end at next function bindBigChartHover or function following
  let end = html.indexOf('function bindBigChartHover', start);
  if (end < 0) end = html.indexOf('\nfunction ', start + 10);
  if (start >= 0 && end > start) {
    html = html.slice(0, start) + newPaintChartDlg + '\n' + html.slice(end);
    console.log('paintChartDlg replaced');
  }
}

// Stronger bindBigChartHover with axis labels
const newBind = `function bindBigChartHover(body){
  const svg=body.querySelector('svg.chart-hover')||body.querySelector('svg');
  let tip=body.querySelector('#chartDlgTip');
  if(!svg)return;
  if(!tip){
    tip=document.createElement('div');
    tip.id='chartDlgTip';
    tip.className='chart-tip-inline';
    body.appendChild(tip);
  }
  const ns='http://www.w3.org/2000/svg';
  let v=svg.querySelector('.chart-crosshair-v');
  let h=svg.querySelector('.chart-crosshair-h');
  let d=svg.querySelector('.chart-crosshair-dot');
  let ax=svg.querySelector('.chart-axis-x');
  let ay=svg.querySelector('.chart-axis-y');
  if(!v){
    v=document.createElementNS(ns,'line');v.setAttribute('class','chart-crosshair-v');
    h=document.createElementNS(ns,'line');h.setAttribute('class','chart-crosshair-h');
    d=document.createElementNS(ns,'circle');d.setAttribute('class','chart-crosshair-dot');d.setAttribute('r','5');
    ax=document.createElementNS(ns,'text');ax.setAttribute('class','chart-axis-x');ax.setAttribute('text-anchor','middle');
    ay=document.createElementNS(ns,'text');ay.setAttribute('class','chart-axis-y');ay.setAttribute('text-anchor','start');
    svg.appendChild(v);svg.appendChild(h);svg.appendChild(d);svg.appendChild(ax);svg.appendChild(ay);
  }
  const hits=[...svg.querySelectorAll('.hit')];
  const vb=svg.viewBox.baseVal;
  const hide=()=>{
    tip.classList.remove('show');
    [v,h].forEach(el=>{el.setAttribute('x1',-99);el.setAttribute('x2',-99);el.setAttribute('y1',-99);el.setAttribute('y2',-99)});
    d.setAttribute('cx',-99);d.setAttribute('cy',-99);
    if(ax)ax.textContent='';
    if(ay)ay.textContent='';
  };
  svg.onmousemove=(e)=>{
    if(!hits.length)return;
    const rect=svg.getBoundingClientRect();
    const mx=(e.clientX-rect.left)*(vb.width/(rect.width||1));
    let best=hits[0],bd=1e9;
    for(const x of hits){
      const dd=Math.abs(+x.getAttribute('cx')-mx);
      if(dd<bd){bd=dd;best=x;}
    }
    const cx=+best.getAttribute('cx'),cy=+best.getAttribute('cy');
    const period=best.getAttribute('data-period')||'';
    const value=best.getAttribute('data-value')||'';
    v.setAttribute('x1',cx);v.setAttribute('x2',cx);v.setAttribute('y1',0);v.setAttribute('y2',vb.height);
    h.setAttribute('y1',cy);h.setAttribute('y2',cy);h.setAttribute('x1',0);h.setAttribute('x2',vb.width);
    d.setAttribute('cx',cx);d.setAttribute('cy',cy);
    if(ax){
      ax.textContent=period;
      ax.setAttribute('x',cx);
      ax.setAttribute('y',Math.min(vb.height-4, vb.height-2));
    }
    if(ay){
      ay.textContent=value+(String(value).includes('%')?'':'%');
      ay.setAttribute('x',6);
      ay.setAttribute('y',cy-4);
    }
    tip.textContent=period+' · '+value+(String(value).includes('%')?'':' %');
    tip.classList.add('show');
    const br=body.getBoundingClientRect();
    let left=e.clientX-br.left+14,top=e.clientY-br.top-10;
    if(left+160>br.width)left=e.clientX-br.left-170;
    if(top<0)top=8;
    tip.style.left=left+'px';
    tip.style.top=top+'px';
  };
  svg.onmouseleave=hide;
}
`;

if (html.includes('function bindBigChartHover')) {
  const start = html.indexOf('function bindBigChartHover');
  // find end: next top-level function after this one
  let end = html.indexOf('\nfunction ', start + 10);
  // avoid cutting too early - bindBigChartHover is multi-line
  // look for closing pattern after onmouseleave
  const leave = html.indexOf('onmouseleave', start);
  if (leave > start) {
    // find end of function - next \nfunction after leave
    end = html.indexOf('\nfunction ', leave);
  }
  if (start >= 0 && end > start) {
    html = html.slice(0, start) + newBind + '\n' + html.slice(end);
    console.log('bindBigChartHover replaced');
  }
}

// Ensure SOFR / UST small charts open dialog (data-chart already on sofr; force ust)
if (html.includes('function paintUstCurve') && !html.includes("data-chart=\"USA|ustCurve")) {
  html = html.replace(
    "host.innerHTML='<div class=\"yield-chart-wrap\">'+renderDualTenorChart(nom,tips,{w:360,h:160})+'</div>';",
    "host.innerHTML='<div class=\"yield-chart-wrap\" role=\"button\" tabindex=\"0\" data-chart=\"USA|ustCurve|US Zinsstruktur\" title=\"Chart vergrößern\">'+renderDualTenorChart(nom,tips,{w:360,h:160})+'</div>';"
  );
  console.log('ust data-chart wrap');
}

// Dual chart hits for crosshair when not big
if (html.includes('function renderDualTenorChart') && !html.includes("class=\"hit\"")) {
  html = html.replace(
    "const dotsN=pn.dots.map(p=>'<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="3.2" fill="var(--accent)"><title>'+p[2]+' Nominal '+Number(p[3]).toFixed(2)+'%</title></circle>').join('');",
    "const dotsN=pn.dots.map(p=>'<circle class=\"hit\" cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="3.2" fill="var(--accent)\" data-period="'+p[2]+' Nominal\" data-value="'+Number(p[3]).toFixed(2)+'"><title>'+p[2]+' Nominal '+Number(p[3]).toFixed(2)+'%</title></circle>').join('');"
  );
  html = html.replace(
    "const dotsT=pt.dots.map(p=>'<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="3.2" fill="#e74c3c"><title>'+p[2]+' TIPS '+Number(p[3]).toFixed(2)+'%</title></circle>').join('');",
    "const dotsT=pt.dots.map(p=>'<circle class=\"hit\" cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="3.2" fill="#e74c3c\" data-period="'+p[2]+' TIPS\" data-value="'+Number(p[3]).toFixed(2)+'"><title>'+p[2]+' TIPS '+Number(p[3]).toFixed(2)+'%</title></circle>').join('');"
  );
  // add chart-hover class on dual svg
  html = html.replace(
    "return '<svg viewBox=\"0 0 "'+w+' "'+h+'\" width="'+w+'" height="'+h+'" style=\"max-width:100%;height:auto\" role=\"img\">'+",
    "return '<svg class=\"chart-hover\" viewBox=\"0 0 "'+w+' "'+h+'\" width="'+w+'" height="'+h+'" style=\"max-width:100%;height:auto;cursor:crosshair\" role=\"img\">'+"
  );
  console.log('dual chart hits');
}

fs.writeFileSync('index.html', html);
console.log(
  'done', html.length,
  'paintChartDlg curve', html.includes("key==='sofrFwd'"),
  'axis', html.includes('chart-axis-x'),
  'bind new', html.includes('chart-axis-y')
);
