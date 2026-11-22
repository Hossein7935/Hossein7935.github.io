import fs from 'node:fs';

/** USA page 9 (index 8): EUR/Dollar · CME XEURBI chart */
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

// Button in page select
if (!html.includes('>EUR/Dollar</button>') && !html.includes('>EUR/Dolla</button>')) {
  if (html.includes('>Repo-Markt</button>')) {
    html = html.replace(
      '>Repo-Markt</button>',
      '>Repo-Markt</button><button type="button" data-page="8">EUR/Dollar</button>'
    );
    console.log('button EUR/Dollar added');
  }
}

// Ensure face-i container can be created by ensure function (runtime)
const paintSrc = `
function ensureUsaFaceI(){
  const card=document.querySelector('.country .usa-face-a')?document.querySelector('.country'):document.querySelector('[data-country="USA"]')||document.querySelector('.country');
  if(!card)return null;
  let face=card.querySelector('.usa-face-i');
  if(!face){
    face=document.createElement('div');
    face.className='metrics usa-face usa-face-i hidden';
    face.setAttribute('data-usa-face','8');
    const h=card.querySelector('.usa-face-h');
    if(h&&h.parentNode)h.after(face);
    else{
      const toggle=card.querySelector('.usa-flip-toggle');
      if(toggle&&toggle.parentNode)toggle.before(face);
      else card.appendChild(face);
    }
  }
  face.classList.add('metrics','usa-face');
  if(!face.querySelector('#xeurbiChart')){
    face.innerHTML=
      '<div class="metric has-chart" id="xeurbiPanel" style="grid-column:1/-1">'+
        '<div class="name">CME XEURBI · EUR/USD Cross-Currency Basis Index</div>'+
        '<div class="value" id="xeurbiValue">—</div>'+
        '<div class="date" id="xeurbiDate">CME · Basispunkte</div>'+
        '<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|xeurbi|XEURBI" title="Chart vergrößern" id="xeurbiChart"></div>'+
        '<div class="sofr-fwd-meta" id="xeurbiMeta">XEURBI in bp · gleiche Chart-Funktionen wie andere Serien (Vergrößern, 6M/1J/3J)</div>'+
      '</div>';
  }
  return face;
}
function paintXeurbi(){
  const face=ensureUsaFaceI();
  if(!face)return;
  const pageNow=(()=>{try{return Number(localStorage.getItem('macrowatch-usa-page')||0)}catch(e){return 0}})();
  if(pageNow===8)face.classList.remove('hidden');
  const pts=(typeof histories!=='undefined'&&histories['USA-xeurbi'])||[];
  const meta=(typeof data!=='undefined'&&data.USA&&data.USA.xeurbi)||{};
  const last=pts.length?pts.at(-1):null;
  const valEl=document.getElementById('xeurbiValue');
  const dateEl=document.getElementById('xeurbiDate');
  const host=document.getElementById('xeurbiChart');
  const metaEl=document.getElementById('xeurbiMeta');
  if(valEl)valEl.textContent=last?((Number(last.value)>=0?'+':'')+Number(last.value).toFixed(2)+' bp'):'—';
  if(dateEl)dateEl.textContent=last?('Stand '+last.period+' · '+(meta.source||'CME XEURBI')+' · '+pts.length+' Punkte'):(meta.note||'Keine Daten');
  if(host){
    if(!pts.length)host.innerHTML='<div class="sparkempty">Keine XEURBI-Daten — CME-Abruf prüfen</div>';
    else if(typeof renderLineChart==='function'){
      host.innerHTML=renderLineChart(pts,{w:Math.min(640, (host.clientWidth||360)), h:120});
      host.setAttribute('data-chart','USA|xeurbi|XEURBI');
    }
  }
  if(metaEl)metaEl.textContent=meta.note||('Historie ab '+(pts[0]&&pts[0].period||'—')+' · Index-Start CME: 2024-07-27');
}
`;

if (!html.includes('function paintXeurbi')) {
  // insert before </script> last occurrence of main app scripts if possible
  const marker = 'function paintRepoPage';
  if (html.includes(marker)) {
    html = html.replace(marker, paintSrc + '\n' + marker);
  } else if (html.includes('function paintYieldPage7')) {
    html = html.replace('function paintYieldPage7', paintSrc + '\nfunction paintYieldPage7');
  } else {
    html = html.replace('</script>', paintSrc + '\n</script>');
  }
  console.log('paintXeurbi injected');
} else {
  // refresh functions
  const rA = replaceFunction(html, 'ensureUsaFaceI', paintSrc.match(/function ensureUsaFaceI\(\)\{[\s\S]*?\n\}/)[0]);
  html = rA.html;
  const rB = replaceFunction(html, 'paintXeurbi', paintSrc.match(/function paintXeurbi\(\)\{[\s\S]*?\n\}/)[0]);
  html = rB.html;
  console.log('paintXeurbi replaced', rA.ok, rB.ok);
}

// Extend setUsaPage to support page 8
const setUsaPageFn = `function setUsaPage(page){
  page=Math.max(0,Math.min(8,Number(page)||0));
  try{localStorage.setItem('macrowatch-usa-page',String(page))}catch(e){}
  try{
    if(page===4){typeof paintFhlb==='function'&&paintFhlb();typeof paintEffrVol==='function'&&paintEffrVol();}
    if(page===5){typeof paintIorbUs1y==='function'&&paintIorbUs1y();typeof paintMove==='function'&&paintMove();}
    if(page===6){typeof paintYieldPage7==='function'&&paintYieldPage7();}
    if(page===7){typeof paintRepoPage==='function'&&paintRepoPage();}
    if(page===8){typeof paintXeurbi==='function'&&paintXeurbi();}
  }catch(e){}
  document.querySelectorAll('.country').forEach(card=>{
    if(!card.querySelector('.usa-face-a'))return;
    const faces=['.usa-face-a','.usa-face-b','.usa-face-c','.usa-face-d','.usa-face-e','.usa-face-f','.usa-face-g','.usa-face-h','.usa-face-i'];
    faces.forEach((sel,i)=>{
      const el=card.querySelector(sel);
      if(el){
        if(i===page)el.classList.remove('hidden');
        else el.classList.add('hidden');
      }
    });
    card.querySelectorAll('#usaPageSelect button, .usa-page-select button').forEach(btn=>{
      const p=Number(btn.getAttribute('data-page'));
      if(p===page)btn.classList.add('active');
      else btn.classList.remove('active');
    });
  });
  if(page===1)setTimeout(()=>{try{typeof paintCuAu==='function'&&paintCuAu()}catch(e){}},50);
  if(page===2)setTimeout(()=>{try{typeof paintRateDiff==='function'&&paintRateDiff();typeof paintRateOverlay==='function'&&paintRateOverlay();typeof paintUs2ySofr==='function'&&paintUs2ySofr()}catch(e){}},50);
  if(page===3)setTimeout(()=>{try{typeof paintSofRFwd==='function'&&paintSofRFwd()}catch(e){};try{typeof paintSofRTenor==='function'&&paintSofRTenor()}catch(e){};try{typeof paintUstCurve==='function'&&paintUstCurve()}catch(e){}},50);
  if(page===4)setTimeout(()=>{try{typeof paintFhlb==='function'&&paintFhlb()}catch(e){};try{typeof paintEffrVol==='function'&&paintEffrVol()}catch(e){}},50);
  if(page===5)setTimeout(()=>{try{typeof paintIorbUs1y==='function'&&paintIorbUs1y();typeof paintMove==='function'&&paintMove()}catch(e){}},50);
  if(page===6)setTimeout(()=>{try{typeof paintYieldPage7==='function'&&paintYieldPage7()}catch(e){}},50);
  if(page===7)setTimeout(()=>{try{typeof paintRepoPage==='function'&&paintRepoPage()}catch(e){}},50);
  if(page===8)setTimeout(()=>{try{typeof paintXeurbi==='function'&&paintXeurbi();typeof ensureUsaFaceI==='function'&&ensureUsaFaceI()}catch(e){}},50);
}`;

const r1 = replaceFunction(html, 'setUsaPage', setUsaPageFn);
html = r1.html;
console.log('setUsaPage', r1.ok);

// Harden bindUsaPages max page 8
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
  if(!Number.isFinite(start)||start<0||start>8)start=0;
  setUsaPage(start);
}`;
const r2 = replaceFunction(html, 'bindUsaPages', bindFn);
html = r2.html;
console.log('bindUsaPages', r2.ok);

fs.writeFileSync('index.html', html);
console.log('done inject page9 xeurbi');
