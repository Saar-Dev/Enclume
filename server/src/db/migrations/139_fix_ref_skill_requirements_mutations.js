// 139_fix_ref_skill_requirements_mutations.js
// docs/PLAN_MUTATION2.md Lot 5 — [CS7] : ref_skill_requirements.value (type MUTATION) référence
// encore les anciens identifiants V1 (muta_XXX, table ref_mutations V1 supprimée migration 94).
// 8 lignes remappées vers le mutation_id V2 réel (correspondance par nom, croisée migration 38 (V1)
// / migration 95 (V2), aucune ambiguïté — chaque nom unique dans les 45 lignes ref_mutations).
// 2 lignes (MAITRISE_DE_LA_FORCE_POLARIS/MAITRISE_DE_LECHO_POLARIS) référençaient muta_029
// ("Sensibilité au Polaris") — mutation qui n'a jamais dû exister en V2 (confirmé Saar) : l'accès aux
// compétences Force Polaris passe par l'Avantage adv_079 "Force Polaris" (ref_advantages, déjà seedé
// migration 123, special_rule déjà littéralement "Débloque l'accès aux compétences Force Polaris").
// Ces 2 lignes basculent type MUTATION → ADVANTAGE.

const MUTATION_REMAP = [
  { skill_id: 'MUTATION_CONTAGION',            mutation_id: 8 },  // Contagion
  { skill_id: 'MUTATION_EMPATHIE',              mutation_id: 13 }, // Empathie
  { skill_id: 'MUTATION_CONTROLE_MOLECULAIRE',  mutation_id: 16 }, // Instabilité moléculaire
  { skill_id: 'MUTATION_METAMORPHOSE',          mutation_id: 17 }, // Métamorphe
  { skill_id: 'MUTATION_PURULENCE',             mutation_id: 30 }, // Purulence
  { skill_id: 'MUTATION_AGILITE_CAUDALE',       mutation_id: 31 }, // Queue
  { skill_id: 'MUTATION_SONAR',                 mutation_id: 41 }, // Sonar
  { skill_id: 'MUTATION_RADIATIONS',            mutation_id: 32 }, // Radiation
]

const POLARIS_SKILL_IDS = ['MAITRISE_DE_LA_FORCE_POLARIS', 'MAITRISE_DE_LECHO_POLARIS']

export const up = async (knex) => {
  for (const { skill_id, mutation_id } of MUTATION_REMAP) {
    await knex('ref_skill_requirements')
      .where({ skill_id, type: 'MUTATION' })
      .update({ value: String(mutation_id) })
  }

  await knex('ref_skill_requirements')
    .whereIn('skill_id', POLARIS_SKILL_IDS)
    .where({ type: 'MUTATION' })
    .update({ type: 'ADVANTAGE', value: 'adv_079' })
}

export const down = async (knex) => {
  await knex('ref_skill_requirements')
    .whereIn('skill_id', POLARIS_SKILL_IDS)
    .where({ type: 'ADVANTAGE', value: 'adv_079' })
    .update({ type: 'MUTATION', value: 'muta_029' })

  const V1_VALUES = {
    MUTATION_CONTAGION: 'muta_011',
    MUTATION_EMPATHIE: 'muta_016',
    MUTATION_CONTROLE_MOLECULAIRE: 'muta_019',
    MUTATION_METAMORPHOSE: 'muta_020',
    MUTATION_PURULENCE: 'muta_025',
    MUTATION_AGILITE_CAUDALE: 'muta_026',
    MUTATION_SONAR: 'muta_031',
    MUTATION_RADIATIONS: 'muta_033',
  }
  for (const [skill_id, value] of Object.entries(V1_VALUES)) {
    await knex('ref_skill_requirements')
      .where({ skill_id, type: 'MUTATION' })
      .update({ value })
  }
}
