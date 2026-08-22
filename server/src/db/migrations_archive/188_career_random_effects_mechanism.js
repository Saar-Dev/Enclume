// Migration 188 — Étape 1 du chantier "mécaniser les avantages professionnels aléatoires"
// (aujourd'hui purement narratifs : reconcileCreation stocke random_picks en JSONB brut sans
// aucune conséquence sur la fiche — cf. shared/careerAdvantages.js resolveCareerRandomEffects).
//
// Schéma :
//   ref_career_random_benefits.effects (JSONB, défaut '[]') — types supportés documentés dans
//     shared/careerAdvantages.js (attribute/celebrity/skill_points/category/income_percent/
//     income_multiplier). Colonne ajoutée pour TOUTES les carrières, peuplée ici uniquement pour
//     chasseur_primes (preuve du mécanisme) — le reste vient lot par lot (Étape 2, migrations
//     séparées), pas dans cette migration.
//   ref_setbacks.effects (JSONB, défaut '[]') — même schéma, réservé pour l'Étape 3 (Revers),
//     colonne ajoutée maintenant par cohérence de schéma, non peuplée ici.
//   char_sheet.celebrity (INTEGER, défaut 0) — n'existait pas du tout avant cette migration.
//   char_careers.random_effects_applied (JSONB, défaut '[]') — traçabilité des bonus de catégorie
//     gagnés par tirage (ex. "Matériel +2"), SÉPARÉ de pro_advantages (qui reste réservé à
//     l'allocation manuelle du joueur, validée par computeProAdvantageAllocation) pour ne jamais
//     fausser la validation de budget Q3 côté reconcileCreation.
//
// Effets chasseur_primes (roll 1-10, texte de 122_ref_career_random_benefits_lot1_and_points_alt.js,
// roll=10 volontairement effects:[] — c'est le choix "convertir en points", géré par points_alt,
// jamais un effet en plus) :

const CHASSEUR_PRIMES_EFFECTS = {
  1: [{ type: 'attribute', target: 'ADA', value: 1 }],
  2: [{ type: 'skill_points', value: 2 }, { type: 'celebrity', value: 2 }, { type: 'category', target: 'Matériel', value: 1 }],
  3: [{ type: 'income_percent', value: 10 }, { type: 'celebrity', value: 4 }, { type: 'category', target: 'Matériel', value: 2 }],
  4: [{ type: 'income_percent', value: 20 }, { type: 'celebrity', value: 4 }, { type: 'skill_points', value: 4 }],
  5: [{ type: 'skill_points', value: 4 }, { type: 'celebrity', value: 4 }, { type: 'income_multiplier', value: 2 }],
  6: [{ type: 'celebrity', value: 2 }, { type: 'category', target: 'Relations', value: 8 }],
  7: [{ type: 'category', target: 'Matériel', value: 6 }],
  // roll 8 "Camarades de combat" (amélioration gratuite d'un Allié) : hors périmètre (ADV1,
  // système Alliés/Contacts non mécanisé) — effects: [] volontaire, texte narratif inchangé.
  8: [],
  9: [{ type: 'income_multiplier', value: 2 }, { type: 'celebrity', value: 2 }, { type: 'category', target: 'Matériel', value: 2 }],
  10: [],
}

export async function up(knex) {
  await knex.schema.alterTable('ref_career_random_benefits', (t) => {
    t.jsonb('effects').notNullable().defaultTo('[]')
  })
  await knex.schema.alterTable('ref_setbacks', (t) => {
    t.jsonb('effects').notNullable().defaultTo('[]')
  })
  await knex.schema.alterTable('char_sheet', (t) => {
    t.integer('celebrity').notNullable().defaultTo(0)
  })
  await knex.schema.alterTable('char_careers', (t) => {
    t.jsonb('random_effects_applied').notNullable().defaultTo('[]')
  })

  const career = await knex('ref_careers').where({ code: 'chasseur_primes' }).first('id')
  if (!career) throw new Error('Carrière inconnue : chasseur_primes')

  for (const [roll, effects] of Object.entries(CHASSEUR_PRIMES_EFFECTS)) {
    await knex('ref_career_random_benefits')
      .where({ career_id: career.id, roll: Number(roll) })
      .update({ effects: JSON.stringify(effects) })
  }
}

export async function down(knex) {
  const career = await knex('ref_careers').where({ code: 'chasseur_primes' }).first('id')
  if (career) {
    await knex('ref_career_random_benefits')
      .where({ career_id: career.id })
      .update({ effects: '[]' })
  }

  await knex.schema.alterTable('char_careers', (t) => {
    t.dropColumn('random_effects_applied')
  })
  await knex.schema.alterTable('char_sheet', (t) => {
    t.dropColumn('celebrity')
  })
  await knex.schema.alterTable('ref_setbacks', (t) => {
    t.dropColumn('effects')
  })
  await knex.schema.alterTable('ref_career_random_benefits', (t) => {
    t.dropColumn('effects')
  })
}
