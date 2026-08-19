// Migration 248 — char_sheet.wizard_progress
// Audit "diffusion live du Wizard" (docs/JOURNAL8.md, 2026-08-19) — point 2 : plusieurs endroits du
// Wizard devinent "cette étape/sous-étape a-t-elle déjà été visitée" à partir du contenu soumis
// (getStep3State#method='none', Step4Experience.jsx#computeInitialSubStep), faute de marqueur
// persisté. Deux cas sont irréductibles par chaînage (WIZ5B pour Step3 ; Step4 : rien ne distingue
// "Avantages & Revers jamais visité" de "visité, career sans Pro-Avantage + reversEnabled=false").
//
// wizard_progress est un petit sac JSONB de marqueurs de progression (pas un stockage de données
// métier — celles-ci restent dans char_archetype/char_careers/char_mutations etc.), même convention
// que state_character sur combat_roster (PC39/PC42 : clé absente = valeur par défaut, jamais stocker
// une valeur "non atteinte" explicitement) :
//   step3_visited: true                    — Step3 a été réconciliée au moins une fois
//   step4_highest_substep: '<SUB_STEPS.*>' — plus loin sous-étape jamais atteinte en Step4 (avance
//                                             uniquement, jamais régressée — creationService.js)
//
// Rétrocompatible : colonne additive, défaut '{}' (équivalent à "rien connu", comportement identique
// à avant cette migration pour toute fiche déjà existante — le code retombe sur l'ancienne heuristique
// de contenu quand la clé est absente).

export const up = async (knex) => {
  await knex.schema.alterTable('char_sheet', (table) => {
    table.jsonb('wizard_progress').notNullable().defaultTo('{}')
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('char_sheet', (table) => {
    table.dropColumn('wizard_progress')
  })
}
