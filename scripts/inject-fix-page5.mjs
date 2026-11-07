import fs from 'fs';

/** Fix page 5: faceE was created with class "hidden" and never shown */
let html = fs.readFileSync('index.html', 'utf8');

const newPaintFhlbStart = `function paintFhlb(){
  let faceE=document.querySelector('.usa-face-e');
  const pageNow=(()=>{try{return Number(localStorage.getItem('macrowatch-usa-page')||0)}catch(e){return 0}})();
  if(!faceE){
    const card=[...document.querySelectorAll('.country')].find(c=>c.querySelector('.usa-face-d')||c.querySelector('.usa-face-a'));
    if(card){
      faceE=document.createElement('div');
      faceE.className='metrics usa-face usa-face-e'+(pageNow===4?'':' hidden');
      faceE.innerHTML='<div class="metric has-chart sofr-fwd-panel" id="fhlbPanel"><div class="name">Federal Home Loan Banks · Advances Outstanding</div><div class="value" id="fhlbValue">—</div><div class="date" id="fhlbDate">—</div><div class="sofr-fwd-bp" id="fhlbCards"></div><div id="fhlbAbsChart"></div><div class="sofr-fwd-meta" id="fhlbMeta"></div></div><div class="metric has-chart sofr-fwd-panel" id="fhlbChgPanel"><div class="name">Veränderung · QoQ / YoY</div><div class="value" id="fhlbChgValue">—</div><div class="date"><button type="button" class="fhlb-mode active" data-mode="qoq">QoQ</button> <button type="button" class="fhlb-mode" data-mode="yoy">YoY</button></div><div id="fhlbChgChart"></div><div class="sofr-fwd-meta" id="fhlbChgMeta"></div></div><div class="metric sofr-fwd-panel" id="fhlbNotePanel"><div class="name">Kurzanalyse</div><div class="date" id="fhlbNote" style="white-space:normal;line-height:1.45"></div></div>';
      const d=card.querySelector('.usa-face-d');
      if(d)d.after(faceE); else card.appendChild(faceE);
    }
  }
  if(faceE&&pageNow===4)faceE.classList.remove('hidden');
`;

if (html.includes('function paintFhlb')) {
  const start = html.indexOf('function paintFhlb');
  const mid = html.indexOf('const fh=(data.USA&&data.USA.fhlbAdv)', start);
  if (start >= 0 && mid > start) {
    html = html.slice(0, start) + newPaintFhlbStart + '\n  ' + html.slice(mid);
    console.log('paintFhlb head replaced');
  } else {
    console.warn('paintFhlb structure unexpected');
  }
}

// paintEffrVol owned by inject-effrvol.mjs (volume-only)

// Ensure setUsaPage calls both paints
if (!html.includes("typeof paintEffrVol==='function'&&paintEffrVol()")) {
  html = html.replace(
    /if\(page===4\)setTimeout\(\(\)=>\{try\{typeof paintFhlb==='function'&&paintFhlb\(\)\}catch\(e\)\{\}\},50\);/,
    "if(page===4)setTimeout(()=>{try{typeof paintFhlb==='function'&&paintFhlb()}catch(e){};try{typeof paintEffrVol==='function'&&paintEffrVol()}catch(e){}},50);"
  );
}

fs.writeFileSync('index.html', html);
console.log('done', html.length, 'unhide', html.includes('pageNow===4'));
