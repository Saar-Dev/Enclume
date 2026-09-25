// server/src/lib/woundHealingSchedule.js — Programme l'échéance de guérison d'UNE case de blessure (Lot 2,
// docs/Old/PLAN_BLESSURES_GUERISON.md §5). Module feuille : woundUtils.js (seul écrivain des lignes de
// `character_wounds`) l'appelle à CHAQUE écriture ; les handlers de woundEvolutionService.js n'ont pas à le faire —
// et ce fichier ne dépend ni de l'un ni de l'autre (sinon import circulaire woundUtils ↔ woundEvolutionService).
import { getWoundHealing, getHealingTotalTests, SOINS_CONSTANTS_INTERVAL_MINUTES } from '../../../shared/woundConstants.js'
import { createEcheance } from './echeanceService.js'

// Échéances d'une case de blessure : guérison ET infection (`payload.woundId`). « Vivante » = pas encore terminée, annulée ni en erreur.
const WOUND_ECHEANCE_TYPES = ['wound_healing_check', 'wound_infection_check']
const LIVE_STATUSES = ['active', 'pending_mj_review', 'awaiting_player_roll']

// Annule les échéances vivantes des cases données (WOUND-ECHEANCE-GHOSTS : une échéance vit et meurt avec sa case — sans cela elle reste
// `active`, se retrouve dans l'écran de revue du MJ sans aucune blessure et bloque la confirmation d'une avance de temps). Statut `cancelled`
// (prévu par la contrainte, traçable : aucune ligne supprimée). `exceptEcheanceId` : l'échéance que le moteur est EN TRAIN de résoudre —
// c'est lui qui fixe son statut final, jamais cette fonction. Retourne les lignes telles qu'elles étaient AVANT l'annulation : les
// appelants qui journalisent une avance de temps en font des entrées d'annulation (`previousValues`).
export async function cancelWoundEcheances(trx, woundIds, { exceptEcheanceId = null } = {}) {
  if (woundIds.length === 0) return []
  const query = trx('game_echeances')
    .whereIn('condition_type', WOUND_ECHEANCE_TYPES)
    .whereIn('status', LIVE_STATUSES)
    .whereIn(trx.raw("payload->>'woundId'"), woundIds)
  if (exceptEcheanceId) query.whereNot('id', exceptEcheanceId)
  const live = await query.select('*').forUpdate()
  if (live.length === 0) return []
  await trx('game_echeances').whereIn('id', live.map(e => e.id)).update({ status: 'cancelled', updated_at: trx.fn.now() })
  return live
}

// Prochain Test d'une guérison qui n'a PAS abouti (Échec ou Catastrophe sur la dernière occurrence) : une échéance ne se termine jamais tant
// que la blessure n'a pas guéri (RAW REGLEBLESSURES.md:393-407 : sans soin réussi, pas de diminution de gravité). Décisions de Saar
// (2026-09-25, docs/PLANS/PLAN_REVUE_GUERISON.md §6 Q2/Q2b) : Moyenne/Grave (guérison naturelle) → une nouvelle période de la durée de la
// gravité ; Critique/Mortelle/Membre détruit (soins constants) → un nouveau Test la semaine suivante. Null si la blessure ne guérit pas.
export function getHealingRetrySchedule(severity, location) {
  const healing = getWoundHealing(severity, location)
  if (!healing) return null
  return { intervalMinutes: healing.soinsConstants ? SOINS_CONSTANTS_INTERVAL_MINUTES : healing.durationMinutes, occurrencesRemaining: 1 }
}

// Appelée par woundUtils.js juste après l'écriture d'une case, uniquement pour Moyenne+ — Légère guérit seule, sans Test ni
// échéance (RAW, REGLEBLESSURES.md:402-403). Une Mort (Tête/Corps) n'en a pas non plus (getWoundHealing = null) ; un Membre
// détruit a la sienne (3 semaines, soins constants).
export async function initializeWoundHealingEcheance(trx, { campaignId, characterId, wound }) {
  const healing = getWoundHealing(wound.severity, wound.location)
  if (!healing) return null

  const payload = { woundId: wound.id }
  const baseMinutes = wound.occurred_at_game_minutes

  if (healing.soinsConstants) {
    // Critique/Mortelle : récurrente hebdomadaire (§3.2 "Soins constants" = Test de Médecine chaque
    // semaine). La gravité ne diminue qu'à la dernière occurrence (occurrences_remaining atteint 0).
    const occurrencesRemaining = getHealingTotalTests(wound.severity, wound.location)
    return createEcheance(trx, {
      campaignId, characterId, conditionType: 'wound_healing_check', payload,
      nextDueMinutes: baseMinutes + SOINS_CONSTANTS_INTERVAL_MINUTES,
      intervalMinutes: SOINS_CONSTANTS_INTERVAL_MINUTES,
      occurrencesRemaining,
    })
  }

  // Moyenne/Grave : unique, ponctuelle, à la fin de la durée totale.
  return createEcheance(trx, {
    campaignId, characterId, conditionType: 'wound_healing_check', payload,
    nextDueMinutes: baseMinutes + healing.durationMinutes,
    intervalMinutes: null,
    occurrencesRemaining: null,
  })
}
