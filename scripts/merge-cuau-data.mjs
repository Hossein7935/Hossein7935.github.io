import fs from 'fs';
const path='data.json';
const data=JSON.parse(fs.readFileSync(path,'utf8'));
if (data.histories?.['USA-cuAu']?.length>10) {
  console.log('cuAu already present', data.histories['USA-cuAu'].length);
  process.exit(0);
}
console.log('running fetch-cu-au');
const {execSync}=await import('child_process');
execSync('node scripts/fetch-cu-au.mjs',{stdio:'inherit'});
