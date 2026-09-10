// 335_game_echeances_repair_item_index.js — docs/PLANS/PLAN_USURE&INTEGRITE.md L6 §8 (L6c-C)
//
// `getItemWithRef` / `getInventory` portent depuis L6c-B une sous-requête scalaire
// `repair_request_status` :
//   SELECT status FROM game_echeances
//   WHERE condition_type = 'equipment_repair'
//     AND status IN ('pending_mj_review','awaiting_player_roll')
//     AND payload->>'itemId' = char_inventory.id::text
//   LIMIT 1
// exécutée une fois par ligne d'inventaire (visage joueur du pop-up d'ITG + liseré bleu de l'icône).
// `payload->>'itemId'` est une expression JSON non indexable par défaut → sans index, chaque
// rafraîchissement d'inventaire fait N balayages séquentiels de `game_echeances`.
//
// Index partiel + fonctionnel : ne couvre que les échéances de réparation (une poignée de lignes),
// clé = l'expression exactement telle qu'écrite dans la sous-requête. Le filtre `status IN (...)`
// s'applique ensuite sur les 0-1 lignes retenues.
//
// Additif, idempotent (`IF NOT EXISTS`). `down()` = `DROP INDEX`.

export const up = async (knex) => {
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_game_echeances_repair_item
    ON game_echeances ((payload->>'itemId'))
    WHERE condition_type = 'equipment_repair'
  `)
}

export const down = async (knex) => {
  await knex.raw('DROP INDEX IF EXISTS idx_game_echeances_repair_item')
}
