// server/src/lib/woundEvolutionService.js — Guérison/Infection des blessures (Lot 2, premier
// consommateur réel, docs/PLAN_BLESSURES_GUERISON.md §5). Payload des échéances reste minimal
// (identifiants uniquement, convention Lot 2 2026-07-30) — l'état métier vit sur `character_wounds`,
// jamais dupliqué ici.
import { WOUND_HEALING, WOUND_INFECTION } from '../../../shared/woundConstants.js'
import { MINUTES_PER_DAY } from '../../../shared/gameTime.js'
import { resolveWoundImprovement, resolveWoundInsertion, buildWoundInsertionUndoEntries } from './woundUtils.js'
import { calcAttributeNA } from './charStats.js'
import { getMutationEffects } from '../services/mutationService.js'
import { createEcheance } from './echeanceService.js'

const WEEK_MINUTES = 7 * MINUTES_PER_DAY
const INFECTION_TICK_MINUTES = 2 * MINUTES_PER_DAY

// Appelée juste après l'insertion d'une blessure (woundService.js applyWound), uniquement pour
// Moyenne+ — Légère guérit seule, sans Test ni échéance (RAW, REGLEBLESSURES.md:402-403).
export async function initializeWoundHealingEcheance(trx, { campaignId, characterId, wound }) {
  const healing = WOUND_HEALING[wound.severity]
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

function buildRecurringReschedule(echeance) {
  const isOneShot = echeance.occurrences_remaining === null
  if (isOneShot || echeance.occurrences_remaining <= 1) return null
  return { intervalMinutes: echeance.interval_minutes, occurrencesRemaining: echeance.occurrences_remaining - 1 }
}

// Échec/Catastrophe déclenchent tous les deux un wound_infection_check, dès maintenant (même instant
// que la résolution du wound_healing_check) — pas de délai, RAW ne prévoit pas d'attente entre les
// deux. `intervalMinutes`/`occurrencesRemaining` null = ponctuel (Échec, "un et un seul Test") ;
// non-null = récurrent tous les 2 jours (Catastrophe).
function buildInfectionSpawn(wound, echeance, { intervalMinutes, occurrencesRemaining }) {
  return {
    conditionType: 'wound_infection_check',
    payload: { woundId: wound.id, periodesSansSoin: 0 },
    nextDueMinutes: echeance.next_due_minutes,
    intervalMinutes,
    occurrencesRemaining,
  }
}

// Fenêtre d'Infection déclenchée par une Catastrophe, bornée à "la période de guérison en cours"
// (lecture A confirmée avec Saar 2026-07-30, docs/PLAN_BLESSURES_GUERISON.md §3.2/§8) : pour une
// échéance récurrente (Critique/Mortelle), la période en cours = la semaine du cycle hebdomadaire
// déjà actif (écheance.interval_minutes). Pour une échéance unique (Moyenne/Grave), il n'existe pas
// de "temps restant" au moment où le Test se déclenche (il se déclenche exactement à la fin de
// l'unique période) — la fenêtre réutilise donc la durée caractéristique de la gravité elle-même
// comme longueur, pas un reliquat qui n'existe pas.
function computeCatastropheInfectionOccurrences(wound, echeance) {
  const isOneShot = echeance.occurrences_remaining === null
  const windowMinutes = isOneShot ? WOUND_HEALING[wound.severity].durationMinutes : echeance.interval_minutes
  return Math.round(windowMinutes / INFECTION_TICK_MINUTES)
}

// Handler `wound_healing_check` (shared/echeanceTypeRegistry.js, interactive: true) — jamais de jet
// serveur pour son propre résultat (§3.2, décision Saar) : lit payload.mjChoice déjà fourni par le
// MJ dans l'écran de revue.
export async function woundHealingCheckHandler(trx, echeance) {
  const wound = await trx('character_wounds').where({ id: echeance.payload.woundId }).first()
  if (!wound) {
    // Blessure déjà guérie/supprimée par une autre voie entre-temps — rien à faire, l'échéance
    // n'a plus d'objet.
    return { resolved: true, reschedule: null, spawn: [], undoEntries: [] }
  }

  const { mjChoice } = echeance.payload
  if (!mjChoice) return { resolved: false } // attend la réponse du MJ

  const isOneShot = echeance.occurrences_remaining === null
  const undoEntries = []
  const spawn = []
  let reschedule

  if (mjChoice === 'amelioration') {
    const isLastOccurrence = isOneShot || echeance.occurrences_remaining <= 1
    if (isLastOccurrence) {
      const result = await resolveWoundImprovement(trx, wound.id)
      undoEntries.push({ table: 'character_wounds', rowId: wound.id, previousValues: wound })
      if (result.wound) {
        undoEntries.push({ table: 'character_wounds', rowId: result.wound.id, previousValues: null })
      }
      reschedule = null
    } else {
      reschedule = buildRecurringReschedule(echeance)
    }
  } else if (mjChoice === 'echec') {
    reschedule = isOneShot
      ? (echeance.payload.soinsContinues
          ? { intervalMinutes: WOUND_HEALING[wound.severity].durationMinutes, occurrencesRemaining: 1 }
          : null)
      : buildRecurringReschedule(echeance)
    spawn.push(buildInfectionSpawn(wound, echeance, { intervalMinutes: null, occurrencesRemaining: null }))
  } else if (mjChoice === 'catastrophe') {
    reschedule = buildRecurringReschedule(echeance)
    const occurrencesRemaining = computeCatastropheInfectionOccurrences(wound, echeance)
    spawn.push(buildInfectionSpawn(wound, echeance, { intervalMinutes: INFECTION_TICK_MINUTES, occurrencesRemaining }))
  } else {
    throw new Error(`mjChoice "${mjChoice}" invalide pour wound_healing_check`)
  }

  return { resolved: true, reschedule, spawn, undoEntries }
}

// NA(Constitution) — même chaîne que char-sheet.js (route macro-preview, ligne ~1291) :
// char_attributes + char_archetype/genotype + mutations, réutilisée telle quelle plutôt que
// dupliquée. Lit via `trx` (pas `db`) pour char_attributes/char_archetype/ref_genotypes — cohérent
// avec le reste de ce fichier, correct même si un futur appelant modifiait un attribut dans la même
// transaction (aucun cas connu aujourd'hui, mais aucune raison de lire hors transaction). Seul
// getMutationEffects reste sur `db` : service partagé qui n'accepte pas de trx, changement hors
// périmètre de ce fichier — sans conséquence ici (aucun scénario ne modifie les mutations pendant
// la résolution d'une blessure).
async function computeConstitutionNA(trx, charSheetId) {
  const [attrs, archetype, mutationEffects] = await Promise.all([
    trx('char_attributes').where({ char_sheet_id: charSheetId }),
    trx('char_archetype').where({ char_sheet_id: charSheetId }).first(),
    getMutationEffects(charSheetId),
  ])
  const genotypeRow = archetype?.genotype_id
    ? await trx('ref_genotypes').where({ id: archetype.genotype_id }).first()
    : null
  return calcAttributeNA(attrs, 'CON', genotypeRow, mutationEffects)
}

// Seuil du Test de Constitution contre l'Infection (§3.3, REGLEBLESSURES.md:436-472) — combine
// jusqu'à trois composantes RAW distinctes, pas toutes présentes pour toutes les gravités
// (shared/woundConstants.js WOUND_INFECTION, relecture attentive documentée là-bas) :
// NA(Constitution) + modificateur de base + malus de cases (-2/case au-delà de la première sur la
// même ligne localisation/gravité) + malus de périodes sans soin (-2/période déjà écoulée).
export async function computeWoundInfectionThreshold(trx, wound, periodesSansSoin) {
  const rule = WOUND_INFECTION[wound.severity]
  const conNA = await computeConstitutionNA(trx, wound.char_sheet_id)

  let threshold = conNA + rule.baseModifier

  if (rule.caseMalus) {
    const { count } = await trx('character_wounds')
      .where({ char_sheet_id: wound.char_sheet_id, location: wound.location, severity: wound.severity })
      .count('* as count')
      .first()
    threshold -= 2 * Math.max(0, parseInt(count) - 1)
  }

  if (rule.periodMalus) {
    threshold -= 2 * periodesSansSoin
  }

  return threshold
}

// Handler `wound_infection_check` (interactive: true) — contrairement à wound_healing_check, garde
// un vrai jet (§3.3, décision Saar) : le caller (route, pas encore codée) doit avoir déjà résolu le
// jet — auto (resolvePolarisTest direct) ou joueur (DICE_ROLL/MACRO_ROLL) — et fusionné le résultat
// dans payload.rollResult avant d'appeler resolveEcheanceNow. Ce handler ne lance jamais de dé
// lui-même, il interprète un résultat déjà connu (même contrat que wound_healing_check.payload.mjChoice,
// une réponse externe déjà fournie).
export async function woundInfectionCheckHandler(trx, echeance) {
  const wound = await trx('character_wounds').where({ id: echeance.payload.woundId }).first()
  if (!wound) {
    return { resolved: true, reschedule: null, spawn: [], undoEntries: [] }
  }

  const { rollResult } = echeance.payload
  if (!rollResult) return { resolved: false } // attend un jet (auto ou joueur)

  const rule = WOUND_INFECTION[wound.severity]
  const { isSuccess } = rollResult
  const undoEntries = []

  const infects = !isSuccess || rule.infectsOnSuccess
  if (infects) {
    const insertion = await resolveWoundInsertion(trx, wound.char_sheet_id, wound.location, wound.severity)
    undoEntries.push(...buildWoundInsertionUndoEntries(insertion))
  }

  // Mortelle/Membre détruit (§3.3) : délai de survie affiché au MJ, jamais appliqué automatiquement
  // (docs/PLAN_BLESSURES_GUERISON.md §8 point 1, confirmé) — la mort reste narrative.
  let survivalHoursInfo = null
  if (wound.severity === 'mortelle') {
    const conNA = await computeConstitutionNA(trx, wound.char_sheet_id)
    survivalHoursInfo = { hours: isSuccess ? conNA : Math.floor(conNA / 2), onSuccess: isSuccess }
  }

  // previousValues capturé par l'engine lui-même pour la ligne game_echeances (voir
  // echeanceService.js resolveEcheanceHandler) — ici on ne fait que faire évoluer le payload pour
  // la prochaine occurrence, écrit directement (même savepoint que le reste du handler).
  const periodesSansSoin = (echeance.payload.periodesSansSoin ?? 0) + 1
  await trx('game_echeances').where({ id: echeance.id }).update({
    payload: { ...echeance.payload, periodesSansSoin, rollResult: null },
  })

  const reschedule = buildRecurringReschedule(echeance)

  return {
    resolved: true,
    effects: { isSuccess, infected: infects, survivalHoursInfo },
    reschedule,
    spawn: [],
    undoEntries,
  }
}
