import fs from 'fs';

/** Fix: faces created after setUsaPage stay .hidden → USA looks empty */
let html = fs.readFileSync('index.html', 'utf8');

// 1) After paintRepoPage creates face-h, force visible when on page 7
if (html.includes('function paintRepoPage') && !html.includes('/* face-h-unhide */')) {
  html = html.replace(
    'function paintRepoPage(){\n  const face=ensureRepoPage();\n  if(!face)return;',
    `function paintRepoPage(){\n  const face=ensureRepoPage();\n  if(!face)return;\n  /* face-h-unhide */\n  try{\n    const p=Number(localStorage.getItem('macrowatch-usa-page')||'0');\n    if(p===7){face.classList.remove('hidden');}\n  }catch(e){face.classList.remove('hidden');}`
  );
  console.log('paintRepoPage unhide');
}

// Also unhide at end of ensureRepoPage when building face
if (html.includes('function ensureRepoPage') && !html.includes('/* ensure-unhide */')) {
  html = html.replace(
    /return face;\n\}\nfunction bindRepoSelect/,
    `try{const p=Number(localStorage.getItem('macrowatch-usa-page')||'0'); if(p===7) face.classList.remove('hidden'); else face.classList.add('hidden');}catch(e){}\n  /* ensure-unhide */\n  return face;\n}\nfunction bindRepoSelect`
  );
  console.log('ensureRepoPage unhide');
}

// 2) Harden setUsaPage: paint late faces FIRST, then toggle visibility
const better = `function setUsaPage(page){
  page=Math.max(0,Math.min(7,Number(page)||0));
  try{localStorage.setItem('macrowatch-usa-page',String(page))}catch(e){}
  // Create dynamic faces before toggling visibility
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
}
`;

if (html.includes('function setUsaPage')) {
  const s = html.indexOf('function setUsaPage');
  const e = html.indexOf('function bindUsaPages', s);
  if (e > s) {
    html = html.slice(0, s) + better + '\n' + html.slice(e);
    console.log('setUsaPage paint-before-toggle');
  }
}

fs.writeFileSync('index.html', html);
console.log('done', html.includes('face-h-unhide') || html.includes('paint-before') || html.includes('Create dynamic faces'));
