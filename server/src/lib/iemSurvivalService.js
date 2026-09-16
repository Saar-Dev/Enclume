// server/src/lib/iemSurvivalService.js — Survie I.E.M. (MANUEL_INFORMATIQUE.md §4.7,
// docs/PLANS/PLAN_INFORMATIQUE.md §4 Lot 3b). Dispositif optionnel d'un ordinateur d'exo-armure,
// distinct du Blindage IEM : il n'intervient qu'APRÈS un échec au Test de panne contre une IEM
// (déclenché par `runIemPanneTriggerExo`/`socketCombatHelpers.js`, catégorie Systèmes auxiliaires,
// uniquement pour l'ordinateur ACTIF de l'exo — jamais un secours inactif, cf. commentaire de
// `exposeToIemSurvival` ci-dessous). Séquence RAW en 4 étapes : (1) immobilisation pendant un
// nombre de Tours = marge d'échec du Test d'origine, (2) tentative de redémarrage chaque Tour
// suivant, (3) séquelle éventuelle au redémarrage réussi, (4) usure du dispositif (−1 niveau par
// redémarrage réussi).
//
// Même patron que `environmentalHazardService.js` (pose + tick dans le même fichier, un seul
// domaine) — mais un statut, pas un registre : contrairement aux dangers environnementaux (3 codes
// distincts partageant une forme), la Survie I.E.M. n'a qu'un statut (`iem_survival`) et une seule
// règle, une abstraction de registre serait sans second consommateur.
import { parseDice } from './diceParser.js'
import { resolvePolarisTest } from './polarisTestService.js'
import * as statusService from './statusService.js'

export const IEM_SURVIVAL_STATUS_CODE = 'iem_survival'

// exposeToIemSurvival — pose/renforce le statut d'immobilisation après un échec au Test de panne
// IEM de l'ordinateur (appelée par `runIemPanneTriggerExo`, jamais directement par un site MJ —
// contrairement à `exposeToHazard`, ceci n'est jamais une action manuelle). `mr` : marge signée du
// Test d'origine (négative sur échec, convention du projet, `runPanneTest`) — la marge d'échec RAW
// est donc `-mr`. `expiresAtTurn` reste toujours `null` (jamais balayé par la purge universelle de
// fin de Tour, `combatTurnEngine.js#endTurn` — l'échéance vit dans `data.rebootEligibleTurn`, lue
// par `resolveIemSurvivalTicks` ci-dessous) : voir le commentaire de `data` plus bas pour le détail
// du calcul.
//
// Garde anti-écrasement (même « decision G » qu'`exposeToHazard`, `applyModStatus` fait
// `.onConflict().merge()` sans argument → écrase inconditionnellement) : un second échec IEM sur le
// même ordinateur avant la fin d'un incident en cours ne doit jamais raccourcir
// `rebootEligibleTurn` (Math.max avec l'existant) ni perdre un `wasCritical` déjà vrai (OR, jamais
// écrasé par `false`).
export async function exposeToIemSurvival(io, db, campaignId, tokenId, { computerId, mr, isCriticalFail }) {
  const state = await db('combat_state').where({ campaign_id: campaignId }).select('current_turn').first()
  const currentTurn = state?.current_turn ?? 1
  const candidateRebootEligibleTurn = currentTurn - mr // mr négatif sur échec → -mr = marge d'échec (RAW, positive)

  const existing = await db('token_statuses')
    .where({ token_id: tokenId, status_code: IEM_SURVIVAL_STATUS_CODE })
    .select('data')
    .first()
  const rebootEligibleTurn = Math.max(existing?.data?.rebootEligibleTurn ?? 0, candidateRebootEligibleTurn)
  const wasCritical = (existing?.data?.wasCritical ?? false) || !!isCriticalFail

  console.log(`[DBG] Survie IEM — pose iem_survival token:${tokenId} ordinateur:${computerId} rebootEligibleTurn:${rebootEligibleTurn} wasCritical:${wasCritical}`)
  await statusService.applyModStatus(io, db, campaignId, tokenId, IEM_SURVIVAL_STATUS_CODE, {
    expiresAtTurn: null,
    data: { exoComputerId: computerId, rebootEligibleTurn, wasCritical },
  })
}

// resolveIemSurvivalTicks — appelée depuis `startResolutionPhase` (combatTurnEngine.js), juste
// après la boucle des dangers environnementaux, avec les lignes `token_statuses` `iem_survival`
// actives de la campagne (même patron de jointure `combat_roster` que les dangers). `currentTurn`
// déjà résolu par l'appelant (disponible dans `startResolutionPhase`, pas un second fetch ici —
// contrairement à `exposeToIemSurvival`, qui n'a pas cette donnée sous la main).
export async function resolveIemSurvivalTicks(io, db, campaignId, currentTurn, rows) {
  for (const row of rows) {
    const rebootEligibleTurn = row.data?.rebootEligibleTurn
    const computerId = row.data?.exoComputerId
    if (rebootEligibleTurn == null || !computerId) continue // ligne malformée — neutre, jamais un throw
    if (rebootEligibleTurn > currentTurn) continue // encore immobile, pas encore le Tour de retenter

    const computer = await db('exo_computers').where({ id: computerId }).first()
    if (!computer || computer.survie_iem_current == null) {
      // Ordinateur supprimé/désinstallé en cours de route (exo détruite, dispositif retiré) —
      // aucun redémarrage n'a de sens, retirer l'immobilisation plutôt que la laisser bloquer le
      // token indéfiniment.
      await statusService.clearModStatus(io, db, campaignId, row.token_id, IEM_SURVIVAL_STATUS_CODE)
      continue
    }

    // Étape 2 RAW — « même principe qu'un Test de panne : 1D20 sous le score », aucun modificateur.
    const outcome = await resolvePolarisTest(computer.survie_iem_current)
    if (!outcome.isSuccess) {
      console.log(`[DBG] Survie IEM — tentative de redémarrage token:${row.token_id} ordinateur:${computerId} roll:${outcome.roll}/${outcome.threshold} → échec, retenté au Tour suivant`)
      continue // reste ≤ rebootEligibleTurn au Tour suivant, retenté seul
    }

    // Étape 3 RAW — « jet d'1 dé, pair = rien, impair = malus cumulatif −1 (−2 si échec critique
    // d'origine) ». Aucune taille de dé donnée par le RAW (seule la parité compte) — 1D6 retenu par
    // défaut (dé générique le plus courant du reste de la RAW Polaris), décision maison journalisée
    // JOURNAL8.md, sans effet sur le résultat au-delà de l'affichage.
    const { total: sequelleRoll } = await parseDice('1D6')
    const sequelleMalus = sequelleRoll % 2 === 0 ? 0 : (row.data.wasCritical ? -2 : -1)

    // Étape 4 RAW — usure, plancher à 0 (jamais négatif, même convention que le reste du projet).
    const newSurvieIemCurrent = Math.max(0, computer.survie_iem_current - 1)

    await db('exo_computers').where({ id: computerId }).update({
      survie_iem_current: newSurvieIemCurrent,
      sequelle_malus: computer.sequelle_malus + sequelleMalus, // cumulatif, RAW ne prévoit aucun effacement
    })
    console.log(`[WS] Survie IEM — redémarrage réussi token:${row.token_id} ordinateur:${computerId} roll:${outcome.roll}/${outcome.threshold} séquelle:${sequelleRoll}→${sequelleMalus} survie_iem_current:${computer.survie_iem_current}→${newSurvieIemCurrent}`)
    await statusService.clearModStatus(io, db, campaignId, row.token_id, IEM_SURVIVAL_STATUS_CODE)
  }
}
