import fs from 'node:fs';

/**
 * USA page 9: EUR/Dollar · CME XEURBI
 * Only adds paint helpers + button + links eur-dollar.js.
 * Runtime open is handled by eur-dollar.js (Credit pattern).
 */
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

html = html.replace(/<button type="button" data-page="8">\s*EUR\/Dollar\s*<\/button>/gi, '');
html = html.replace(/<button type="button" data-page="8">\s*EURUSD\s*<\/button>/gi, '');

if (!html.includes('data-page="9"')) {
  if (html.includes('>Repo-Markt</button>')) {
    html = html.replace(
      '>Repo-Markt</button>',
      '>Repo-Markt</button><button type="button" data-page="9">EUR/Dollar</button>'
    );
    console.log('added EUR/Dollar button page 9');
  }
} else {
  html = html.replace(
    /(<button type="button" data-page="9">)([^<]*)(<\/button>)/,
    '$1EUR/Dollar$3'
  );
}

const ensureFn = `function ensureUsaFaceJ(){
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
  if(!face.querySelector('#xeurbiChart')){
    face.innerHTML=
      '<div class="metric has-chart" id="xeurbiPanel" style="grid-column:1/-1">'+
        '<div class="name">CME XEURBI · EUR/USD Cross-Currency Basis Index</div>'+
        '<div class="value" id="xeurbiValue">—</div>'+
        '<div class="date" id="xeurbiDate">CME · Basispunkte</div>'+
        '<div class="yield-chart-wrap" role="button" tabindex="0" data-chart="USA|xeurbi|XEURBI" title="Chart vergrößern" id="xeurbiChart"></div>'+
        '<div class="sofr-fwd-meta" id="xeurbiMeta">XEURBI in bp · Seite öffnet auch ohne Daten</div>'+
      '</div>';
  }
  return face;
}`;

const paintFn = `function paintXeurbi(){
  const face=ensureUsaFaceJ();
  if(!face)return;
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
  if(dateEl)dateEl.textContent=last?('Stand '+last.period+' · '+(meta.source||'CME XEURBI')+' · '+pts.length+' Punkte'):'Noch keine CME-Daten — Seite ist aktiv';
  if(host){
    if(!pts.length)host.innerHTML='<div class="sparkempty">Keine XEURBI-Historie bisher. Seite funktioniert; Daten kommen über den CME-Fetch.</div>';
    else if(typeof renderLineChart==='function'){
      host.innerHTML=renderLineChart(pts,{w:Math.min(640,(host.clientWidth||360)),h:120});
      host.setAttribute('data-chart','USA|xeurbi|XEURBI');
    }
  }
  if(metaEl)metaEl.textContent=meta.note||('Historie ab '+(pts[0]&&pts[0].period||'—')+' · CME Index-Start: 2024-07-27');
}`;

if (html.includes('function ensureUsaFaceJ')) {
  const r = replaceFunction(html, 'ensureUsaFaceJ', ensureFn);
  html = r.html;
} else if (html.includes('function paintRepoPage')) {
  html = html.replace('function paintRepoPage', ensureFn + '\n' + paintFn + '\nfunction paintRepoPage');
} else {
  html = html.replace('</script>', ensureFn + '\n' + paintFn + '\n</script>');
}

if (html.includes('function paintXeurbi')) {
  const r = replaceFunction(html, 'paintXeurbi', paintFn);
  html = r.html;
}

if (html.includes('data-page="9"') && html.includes('Math.min(7,')) {
  html = html.replace(/Math\.min\(7,/g, 'Math.min(9,');
  html = html.replace(/start>7\)/g, 'start>9)');
}

if (!html.includes('eur-dollar.js')) {
  if (html.includes('credit.js')) {
    html = html.replace(
      /(<script src="credit\.js[^"]*"><\/script>)/,
      '$1<script src="eur-dollar.js?v=1"></script>'
    );
    html = html.replace(/(<script src="eur-dollar\.js\?v=1"><\/script>){2,}/g, '$1');
    console.log('linked eur-dollar.js');
  } else if (html.includes('autorefresh.js')) {
    html = html.replace(
      /(<script src="autorefresh\.js[^"]*"><\/script>)/,
      '<script src="eur-dollar.js?v=1"></script>$1'
    );
  }
}

fs.writeFileSync('index.html', html);
console.log('done page9 xeurbi');
