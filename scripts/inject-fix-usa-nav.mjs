import fs from 'fs';

/** USA page nav sticky + bindUsaPages + setUsaPage 0..7 (brace-safe replace) */
let html = fs.readFileSync('index.html', 'utf8');

function dedupeDecl(html, decl) {
  const first = html.indexOf(decl);
  if (first < 0) return html;
  let pos = first + decl.length;
  while (true) {
    const n = html.indexOf(decl, pos);
    if (n < 0) break;
    html = html.slice(0, n) + html.slice(n + decl.length);
    pos = n;
  }
  return html;
}
function replaceFunction(html, name, newSrc) {
  const start = html.indexOf('function ' + name);
  if (start < 0) return { html, ok: false };
  let i = start, depth = 0, started = false, end = -1;
  for (; i < html.length; i++) {
    if (html[i] === '{') { depth++; started = true; }
    else if (html[i] === '}') {
      depth--;
      if (started && depth === 0) { end = i; break; }
    }
  }
  if (end < 0) return { html, ok: false };
  return { html: html.slice(0, start) + newSrc + html.slice(end + 1), ok: true };
}

html = dedupeDecl(html, 'let _rateDiffOrder=[];');
html = dedupeDecl(html, 'let _yieldDiffOrder=[];');

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
  page=Math.max(0,Math.min(7,Number(page)||0));
  try{localStorage.setItem('macrowatch-usa-page',String(page))}catch(e){}
  try{
    if(page===4){typeof paintFhlb==='function'&&paintFhlb();typeof paintEffrVol==='function'&&paintEffrVol();}
    if(page===5){typeof paintIorbUs1y==='function'&&paintIorbUs1y();typeof paintMove==='function'&&paintMove();}
    if(page===6){typeof paintYieldPage7==='function'&&paintYieldPage7();}
    if(page===7){typeof paintRepoPage==='function'&&paintRepoPage();}
  }catch(e){}
  document.querySelectorAll('.country').forEach(card=>{
    if(!card.querySelector('.usa-face-a'))return;
    const faces=['.usa-face-a','.usa-face-b','.usa-face-c','.usa-face-d','.usa-face-e','.usa-face-f','.usa-face-g','.usa-face-h'];
    faces.forEach((sel,i)=>{
      const el=card.querySelector(sel);
      if(el)el.classList.toggle('hidden',page!==i);
    });
    const sel=card.querySelector('#usaPageSelect');
    if(sel)sel.querySelectorAll('button').forEach(btn=>btn.classList.toggle('active',Number(btn.dataset.page)===page));
  });
  if(page===0)setTimeout(()=>{try{typeof paintDxy==='function'&&paintDxy()}catch(e){}},50);
  if(page===1)setTimeout(()=>{try{typeof paintCuAu==='function'&&paintCuAu()}catch(e){}},50);
  if(page===2)setTimeout(()=>{try{typeof paintRateDiff==='function'&&paintRateDiff();typeof paintRateOverlay==='function'&&paintRateOverlay();typeof paintUs2ySofr==='function'&&paintUs2ySofr()}catch(e){}},50);
  if(page===3)setTimeout(()=>{try{typeof paintSofRFwd==='function'&&paintSofRFwd()}catch(e){};try{typeof paintSofRTenor==='function'&&paintSofRTenor()}catch(e){};try{typeof paintUstCurve==='function'&&paintUstCurve()}catch(e){}},50);
  if(page===4)setTimeout(()=>{try{typeof paintFhlb==='function'&&paintFhlb()}catch(e){};try{typeof paintEffrVol==='function'&&paintEffrVol()}catch(e){}},50);
  if(page===5)setTimeout(()=>{try{typeof paintIorbUs1y==='function'&&paintIorbUs1y();typeof paintMove==='function'&&paintMove()}catch(e){}},50);
  if(page===6)setTimeout(()=>{try{typeof paintYieldPage7==='function'&&paintYieldPage7()}catch(e){}},50);
  if(page===7)setTimeout(()=>{try{typeof paintRepoPage==='function'&&paintRepoPage()}catch(e){}},50);
}`;

const r1 = replaceFunction(html, 'setUsaPage', setUsaPageFn);
html = r1.html;
console.log('setUsaPage brace-replace', r1.ok);

const hardened = `function bindUsaPages(){
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
  if(!Number.isFinite(start)||start<0||start>7)start=0;
  setUsaPage(start);
}`;

const r2 = replaceFunction(html, 'bindUsaPages', hardened);
html = r2.html;
console.log('bindUsaPages brace-replace', r2.ok);

if (!html.includes('bindUsaPages();')) {
  if (html.includes('refresh();')) {
    html = html.replace('refresh();', 'bindUsaPages();refresh();');
  }
}

if (!html.includes('data-page="7"') && !html.includes('data-page=\"7\"')) {
  html = html.replace(
    /(data-page="6"[^>]*>)([^<]*)(<\/button>)/,
    '$1$2$3<button type="button" data-page="7">Repo-Markt</button>'
  );
}

html = dedupeDecl(html, 'let _rateDiffOrder=[];');
html = dedupeDecl(html, 'let _yieldDiffOrder=[];');

fs.writeFileSync('index.html', html);
console.log('done', html.length, 'REPO kept', html.includes('const REPO_PAGE_CATALOG') || html.includes('function paintRepoPage'), 'page===7', html.includes('page===7'));
