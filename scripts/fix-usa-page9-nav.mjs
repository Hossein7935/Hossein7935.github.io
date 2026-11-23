import fs from 'node:fs';

/** Last-step fix: USA page 9 nav + do NOT wipe eur-dollar.js content */
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
    // Seite 9: eur-dollar.js steuert den Inhalt — paintXeurbi darf nicht überschreiben
    if(page===9){typeof ensureUsaFaceJ==='function'&&ensureUsaFaceJ();}
  }catch(e){}
  document.querySelectorAll('.country').forEach(card=>{
    if(!card.querySelector('.usa-face-a'))return;
    const faces=['.usa-face-a','.usa-face-b','.usa-face-c','.usa-face-d','.usa-face-e','.usa-face-f','.usa-face-g','.usa-face-h','.usa-face-i','.usa-face-j'];
    faces.forEach((sel,i)=>{
      const f=card.querySelector(sel);
      if(f)f.classList.toggle('hidden',i!==page);
    });
  });
  document.querySelectorAll('#usaPageSelect button, .usa-page-select button').forEach(b=>{
    b.classList.toggle('active',Number(b.getAttribute('data-page'))===page);
  });
}`;

const ensureUsaFaceJFn = `function ensureUsaFaceJ(){
  const faceA=document.querySelector('.country .usa-face-a');
  if(!faceA)return null;
  const card=faceA.closest('.country');
  if(!card)return null;
  let face=card.querySelector('.usa-face-j');
  if(!face){
    face=document.createElement('div');
    face.className='metrics usa-face usa-face-j hidden';
    face.setAttribute('data-usa-face','9');
    const after=card.querySelector('.usa-face-i')||card.querySelector('.usa-face-h')||card.querySelector('.usa-face-g');
    if(after&&after.parentNode)after.after(face);
    else{
      const toggle=card.querySelector('.usa-flip-toggle');
      if(toggle&&toggle.parentNode)toggle.before(face);
      else card.appendChild(face);
    }
  }
  face.classList.add('metrics','usa-face');
  // WICHTIG: Inhalt von eur-dollar.js nicht überschreiben
  if(face.querySelector('.usde-curve-root')||face.querySelector('[data-chart*="usDeCurve"]')||face.children.length>1){
    return face;
  }
  if(!face.querySelector('#xeurbiChart')&&!face.querySelector('.metric')){
    face.innerHTML=
      '<div class="metric has-chart" id="xeurbiPanel" style="grid-column:1/-1">'+
        '<div class="name">CME XEURBI · EUR/USD Cross-Currency Basis Index</div>'+
        '<div class="value" id="xeurbiValue">—</div>'+
        '<div class="date" id="xeurbiDate">CME · Basispunkte</div>'+
        '<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|xeurbi|XEURBI" title="Chart vergrößern" id="xeurbiChart"></div>'+
        '<div class="sofr-fwd-meta" id="xeurbiMeta">XEURBI in bp</div>'+
      '</div>';
  }
  return face;
}`;

const paintXeurbiFn = `function paintXeurbi(){
  const face=ensureUsaFaceJ();
  if(!face)return;
  // Wenn eur-dollar.js die volle Seite gemalt hat: nichts überschreiben
  if(face.querySelector('.usde-curve-root')||face.querySelector('[data-chart*="usDeCurve"]'))return;
  let pageNow=0;
  try{pageNow=Number(localStorage.getItem('macrowatch-usa-page')||0)}catch(e){}
  if(pageNow===9)face.classList.remove('hidden');
  const pts=(typeof histories!=='undefined'&&histories['USA-xeurbi'])||[];
  const meta=(typeof data!=='undefined'&&data.USA&&data.USA.xeurbi)||{};
  const last=pts.length?pts[pts.length-1]:null;
  const valEl=document.getElementById('xeurbiValue');
  const dateEl=document.getElementById('xeurbiDate');
  const host=document.getElementById('xeurbiChart');
  const metaEl=document.getElementById('xeurbiMeta');
  if(valEl)valEl.textContent=last?((Number(last.value)>=0?'+':'')+Number(last.value).toFixed(2)+' bp'):'—';
  if(dateEl)dateEl.textContent=last?('Stand '+last.period+(meta.source?' · '+meta.source:'')):'Keine Daten';
  if(host&&typeof renderLineChart==='function'&&pts.length){
    host.innerHTML=renderLineChart(pts,{w:Math.min(640,360),h:140});
  }
  if(metaEl)metaEl.textContent=meta.note||(pts.length?pts.length+' Punkte':'');
}`;

let r = replaceFunction(html, 'setUsaPage', setUsaPageFn);
html = r.html;
console.log('setUsaPage', r.ok);
r = replaceFunction(html, 'ensureUsaFaceJ', ensureUsaFaceJFn);
html = r.html;
console.log('ensureUsaFaceJ', r.ok);
r = replaceFunction(html, 'paintXeurbi', paintXeurbiFn);
html = r.html;
console.log('paintXeurbi', r.ok);

// bindUsaPages: ensure face-j exists, max page 9
if (html.includes('function bindUsaPages')) {
  html = html.replace(
    /Math\.min\(\s*[0-9]+\s*,/g,
    (m) => (m.includes('9') ? m : 'Math.min(9,')
  );
}

html = html.replace(/eur-dollar\.js\?v=\d+/g, 'eur-dollar.js?v=5');
if (!html.includes('eur-dollar.js')) {
  html = html.replace(
    /(</script>)(\s*<script src="credit\.js)/,
    '$1<script src="eur-dollar.js?v=5"></script>$2'
  );
  if (!html.includes('eur-dollar.js')) {
    html = html.replace('</body>', '<script src="eur-dollar.js?v=5"></script></body>');
  }
  console.log('linked eur-dollar.js');
}

fs.writeFileSync('index.html', html);
console.log(
  'fix-usa-page9-nav done',
  html.includes('usde-curve-root'),
  html.includes('eur-dollar.js?v=5'),
  html.includes('paintXeurbi darf nicht')
);
