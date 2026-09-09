// 331_merchants_black_market.js — docs/PLANS/PLAN_USURE&INTEGRITE.md L0 §2.4 (décision D2)
//
// Un Marchand « marché noir » vend du matériel NEUF (ITG courante = ITG max) ; un Marchand légal
// vend de l'OCCASION (ITG courante tirée sur la formule de qualité — MANUEL_USURE.md §3.2, écart
// RAW assumé). Aucun flag « marché noir » n'existait (`merchants` / `tradeService.js` / TRADE.md —
// vérifié 2026-09-09). Consommé par L3 (génération d'ITG à l'achat).
//
// Rétro-compatible : défaut `false` = comportement actuel (tous les Marchands légaux). Aucun
// lecteur avant L3. `ADD COLUMN ... NOT NULL DEFAULT false` est instantané sur PostgreSQL ≥ 11
// (pas de réécriture de table). Idempotent (`IF NOT EXISTS`) ; `down()` = `DROP COLUMN`.

export const up = async (knex) => {
  await knex.raw('ALTER TABLE merchants ADD COLUMN IF NOT EXISTS is_black_market boolean NOT NULL DEFAULT false')
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE merchants DROP COLUMN IF EXISTS is_black_market')
}
