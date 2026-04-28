const fs = require('fs');
const parse = require('csv-parse/sync');

// Lire brut (important)
const raw = fs.readFileSync('skills.csv');

// Parser CSV correctement
const records = parse.parse(raw, {
  delimiter: ';',
  columns: true,
  skip_empty_lines: true,
  relax_quotes: true
});

// Fix encodage SAFE
function fix(text) {
  if (!text) return '';

  // tentative unique (pas de double transformation)
  let t = Buffer.from(text, 'latin1').toString('utf8');

  // fallback ciblé (TON dataset uniquement)
  return t
    .replace(/â€¦/g, '…')
    .replace(/â€™/g, "'")
    .replace(/â€œ|â€/g, '"')
    .replace(/â€“|â€”/g, '-');
}

// Nettoyage texte simple
function clean(t) {
  return fix(t).replace(/\s+/g, ' ').trim();
}

// Génération
let uid = 1;

const output = records.map(r => {
  return {
    uid: uid++, // one-shot → OK
    id: clean(r.name).toUpperCase().replace(/\s+/g, '_'),
    family: clean(r.category),
    label: clean(r.spec || r.name),
    parent: r.spec ? clean(r.name).toUpperCase().replace(/\s+/g, '_') : null,
    attr_1: (r.attrs || '').split('/')[0] || null,
    attr_2: (r.attrs || '').split('/')[1] || null,
    marker: r.type || null,
    description: clean(r.desc)
  };
});

// Export propre
fs.writeFileSync(
  'skills_clean.json',
  JSON.stringify(output, null, 2),
  'utf8'
);

console.log('DONE:', output.length);