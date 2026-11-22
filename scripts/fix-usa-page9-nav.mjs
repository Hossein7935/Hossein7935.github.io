import fs from 'node:fs';

/** Last-step fix: USA setUsaPage/bindUsaPages must allow page 9 (EUR/Dollar). */
let html = fs.readFileSync('index.html', 'utf8');

function replaceFunction(html, name, newSrc) {
  const start = html.indexOf('function ' + name);
  if (start < 0) return { html, ok: false };
  let i = start,
    depth = 0,
    started = false,
    end = -1;
  for (; i < html.length; i++) {
    if (html[i] === '{') {
      depth++;
      started = true;
    } else if (html[i] === '}') {
      depth--;
      if (started && depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return { html, ok: false };
  return { html: html.slice(0, start) + newSrc + html.slice(end + 1), ok: true };
}

const setUsaPageFn = `function setUsaPage(page){
  page=Math.max(0,Math.min(9,Number(page)||0));
  try{localStorage.setItem('macrowatch-usa-page',String(page))}catch(e){}
  try{
    if(page===4){typeof paintFhlb==='function'&&paintFhlb();typeof paintEffrVol==='function'&&paintEffrVol();}
    if(page===5){typeof paintIorbUs1y==='function'&&paintIorbUs1y();typeof paintMove==='function'&&paintMove();}
    if(page===6){typeof paintYieldPage7==='function'&&paintYieldPage7();}
    if(page===7){typeof paintRepoPage==='function'&&paintRepoPage();}
    if(page===9){typeof ensureUsaFaceJ==='function'&&ensureUsaFaceJ();typeof paintXeurbi==='function'&&paintXeurbi();}
  }catch(e){}
  document.querySelectorAll('.country').forEach(card=>{
    if(!card.querySelector('.usa-face-a'))return;
    const faces=['.usa-face-a','.usa-face-b','.usa-face-c','.usa-face-d','.usa-face-e','.usa-face-f','.usa-face-g','.usa-face-h','.usa-face-i','.usa-face-j'];
    faces.forEach((sel,i)=>{
      const el=card.querySelector(sel);
      if(el)el.classList.toggle('hidden',page!==i);
    });
    // page 8/9 faces may be created later — ensure j visible when selected
    if(page===9){
      let fj=card.querySelector('.usa-face-j');
      if(!fj&&typeof ensureUsaFaceJ==='function'){try{ensureUsaFaceJ()}catch(e){} fj=card.querySelector('.usa-face-j');}
      if(fj)fj.classList.remove('hidden');
    }
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
  if(page===9)setTimeout(()=>{try{typeof ensureUsaFaceJ==='function'&&ensureUsaFaceJ();typeof paintXeurbi==='function'&&paintXeurbi();
    document.querySelectorAll('.country .usa-face-j').forEach(el=>el.classList.remove('hidden'));
  }catch(e){}},50);
}`;

const bindFn = `function bindUsaPages(){
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
  if(!Number.isFinite(start)||start<0||start>9)start=0;
  setUsaPage(start);
}`;

const r1 = replaceFunction(html, 'setUsaPage', setUsaPageFn);
html = r1.html;
console.log('setUsaPage', r1.ok);

const r2 = replaceFunction(html, 'bindUsaPages', bindFn);
html = r2.html;
console.log('bindUsaPages', r2.ok);

if (!html.includes('data-page="9"') && html.includes('>Repo-Markt</button>')) {
  html = html.replace(
    '>Repo-Markt</button>',
    '>Repo-Markt</button><button type="button" data-page="9">EUR/Dollar</button>'
  );
}

fs.writeFileSync('index.html', html);
console.log('fix-usa-page9-nav done', html.includes('Math.min(9,'), html.includes('page===9'));
