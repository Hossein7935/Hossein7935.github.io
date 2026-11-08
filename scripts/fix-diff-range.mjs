import fs from 'fs';

/** Allow 6m/1y/3y range toolbar on calculated rate-diff chart */
let html = fs.readFileSync('index.html', 'utf8');

// Remove key==='diff' from isCurve (any surrounding ||)
html = html.replace(/\|\|key==='diff'/g, '');
html = html.replace(/key==='diff'\|\|/g, '');
html = html.replace(/key==='diff'/g, "key==='__none__'");
// clean accidental empty isCurve parts - if we left __none__, remove it
html = html.replace(/\|\|key==='__none__'/g, '');
html = html.replace(/key==='__none__'\|\|/g, '');
html = html.replace(/key==='__none__'/g, 'false');

fs.writeFileSync('index.html', html);
const m = html.match(/const isCurve=([^;]+)/);
console.log('isCurve=', m ? m[1].slice(0, 200) : 'missing');
console.log('has diff token', m ? /diff/.test(m[1]) : null);
console.log('done', html.length);
