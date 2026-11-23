import fs from 'node:fs';

/** data-Load behält usDeCurve / usDeCurveDaily (auch ohne .value) */
let html = fs.readFileSync('index.html', 'utf8');

// ALL_KEYS um Kurven-Keys erweitern
if (html.includes("const ALL_KEYS=") && !html.includes("'usDeCurveDaily'")) {
  html = html.replace(
    "const ALL_KEYS=['inflation'",
    "const ALL_KEYS=['usDeCurve','usDeCurveDaily','xeurbi','rr25','eurusd','inflation'"
  );
  console.log('ALL_KEYS extended');
}

// Zweiten Merge-Zweig: auch Objekte mit dates/curves/usa übernehmen
const old =
  "for(const key of Object.keys(incoming)){if(!next[key]&&incoming[key]&&typeof incoming[key]==='object'&&incoming[key].value!=null)next[key]=incoming[key]}";
const neu =
  "for(const key of Object.keys(incoming)){if(next[key])continue;const v=incoming[key];if(!v||typeof v!=='object')continue;if(v.value!=null||Array.isArray(v.dates)||Array.isArray(v.usa)||Array.isArray(v.curves)||Array.isArray(v.nominal))next[key]=v}";
if (html.includes(old)) {
  html = html.replace(old, neu);
  console.log('merge branch fixed');
} else if (!html.includes('Array.isArray(v.dates)')) {
  console.warn('merge pattern not found — manual check');
}

html = html.replace(/eur-dollar\.js\?v=\d+/g, 'eur-dollar.js?v=7');

fs.writeFileSync('index.html', html);
console.log('inject-fix-usde-curve-load done');
