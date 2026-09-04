// 324_campaigns_current_battlemap_id.js — docs/PLANS/PLAN_CHAT_COMMANDES.md §4.
//
// Distincte de `default_battlemap_id` (config « carte d'accueil » — inchangée). `current_battlemap_id`
// est la carte où le groupe se trouve réellement en ce moment, mise à jour par le MJ via MAP_SWITCH
// (socketBattlemap.js). Jusqu'ici ce relais était stateless (validait puis retransmettait sans jamais
// écrire en base) — aucune ligne du projet ne savait donc « quelle est la carte actuelle de cette
// campagne » de façon durable. Premier consommateur : `/heal` (portée « carte active », sans argument).
// Corrige au passage un bug latent trouvé en investiguant : un joueur qui se reconnecte après un
// changement de carte rechargeait `default_battlemap_id` (potentiellement périmé) — SessionPage.jsx lit
// désormais `current_battlemap_id ?? default_battlemap_id`.
//
// Nullable : NULL tant qu'aucun MAP_SWITCH n'a eu lieu depuis l'ajout de la colonne (repli sur
// `default_battlemap_id` côté consommateur, jamais une valeur par défaut devinée ici).
export const up = async (knex) => {
  await knex.schema.alterTable('campaigns', (t) => {
    t.uuid('current_battlemap_id')
  })
  await knex.raw(`
    ALTER TABLE campaigns
      ADD CONSTRAINT campaigns_current_battlemap_id_foreign
      FOREIGN KEY (current_battlemap_id) REFERENCES battlemaps(id) ON DELETE SET NULL
  `)
}

export const down = async (knex) => {
  await knex.schema.alterTable('campaigns', (t) => {
    t.dropColumn('current_battlemap_id')
  })
}
