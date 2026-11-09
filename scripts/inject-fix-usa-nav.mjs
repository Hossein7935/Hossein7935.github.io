import fs from 'fs';

/** USA page nav: sticky selector + bindUsaPages() call; pages 0..6 */
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
    console.log('bindUsaPages() after render patch');
  }
  if (!html.includes('bindUsaPages();') && html.includes('refresh();')) {
    html = html.replace('refresh();', 'bindUsaPages();refresh();');
  }
}

if (html.includes('__usaRenderPatched')) {
  html = html.replace(
    "try{setUsaPage(Number(localStorage.getItem('macrowatch-usa-page')||'0'))}catch(e){}\n    return r;",
    "try{bindUsaPages()}catch(e){try{setUsaPage(Number(localStorage.getItem('macrowatch-usa-page')||'0'))}catch(e2){}}\n    return r;"
  );
}

// Ensure Seite 7 button exists in template
if (!html.includes('data-page=\"6\"') && !html.includes('data-page="6"')) {
  html = html.replace(
    /(data-page=\"5\"[^>]*>)([^<]*)(<\/button>)/,
    '$1$2$3<button type=\"button\" data-page=\"6\">Seite 7</button>'
  );
  html = html.replace(
    /(data-page="5"[^>]*>)([^<]*)(<\/button>)/,
    '$1$2$3<button type="button" data-page="6">Seite 7</button>'
  );
  console.log('added page 7 button');
}

fs.writeFileSync('index.html', html);
console.log('done', html.length, 'has call', html.includes('bindUsaPages();'), 'page6 btn', html.includes('data-page=\"6\"')||html.includes('data-page="6"'));
