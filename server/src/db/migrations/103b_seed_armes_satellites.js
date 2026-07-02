// 103b_seed_armes_satellites.js
// Ajoute ARMES_SATELLITES dans ref_skills.
// Compétence exclusive de l'Officier militaire (spécialité Surface).
// Calquée sur ARMES_EMBARQUEES_ARTILLERIE : family Techniques, INT, marker (X).
// onConflict ignore : safe à rejouer.

const SKILL = {
  id: 'ARMES_SATELLITES',
  family: 'Techniques',
  label: 'Armes satellites',
  parent: null,
  attr_1: 'INT',
  attr_2: null,
  marker: '(X)',
  description: null,
}

export const up = async (knex) => {
  await knex('ref_skills')
    .insert(SKILL)
    .onConflict('id')
    .ignore()
}

export const down = async (knex) => {
  await knex('ref_skills').where({ id: SKILL.id }).delete()
}
