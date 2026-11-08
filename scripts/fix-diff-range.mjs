import fs from 'fs';

/** Allow time-range toolbar on calculated rate-diff chart */
let html = fs.readFileSync('index.html', 'utf8');

const before = html.includes("key==='diff'||key==='iorbUs1yDual'") || html.includes("key==='diff'||");

// Remove 'diff' from isCurve so #chartRange shows and filterByRange applies
html = html.replace(
  /const isCurve=key==='sofrFwd'\|\|key==='ustCurve'\|\|key==='tipsCurve'\|\|key==='diff'\|\|key==='iorbUs1yDual'/,
  "const isCurve=key==='sofrFwd'||key==='ustCurve'||key==='tipsCurve'||key==='iorbUs1yDual'"
);

// Also handle if already partially different
html = html.replace(
  /\|\|key==='diff'\|\|key==='iorbUs1yDual'/g,
  "||key==='iorbUs1yDual'"
);
html = html.replace(
  /key==='tipsCurve'\|\|key==='diff'\|\|/g,
  "key==='tipsCurve'||"
);

// Ensure histories USA-diff is used with range when opening
// paintChartDlg already does filterByRange for non-isCurve keys via histories[country-key]

fs.writeFileSync('index.html', html);
const still = html.includes("key==='diff'") && html.includes('isCurve');
// check isCurve line specifically
const m = html.match(/const isCurve=([^;]+)/);
console.log('isCurve=', m ? m[1].slice(0, 180) : 'missing');
console.log('diff still in isCurve', m ? m[1].includes("'diff'") : null);
console.log('done', html.length);
