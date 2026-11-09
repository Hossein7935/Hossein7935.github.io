import fs from 'fs';

/** Make USA page selector always reachable (sticky top) and harden navigation */
let html = fs.readFileSync('index.html', 'utf8');

// 1) CSS: sticky page select at top of USA card
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

// 2) Move page select to right after .ctop in the render template (before metrics)
// Current: ...</div></div><div class="metrics">...links...usa-flip-toggle
// Want: after ctop, before metrics
const oldToggle =
  "${c.id==='USA'?`<div class=\"usa-flip-toggle\"><div class=\"usa-page-select\" id=\"usaPageSelect\"><button type=\"button\" data-page=\"0\" class=\"active\">Seite 1</button><button type=\"button\" data-page=\"1\">Seite 2</button><button type=\"button\" data-page=\"2\">Seite 3 · Rates</button><button type=\"button\" data-page=\"3\">Seite 4 · Kurven</button><button type=\"button\" data-page=\"4\">Seite 5 · FHLB</button><button type=\"button\" data-page=\"5\">Seite 6 · IORB/1Y</button></div></div>`:''}";

// Find actual toggle snippet in file (escaping may differ)
if (html.includes('id="usaPageSelect"') || html.includes("id=\"usaPageSelect\"")) {
  // Remove toggle from end of card template if present after links
  html = html.replace(
    /\$\{c\.id==='USA'\?`<div class="usa-flip-toggle">[\s\S]*?<\/div><\/div>`:''\}/,
    ''
  );
  // Insert after ctop closing in template: <div class="ctop">...</div>
  const ctopEnd = html.indexOf(
    '<div class="ctop"><div class="flag">${c.flag}</div><div><h2>${c.name}</h2><div class="code">${c.id}</div></div></div>'
  );
  if (ctopEnd >= 0) {
    const insertAt =
      ctopEnd +
      '<div class="ctop"><div class="flag">${c.flag}</div><div><h2>${c.name}</h2><div class="code">${c.id}</div></div></div>'
        .length;
    const nav =
      "${c.id==='USA'?`<div class=\"usa-flip-toggle\"><div class=\"usa-page-select\" id=\"usaPageSelect\"><button type=\"button\" data-page=\"0\">Seite 1</button><button type=\"button\" data-page=\"1\">Seite 2</button><button type=\"button\" data-page=\"2\">Seite 3</button><button type=\"button\" data-page=\"3\">Seite 4</button><button type=\"button\" data-page=\"4\">Seite 5</button><button type=\"button\" data-page=\"5\">Seite 6</button></div></div>`:''}";
    // Avoid double insert
    if (!html.slice(insertAt, insertAt + 80).includes('usaPageSelect')) {
      html = html.slice(0, insertAt) + nav + html.slice(insertAt);
      console.log('nav moved after ctop');
    }
  } else {
    console.warn('ctop template not found for nav insert');
  }
}

// 3) Harden bindUsaPages — always rebind, stopPropagation issues
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
  const e = html.indexOf('function ', s + 10);
  // also handle if(!window.__usaRenderPatched) following
  let end = html.indexOf('if(!window.__usaRenderPatched)', s);
  if (end < 0 || end > s + 800) end = html.indexOf('\nfunction ', s + 10);
  if (end > s) {
    html = html.slice(0, s) + hardened + html.slice(end);
    console.log('bindUsaPages hardened');
  }
}

fs.writeFileSync('index.html', html);
console.log('done', html.length, 'usaPageSelect', html.includes('usaPageSelect'));
