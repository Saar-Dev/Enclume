// server/src/lib/woundHealingSchedule.js — Programme l'échéance de guérison d'UNE case de blessure (Lot 2,
// docs/Old/PLAN_BLESSURES_GUERISON.md §5). Module feuille : woundUtils.js (seul écrivain des lignes de
// `character_wounds`) l'appelle à CHAQUE écriture ; les handlers de woundEvolutionService.js n'ont pas à le faire —
// et ce fichier ne dépend ni de l'un ni de l'autre (sinon import circulaire woundUtils ↔ woundEvolutionService).
import { getWoundHealing } from '../../../shared/woundConstants.js'
import { MINUTES_PER_DAY } from '../../../shared/gameTime.js'
import { createEcheance } from './echeanceService.js'

const WEEK_MINUTES = 7 * MINUTES_PER_DAY

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
    const occurrencesRemaining = Math.round(healing.durationMinutes / WEEK_MINUTES)
    return createEcheance(trx, {
      campaignId, characterId, conditionType: 'wound_healing_check', payload,
      nextDueMinutes: baseMinutes + WEEK_MINUTES,
      intervalMinutes: WEEK_MINUTES,
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
