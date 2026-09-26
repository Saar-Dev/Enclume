// server/src/lib/woundEvolutionService.js — Guérison/Infection des blessures (Lot 2, premier
// consommateur réel, docs/PLAN_BLESSURES_GUERISON.md §5). Payload des échéances reste minimal
// (identifiants uniquement, convention Lot 2 2026-07-30) — l'état métier vit sur `character_wounds`,
// jamais dupliqué ici.
import { WOUND_INFECTION, WOUND_MAX_COUNTS, getWoundHealing, getHealingTotalTests, findInfectionTarget } from '../../../shared/woundConstants.js'
import { MINUTES_PER_DAY } from '../../../shared/gameTime.js'
import { resolveWoundImprovement, resolveWoundInsertion, buildWoundInsertionUndoEntries, buildWoundImprovementUndoEntries } from './woundUtils.js'
import { getHealingRetrySchedule, ensureLocationInfection } from './woundHealingSchedule.js'
import { calcAttributeNA } from './charStats.js'
import { shortId } from './reviewTrace.js'
import { getMutationEffects } from '../services/mutationService.js'

const INFECTION_TICK_MINUTES = 2 * MINUTES_PER_DAY

// L'échéance de guérison d'une case est programmée à son écriture par woundUtils.js (seul écrivain de lignes de blessure) —
// woundHealingSchedule.js : les handlers ci-dessous n'ont jamais à s'en soucier.

// Dernière occurrence d'une échéance : l'échéance UNIQUE (Moyenne/Grave : `occurrences_remaining` nul) ou le dernier Test d'une échéance récurrente.
function isLastOccurrence(echeance) {
  return echeance.occurrences_remaining === null || echeance.occurrences_remaining <= 1
}

// Suite d'un cycle récurrent : null à la dernière occurrence (l'échéance d'INFECTION, elle, se termine bien là — un Test « un et un seul »).
function buildRecurringReschedule(echeance) {
  if (isLastOccurrence(echeance)) return null
  return { intervalMinutes: echeance.interval_minutes, occurrencesRemaining: echeance.occurrences_remaining - 1 }
}

// SEUL calcul du Test suivant d'une GUÉRISON qui n'a pas abouti (Échec ou Catastrophe) — une échéance de guérison ne se termine jamais tant
// que la blessure n'a pas guéri (WOUND-HEAL-ONESHOT-STUCK : ni un Échec sur la dernière semaine d'une Critique, ni un 2ᵉ Échec sur une
// Moyenne, ni une Catastrophe ne doivent laisser une blessure sans plus aucun Test — vérifié par exécution avant ce correctif) :
// pas la dernière occurrence → le cycle hebdomadaire continue ; dernière occurrence → une nouvelle tentative (getHealingRetrySchedule).
function buildFailedHealingReschedule(wound, echeance) {
  if (!isLastOccurrence(echeance)) return buildRecurringReschedule(echeance)
  return getHealingRetrySchedule(wound.severity, wound.location)
}

// Échec/Catastrophe déclenchent tous les deux le Test de Constitution de la LOCALISATION de la blessure (REGLEBLESSURES.md:396-401 : « un (et un seul)
// Test de Constitution » ; :439-442 : « pour chaque Localisation »), dès maintenant (même instant que la résolution du wound_healing_check) — pas de
// délai, RAW ne prévoit pas d'attente entre les deux. `intervalMinutes`/`occurrencesRemaining` null = ponctuel (Échec) ; non-null = récurrent tous les
// 2 jours (Catastrophe). Trois cases de la même localisation qui échouent d'un coup ne créent qu'UN Test : `ensureLocationInfection` fusionne (Lot B1).
async function ensureInfection(trx, wound, echeance, { intervalMinutes, occurrencesRemaining }) {
  return ensureLocationInfection(trx, {
    campaignId: echeance.campaign_id, characterId: echeance.character_id, location: wound.location,
    nextDueMinutes: echeance.next_due_minutes, intervalMinutes, occurrencesRemaining,
  })
}

// Trace : ce que l'assurance de l'infection a fait pour la localisation (créée, fusionnée, ou déjà là).
const describeEnsuredInfection = (wound, { created, echeance, undoEntries }) => {
  if (created) return `un Test d'infection est créé pour ${wound.location} (échéance ${shortId(echeance.id)}, déjà dû)`
  return undoEntries.length > 0
    ? `${wound.location} avait déjà un Test d'infection (échéance ${shortId(echeance.id)}) : il devient récurrent / s'allonge, aucun Test de plus`
    : `${wound.location} a déjà un Test d'infection (échéance ${shortId(echeance.id)}) : aucun Test de plus`
}

// Fenêtre d'Infection déclenchée par une Catastrophe, bornée à "la période de guérison en cours"
// (lecture A confirmée avec Saar 2026-07-30, docs/PLAN_BLESSURES_GUERISON.md §3.2/§8) : pour une
// échéance récurrente (Critique/Mortelle), la période en cours = la semaine du cycle hebdomadaire
// déjà actif (écheance.interval_minutes). Pour une échéance unique (Moyenne/Grave), il n'existe pas
// de "temps restant" au moment où le Test se déclenche (il se déclenche exactement à la fin de
// l'unique période) — la fenêtre réutilise donc la durée caractéristique de la gravité elle-même
// comme longueur, pas un reliquat qui n'existe pas.
// La période que ce Test referme est `interval_minutes` (échéance récurrente, y compris une nouvelle tentative) ; une échéance unique n'en a pas
// (`interval_minutes` nul) : la durée de la gravité fait alors office de période.
function computeCatastropheInfectionOccurrences(wound, echeance) {
  const windowMinutes = echeance.interval_minutes ?? getWoundHealing(wound.severity, wound.location).durationMinutes
  return Math.round(windowMinutes / INFECTION_TICK_MINUTES)
}

// Trace (revue des guérisons) : ce que devient la blessure quand la guérison réussit à son dernier Test. Lue par le collecteur `context.trace` — jamais
// appelée (donc aucune requête en plus) quand personne ne trace. Signale une ligne qui DÉPASSE son maximum (WOUND-HEAL-LINE-CAPACITY).
async function describeImprovement(trx, wound, result) {
  const cancelled = `${result.cancelledEcheances?.length ?? 0} échéance(s) annulée(s) avec l'ancienne case`
  if (result.healed) return `→ blessure guérie : la case disparaît ; ${cancelled}`
  const { location, severity } = result.wound
  const [{ count }] = await trx('character_wounds').where({ char_sheet_id: wound.char_sheet_id, location, severity }).count('* as count')
  const max = WOUND_MAX_COUNTS[location]?.[severity]
  const overflow = max != null && Number(count) > max ? ' ⚠ DÉPASSE LE MAXIMUM' : ''
  const fused = result.promoted
    ? ` ; LIGNE D'ARRIVÉE PLEINE : ${result.deletedWounds.length} case(s) effacée(s), la case est cochée en ${severity} (première case libre au-dessus)`
    : ''
  return `→ devient ${severity} (nouvelle case ${shortId(result.wound?.id)}, échéance ${shortId(result.echeance?.id)}) ; ligne ${location}/${severity} : ${count} case(s) pour un maximum de ${max ?? '?'}${overflow}${fused} ; ${cancelled}`
}

// Handler `wound_healing_check` (shared/echeanceTypeRegistry.js, interactive: true) — jamais de jet
// serveur pour son propre résultat (§3.2, décision Saar) : lit payload.mjChoice déjà fourni par le
// MJ dans l'écran de revue.
export async function woundHealingCheckHandler(trx, echeance, context = {}) {
  const trace = context.trace ?? null
  const wound = await trx('character_wounds').where({ id: echeance.payload.woundId }).first()
  if (!wound) {
    // Blessure déjà guérie/supprimée par une autre voie entre-temps — rien à faire, l'échéance
    // n'a plus d'objet.
    return { resolved: true, reschedule: null, spawn: [], undoEntries: [] }
  }

  const { mjChoice } = echeance.payload
  if (!mjChoice) return { resolved: false } // attend la réponse du MJ

  if (trace) {
    const total = getHealingTotalTests(wound.severity, wound.location)
    const step = total === null || echeance.occurrences_remaining == null ? 'Test unique' : `semaine ${total - echeance.occurrences_remaining + 1}/${total}`
    trace(`guérison ${wound.location}/${wound.severity} (case ${shortId(wound.id)}, ${step}) — issue « ${mjChoice} »`)
  }

  const undoEntries = []
  const spawn = []
  let reschedule

  if (mjChoice === 'amelioration') {
    if (isLastOccurrence(echeance)) {
      // La case obtenue naît AVEC son échéance de guérison (la chaîne continue jusqu'à disparition, RAW REGLEBLESSURES.md:366-367),
      // datée du jour d'échéance de cette guérison : `game_time_resolved_minutes` n'avance qu'à la confirmation de l'avance de
      // temps, elle serait datée avant le jour où elle est réellement devenue plus légère.
      const result = await resolveWoundImprovement(
        trx, wound.id,
        { campaignId: echeance.campaign_id, characterId: echeance.character_id },
        // exceptEcheanceId : cette échéance-ci fixe elle-même son statut final (le moteur) ; les AUTRES échéances de la case guérie
        // (ex. son infection en cours) sont annulées avec elle et journalisées pour l'annulation d'avance.
        { occurredAtGameMinutes: echeance.next_due_minutes, exceptEcheanceId: echeance.id },
      )
      undoEntries.push(...buildWoundImprovementUndoEntries(wound, result))
      if (trace) trace(await describeImprovement(trx, wound, result))
      reschedule = null
    } else {
      reschedule = buildRecurringReschedule(echeance)
      trace?.('→ la guérison continue : la gravité ne change pas à ce Test')
    }
  } else if (mjChoice === 'echec') {
    reschedule = buildFailedHealingReschedule(wound, echeance)
    const infection = await ensureInfection(trx, wound, echeance, { intervalMinutes: null, occurrencesRemaining: null })
    undoEntries.push(...infection.undoEntries)
    trace?.(`→ la blessure ne s'améliore pas ; ${describeEnsuredInfection(wound, infection)}`)
  } else if (mjChoice === 'catastrophe') {
    reschedule = buildFailedHealingReschedule(wound, echeance)
    const occurrencesRemaining = computeCatastropheInfectionOccurrences(wound, echeance)
    const infection = await ensureInfection(trx, wound, echeance, { intervalMinutes: INFECTION_TICK_MINUTES, occurrencesRemaining })
    undoEntries.push(...infection.undoEntries)
    trace?.(`→ la blessure ne s'améliore pas ; Catastrophe : ${occurrencesRemaining} Test(s) de Constitution contre l'infection ; ${describeEnsuredInfection(wound, infection)}`)
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

// La CIBLE du Test d'infection d'une localisation : sa pire blessure susceptible de s'infecter et le nombre de cases de sa ligne (`findInfectionTarget`), ou null.
async function loadInfectionTarget(trx, charSheetId, location) {
  const wounds = await trx('character_wounds').where({ char_sheet_id: charSheetId, location }).select('severity', 'location')
  return findInfectionTarget(wounds)
}

// Seuil du Test de Constitution contre l'Infection d'UNE LOCALISATION (REGLEBLESSURES.md:439-472 ; décision de Saar 2026-09-26, Q5/Q6 : la PIRE blessure fixe
// le Test, et seules les cases de SA ligne comptent) — combine jusqu'à trois composantes RAW distinctes, pas toutes présentes pour toutes les gravités
// (shared/woundConstants.js WOUND_INFECTION) : NA(Constitution) + modificateur de base + malus de cases (-2/case au-delà de la première sur la ligne de la
// pire blessure) + malus de périodes sans soin (-2/période déjà écoulée). Retourne `{ threshold, severity, cases }`, ou null si la localisation n'a plus aucune
// blessure susceptible de s'infecter.
export async function computeLocationInfectionThreshold(trx, charSheetId, location, periodesSansSoin) {
  const target = await loadInfectionTarget(trx, charSheetId, location)
  if (!target) return null
  const rule = WOUND_INFECTION[target.severity]
  const conNA = await computeConstitutionNA(trx, charSheetId)

  let threshold = conNA + rule.baseModifier
  if (rule.caseMalus) threshold -= 2 * Math.max(0, target.cases - 1)
  if (rule.periodMalus) threshold -= 2 * periodesSansSoin
  return { threshold, severity: target.severity, cases: target.cases }
}

// Handler `wound_infection_check` (interactive: true) — une échéance par PERSONNAGE et LOCALISATION (`payload.location`, Lot B1), contrairement à
// wound_healing_check garde un vrai jet (§3.3, décision Saar) : le caller (route, pas encore codée) doit avoir déjà résolu le
// jet — auto (resolvePolarisTest direct) ou joueur (DICE_ROLL/MACRO_ROLL) — et fusionné le résultat
// dans payload.rollResult avant d'appeler resolveEcheanceNow. Ce handler ne lance jamais de dé
// lui-même, il interprète un résultat déjà connu (même contrat que wound_healing_check.payload.mjChoice,
// une réponse externe déjà fournie). La cible est lue AU MOMENT du jet : la pire blessure susceptible de s'infecter de la localisation.
export async function woundInfectionCheckHandler(trx, echeance, context = {}) {
  const trace = context.trace ?? null
  const { location } = echeance.payload
  const sheet = await trx('char_sheet').where({ character_id: echeance.character_id }).first('id')
  const target = sheet ? await loadInfectionTarget(trx, sheet.id, location) : null
  if (!target) {
    trace?.(`infection ${location} : plus aucune blessure susceptible de s'infecter — l'échéance se termine sans jet`)
    return { resolved: true, reschedule: null, spawn: [], undoEntries: [] }
  }

  const { rollResult } = echeance.payload
  if (!rollResult) return { resolved: false } // attend un jet (auto ou joueur)

  const rule = WOUND_INFECTION[target.severity]
  const { isSuccess } = rollResult
  const undoEntries = []

  const infects = !isSuccess || rule.infectsOnSuccess
  if (trace) {
    const critical = rollResult.isCriticalFail ? ' (échec critique)' : (rollResult.isCriticalSuccess ? ' (réussite critique)' : '')
    trace(`infection ${location} — pire blessure susceptible : ${target.severity} (${target.cases} case(s) sur sa ligne), période sans soin n°${(echeance.payload.periodesSansSoin ?? 0) + 1} — jet ${rollResult.roll} contre seuil ${rollResult.threshold} : ${isSuccess ? 'réussite' : 'échec'}${critical}`)
  }
  // Une case supplémentaire seulement quand le RAW la prévoit (WOUND_INFECTION.extraCase) : jamais pour Mortelle.
  if (infects && rule.extraCase) {
    // La case d'infection est cochée sur la ligne de la pire blessure et guérit comme toute autre case : elle naît avec sa propre échéance de guérison. Si la
    // ligne déborde (règle des cases), la cascade fusionne des cases et annule leurs échéances de guérison ; l'infection de la localisation, elle, continue
    // tant qu'une blessure susceptible de s'infecter subsiste (la case du dessus en est une) — celle que le moteur résout n'est de toute façon jamais annulée.
    const insertion = await resolveWoundInsertion(
      trx, sheet.id, location, target.severity,
      { campaignId: echeance.campaign_id, characterId: echeance.character_id },
      { exceptEcheanceId: echeance.id },
    )
    undoEntries.push(...buildWoundInsertionUndoEntries(insertion))
    trace?.(`→ infection : une case supplémentaire naît (${insertion.wound?.location}/${insertion.wound?.severity}, case ${shortId(insertion.wound?.id)}, échéance ${shortId(insertion.echeance?.id)})${insertion.promoted ? ' ; la ligne était pleine : promotion en cascade' : ''}`)
  } else {
    trace?.(infects ? "→ infection sans case supplémentaire (la règle n'en prévoit pas pour cette gravité)" : "→ pas d'infection")
  }

  // Mortelle/Membre détruit (§3.3, `survivalHours`) : délai de survie affiché au MJ, jamais appliqué automatiquement
  // (docs/PLAN_BLESSURES_GUERISON.md §8 point 1, confirmé) — la mort reste narrative, à la charge du MJ (elle
  // peut être matérialisée par le statut `dead`, ci-dessous). Une Mort (Tête/Corps) n'a ni guérison ni infection.
  let survivalHoursInfo = null
  if (rule.survivalHours) {
    const conNA = await computeConstitutionNA(trx, sheet.id)
    survivalHoursInfo = { hours: isSuccess ? conNA : Math.floor(conNA / 2), onSuccess: isSuccess }
  }

  // previousValues capturé par l'engine lui-même pour la ligne game_echeances (voir
  // echeanceService.js resolveEcheanceHandler) — ici on ne fait que faire évoluer le payload pour
  // la prochaine occurrence, écrit directement (même savepoint que le reste du handler).
  const periodesSansSoin = (echeance.payload.periodesSansSoin ?? 0) + 1
  await trx('game_echeances').where({ id: echeance.id }).update({
    payload: { ...echeance.payload, periodesSansSoin, rollResult: null },
  })

  // Plus aucune blessure susceptible de s'infecter (une cascade jusqu'à une Mort en Tête/Corps) : l'infection se termine au lieu de se reprogrammer sans cible.
  const stillInfectable = await loadInfectionTarget(trx, sheet.id, location)
  const reschedule = stillInfectable ? buildRecurringReschedule(echeance) : null

  return {
    resolved: true,
    effects: { isSuccess, infected: infects, survivalHoursInfo },
    reschedule,
    spawn: [],
    undoEntries,
  }
}
