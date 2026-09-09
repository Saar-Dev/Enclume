// combatAllureService.js — Autorité serveur de l'allure de déplacement en combat de Tir.
//
// L'allure du tireur et celle de la cible (malus RAW « Cible / Tireur en déplacement »,
// LdB p.226-227 + Écran du MJ) ne sont pas des confirmations libres : ce sont les
// conséquences mécaniques du `movement_gait` déclaré pour le Tour. Ce service lit la ligne
// de déplacement autoritaire dans `combat_actions` ; la LOGIQUE gait → clé de situation vit
// dans shared/combatSituationMods.js (rangedAllureKeyForGait, testable sans base).
//
// docs/PLANS/PLAN_ALLURE.md A2. Consommé en A3 par COMBAT_ACTION_PRECHECK (préselect des
// fenêtres) et par le gate joueur de socketCombatResolution.js (réécriture de
// confirmedModifiers.situation avant les 3 résolveurs de Tir).

import { rangedAllureKeyForGait } from '../../../shared/combatSituationMods.js'

// Allure réellement déclarée par un token pour un Tour donné, ou null (aucun déplacement).
// db : instance knex ou transaction. Lit la ligne de mouvement (`move_short`/`move_long`)
// non annulée du Tour ; `status:'skipped'` = le combattant n'a finalement pas bougé.
// `orderBy sequence desc` : défensif (une seule ligne de mouvement par Tour en pratique).
export async function resolveMovementGait(db, campaignId, tokenId, turnNumber) {
  if (tokenId == null || turnNumber == null) return null
  const row = await db('combat_actions')
    .where({ campaign_id: campaignId, token_id: tokenId, turn_number: turnNumber })
    .whereIn('type', ['move_short', 'move_long'])
    .whereNot('status', 'skipped')
    .orderBy('sequence', 'desc')
    .first()
  return row?.movement_gait ?? null
}

// Les 2 clés de situation dérivées du mouvement pour un jet de Tir attaquant → cible.
// Retour : { shooterAllureKey, targetAllureKey } — chaque valeur est une clé de
// RANGED_SITUATION_MODS ou null (aucun modificateur).
//   - shooterAllureKey : null si le tireur ne s'est pas déplacé (immobile, 0).
//   - targetAllureKey  : `cible_immobile` (+3) si la cible ne s'est pas déplacée ;
//                        null s'il n'y a PAS de cible unique (zone d'effet) — jamais
//                        confondre « pas de cible » et « cible immobile ».
export async function resolveRangedAllureKeys(db, campaignId, shooterTokenId, targetTokenId, turnNumber) {
  const [shooterGait, targetGait] = await Promise.all([
    resolveMovementGait(db, campaignId, shooterTokenId, turnNumber),
    targetTokenId == null ? Promise.resolve(null) : resolveMovementGait(db, campaignId, targetTokenId, turnNumber),
  ])
  return {
    shooterAllureKey: rangedAllureKeyForGait(shooterGait, 'shooter'),
    targetAllureKey: targetTokenId == null ? null : rangedAllureKeyForGait(targetGait, 'target'),
  }
}
