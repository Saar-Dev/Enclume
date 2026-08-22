// 103_seed_missing_ref_skills.js
// Ajoute les 2 compétences manquantes dans ref_skills :
//   - ENSEIGNEMENT (utilisé dans ref_career_skills dès la migration 100 mais absent de ref_skills)
//   - CONNAISSANCE_MILIEUX_SOCIAUX (utilisé dans les lots 4a/6)
// onConflict ignore : safe à rejouer si déjà présent.

const MISSING_SKILLS = [
  {
    id: 'ENSEIGNEMENT',
    family: 'Communication / Relations sociales',
    label: 'Enseignement',
    parent: null,
    attr_1: 'INT',
    attr_2: 'ADA',
    marker: null,
    description: null,
  },
  {
    id: 'CONNAISSANCE_MILIEUX_SOCIAUX',
    family: 'Connaissances',
    label: 'Connaissance des milieux sociaux',
    parent: null,
    attr_1: 'INT',
    attr_2: 'PRE',
    marker: null,
    description: null,
  },
]

export const up = async (knex) => {
  await knex('ref_skills')
    .insert(MISSING_SKILLS)
    .onConflict('id')
    .ignore()
}

export const down = async (knex) => {
  await knex('ref_skills')
    .whereIn('id', MISSING_SKILLS.map(s => s.id))
    .delete()
}
