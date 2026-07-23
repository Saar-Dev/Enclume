// Migration 194 — Lot 6 (PLAN_WIZARD_AVANTAGES_IMPLANTATION.md §5bis) : peuple ref_setbacks.effects
// pour les 27 Revers (colonne JSONB ajoutée par la migration 188, réservée depuis pour cette étape,
// jamais peuplée). Données réelles : shared/reversEffectsData.js — source unique, réutilisée par ses
// tests (shared/reversEffectsData.test.mjs), aucune duplication ici (même patron que la migration
// 188 pour chasseur_primes, mais gardée dans shared/ vu le volume : 27 lignes contre 10).

import { REVERS_EFFECTS_BY_NAME } from '../../../../shared/reversEffectsData.js'

export async function up(knex) {
  for (const [name, effects] of Object.entries(REVERS_EFFECTS_BY_NAME)) {
    const updated = await knex('ref_setbacks')
      .where({ name })
      .update({ effects: JSON.stringify(effects) })
    if (updated !== 1) throw new Error(`Revers introuvable ou dupliqué en base : ${name} (${updated} ligne(s))`)
  }
}

export async function down(knex) {
  await knex('ref_setbacks').whereIn('name', Object.keys(REVERS_EFFECTS_BY_NAME)).update({ effects: '[]' })
}
