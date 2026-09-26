// server/src/lib/woundHealingSchedule.js — Programme l'échéance de guérison d'UNE case de blessure (Lot 2,
// docs/Old/PLAN_BLESSURES_GUERISON.md §5). Module feuille : woundUtils.js (seul écrivain des lignes de
// `character_wounds`) l'appelle à CHAQUE écriture ; les handlers de woundEvolutionService.js n'ont pas à le faire —
// et ce fichier ne dépend ni de l'un ni de l'autre (sinon import circulaire woundUtils ↔ woundEvolutionService).
import { getWoundHealing, getHealingTotalTests, findInfectionTarget, SOINS_CONSTANTS_INTERVAL_MINUTES } from '../../../shared/woundConstants.js'
import { createEcheance } from './echeanceService.js'

// « Vivante » = pas encore terminée, annulée ni en erreur. Deux formes d'échéance de blessure : la GUÉRISON appartient à une CASE (`payload.woundId`,
// chaque blessure a sa période — REGLEBLESSURES.md:393-395) ; l'INFECTION appartient à une LOCALISATION d'un personnage (`payload.location` — le livre
// la joue « pour chaque Localisation », REGLEBLESSURES.md:439-442 ; un seul Test par localisation, Lot B1 de PLAN_GUERISON_RAW).
const HEALING_TYPE = 'wound_healing_check'
const INFECTION_TYPE = 'wound_infection_check'
const LIVE_STATUSES = ['active', 'pending_mj_review', 'awaiting_player_roll']

// Annule les échéances de GUÉRISON vivantes des cases données (WOUND-ECHEANCE-GHOSTS : une échéance vit et meurt avec sa case — sans cela elle reste
// `active`, se retrouve dans l'écran de revue du MJ sans aucune blessure et bloque la confirmation d'une avance de temps). Statut `cancelled`
// (prévu par la contrainte, traçable : aucune ligne supprimée). `exceptEcheanceId` : l'échéance que le moteur est EN TRAIN de résoudre —
// c'est lui qui fixe son statut final, jamais cette fonction. Retourne les lignes telles qu'elles étaient AVANT l'annulation : les
// appelants qui journalisent une avance de temps en font des entrées d'annulation (`previousValues`). L'infection, elle, ne meurt pas avec UNE case :
// voir `settleLocationInfections`.
export async function cancelWoundEcheances(trx, woundIds, { exceptEcheanceId = null } = {}) {
  if (woundIds.length === 0) return []
  const query = trx('game_echeances')
    .where({ condition_type: HEALING_TYPE })
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

// Échéances d'infection VIVANTES d'une localisation d'un personnage (au plus une : index unique, migration « constraints » du Lot B1).
const liveInfectionsOf = (trx, characterId, location) => trx('game_echeances')
  .where({ condition_type: INFECTION_TYPE, character_id: characterId })
  .whereRaw("payload->>'location' = ?", [location])
  .whereIn('status', LIVE_STATUSES)

// Règle l'infection des localisations données APRÈS une écriture de blessures : une localisation qui n'a plus AUCUNE blessure susceptible de s'infecter
// (`findInfectionTarget`) perd son échéance d'infection vivante (statut `cancelled`, comme une échéance de guérison qui meurt avec sa case). À appeler
// UNE fois, à la FIN de l'opération publique — jamais au milieu d'une cascade de promotion (la ligne est effacée avant que la case du dessus soit
// cochée : la localisation semblerait, un instant, sans blessure). `exceptEcheanceId` : l'infection que le moteur résout en ce moment. Retourne les
// lignes telles qu'elles étaient AVANT l'annulation (entrées d'annulation d'une avance de temps).
export async function settleLocationInfections(trx, charSheetId, locations, { exceptEcheanceId = null } = {}) {
  const sheet = await trx('char_sheet').where({ id: charSheetId }).first('character_id')
  if (!sheet) return []
  const cancelled = []
  for (const location of new Set(locations)) {
    const wounds = await trx('character_wounds').where({ char_sheet_id: charSheetId, location }).select('severity', 'location')
    if (findInfectionTarget(wounds)) continue
    const query = liveInfectionsOf(trx, sheet.character_id, location)
    if (exceptEcheanceId) query.whereNot('id', exceptEcheanceId)
    const live = await query.select('*').forUpdate()
    if (live.length === 0) continue
    await trx('game_echeances').whereIn('id', live.map(e => e.id)).update({ status: 'cancelled', updated_at: trx.fn.now() })
    cancelled.push(...live)
  }
  return cancelled
}

// Assure l'infection d'une localisation après un Échec (ponctuelle : `intervalMinutes` nul) ou une Catastrophe (récurrente). IDEMPOTENTE et indépendante
// de l'ordre : trois cases échouent d'un coup, il n'y a qu'UN Test. Rien de vivant → création ; une infection vivante existe → fusion (jamais un deuxième
// Test) : une Catastrophe transforme une infection ponctuelle en récurrente (les Tests de la période) et allonge une récurrente ; un Échec ne change
// rien. Retourne `{ echeance, created, undoEntries }` — les entrées d'annulation d'une avance de temps (création : `previousValues: null` ; fusion : la
// ligne d'origine ; aucun changement : aucune entrée).
export async function ensureLocationInfection(trx, { campaignId, characterId, location, nextDueMinutes, intervalMinutes = null, occurrencesRemaining = null }) {
  const existing = await liveInfectionsOf(trx, characterId, location).forUpdate().first()
  if (!existing) {
    const echeance = await createEcheance(trx, {
      campaignId, characterId, conditionType: INFECTION_TYPE, payload: { location, periodesSansSoin: 0 },
      nextDueMinutes, intervalMinutes, occurrencesRemaining,
    })
    return { echeance, created: true, undoEntries: [{ table: 'game_echeances', rowId: echeance.id, previousValues: null }] }
  }

  const incomingRecurring = intervalMinutes !== null
  if (!incomingRecurring) return { echeance: existing, created: false, undoEntries: [] } // un Échec de plus : le Test de la localisation existe déjà

  const patch = existing.interval_minutes === null
    ? { interval_minutes: intervalMinutes, occurrences_remaining: occurrencesRemaining, next_due_minutes: Math.min(existing.next_due_minutes, nextDueMinutes) }
    : { occurrences_remaining: Math.max(existing.occurrences_remaining ?? 0, occurrencesRemaining ?? 0) }
  const changed = Object.entries(patch).some(([key, value]) => existing[key] !== value)
  if (!changed) return { echeance: existing, created: false, undoEntries: [] }

  const [echeance] = await trx('game_echeances').where({ id: existing.id }).update({ ...patch, updated_at: trx.fn.now() }).returning('*')
  return { echeance, created: false, undoEntries: [{ table: 'game_echeances', rowId: existing.id, previousValues: existing }] }
}
