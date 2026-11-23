import fs from 'node:fs';

/** Patch eur-dollar.js getDailyPack to rebuild from histories */
const path = 'eur-dollar.js';
let t = fs.readFileSync(path, 'utf8');

const marker = 'function getDailyPack()';
if (!t.includes(marker)) {
  console.error('getDailyPack not found');
  process.exit(0);
}
if (t.includes('buildPackFromHistories')) {
  console.log('already patched');
  process.exit(0);
}

const start = t.indexOf(marker);
// find matching closing brace of function
let i = start;
let depth = 0;
let begun = false;
let end = -1;
for (; i < t.length; i++) {
  if (t[i] === '{') {
    depth++;
    begun = true;
  } else if (t[i] === '}') {
    depth--;
    if (begun && depth === 0) {
      end = i;
      break;
    }
  }
}
if (end < 0) {
  console.error('could not find end of getDailyPack');
  process.exit(1);
}

const replacement = `function histMap(key) {
    var pts = series(key);
    var m = {};
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (p && p.period != null && Number.isFinite(Number(p.value)))
        m[String(p.period).slice(0, 10)] = Number(p.value);
    }
    return m;
  }

  function buildPackFromHistories() {
    var tenors = [
      { t: '3M', us: 'USA-us3m', de: 'DEU-y3m' },
      { t: '1Y', us: 'USA-us1y', de: 'DEU-y1y' },
      { t: '2Y', us: 'USA-us2y', de: 'DEU-y2y' },
      { t: '5Y', us: 'USA-us5y', de: 'DEU-y5y' },
      { t: '10Y', us: 'USA-us10y', de: 'DEU-y10y' },
      { t: '30Y', us: 'USA-us30y', de: 'DEU-y30y' }
    ];
    var maps = tenors.map(function (x) {
      return { t: x.t, us: histMap(x.us), de: histMap(x.de) };
    });
    var dateSet = {};
    maps.forEach(function (m) {
      Object.keys(m.us).forEach(function (d) { dateSet[d] = 1; });
      Object.keys(m.de).forEach(function (d) { dateSet[d] = 1; });
    });
    var dates = Object.keys(dateSet).sort();
    if (!dates.length) return { dates: [], curves: [] };
    var lastU = {};
    var lastD = {};
    var outDates = [];
    var outCurves = [];
    for (var i = 0; i < dates.length; i++) {
      var day = dates[i];
      for (var j = 0; j < maps.length; j++) {
        if (maps[j].us[day] != null) lastU[maps[j].t] = maps[j].us[day];
        if (maps[j].de[day] != null) lastD[maps[j].t] = maps[j].de[day];
      }
      var usa = [];
      var de = [];
      for (var k = 0; k < tenors.length; k++) {
        var tt = tenors[k].t;
        if (lastU[tt] != null) usa.push({ period: tt, value: lastU[tt] });
        if (lastD[tt] != null) de.push({ period: tt, value: lastD[tt] });
      }
      if (usa.length >= 3 && de.length >= 3) {
        outDates.push(day);
        outCurves.push({ usa: usa, de: de });
      }
    }
    if (outDates.length > 2200) {
      outDates = outDates.slice(-2200);
      outCurves = outCurves.slice(-2200);
    }
    return {
      dates: outDates,
      curves: outCurves,
      source: 'Historien USA-us* / DEU-y*',
      note: 'Aus Einzelserien rekonstruiert'
    };
  }

  function getDailyPack() {
    var pack = metaUSA('usDeCurveDaily');
    if (pack && Array.isArray(pack.dates) && pack.dates.length && Array.isArray(pack.curves) && pack.curves.length)
      return pack;
    if (typeof data !== 'undefined' && data.USA) {
      if (data.USA.usDeCurveDaily && data.USA.usDeCurveDaily.dates && data.USA.usDeCurveDaily.dates.length)
        return data.USA.usDeCurveDaily;
      if (data.USA.usDeCurve && data.USA.usDeCurve.usa) {
        return {
          dates: [data.USA.usDeCurve.date || '—'],
          curves: [{ usa: data.USA.usDeCurve.usa, de: data.USA.usDeCurve.de || [] }],
          source: data.USA.usDeCurve.source
        };
      }
    }
    var built = buildPackFromHistories();
    if (built.dates.length) {
      try {
        if (typeof data !== 'undefined') {
          data.USA = data.USA || {};
          data.USA.usDeCurveDaily = built;
          data.USA.usDeCurve = {
            usa: built.curves[built.curves.length - 1].usa,
            de: built.curves[built.curves.length - 1].de,
            date: built.dates[built.dates.length - 1],
            source: built.source
          };
        }
      } catch (e) {}
      return built;
    }
    return { dates: [], curves: [] };
  }`;

t = t.slice(0, start) + replacement + t.slice(end + 1);
fs.writeFileSync(path, t);
console.log('patched eur-dollar.js getDailyPack, len', t.length);
