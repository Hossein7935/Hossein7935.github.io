import fs from 'node:fs';

/**
 * USA page 9 (index 9): EUR/Dollar · CME XEURBI
 * Does NOT touch page 8 / face-i (Credit Vergabe lives there via credit.js).
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

// Remove wrong EUR/Dollar button on page 8 if present (page 8 = Credit)
html = html.replace(
  /<button type="button" data-page="8">\s*EUR\/Dollar\s*<\/button>/gi,
  ''
);
html = html.replace(
  /<button type="button" data-page="8">\s*EURUSD\s*<\/button>/gi,
  ''
);

// Ensure page 9 button exists (Credit is page 8 via credit.js)
if (!html.includes('data-page="9"')) {
  // Prefer after Repo-Markt; credit.js may add Credit after load
  if (html.includes('>Repo-Markt</button>')) {
    html = html.replace(
      '>Repo-Markt</button>',
      '>Repo-Markt</button><button type="button" data-page="9">EUR/Dollar</button>'
    );
    console.log('button EUR/Dollar page 9 after Repo-Markt');
  } else if (html.includes('data-page="7"')) {
    html = html.replace(
      /(data-page="7"[^>]*>[^<]*<\/button>)/,
      '$1<button type="button" data-page="9">EUR/Dollar</button>'
    );
  }
} else {
  // normalize label
  html = html.replace(
    /(<button type="button" data-page="9">)([^<]*)(<\/button>)/,
    '$1EUR/Dollar$3'
  );
}

const paintSrc = `
function ensureUsaFaceJ(){
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
        '<div class="sofr-fwd-meta" id="xeurbiMeta">XEURBI in bp · Vergrößern · 6M/1J/3J wie andere Charts</div>'+
      '</div>';
  }
  return face;
}
function paintXeurbi(){
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
  if(dateEl)dateEl.textContent=last?('Stand '+last.period+' · '+(meta.source||'CME XEURBI')+' · '+pts.length+' Punkte'):(meta.note||'Keine Daten');
  if(host){
    if(!pts.length)host.innerHTML='<div class="sparkempty">Keine XEURBI-Daten — CME-Abruf prüfen</div>';
    else if(typeof renderLineChart==='function'){
      host.innerHTML=renderLineChart(pts,{w:Math.min(640,(host.clientWidth||360)),h:120});
      host.setAttribute('data-chart','USA|xeurbi|XEURBI');
    }
  }
  if(metaEl)metaEl.textContent=meta.note||('Historie ab '+(pts[0]&&pts[0].period||'—')+' · CME Index-Start: 2024-07-27');
}
`;

// Refresh paint helpers
if (html.includes('function paintXeurbi')) {
  let r = replaceFunction(html, 'ensureUsaFaceJ', '');
  // strip old ensureUsaFaceI if it was for xeurbi on face-i
  if (html.includes('function ensureUsaFaceI') && html.includes('xeurbiChart')) {
    // only remove if it's the xeurbi one - leave alone if not
  }
  const r1 = replaceFunction(html, 'paintXeurbi', paintSrc.match(/function paintXeurbi\(\)\{[\s\S]*?\n\}/)[0]);
  html = r1.html;
  if (!html.includes('function ensureUsaFaceJ')) {
    html = html.replace('function paintXeurbi', paintSrc.match(/function ensureUsaFaceJ\(\)\{[\s\S]*?\n\}/)[0] + '\nfunction paintXeurbi');
  } else {
    const r0 = replaceFunction(html, 'ensureUsaFaceJ', paintSrc.match(/function ensureUsaFaceJ\(\)\{[\s\S]*?\n\}/)[0]);
    html = r0.html;
  }
  console.log('paintXeurbi refreshed');
} else {
  const marker = 'function paintRepoPage';
  if (html.includes(marker)) html = html.replace(marker, paintSrc + '\n' + marker);
  else html = html.replace('</script>', paintSrc + '\n</script>');
  console.log('paintXeurbi injected');
}

// Patch setUsaPage: max page >= 9, call paintXeurbi on 9, never steal face-i from Credit
const setMatch = html.match(/function setUsaPage\(page\)\{[\s\S]*?\n\}/);
if (setMatch) {
  let src = setMatch[0];
  // expand max clamp
  src = src.replace(/Math\.min\(\s*[78]\s*,/g, 'Math.min(9,');
  src = src.replace(/start>7/g, 'start>9');
  src = src.replace(/start>8/g, 'start>9');
  // faces array include j
  if (!src.includes(".usa-face-j")) {
    src = src.replace(
      /\['\.usa-face-a'[\s\S]*?\.usa-face-h'\]/,
      "['.usa-face-a','.usa-face-b','.usa-face-c','.usa-face-d','.usa-face-e','.usa-face-f','.usa-face-g','.usa-face-h','.usa-face-i','.usa-face-j']"
    );
    src = src.replace(
      /\['\.usa-face-a'[\s\S]*?\.usa-face-i'\]/,
      "['.usa-face-a','.usa-face-b','.usa-face-c','.usa-face-d','.usa-face-e','.usa-face-f','.usa-face-g','.usa-face-h','.usa-face-i','.usa-face-j']"
    );
  }
  if (!src.includes('paintXeurbi') || !src.includes('page===9')) {
    if (src.includes('if(page===8)')) {
      src = src.replace(
        /if\(page===8\)\{[^}]*\}/g,
        (m) => m + "\n    if(page===9){typeof paintXeurbi==='function'&&paintXeurbi();}"
      );
    } else if (src.includes('if(page===7)')) {
      src = src.replace(
        /if\(page===7\)\{[^}]*\}/,
        (m) => m + "\n    if(page===9){typeof paintXeurbi==='function'&&paintXeurbi();}"
      );
    }
    // setTimeout branch
    if (!src.includes('page===9)setTimeout')) {
      src = src.replace(
        /if\(page===7\)setTimeout\([^;]+;/, 
        (m) => m + "\n  if(page===9)setTimeout(()=>{try{typeof paintXeurbi==='function'&&paintXeurbi();typeof ensureUsaFaceJ==='function'&&ensureUsaFaceJ()}catch(e){}},50);"
      );
    }
  }
  const r = replaceFunction(html, 'setUsaPage', src);
  html = r.html;
  console.log('setUsaPage patched', r.ok);
}

// bindUsaPages max 9
const bindMatch = html.match(/function bindUsaPages\(\)\{[\s\S]*?\n\}/);
if (bindMatch) {
  let src = bindMatch[0];
  src = src.replace(/start>7/g, 'start>9');
  src = src.replace(/start>8/g, 'start>9');
  src = src.replace(/Math\.min\(\s*[78]\s*,/g, 'Math.min(9,');
  const r = replaceFunction(html, 'bindUsaPages', src);
  html = r.html;
  console.log('bindUsaPages patched', r.ok);
}

// Remove old xeurbi UI mistakenly on face-i (Credit owns face-i)
// Only if face-i template in HTML contains xeurbi - rare static case
html = html.replace(
  /<div class="usa-face-i[^>]*>[\s\S]*?xeurbi[\s\S]*?<\/div>/gi,
  '<div class="metrics usa-face usa-face-i hidden" data-usa-face="8"></div>'
);

fs.writeFileSync('index.html', html);
console.log('done: Credit stays page 8; XEURBI on page 9 EUR/Dollar');
