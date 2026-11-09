import fs from 'fs';

/** USA page nav sticky + bindUsaPages + FULL setUsaPage 0..6 (must run last) */
let html = fs.readFileSync('index.html', 'utf8');

if (!html.includes('/* usa-nav-sticky */')) {
  const css = `
/* usa-nav-sticky */
.usa-flip-toggle{position:sticky;top:0;z-index:30;background:var(--panel);margin-top:0;padding:10px 0 8px;border-top:none;border-bottom:1px solid var(--line);flex-wrap:wrap}
.usa-page-select{display:flex;gap:6px;flex-wrap:wrap;width:100%}
.usa-page-select button{padding:8px 12px;min-height:36px;touch-action:manipulation}
`;
  if (html.includes('</style>')) {
    html = html.replace('</style>', css + '</style>');
    console.log('sticky css');
  }
}

const setUsaPageFn = `function setUsaPage(page){
  page=Math.max(0,Math.min(6,Number(page)||0));
  try{localStorage.setItem('macrowatch-usa-page',String(page))}catch(e){}
  document.querySelectorAll('.country').forEach(card=>{
    if(!card.querySelector('.usa-face-a'))return;
    const faces=['.usa-face-a','.usa-face-b','.usa-face-c','.usa-face-d','.usa-face-e','.usa-face-f','.usa-face-g'];
    faces.forEach((sel,i)=>{
      const el=card.querySelector(sel);
      if(el)el.classList.toggle('hidden',page!==i);
    });
    const sel=card.querySelector('#usaPageSelect');
    if(sel)sel.querySelectorAll('button').forEach(btn=>btn.classList.toggle('active',Number(btn.dataset.page)===page));
  });
  if(page===1)setTimeout(()=>{try{typeof paintCuAu==='function'&&paintCuAu()}catch(e){}},50);
  if(page===2)setTimeout(()=>{try{typeof paintRateDiff==='function'&&paintRateDiff();typeof paintUs2ySofr==='function'&&paintUs2ySofr()}catch(e){}},50);
  if(page===3)setTimeout(()=>{try{typeof paintSofRFwd==='function'&&paintSofRFwd()}catch(e){};try{typeof paintUstCurve==='function'&&paintUstCurve()}catch(e){}},50);
  if(page===4)setTimeout(()=>{try{typeof paintFhlb==='function'&&paintFhlb()}catch(e){};try{typeof paintEffrVol==='function'&&paintEffrVol()}catch(e){}},50);
  if(page===5)setTimeout(()=>{try{typeof paintIorbUs1y==='function'&&paintIorbUs1y();typeof paintMove==='function'&&paintMove()}catch(e){}},50);
  if(page===6)setTimeout(()=>{try{typeof paintYieldPage7==='function'&&paintYieldPage7()}catch(e){}},50);
}
`;

if (html.includes('function setUsaPage')) {
  const s = html.indexOf('function setUsaPage');
  const e = html.indexOf('function bindUsaPages', s);
  if (e > s) {
    html = html.slice(0, s) + setUsaPageFn + '\n' + html.slice(e);
    console.log('setUsaPage full 0-6');
  }
}

const hardened = `
function bindUsaPages(){
  if(!window.__usaPageClickBound){
    window.__usaPageClickBound=true;
    document.addEventListener('click',e=>{
      const btn=e.target&&e.target.closest&&e.target.closest('#usaPageSelect button, .usa-page-select button');
      if(!btn)return;
      e.preventDefault();
      e.stopPropagation();
      const page=Number(btn.getAttribute('data-page'));
      if(!Number.isFinite(page))return;
      try{localStorage.setItem('macrowatch-usa-page',String(page))}catch(err){}
      setUsaPage(page);
    },true);
  }
  let start=0;
  try{start=Number(localStorage.getItem('macrowatch-usa-page')||'0')}catch(e){start=0}
  if(!Number.isFinite(start)||start<0||start>6)start=0;
  setUsaPage(start);
}
`;

if (html.includes('function bindUsaPages')) {
  const s = html.indexOf('function bindUsaPages');
  let end = html.indexOf('if(!window.__usaRenderPatched)', s);
  if (end < 0 || end > s + 900) end = html.indexOf('\nfunction ', s + 10);
  if (end > s) {
    html = html.slice(0, s) + hardened + html.slice(end);
    console.log('bindUsaPages hardened');
  }
}

if (!html.includes('bindUsaPages();')) {
  if (html.includes('if(!window.__usaRenderPatched)')) {
    html = html.replace(
      /if\(!window\.__usaRenderPatched\)\{[\s\S]*?\n\}/,
      (m) => m + '\nbindUsaPages();\n'
    );
  }
  if (!html.includes('bindUsaPages();') && html.includes('refresh();')) {
    html = html.replace('refresh();', 'bindUsaPages();refresh();');
  }
}

if (!html.includes('data-page=\"6\"') && !html.includes('data-page="6"')) {
  html = html.replace(
    /(data-page=\"5\"[^>]*>)([^<]*)(<\/button>)/,
    '$1$2$3<button type=\"button\" data-page=\"6\">Seite 7</button>'
  );
  html = html.replace(
    /(data-page="5"[^>]*>)([^<]*)(<\/button>)/,
    '$1$2$3<button type="button" data-page="6">Seite 7</button>'
  );
}

fs.writeFileSync('index.html', html);
console.log('done', html.length, 'page===6', html.includes('page===6'), 'call', html.includes('bindUsaPages();'));
