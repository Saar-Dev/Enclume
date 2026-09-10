// 334_game_echeances_advance_driven.js — docs/PLANS/PLAN_USURE&INTEGRITE.md L6 §8
//
// `advance_driven` : cette échéance participe-t-elle au flux de revue/annulation d'une avance
// d'horloge de campagne (`gameTimeService.js`) ?
//   - `true`  (défaut) : échéance PROGRAMMÉE — naît `active` avec un `next_due_minutes` réel, devient
//     `pending_mj_review` quand l'horloge la franchit. C'est le cas des blessures
//     (`wound_healing_check` / `wound_infection_check`). Elle bloque une avance tant qu'elle n'est
//     pas résolue, elle est remise à `active` si le MJ annule l'avance, et ses `undoEntries`
//     alimentent `campaigns.pending_advance_undo_log`.
//   - `false` : échéance À LA DEMANDE — créée directement en `pending_mj_review` par un geste joueur,
//     `next_due_minutes` sans objet. N'a rien à voir avec l'horloge : ne doit ni bloquer une avance,
//     ni être clobberée par une annulation d'avance, ni polluer le journal d'annulation. Premier
//     consommateur : `equipment_repair` (le joueur demande une réparation, le MJ approuve).
//
// Dénormalisé sur la ligne à la création (`echeanceService.createEcheance`, depuis
// `shared/echeanceTypeRegistry.js`) — exactement comme `interactive`, pour la même raison : filtre
// direct de balayage, jamais recalculé depuis le registre au moment d'une requête (le registre est
// peuplé au boot serveur, une requête ne doit pas en dépendre).
//
// `DEFAULT true` + aucun backfill : toutes les lignes existantes sont des échéances de blessure ou
// de froid — toutes correctement `advance_driven = true` (les échéances de froid sont
// `interactive: false`, jamais regardées par le flux d'avance, `true` y est inoffensif).
// Rétro-compatible : le code encore déployé ignore cette colonne.
//
// Idempotent (`ADD COLUMN IF NOT EXISTS`). `down()` = `DROP`.

export const up = async (knex) => {
  await knex.raw(
    'ALTER TABLE game_echeances ADD COLUMN IF NOT EXISTS advance_driven boolean NOT NULL DEFAULT true',
  )
}

export const down = async (knex) => {
  await knex.raw('ALTER TABLE game_echeances DROP COLUMN IF EXISTS advance_driven')
}
