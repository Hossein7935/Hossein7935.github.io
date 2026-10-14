import fs from 'node:fs';

const countries = [
  { id: 'CHN', oecd: 'CHN', bis: 'CN', fred10: 'IRLTLT01CNM156N' },
  { id: 'USA', oecd: 'USA', bis: 'US', fred10: 'IRLTLT01USM156N' },
  { id: 'JPN', oecd: 'JPN', bis: 'JP', fred10: 'IRLTLT01JPM156N' },
  { id: 'FRA', oecd: 'FRA', bis: 'FR', fred10: 'IRLTLT01FRM156N' },
  { id: 'DEU', oecd: 'DEU', bis: 'DE', fred10: 'IRLTLT01DEM156N' },
  { id: 'AUS', oecd: 'AUS', bis: 'AU', fred10: 'IRLTLT01AUM156N' },
];
const data = Object.fromEntries(countries.map(c => [c.id, {}]));
const histories = {};
const errors = [];
const nowYear = new Date().getUTCFullYear();
const forecastYears = [nowYear, nowYear + 1, nowYear + 2];
const forecasts = Object.fromEntries(countries.map(c => [c.id, {}]));

async function getText(url, accept = '*/*') {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { Accept: accept, 'User-Agent': 'MacroWatch/1.1 (+https://hossein7935.github.io/)' },
        signal: AbortSignal.timeout(30000),
        cache: 'no-store'
      });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        if (![408, 425, 429, 500, 502, 503, 504].includes(response.status) || attempt === 2) throw error;
        lastError = error;
      } else {
        const body = await response.text();
        if (!body || body.trim().length < 2) throw new Error('leere Antwort');
        return body;
      }
    } catch (e) {
      lastError = e;
      if (attempt === 2 || !/HTTP (408|425|429|500|502|503|504)|fetch failed|timed out|timeout|ECONNRESET|ECONNREFUSED|EAI_AGAIN/i.test(e?.message || String(e))) throw e;
    }
    await new Promise(resolve => setTimeout(resolve, 800 * (attempt + 1)));
  }
  throw lastError || new Error('Datenquelle nach mehreren Versuchen nicht erreichbar');
}
async function getJSON(url, accept = 'application/json') {
  const text = await getText(url, accept);
  try { return JSON.parse(text); } catch { throw new Error('Antwort ist kein JSON'); }
}
function csvParse(text) {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const parseLine = line => { const out=[]; let cur='', quoted=false; for(let i=0;i<line.length;i++){const ch=line[i]; if(ch==='"'){if(quoted&&line[i+1]==='"'){cur+='"';i++;}else quoted=!quoted;} else if(ch===','&&!quoted){out.push(cur);cur='';} else cur+=ch;} out.push(cur); return out; };
  const headers = parseLine(lines[0]).map(x => x.trim());
  return lines.slice(1).map(line => { const cols=parseLine(line), row={}; headers.forEach((h,i)=>row[h]=cols[i]??''); return row; });
}
function val(row, names) { for (const n of names) if (row[n] !== undefined && row[n] !== '' && row[n] !== null) return row[n]; return ''; }
function area(row) { return String(val(row,['REF_AREA','Reference area','Reference Area','LOCATION','Location'])).toUpperCase(); }
function period(row) { return String(val(row,['TIME_PERIOD','Time period','TIME','Period','observation_date','DATE'])); }
function observation(row) { const raw=val(row,['OBS_VALUE','Observation value','Observation Value','Value']); if(raw===''||raw===null)return NaN; const n=Number(String(raw).replace(',','.'));return Number.isFinite(n)?n:NaN; }
function set(country,key,value,date,source) { if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return; data[country][key]={value:Number(value),date:String(date||'Datum unbekannt'),source}; }
function saveHistory(key, points) { histories[key]=points.slice(-5); }
function latest(rows) { return rows.filter(x=>x && Number.isFinite(Number(x.value)) && x.period).sort((a,b)=>String(a.period).localeCompare(String(b.period))).at(-1) || null; }
function err(label,e) { errors.push(`${label}: ${e?.message || String(e)}`); }

async function fetchFredSeries(seriesId, startDate = '2024-01-01') {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}&cosd=${startDate}`;
  const rows = csvParse(await getText(url, 'text/csv, text/plain;q=0.9, */*;q=0.8'));
  const col = Object.keys(rows[0] || {}).find(k => k === seriesId);
  if (!col) throw new Error(`FRED-Reihe ${seriesId} fehlt in der CSV`);
  return rows.map(r => ({
    date: r.observation_date || r.DATE || r.date,
    value: r[col] === '' || r[col] === '.' || r[col] === undefined ? NaN : Number(r[col])
  })).filter(p => p.date && Number.isFinite(p.value)).sort((a, b) => a.date.localeCompare(b.date));
}
const cpiSeries = {
  CHN: ['CPALTT01CNM657N', 'CPALTT01CNQ657N'],
  USA: ['CPALTT01USM657N', 'CPALTT01USQ657N'],
  JPN: ['CPALTT01JPM657N', 'CPALTT01JPQ657N'],
  FRA: ['CPALTT01FRM657N', 'CPALTT01FRQ657N'],
  DEU: ['CPALTT01DEM657N', 'CPALTT01DEQ657N'],
  AUS: ['CPALTT01AUM657N', 'CPALTT01AUQ657N']
};
async function loadInflation() {
  let count = 0;
  for (const c of countries) {
    let points = [];
    let usedSeries = '';
    const candidates = cpiSeries[c.id] || [];
    for (const seriesId of candidates) {
      try {
        const rows = await fetchFredSeries(seriesId, '2024-01-01');
        if (rows.length) {
          points = rows;
          usedSeries = seriesId;
          break;
        }
      } catch (e) {
        errors.push(`Inflation ${c.id} ${seriesId}: ${e.message}`);
      }
    }
    if (!points.length) {
      errors.push(`Inflation ${c.id}: keine CPI-Reihe bei FRED verfügbar`);
      continue;
    }
    const quarterly = new Map();
    for (const p of points) {
      const d = new Date(`${p.date}T00:00:00Z`);
      const q = `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
      if (!quarterly.has(q)) quarterly.set(q, []);
      quarterly.get(q).push(p.value);
    }
    const history = [...quarterly.entries()].map(([period, values]) => ({
      period, value: values.reduce((sum, v) => sum + v, 0) / values.length
    })).sort((a, b) => a.period.localeCompare(b.period)).slice(-5);
    if (history.length) {
      saveHistory(`${c.id}-inflation`, history);
      set(c.id, 'inflation', history.at(-1).value, history.at(-1).period, `FRED · CPI inflation (${usedSeries})`);
      count++;
    }
  }
  return count;
}
const gdpLevelSeries = {
  USA: 'A191RL1Q225SBEA', // real GDP, quarter-on-quarter annualized growth rate
  JPN: 'JPNRGDPEXP',
  FRA: 'CLVMNACSCAB1GQFR',
  DEU: 'CLVMNACSCAB1GQDE',
  AUS: 'AUSGDPRQDSMEI'
};
async function loadGDPQuarterly() {
  let count = 0;
  for (const c of countries) {
    const seriesId = gdpLevelSeries[c.id];
    if (!seriesId) {
      errors.push(`BIP-Quartale ${c.id}: keine geprüfte aktuelle Quartalsreihe gefunden; Wert bleibt leer`);
      continue;
    }
    try {
      const raw = await fetchFredSeries(seriesId, '2024-01-01');
      if (raw.length < 2) throw new Error('zu wenige Quartalsbeobachtungen');
      const isGrowthSeries = c.id === 'USA';
      const points = (isGrowthSeries
        ? raw.map(p => ({ date: p.date, value: p.value }))
        : raw.slice(1).map((p, i) => ({ date: p.date, value: (p.value / raw[i].value - 1) * 100 })))
        .filter(p => Number.isFinite(p.value));
      const latest = points.slice(-5).map(p => {
        const d = new Date(`${p.date}T00:00:00Z`);
        return { period: `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`, value: p.value };
      });
      if (!latest.length) throw new Error('keine gültigen Quartalswerte');
      saveHistory(`${c.id}-gdp`, latest);
      count++;
    } catch (e) {
      errors.push(`BIP-Quartale ${c.id} (${seriesId}): ${e.message}`);
    }
  }
  return count;
}
function parseBISLatest(j) {
  const root=j?.data||j; const ds=root?.dataSets?.[0]; const series=ds?.series||{}; const dims=root?.structure?.dimensions||{}; const od=dims.observation||[];
  const td=od.find(d=>/TIME_PERIOD|TIME/i.test(d.id||d.name||''))||od.at(-1); const times=td?.values||[]; const points=[];
  for(const s of Object.values(series)) for(const [idx,a] of Object.entries(s.observations||{})) { const v=Number(Array.isArray(a)?a[0]:a), t=times[Number(idx)]?.id||times[Number(idx)]?.name||''; if(t&&Number.isFinite(v))points.push({period:t,value:v}); }
  return latest(points);
}
function requireFreshPoint(point, maxAgeDays = 180) {
  if (!point?.period || !Number.isFinite(Number(point.value))) throw new Error('keine gültige Beobachtung');
  const date = new Date(point.period);
  if (!Number.isFinite(date.getTime())) throw new Error(`ungültiges Datum ${point.period}`);
  const ageDays = (Date.now() - date.getTime()) / 86400000;
  if (ageDays > maxAgeDays) throw new Error(`letzter Wert ist veraltet (${point.period})`);
  if (ageDays < -2) throw new Error(`Beobachtung liegt in der Zukunft (${point.period})`);
  return point;
}
async function bisRate(areaCode) {
  const candidates = [];
  for (const freq of ['D', 'M']) {
    try {
      const j = await getJSON(`https://stats.bis.org/api/v2/data/dataflow/BIS/WS_CBPOL/1.0/${freq}.${areaCode}?lastNObservations=5`, 'application/vnd.sdmx.data+json;version=1.0.0');
      const p = parseBISLatest(j);
      if (p) return requireFreshPoint(p, 180);
    } catch (e) {
      candidates.push(`${freq}: ${e.message}`);
    }
  }
  throw new Error(candidates.join('; ') || 'keine lesbaren aktuellen Beobachtungen');
}
async function ecbPolicyRate() {
  const url = 'https://data-api.ecb.europa.eu/service/data/FM/D.U2.EUR.4F.KR.DFR.LEV?lastNObservations=20&format=csvdata';
  const rows = csvParse(await getText(url, 'text/csv, text/plain;q=0.9, */*;q=0.8'));
  const points = rows.map(r => ({ period: period(r), value: observation(r) }))
    .filter(p => p.period && Number.isFinite(p.value))
    .sort((a, b) => a.period.localeCompare(b.period));
  return requireFreshPoint(points.at(-1), 180);
}
async function loadPolicyRates() {
  let count = 0;
  try {
    const p = await ecbPolicyRate();
    for (const id of ['FRA', 'DEU']) set(id, 'rate', p.value, p.period, 'ECB · Einlagefazilität');
    count += 2;
  } catch (e) {
    errors.push(`Leitzins FRA/DEU: ECB-Einlagefazilität ${e.message}`);
  }
  const results = await Promise.all(countries.filter(c => !['FRA', 'DEU'].includes(c.id)).map(async c => {
    try {
      const p = await bisRate(c.bis);
      set(c.id, 'rate', p.value, p.period, 'BIS · Central bank policy rates');
      return true;
    } catch (e) {
      errors.push(`Leitzins ${c.id}: ${e.message}`);
      return false;
    }
  }));
  return count + results.filter(Boolean).length;
}
async function loadIMFForecasts() {
  const ids = countries.map(c => c.id).join('/');
  const urls = [
    `https://www.imf.org/external/datamapper/api/v2/NGDP_RPCH/${ids}?periods=${forecastYears.join(',')}`,
    `https://www.imf.org/external/datamapper/api/v1/NGDP_RPCH/${ids}?periods=${forecastYears.join(',')}`
  ];
  let j = null;
  let lastError = null;
  for (const url of urls) {
    try {
      j = await getJSON(url, 'application/json, text/plain;q=0.9, */*;q=0.8');
      if (j?.values?.NGDP_RPCH || j?.values?.ngdp_rpch) break;
      lastError = new Error('Antwort enthält keine NGDP_RPCH-Zeitreihe');
      j = null;
    } catch (e) {
      lastError = e;
    }
  }
  const series = j?.values?.NGDP_RPCH || j?.values?.ngdp_rpch;
  if (!series) throw lastError || new Error('IMF DataMapper liefert keine NGDP_RPCH-Zeitreihe (v1/v2)');
  let count = 0;
  for (const c of countries) {
    for (const year of forecastYears) {
      const v = series[c.id]?.[year] ?? series[c.id]?.[String(year)];
      if (v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v))) {
        forecasts[c.id][year] = Number(v);
        if (year === forecastYears[0]) set(c.id, 'gdp', Number(v), `IMF WEO · ${year}`, 'IMF DataMapper · NGDP_RPCH');
      }
    }
    if (forecasts[c.id][forecastYears[0]] !== undefined) count++;
    else errors.push(`IMF-Prognose ${c.id}: kein Wert für ${forecastYears[0]}`);
  }
  return count;
}
function xmlField(entry,name){const re=new RegExp(`<(?:(?:[\\w.-]+):)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:[\\w.-]+):)?${name}>`,'i');return (entry.match(re)?.[1]||'').replace(/<[^>]+>/g,'').trim();}
async function loadUSTreasury() {
  const year=new Date().getUTCFullYear();const url=`https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=${year}`;
  const text=await getText(url,'application/xml, text/xml;q=0.9, */*;q=0.8');const entries=[...text.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map(m=>m[0]);
  const rows=entries.map(e=>({date:xmlField(e,'NEW_DATE'),y2:xmlField(e,'BC_2YEAR'),y10:xmlField(e,'BC_10YEAR')})).filter(r=>r.date&&(/\d/.test(r.y2)||/\d/.test(r.y10))).sort((a,b)=>a.date.localeCompare(b.date));
  const p=rows.at(-1);if(!p)throw new Error('Treasury-XML enthält keine Renditezeilen');let n=0;
  if(p.y2!==''&&Number.isFinite(Number(p.y2))){set('USA','y2',Number(p.y2),p.date,'U.S. Treasury · Daily Par Yield Curve');n++;}
  if(p.y10!==''&&Number.isFinite(Number(p.y10))){set('USA','y10',Number(p.y10),p.date,'U.S. Treasury · Daily Par Yield Curve');n++;}
  if(!n)throw new Error('Treasury-XML enthält keine 2-/10-Jahres-Werte');return n;
}
async function loadUSTreasuryFRED() {
  const rows=csvParse(await getText('https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS2,DGS10&cosd=2024-01-01','text/csv, text/plain;q=0.9, */*;q=0.8'));
  const pts=rows.map(r=>({date:r.observation_date,y2:Number(r.DGS2),y10:Number(r.DGS10)})).filter(r=>r.date).sort((a,b)=>a.date.localeCompare(b.date));const p=pts.reverse().find(r=>Number.isFinite(r.y2)||Number.isFinite(r.y10));if(!p)throw new Error('FRED-Treasury-Reihen ohne Zahlenwerte');if(Number.isFinite(p.y2))set('USA','y2',p.y2,p.date,'FRED · DGS2');if(Number.isFinite(p.y10))set('USA','y10',p.y10,p.date,'FRED · DGS10');return p;
}
async function loadOECDLongRates() {
  const cs = countries.map(c => c.oecd).join('+');
  const urls = [
    `https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_FINMARK,4.0/${cs}.M.IRLT.PA.....?startPeriod=2024-01&dimensionAtObservation=AllDimensions&format=csvfile`,
    `https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_KEI@DF_KEI,4.0/${cs}.M.IRLT....?startPeriod=2024-01&dimensionAtObservation=AllDimensions&format=csvfile`
  ];
  let rows = null;
  let lastError = null;
  for (const url of urls) {
    try {
      rows = csvParse(await getText(url, 'text/csv, text/plain;q=0.9, */*;q=0.8'));
      if (rows.length) break;
      lastError = new Error('OECD-Langfristzins-CSV enthält keine Zeilen');
    } catch (e) {
      lastError = e;
    }
  }
  if (!rows?.length) throw lastError || new Error('OECD-Langfristzinsreihe ist leer');
  let count = 0;
  for (const c of countries) {
    if (data[c.id].y10?.source.startsWith('U.S. Treasury') || data[c.id].y10?.source.startsWith('Trading Economics')) {
      count++;
      continue;
    }
    const points = rows.filter(r => area(r) === c.oecd && /^\d{4}-\d{2}$/.test(period(r)) && Number.isFinite(observation(r)))
      .map(r => ({ period: period(r), value: observation(r) }))
      .sort((a, b) => a.period.localeCompare(b.period));
    const p = points.at(-1);
    if (p) {
      set(c.id, 'y10', p.value, p.period, 'OECD · Financial market long-term rate');
      count++;
    } else errors.push(`10-Jahres-Rendite ${c.id}: OECD-Monatsreihe fehlt`);
  }
  return count;
}
async function loadFREDLongRatesFallback() {
  let count = 0;
  for (const c of countries) {
    if (data[c.id].y10) { count++; continue; }
    try {
      const rows = csvParse(await getText(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${c.fred10}&cosd=2024-01-01`, 'text/csv, text/plain;q=0.9, */*;q=0.8'));
      const col = Object.keys(rows[0] || {}).find(k => k === c.fred10);
      const points = rows.map(r => ({ period: r.observation_date, raw: r[col], value: r[col] === '' || r[col] === '.' || r[col] === undefined ? NaN : Number(r[col]) }))
        .filter(x => x.period && Number.isFinite(x.value))
        .sort((a, b) => a.period.localeCompare(b.period));
      const p = points.at(-1);
      if (!p) throw new Error('keine numerische Beobachtung');
      set(c.id, 'y10', p.value, p.period, 'FRED/OECD · long-term government bond rate');
      count++;
    } catch (e) {
      errors.push(`10-Jahres-Rendite ${c.id}: FRED-Fallback ${e.message}`);
    }
  }
  return count;
}
function teCountry(row){const s=String(row.Country||row.country||'').toLowerCase();if(s.includes('china'))return'CHN';if(s.includes('united states'))return'USA';if(s.includes('japan'))return'JPN';if(s.includes('france'))return'FRA';if(s.includes('germany'))return'DEU';if(s.includes('australia'))return'AUS';return null;}
async function loadTEBonds(maturity,key){
  const rows=await getJSON(`https://api.tradingeconomics.com/markets/bond?c=${encodeURIComponent(key)}&type=${maturity}&f=json`);if(!Array.isArray(rows))throw new Error('API-Antwort ist keine Bond-Liste');let count=0;
  for(const c of countries){const r=rows.find(x=>teCountry(x)===c.id&&Number.isFinite(Number(x.Last))&&(String(x.Group||'').includes(maturity)||String(x.Name||'').toUpperCase().includes(maturity)||String(x.Ticker||'').toUpperCase().includes(maturity)));if(r){set(c.id,maturity==='2Y'?'y2':'y10',Number(r.Last),r.Date||r.LastUpdate,`Trading Economics · ${maturity}`);count++;}}
  if(!count)throw new Error(`Keine passenden ${maturity}-Renditen geliefert`);return count;
}
async function main(){
  const tasks=[['Inflation',loadInflation],['BIP-Quartale',loadGDPQuarterly],['Leitzins',loadPolicyRates],['IMF-Prognose',loadIMFForecasts]];
  for(const [name,fn] of tasks){try{const n=await fn();console.log(`${name}: ${n}/6`)}catch(e){err(name,e)}}
  try{await loadUSTreasury()}catch(e){err('US Treasury Renditen',e);try{await loadUSTreasuryFRED()}catch(e2){err('FRED US-Renditen',e2)}}
  try{await loadOECDLongRates()}catch(e){err('OECD-Langfristzinsen',e)}
  try{await loadFREDLongRatesFallback()}catch(e){err('FRED-Langfristzinsen',e)}
  const key=process.env.TRADING_ECONOMICS_API_KEY||'';
  if(key){for(const m of ['2Y','10Y'])try{await loadTEBonds(m,key)}catch(e){err(`Trading Economics ${m}`,e)}}
  else errors.push('2-Jahres-Renditen außerhalb der USA: TRADING_ECONOMICS_API_KEY als GitHub Actions Secret fehlt');
  const counts={
    inflation:countries.filter(c=>data[c.id].inflation).length,
    gdp:countries.filter(c=>(histories[`${c.id}-gdp`]||[]).length).length,
    imf:Object.fromEntries(forecastYears.map(y=>[y,countries.filter(c=>forecasts[c.id][y]!==undefined).length])),
    rate:countries.filter(c=>data[c.id].rate).length,
    y2:countries.filter(c=>data[c.id].y2).length,
    y10:countries.filter(c=>data[c.id].y10).length,
  };
  const payload={updatedAt:new Date().toISOString(),data,histories,forecasts,forecastYears,counts,errors};
  fs.writeFileSync('data.json',JSON.stringify(payload,null,2)+'\n');
  console.log('data.json geschrieben',JSON.stringify(counts));
}
main().catch(e=>{console.error('Datenaktualisierung fehlgeschlagen:',e);process.exitCode=1;});
