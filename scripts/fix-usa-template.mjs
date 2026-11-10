import fs from 'fs';

/** Restore USA flip-toggle + page buttons if template was wiped */
let html = fs.readFileSync('index.html', 'utf8');

const good = "${c.id==='USA'?`<div class=\"usa-flip-toggle\"><div class=\"usa-page-select\" id=\"usaPageSelect\"><button type=\"button\" data-page=\"0\">Seite 1</button><button type=\"button\" data-page=\"1\">Seite 2</button><button type=\"button\" data-page=\"2\">Seite 3</button><button type=\"button\" data-page=\"3\">Seite 4</button><button type=\"button\" data-page=\"4\">Seite 5</button><button type=\"button\" data-page=\"5\">Seite 6</button><button type=\"button\" data-page=\"6\">Seite 7</button><button type=\"button\" data-page=\"7\">Repo-Markt</button></div></div>`:''}";

// Broken empty USA ternary left by inject-page8-repo
const brokenPatterns = [
  "${c.id==='USA'?``:''}",
  "${c.id==='USA'?``:''}",
  "${c.id==='USA'?'':''}",
];

let fixed = false;
for (const b of brokenPatterns) {
  if (html.includes(b)) {
    html = html.replace(b, good);
    fixed = true;
    console.log('replaced broken', JSON.stringify(b));
  }
}

// If usa-page-select missing entirely near card.innerHTML USA branch
if (!html.includes('id="usaPageSelect"') && !html.includes('id=\"usaPageSelect\"')) {
  // insert before metrics in template
  if (html.includes("${c.id==='USA'?``:''}")) {
    html = html.replace("${c.id==='USA'?``:''}", good);
    fixed = true;
  } else if (html.includes('<div class="metrics">${defs.map')) {
    html = html.replace(
      '<div class="metrics">${defs.map',
      good + '<div class="metrics">${defs.map'
    );
    // only for USA - that would add to all countries. Bad.
    // revert that approach
    console.log('page select missing - need careful insert');
  }
}

// Deduplicate buttons if multiple Repo-Markt
html = html.replace(
  /(<button type=\"button\" data-page=\"7\">Repo-Markt<\/button>)(\s*<button type=\"button\" data-page=\"7\">Repo-Markt<\/button>)+/g,
  '$1'
);
html = html.replace(
  /(<button type="button" data-page="7">Repo-Markt<\/button>)(\s*<button type="button" data-page="7">Repo-Markt<\/button>)+/g,
  '$1'
);

fs.writeFileSync('index.html', html);
console.log('fixed', fixed);
console.log('has usaPageSelect', html.includes('usaPageSelect'));
console.log('has empty USA ternary', html.includes("${c.id==='USA'?``:''}"));
console.log('has flip-toggle in template', html.includes('usa-flip-toggle'));
