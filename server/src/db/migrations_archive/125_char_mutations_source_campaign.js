// Migration 125 — AdvantagesPanel Lot D : mutations octroyées en jeu par le MJ
// char_mutations.source était contraint à 'chosen'/'random' (valeurs Wizard Step3 uniquement).
// Ajoute 'campaign' — distinct des deux existantes, même logique que char_advantages.acquired_during
// ('creation_step5' vs 'campaign'). Voir docs/PLAN_ADVANTAGESPANEL.md Lot D.

export const up = async (knex) => {
  await knex.raw('ALTER TABLE char_mutations DROP CONSTRAINT chk_char_mutations_source')
  await knex.raw(`
    ALTER TABLE char_mutations
    ADD CONSTRAINT chk_char_mutations_source CHECK (source IN ('chosen', 'random', 'campaign'))
  `)
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE char_mutations DROP CONSTRAINT chk_char_mutations_source')
  await knex.raw(`
    ALTER TABLE char_mutations
    ADD CONSTRAINT chk_char_mutations_source CHECK (source IN ('chosen', 'random'))
  `)
}
