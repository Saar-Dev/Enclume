// Migration 192 — Chantier mécanisation Avantages professionnels aléatoires / Revers (Wizard
// Step4, docs/PLAN_WIZARD_AVANTAGES.md). char_mutations.source était contraint à 'chosen'/'random'/
// 'campaign' (migration 125) — un grant_mutation octroyé par un Revers (ou un tirage 1D10 de
// carrière) pendant la création n'a sa place dans aucune des 3 : ce n'est ni un choix du joueur
// (STEP3), ni un octroi narratif MJ en jeu ('campaign', AdvantagesPanel.jsx). Ajoute 'revers' —
// même mot que celui déjà utilisé par char_advantages.acquired_during pour la même origine, et déjà
// le nom joueur/UI officiel de la mécanique (docs/VOCABULARY.md "Revers" / "Provenance des octrois").

export const up = async (knex) => {
  await knex.raw('ALTER TABLE char_mutations DROP CONSTRAINT chk_char_mutations_source')
  await knex.raw(`
    ALTER TABLE char_mutations
    ADD CONSTRAINT chk_char_mutations_source CHECK (source IN ('chosen', 'random', 'campaign', 'revers'))
  `)
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE char_mutations DROP CONSTRAINT chk_char_mutations_source')
  await knex.raw(`
    ALTER TABLE char_mutations
    ADD CONSTRAINT chk_char_mutations_source CHECK (source IN ('chosen', 'random', 'campaign'))
  `)
}
