/**
 * Migration 255 — exo_sheet.notes
 *
 * PLAN_EXOARMURE.md §13.3 (Lot B — Base éditable, UI). En comparant la disposition retenue
 * ("copier la fiche RAW", FDEA.webp) à la liste des 19+3 champs déjà couverte par la migration 254,
 * un champ "Notes" libre apparaît sur la fiche officielle sans colonne correspondante — même famille
 * que `taille`/`type_batterie`/`type_coque` (migration 254) : narratif, instance-only, jamais copié
 * depuis `ref_exo_templates` (aucune colonne équivalente là-bas), aucun calcul ne le consomme.
 * Nullable sans défaut comme ses voisins narratifs — n'entre pas dans la sentinelle "non configurée"
 * (`category IS NULL`, migration 254), qui ne porte que sur les champs de calcul.
 */

export const up = async (knex) => {
  await knex.schema.alterTable('exo_sheet', (t) => {
    t.text('notes')
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('exo_sheet', (t) => {
    t.dropColumn('notes')
  })
}
