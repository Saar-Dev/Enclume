// server/src/lib/surpriseService.js
//
// Résolution du Test de Réaction (Surprise, LdB p.213-214) — autorité unique, consommée par le jet
// automatique PNJ (COMBAT_START, socketCombatState.js) et le jet manuel PJ (COMBAT_SURPRISE_RESULT,
// même fichier). Avant ce module, les deux chemins recalculaient la même règle indépendamment et
// avaient divergé (INI1, retour Saar 2026-09-18) : le PNJ ne passait jamais par resolveTestOutcome
// (jamais d'échec possible, formule `base_ini + roll` au lieu de la marge de réussite RAW), et ni
// l'un ni l'autre n'émettait un DICE_RESULT lisible en chat. Même geste d'extraction que
// gmArbitratedTestService.js/activeMalusRegistry.js pour la même raison (risque de divergence déjà
// vécu ailleurs dans le projet, collision PC28, dispatch drone).

import { parseDice } from './diceParser.js'
import { resolveTestOutcome, getCriticalSuccessBonus, applyCriticalSuccessBonus } from '../../../shared/polarisTestResolution.js'
import { resolveCombatantDisplayIdentity } from './combatantContextService.js'
import { WS } from '../../../shared/events.js'

// rollSurpriseTest(baseIni) — jet serveur (non manipulable par le client) + résolution RAW complète
// (p.204-205 pour le critique, p.213-214 pour la Réaction). Seuil = base_ini. Réaction est un
// attribut dérivé (calcREA = round((ADA_NA+PER_NA)/2) + bonus), jamais stocké comme un attribut
// simple — base_ini joue ici le rôle d'AN pour le bonus de Réussite critique, même convention que
// tout Test d'Attribut pur (gmArbitratedTestService.js).
// RAW : Succès → Initiative = marge de réussite (mr, déjà majorée du bonus critique le cas échéant).
//       Échec  → Initiative = 0, personnage surpris, ne peut pas agir ce Tour de combat.
export async function rollSurpriseTest(baseIni) {
  const { rolls, total: diceRoll, seed } = await parseDice('1d20')
  const outcome = applyCriticalSuccessBonus(
    resolveTestOutcome(diceRoll, baseIni),
    getCriticalSuccessBonus({ attributeAN: baseIni }),
  )
  const initiative = outcome.isSuccess ? outcome.mr : 0
  return { diceRoll, rolls, seed, baseIni, ...outcome, initiative }
}

// emitSurpriseDiceResult(io, campaignId, db, character, outcome) — construit et diffuse le
// DICE_RESULT du Test de Réaction, avec skillLabel/cardType pour la carte chat dédiée
// (MessageRendererRegistry.jsx, patron déjà établi par shock_test/drone_damage) au lieu du rendu
// générique "jet libre" (INI1, retour Saar : « juste un jet d20 sans explication »).
// resolveCombatantDisplayIdentity gère déjà PJ (pseudo/couleur utilisateur) et PNJ (nom du
// personnage, gris #808080) en une seule autorité (combatantContextService.js) — jamais une variante
// locale ici. `outcome` : le retour de rollSurpriseTest ci-dessus.
export async function emitSurpriseDiceResult(io, campaignId, db, character, outcome) {
  const { userId, username, color } = await resolveCombatantDisplayIdentity(db, character)
  io.to(campaignId).emit(WS.DICE_RESULT, {
    userId, username, color,
    formula: '1d20',
    rolls: outcome.rolls,
    total: outcome.diceRoll,
    isCriticalSuccess: outcome.isCriticalSuccess,
    isCriticalFail: outcome.isCriticalFail,
    seed: outcome.seed,
    timestamp: new Date().toISOString(),
    skillLabel: 'Test de Réaction (Surprise)',
    cardType: 'surprise',
    chancesDeReussite: outcome.baseIni,
    isSuccess: outcome.isSuccess,
    mr: outcome.mr,
  })
}
