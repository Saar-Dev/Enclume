// 140_ref_skill_requirements_or_group.js
// HYBRIDE (ref_skills) n'avait aucune ligne ref_skill_requirements — visible pour tout le monde,
// alors que son texte LdB restreint l'accès à hybride naturel/géno-hybride/techno-hybride OU la
// mutation Amphibie (4 alternatives, OR). Le moteur actuel (isVisible) traite toutes les lignes
// d'une compétence en ET — insuffisant ici. Colonne or_group (text nullable) : les lignes qui
// partagent le même (skill_id, or_group) sont liées en OU (une seule suffit) ; or_group NULL =
// comportement actuel inchangé (ET). Même convention que ref_career_skills.choice_group
// (migration 121) — pattern déjà validé dans ce projet pour un regroupement similaire.
// Recherche pro (5etools feat prerequisites — tableau = ET, tableau imbriqué = OU ; PF2e Predicate —
// arbre récursif, mais pensé pour du contenu homebrew, hors scope ici) : modèle à 2 niveaux
// (ET entre groupes, OU dans un groupe) suffisant et proportionné — HYBRIDE est le seul des 232
// compétences ayant besoin d'un OR, un seul niveau d'imbrication requis.

const HYBRIDE_REQUIREMENTS = [
  { skill_id: 'HYBRIDE', type: 'GENOTYPE', value: 'HYB_NAT', or_group: 'HYBRIDE_ORIGIN' },
  { skill_id: 'HYBRIDE', type: 'GENOTYPE', value: 'GEN_HYB', or_group: 'HYBRIDE_ORIGIN' },
  { skill_id: 'HYBRIDE', type: 'GENOTYPE', value: 'TEC_HYB', or_group: 'HYBRIDE_ORIGIN' },
  { skill_id: 'HYBRIDE', type: 'MUTATION', value: '2', or_group: 'HYBRIDE_ORIGIN' }, // Amphibie
]

export const up = async (knex) => {
  await knex.schema.alterTable('ref_skill_requirements', (table) => {
    table.text('or_group').defaultTo(null)
  })

  await knex('ref_skill_requirements').insert(HYBRIDE_REQUIREMENTS)
}

export const down = async (knex) => {
  await knex('ref_skill_requirements')
    .where({ skill_id: 'HYBRIDE', or_group: 'HYBRIDE_ORIGIN' })
    .del()

  await knex.schema.alterTable('ref_skill_requirements', (table) => {
    table.dropColumn('or_group')
  })
}
