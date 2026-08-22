// 101_fix_background_names_encoding.js
// Corrige les noms corrompus (mojibake Latin-1/UTF-8) insérés par migration 98.
// 8 entrées affectées dans ref_backgrounds.

export const up = async (knex) => {
  const fixes = [
    { type: 'geo_origin',    code: 'grande_cite',         name: 'Grande cité' },
    { type: 'social_origin', code: 'classes_superieures', name: 'Classes supérieures' },
    { type: 'training',      code: 'delinquance',          name: 'Délinquance/Criminalité' },
    { type: 'training',      code: 'education_scolaire',   name: 'Éducation scolaire' },
    { type: 'higher_ed',     code: 'ecole_ingenieurs',     name: "École d'ingénieurs" },
    { type: 'higher_ed',     code: 'ecole_militaire',      name: 'École militaire' },
    { type: 'higher_ed',     code: 'ecole_navale',         name: 'École navale' },
    { type: 'higher_ed',     code: 'medecine',             name: 'Médecine' },
  ]
  for (const { type, code, name } of fixes) {
    await knex('ref_backgrounds').where({ type, code }).update({ name })
  }
}

export const down = async (knex) => {
  const originals = [
    { type: 'geo_origin',    code: 'grande_cite',         name: 'Grande citÃ©' },
    { type: 'social_origin', code: 'classes_superieures', name: 'Classes supÃ©rieures' },
    { type: 'training',      code: 'delinquance',          name: 'DÃ©linquance/CriminalitÃ©' },
    { type: 'training',      code: 'education_scolaire',   name: 'Ãducation scolaire' },
    { type: 'higher_ed',     code: 'ecole_ingenieurs',     name: "Ãcole d'ingÃ©nieurs" },
    { type: 'higher_ed',     code: 'ecole_militaire',      name: 'Ãcole militaire' },
    { type: 'higher_ed',     code: 'ecole_navale',         name: 'Ãcole navale' },
    { type: 'higher_ed',     code: 'medecine',             name: 'MÃ©decine' },
  ]
  for (const { type, code, name } of originals) {
    await knex('ref_backgrounds').where({ type, code }).update({ name })
  }
}
