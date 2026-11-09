import fs from 'fs';

/** USA page nav: sticky selector + ensure bindUsaPages() is actually called */
let html = fs.readFileSync('index.html', 'utf8');

// 1) CSS sticky
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

// 2) Harden bindUsaPages
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
  if(!Number.isFinite(start)||start<0||start>5)start=0;
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

// 3) CRITICAL: ensure bindUsaPages() is invoked
// Prefer right after the render-patch block; also before refresh();
if (!html.includes('bindUsaPages();')) {
  if (html.includes('if(!window.__usaRenderPatched)')) {
    // append call after the render patch closing
    html = html.replace(
      /if\(!window\.__usaRenderPatched\)\{[\s\S]*?\n\}/,
      (m) => m + '\nbindUsaPages();\n'
    );
    console.log('bindUsaPages() after render patch');
  }
  if (!html.includes('bindUsaPages();')) {
    // fallback: before final refresh();
    if (html.includes('\nrefresh();\n')) {
      html = html.replace('\nrefresh();\n', '\nbindUsaPages();\nrefresh();\n');
      console.log('bindUsaPages() before refresh');
    } else if (html.includes('refresh();')) {
      html = html.replace('refresh();', 'bindUsaPages();refresh();');
      console.log('bindUsaPages() before refresh (inline)');
    }
  }
} else {
  console.log('bindUsaPages(); already present');
}

// 4) Also call after each render (in case cards rebuilt)
if (html.includes('__usaRenderPatched') && !html.includes('bindUsaPages()\n    return')) {
  html = html.replace(
    "try{setUsaPage(Number(localStorage.getItem('macrowatch-usa-page')||'0'))}catch(e){}\n    return r;",
    "try{bindUsaPages()}catch(e){try{setUsaPage(Number(localStorage.getItem('macrowatch-usa-page')||'0'))}catch(e2){}}\n    return r;"
  );
  console.log('render calls bindUsaPages');
}

fs.writeFileSync('index.html', html);
console.log('done', html.length, 'has call', html.includes('bindUsaPages();'));
