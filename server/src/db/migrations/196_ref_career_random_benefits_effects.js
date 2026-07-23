// Migration 196 — Lot 6 (PLAN_WIZARD_AVANTAGES_IMPLANTATION.md §5quater) : peuple
// ref_career_random_benefits.effects pour les 36 métiers restants (colonne JSONB ajoutée par la
// migration 188, réservée depuis pour cette étape — seul chasseur_primes était déjà peuplé, migration
// 188 elle-même, jamais touché ici). Données réelles : shared/careerRandomEffectsData.js — source
// unique, réutilisée par ses tests (shared/careerRandomEffectsData.test.mjs), aucune duplication.
//
// La correction du résultat 4 de chasseur_primes (choix accepte/refuse manquant dans la migration
// 188 d'origine) est traitée séparément (migration 198) — un correctif isolé sur une donnée déjà en
// production ne doit jamais être mélangé à un peuplement neuf.

import { CAREER_RANDOM_EFFECTS_BY_CODE } from '../../../../shared/careerRandomEffectsData.js'

export async function up(knex) {
  for (const [code, table] of Object.entries(CAREER_RANDOM_EFFECTS_BY_CODE)) {
    const career = await knex('ref_careers').where({ code }).first('id')
    if (!career) throw new Error(`Carrière inconnue : ${code}`)
    for (const [roll, effects] of Object.entries(table)) {
      const updated = await knex('ref_career_random_benefits')
        .where({ career_id: career.id, roll: Number(roll) })
        .update({ effects: JSON.stringify(effects) })
      if (updated !== 1) {
        throw new Error(`Résultat introuvable ou dupliqué en base : ${code} roll=${roll} (${updated} ligne(s))`)
      }
    }
  }
}

export async function down(knex) {
  for (const code of Object.keys(CAREER_RANDOM_EFFECTS_BY_CODE)) {
    const career = await knex('ref_careers').where({ code }).first('id')
    if (career) {
      await knex('ref_career_random_benefits').where({ career_id: career.id }).update({ effects: '[]' })
    }
  }
}
