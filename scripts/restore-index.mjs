import fs from 'fs';
import { execSync } from 'child_process';

const GOOD = 'b9d928f1168a1077691008e344d5968c636056a6';
let html = fs.existsSync('index.html') ? fs.readFileSync('index.html','utf8') : '';
if (html.length < 15000 || !html.includes('defs.map') || !html.includes('usa-face-a')) {
  try { execSync(`git show ${GOOD}:index.html > index.html`); }
  catch { execSync(`curl -sL https://raw.githubusercontent.com/Hossein7935/Hossein7935.github.io/${GOOD}/index.html -o index.html`); }
  html = fs.readFileSync('index.html','utf8');
  console.log('restored', html.length);
}

if (!html.includes('chart-hover')) {
  html = html.replace('class="${cls}" viewBox', 'class="${cls} chart-hover" viewBox');
  html = html.replace('r="${opts.big?12:9}"', 'r="${opts.big?14:11}"');
}

if (!html.includes('chart-crosshair-v')) {
  const inject = `svg.chart-hover{cursor:crosshair}.chart-crosshair-v,.chart-crosshair-h{stroke:var(--muted);stroke-width:1;stroke-dasharray:4 3;opacity:.7;pointer-events:none}.chart-crosshair-dot{fill:var(--accent);stroke:var(--panel);stroke-width:2;pointer-events:none}#chartDlg .chart-big{min-height:260px}#chartDlg .chart-tip-inline{position:absolute;z-index:5;background:var(--panel);border:1px solid var(--line);color:var(--text);padding:8px 12px;border-radius:10px;font-size:13px;line-height:1.4;box-shadow:0 8px 24px #0005;pointer-events:none;opacity:0;white-space:nowrap}#chartDlg .chart-tip-inline.show{opacity:1}#chartDlg #chartBody{position:relative}`;
  if (html.includes('</style>')) html = html.replace('</style>', inject + '</style>');
}

if (!html.includes('bindBigChartHover')) {
  const needle = 'body.innerHTML=renderLineChart(pts,{w:640,h:180,big:true});';
  const repl = "body.innerHTML=renderLineChart(pts,{w:720,h:280,big:true})+'<div class=\"chart-tip-inline\" id=\"chartDlgTip\"></div>';bindBigChartHover(body);";
  if (html.includes(needle)) {
    html = html.replace(needle, repl);
    const fn = `\nfunction bindBigChartHover(body){\n  const svg=body.querySelector('svg.chart-hover')||body.querySelector('svg');\n  const tip=body.querySelector('#chartDlgTip');\n  if(!svg||!tip)return;\n  const ns='http://www.w3.org/2000/svg';\n  let v=svg.querySelector('.chart-crosshair-v'),h=svg.querySelector('.chart-crosshair-h'),d=svg.querySelector('.chart-crosshair-dot');\n  if(!v){v=document.createElementNS(ns,'line');v.setAttribute('class','chart-crosshair-v');h=document.createElementNS(ns,'line');h.setAttribute('class','chart-crosshair-h');d=document.createElementNS(ns,'circle');d.setAttribute('class','chart-crosshair-dot');d.setAttribute('r','5');svg.appendChild(v);svg.appendChild(h);svg.appendChild(d);}\n  const hits=[...svg.querySelectorAll('.hit')];\n  const vb=svg.viewBox.baseVal;\n  svg.onmousemove=(e)=>{\n    if(!hits.length)return;\n    const rect=svg.getBoundingClientRect();\n    const mx=(e.clientX-rect.left)*(vb.width/(rect.width||1));\n    let best=hits[0],bd=1e9;\n    for(const x of hits){const dd=Math.abs(+x.getAttribute('cx')-mx);if(dd<bd){bd=dd;best=x;}}\n    const cx=+best.getAttribute('cx'),cy=+best.getAttribute('cy');\n    v.setAttribute('x1',cx);v.setAttribute('x2',cx);v.setAttribute('y1',0);v.setAttribute('y2',vb.height);\n    h.setAttribute('y1',cy);h.setAttribute('y2',cy);h.setAttribute('x1',0);h.setAttribute('x2',vb.width);\n    d.setAttribute('cx',cx);d.setAttribute('cy',cy);\n    tip.innerHTML='<b>'+best.dataset.period+'</b><br>'+best.dataset.value;tip.classList.add('show');\n    const br=body.getBoundingClientRect();\n    let left=e.clientX-br.left+14,top=e.clientY-br.top-10;\n    if(left+140>br.width)left=e.clientX-br.left-150;if(top<0)top=8;\n    tip.style.left=left+'px';tip.style.top=top+'px';\n  };\n  svg.onmouseleave=()=>{tip.classList.remove('show');v.setAttribute('x1',-9);v.setAttribute('x2',-9);h.setAttribute('y1',-9);h.setAttribute('y2',-9);d.setAttribute('cx',-9);d.setAttribute('cy',-9);};\n}\n`;
    html = html.replace('function historyHTML', fn + 'function historyHTML');
    console.log('TV crosshair patch applied');
  }
}

// Chart keys: hhDebt, bizDebt, sofrUs3mSpread
html = html.replace(
  "||key==='sofr3m'||key==='t10y2y'||key==='nonfinDebt'",
  "||key==='sofr3m'||key==='t10y2y'||key==='hhDebt'||key==='bizDebt'||key==='sofrUs3mSpread'"
);
html = html.replace(
  "||key==='sofr3m'||key==='t10y2y'||key==='hhDebt'||key==='bizDebt'",
  "||key==='sofr3m'||key==='t10y2y'||key==='hhDebt'||key==='bizDebt'||key==='sofrUs3mSpread'"
);
// dedupe
html = html.replace(
  "||key==='sofrUs3mSpread'||key==='sofrUs3mSpread'",
  "||key==='sofrUs3mSpread'"
);
if (!html.includes("sofrUs3mSpread:'")) {
  html = html.replace(
    "hhDebt:'Households Debt Growth',bizDebt:'Business Debt Growth'",
    "hhDebt:'Households Debt Growth',bizDebt:'Business Debt Growth',sofrUs3mSpread:'SOFR − US 3M Spread'"
  );
  html = html.replace(
    "extraLabels={sofr3m:'CME Term SOFR 3M',t10y2y:'10Y − 2Y Spread'}",
    "extraLabels={sofr3m:'CME Term SOFR 3M',t10y2y:'10Y − 2Y Spread',hhDebt:'Households Debt Growth',bizDebt:'Business Debt Growth',sofrUs3mSpread:'SOFR − US 3M Spread'}"
  );
}

// HH + Business debt block
const debtHtml = [
  '<div class="metric has-chart"><div class="name">Households & Nonprofits Debt Growth</div>',
  "<div class=\"value\">${(()=>{const a=histories['USA-hhDebt']||[];const last=a.at(-1);return last?fmt(last.value):'—' })()}</div>",
  '<div class="date">Fed Z.1 · SAAR · <a href="https://www.federalreserve.gov/releases/z1/dataviz/z1/nonfinancial_debt/chart/#units:growth" target="_blank" rel="noopener" style="color:var(--accent)">Fed ↗</a></div>',
  "${historyHTML('USA','hhDebt')}</div>",
  '<div class="metric has-chart"><div class="name">Nonfinancial Business Debt Growth</div>',
  "<div class=\"value\">${(()=>{const a=histories['USA-bizDebt']||[];const last=a.at(-1);return last?fmt(last.value):'—' })()}</div>",
  '<div class="date">Fed Z.1 · SAAR · <a href="https://www.federalreserve.gov/releases/z1/dataviz/z1/nonfinancial_debt/chart/#units:growth" target="_blank" rel="noopener" style="color:var(--accent)">Fed ↗</a></div>',
  "${historyHTML('USA','bizDebt')}</div>"
].join('');

if (html.includes('Nonfinancial Debt Growth')) {
  const start = html.indexOf('<div class="metric has-chart"><div class="name">Nonfinancial Debt Growth');
  if (start >= 0) {
    const endMarker = "historyHTML('USA','nonfinDebt')}</div>";
    const end = html.indexOf(endMarker, start);
    if (end > start) {
      html = html.slice(0, start) + debtHtml + html.slice(end + endMarker.length);
      console.log('replaced Nonfinancial Debt Growth block');
    }
  }
} else if (!html.includes('Households & Nonprofits Debt Growth')) {
  const marker = "historyHTML('USA','t10y2y')}</div>";
  const idx = html.indexOf(marker);
  if (idx >= 0) {
    html = html.slice(0, idx + marker.length) + debtHtml + html.slice(idx + marker.length);
    console.log('appended hh+biz after t10y2y');
  }
}

// SOFR − US 3M spread metric (after biz debt or after t10y2y)
if (!html.includes('SOFR − US 3M') && !html.includes('sofrUs3mSpread')) {
  const spreadHtml = [
    '<div class="metric has-chart"><div class="name">SOFR − US 3M Spread</div>',
    "<div class=\"value\">${(()=>{const a=histories['USA-sofrUs3mSpread']||[];const last=a.at(-1);return last?fmt(last.value):'—' })()}</div>",
    '<div class="date">Term SOFR 3M − TVC:US03MY · TradingView</div>',
    "${historyHTML('USA','sofrUs3mSpread')}</div>"
  ].join('');
  const after = "historyHTML('USA','bizDebt')}</div>";
  if (html.includes(after)) {
    html = html.replace(after, after + spreadHtml);
    console.log('spread metric added after bizDebt');
  } else {
    const m2 = "historyHTML('USA','t10y2y')}</div>";
    if (html.includes(m2)) {
      html = html.replace(m2, m2 + spreadHtml);
      console.log('spread metric added after t10y2y');
    }
  }
}

fs.writeFileSync('index.html', html);
console.log('done', html.length, 'spread', html.includes('sofrUs3mSpread'), 'hh', html.includes('hhDebt'));
