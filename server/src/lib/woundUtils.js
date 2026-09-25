import { AppError } from './AppError.js'
import {
  WOUND_MAX_COUNTS, WOUND_SEVERITIES, WOUND_IMPROVEMENT_TARGET, isWoundLinePromoted, isSuddenDeathLocation,
  chanceCostOfStep, maxNormalChanceDegrees,
} from '../../../shared/woundConstants.js'
import { canSpendChance } from '../../../shared/chanceRules.js'
import { initializeWoundHealingEcheance } from './woundHealingSchedule.js'

// Test de Choc requis ? RAW : Grave (Tête/Corps), Critique, Mortelle, et Membre détruit (bras/jambe). La Mort subite
// (6ᵉ ligne en Tête/Corps) n'en fait aucun : « le personnage meurt sur le coup » (REGLEBLESSURES.md:164-167).
// Ligne pleine : la localisation est déjà au maximum de cette gravité et n'a pas de gravité supérieure (la 6ᵉ ligne
// seule, depuis que la Mortelle déborde vers elle). Erreur DÉDIÉE : les appelants la distinguent d'une vraie erreur.
export class WoundLineFullError extends AppError {
  constructor() {
    super(400, 'Ligne pleine — gravité maximale atteinte pour cette localisation')
  }
}

export function isShockTestRequired(severity, location) {
  if (severity === 'mort_subite') return !isSuddenDeathLocation(location)
  if (severity === 'critique' || severity === 'mortelle') return true
  if (severity === 'grave' && (location === 'tete' || location === 'corps')) return true
  return false
}

// Clause SQL `CASE <colonne> … END` qui classe une gravité de la plus grave (1) à la plus légère : GÉNÉRÉE depuis
// WOUND_SEVERITIES, l'autorité de l'ordre (une gravité ajoutée à la liste est classée sans toucher au SQL).
// `column` est un identifiant écrit dans le code appelant, jamais une entrée utilisateur.
export function woundSeverityRankSql(column) {
  const whens = WOUND_SEVERITIES.slice().reverse().map((severity, index) => `WHEN '${severity}' THEN ${index + 1}`).join(' ')
  return `CASE ${column} ${whens} END`
}

export function nextSeverity(severity) {
  const idx = WOUND_SEVERITIES.indexOf(severity)
  return idx < WOUND_SEVERITIES.length - 1 ? WOUND_SEVERITIES[idx + 1] : null
}

export function previousSeverity(severity) {
  const idx = WOUND_SEVERITIES.indexOf(severity)
  return idx > 0 ? WOUND_SEVERITIES[idx - 1] : null
}

// Gravité qu'une blessure devient quand elle s'AMÉLIORE d'un cran (guérison) : la gravité juste en dessous, sauf la 6ᵉ
// ligne — un Membre détruit (ou une Mort rachetée) devient une Critique, pas une Mortelle (WOUND_IMPROVEMENT_TARGET).
// `previousSeverity` reste l'inverse mécanique de la promotion (`nextSeverity`) ; ce n'est PAS la cible d'une guérison.
export function improvedSeverity(severity) {
  return WOUND_IMPROVEMENT_TARGET[severity] ?? previousSeverity(severity)
}

// campaigns.game_time_resolved_minutes, jamais game_time_minutes (affiché) — voir
// docs/PLAN_BLESSURES_GUERISON.md §4, autorité unique du repère mécanique.
async function getResolvedGameMinutes(trx, char_sheet_id) {
  const row = await trx('char_sheet')
    .join('characters', 'characters.id', 'char_sheet.character_id')
    .join('campaigns', 'campaigns.id', 'characters.campaign_id')
    .where('char_sheet.id', char_sheet_id)
    .select('campaigns.game_time_resolved_minutes')
    .first()
  return row?.game_time_resolved_minutes ?? 0
}

// `schedule` = { campaignId, characterId } : l'identité sous laquelle l'échéance de guérison d'une case écrite est programmée.
// Obligatoire pour toute écriture de blessure (insertion, promotion, amélioration, infection) : un appelant qui l'oublie échoue
// tout de suite, il n'écrit jamais une case sans échéance.
function requireSchedule(schedule) {
  if (!schedule) throw new Error('woundUtils : contexte de programmation { campaignId, characterId } obligatoire pour écrire une blessure')
}

// SEUL écrivain de lignes `character_wounds` : chaque case qui doit guérir naît AVEC son échéance de guérison, dans la même
// transaction (WOUND-HEAL-CHAIN-STOPS : une case écrite sans échéance ne guérit jamais). L'invariant tient ici, pas à la
// discipline des appelants — insertion d'un coup, cascade de promotion, amélioration (guérison ou Chance), case d'infection.
// `occurredAtGameMinutes` : départ de la durée de guérison ; à défaut, le repère mécanique de la campagne.
async function insertWoundRow(trx, { char_sheet_id, location, severity, is_stabilized = false, occurredAtGameMinutes }, schedule) {
  const occurredAt = occurredAtGameMinutes ?? await getResolvedGameMinutes(trx, char_sheet_id)
  const [wound] = await trx('character_wounds')
    .insert({ char_sheet_id, location, severity, is_stabilized, occurred_at_game_minutes: occurredAt })
    .returning('*')
  const echeance = await initializeWoundHealingEcheance(trx, {
    campaignId: schedule.campaignId, characterId: schedule.characterId, wound,
  })
  return { wound, echeance }
}

// undoEntry générique de la ligne d'échéance créée avec une case (voir buildWoundInsertionUndoEntries).
function echeanceUndoEntries(echeance) {
  return echeance ? [{ table: 'game_echeances', rowId: echeance.id, previousValues: null }] : []
}

// Récursif — résout la promotion en cascade dans une transaction knex. `deletedWounds` accumule les
// lignes supprimées par la cascade (vide si aucune promotion) — nécessaire aux appelants qui doivent
// construire des undoEntries génériques { table, rowId, previousValues } (Lot 2, ex.
// wound_infection_check) sur une insertion qui peut être un mélange delete+insert, pas juste un insert.
// Retourne aussi `echeance` : l'échéance de guérison de la case finale (null si elle guérit seule ou ne guérit pas).
export async function resolveWoundInsertion(trx, char_sheet_id, location, severity, schedule) {
  requireSchedule(schedule)
  const maxCount = WOUND_MAX_COUNTS[location]?.[severity]
  if (!maxCount) throw new AppError(400, `Gravité "${severity}" invalide pour "${location}"`)

  const existingRows = await trx('character_wounds')
    .where({ char_sheet_id, location, severity })
    .select('*')

  const currentCount = existingRows.length
  const next = nextSeverity(severity)

  // Règle de promotion : shared/woundConstants.js:isWoundLinePromoted (Mortelle : au dépassement seulement).
  if (next && isWoundLinePromoted(severity, currentCount, maxCount)) {
    await trx('character_wounds').where({ char_sheet_id, location, severity }).del()
    const result = await resolveWoundInsertion(trx, char_sheet_id, location, next, schedule)
    return { ...result, promoted: true, deletedWounds: [...existingRows, ...result.deletedWounds] }
  }

  if (currentCount >= maxCount) {
    throw new WoundLineFullError()
  }

  const { wound, echeance } = await insertWoundRow(trx, { char_sheet_id, location, severity }, schedule)
  return { wound, echeance, promoted: false, deletedWounds: [] }
}

// undoEntries génériques { table, rowId, previousValues } pour un résultat de resolveWoundInsertion —
// une entrée par ligne supprimée par la cascade (previousValues = son contenu) + une pour la ligne
// insérée (previousValues: null) + une pour l'échéance de guérison créée avec elle (previousValues: null).
// Convention Lot 2, docs/PLAN_FATIGUE_DOMMAGES.md §8.
export function buildWoundInsertionUndoEntries(insertionResult) {
  return [
    ...insertionResult.deletedWounds.map(w => ({ table: 'character_wounds', rowId: w.id, previousValues: w })),
    { table: 'character_wounds', rowId: insertionResult.wound.id, previousValues: null },
    ...echeanceUndoEntries(insertionResult.echeance),
  ]
}

// Même convention pour un résultat de resolveWoundImprovement : la case d'origine supprimée (previousValues = son contenu),
// la case obtenue (previousValues: null) si elle existe, et son échéance de guérison (previousValues: null) si elle en a une.
export function buildWoundImprovementUndoEntries(originalWound, improvementResult) {
  return [
    { table: 'character_wounds', rowId: originalWound.id, previousValues: originalWound },
    ...(improvementResult.wound ? [{ table: 'character_wounds', rowId: improvementResult.wound.id, previousValues: null }] : []),
    ...echeanceUndoEntries(improvementResult.echeance),
  ]
}

// Inverse de resolveWoundInsertion — ne cascade jamais (RAW : la guérison diminue la gravité d'un
// seul niveau par échéance, jamais plusieurs d'un coup). Supprime la case ; si une gravité inférieure
// existe, insère une case fraîche à ce niveau (sa propre durée de guérison recommence à zéro, elle
// ne reprend pas celle de la case d'origine) AVEC son échéance de guérison ; sinon (Légère) la case
// disparaît simplement, la blessure est guérie.
// `steps` : nombre de crans d'un seul coup (la Chance en fait jusqu'à 2, ou plus avec l'exception « palier plein ») — UNE
// SEULE case est écrite, à la gravité d'arrivée, jamais une case intermédiaire et son échéance aussitôt supprimées.
// `occurredAtGameMinutes` : départ de la durée de guérison de la case obtenue. La guérison le fixe au jour d'échéance de la
// case qui vient de guérir (`echeance.next_due_minutes`) : le repère mécanique de la campagne, lui, n'avance qu'à la
// confirmation de l'avance de temps — la case naîtrait datée AVANT le jour où elle est réellement devenue plus légère.
// Défaut : le repère mécanique courant (la Chance, qui s'exerce « maintenant »).
export async function resolveWoundImprovement(trx, woundId, schedule, { steps = 1, occurredAtGameMinutes } = {}) {
  requireSchedule(schedule)
  if (!Number.isInteger(steps) || steps < 1) throw new Error(`resolveWoundImprovement : steps doit être un entier ≥ 1 (reçu ${steps})`)

  const wound = await trx('character_wounds').where({ id: woundId }).first()
  if (!wound) throw new AppError(404, `Blessure "${woundId}" introuvable`)

  await trx('character_wounds').where({ id: woundId }).del()

  let targetSeverity = wound.severity
  for (let step = 0; step < steps && targetSeverity; step += 1) targetSeverity = improvedSeverity(targetSeverity)
  if (!targetSeverity) return { wound: null, echeance: null, healed: true }

  const { wound: newWound, echeance } = await insertWoundRow(trx, {
    char_sheet_id: wound.char_sheet_id,
    location: wound.location,
    severity: targetSeverity,
    is_stabilized: wound.is_stabilized,
    occurredAtGameMinutes,
  }, schedule)
  return { wound: newWound, echeance, healed: false }
}

// hasSeverityRoom — vrai si ce palier a encore une case libre pour cette localisation (même règle
// que resolveWoundInsertion, jamais dupliquée : `currentCount < maxCount`). Exportée : la réponse à un choix de Chance
// REVÉRIFIE la place du palier visé (l'état a pu changer pendant les secondes d'attente).
export async function hasSeverityRoom(dbOrTrx, charSheetId, location, severity) {
  const maxCount = WOUND_MAX_COUNTS[location]?.[severity]
  if (maxCount == null) return false
  const [{ count }] = await dbOrTrx('character_wounds')
    .where({ char_sheet_id: charSheetId, location, severity })
    .count('* as count')
  return Number(count) < maxCount
}

// computeAvailableSeverityReductions — pour la réduction de gravité par dépense de Chance
// (docs/PLANS/PLAN_CHANCE.md L5, REGLE_CHANCE.md:112-131). Calcule les degrés de réduction qui
// aboutissent RÉELLEMENT à un palier disponible pour cette blessure — jamais un degré qui ferait
// dépenser des points de Chance pour atterrir sur un palier déjà plein (resolveWoundImprovement ne
// vérifie pas la capacité, cf. son commentaire : c'est à l'appelant de le faire en amont).
//
// Un « degré » est un CRAN de réduction (`improvedSeverity` : la gravité juste en dessous, sauf la 6ᵉ ligne qui redescend
// en Critique) ; son COÛT en points de Chance est distinct (`chanceCostOfStep` : 1 par cran, 3 pour quitter la 6ᵉ ligne —
// décision Saar 2026-09-23). Deux étapes RAW :
// 1. Les degrés normaux (`maxNormalChanceDegrees` : 2, REGLE_CHANCE.md:117-119 ; 1 seul pour la 6ᵉ ligne) — retenus
//    seulement s'ils aboutissent chacun à un palier avec de la place.
// 2. Exception du « palier plein » (REGLE_CHANCE.md:125-131) : si aucun degré normal n'aboutit à un palier disponible, il
//    faut continuer à descendre — un SEUL palier est alors proposé (le premier disponible), jamais la liste des paliers
//    intermédiaires encore pleins ; le coût est cumulé cran par cran.
//
// Retourne un tableau (0 à 2 entrées) `{ degree, cost, targetSeverity }` — `degree` = nombre de crans, `cost` = points de
// Chance —, jamais un `degree` hors norme sauf si l'exception s'applique (alors une seule entrée). N'examine PAS la
// réserve de Chance du personnage : voir `affordableReductions`.
export async function computeAvailableSeverityReductions(dbOrTrx, charSheetId, location, severity) {
  const normal = []
  let candidate = severity
  let cost = 0
  for (let degree = 1; degree <= maxNormalChanceDegrees(severity); degree += 1) {
    cost += chanceCostOfStep(candidate)
    candidate = improvedSeverity(candidate)
    if (!candidate) break
    if (await hasSeverityRoom(dbOrTrx, charSheetId, location, candidate)) {
      normal.push({ degree, cost, targetSeverity: candidate })
    }
  }
  if (normal.length > 0) return normal

  candidate = severity
  cost = 0
  for (let degree = 1; degree <= WOUND_SEVERITIES.length; degree += 1) {
    cost += chanceCostOfStep(candidate)
    candidate = improvedSeverity(candidate)
    if (!candidate) return [] // plus rien sous Légère et toujours plein — réduction impossible
    if (await hasSeverityRoom(dbOrTrx, charSheetId, location, candidate)) {
      return [{ degree, cost, targetSeverity: candidate }]
    }
  }
  return []
}

// affordableReductions — ne garde que les réductions que la réserve de Chance permet de payer (RAW : il doit en rester 3,
// `shared/chanceRules.js`). Pure : la lecture de `chc` est à l'appelant. Sert à décider s'il y a QUELQUE CHOSE à proposer
// avant d'ouvrir une réaction — une carte dont aucune option n'est payable ne s'ouvre jamais.
export function affordableReductions(reductions, chc) {
  return reductions.filter(reduction => canSpendChance(chc, reduction.cost))
}

export async function getWorstWoundSeverity(db, charSheetId) {
  const ORDER = WOUND_SEVERITIES.slice().reverse()
  const wounds = await db('character_wounds').where({ char_sheet_id: charSheetId }).select('severity')
  if (!wounds.length) return null
  wounds.sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity))
  return wounds[0].severity
}
