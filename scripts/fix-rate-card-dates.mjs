import fs from 'node:fs';

/**
 * USA page 3: show the actual data date on the EFFR / SOFR / IORB cards
 * (previously only "FRED … · täglich"). Idempotent.
 */
let html = fs.readFileSync('index.html', 'utf8');
const before = html;
const reps = [
  [`<div class="date">FRED EFFR · täglich</div>`, `<div class="date">NY Fed/FRED · Stand '+(_e?_e.period:'—')+'</div>`],
  [`<div class="date">FRED SOFR · täglich</div>`, `<div class="date">NY Fed/FRED · Stand '+(_s?_s.period:'—')+'</div>`],
  [`<div class="date">FRED IORB · täglich</div>`, `<div class="date">Fed/FRED · Stand '+(_i?_i.period:'—')+'</div>`]
];
for (const [a, b] of reps) html = html.split(a).join(b);
if (html !== before) fs.writeFileSync('index.html', html);
console.log('rate card dates', html !== before ? 'gesetzt' : 'unverändert');
