import { AppError } from './AppError.js'
import {
  WOUND_MAX_COUNTS, WOUND_SEVERITIES, WOUND_IMPROVEMENT_TARGET, isWoundLinePromoted, isSuddenDeathLocation,
  chanceCostOfStep, maxNormalChanceDegrees,
} from '../../../shared/woundConstants.js'
import { canSpendChance } from '../../../shared/chanceRules.js'

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

// Récursif — résout la promotion en cascade dans une transaction knex. `deletedWounds` accumule les
// lignes supprimées par la cascade (vide si aucune promotion) — nécessaire aux appelants qui doivent
// construire des undoEntries génériques { table, rowId, previousValues } (Lot 2, ex.
// wound_infection_check) sur une insertion qui peut être un mélange delete+insert, pas juste un insert.
export async function resolveWoundInsertion(trx, char_sheet_id, location, severity) {
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
    const result = await resolveWoundInsertion(trx, char_sheet_id, location, next)
    return { ...result, promoted: true, deletedWounds: [...existingRows, ...result.deletedWounds] }
  }

  if (currentCount >= maxCount) {
    throw new WoundLineFullError()
  }

  const occurredAtGameMinutes = await getResolvedGameMinutes(trx, char_sheet_id)
  const [wound] = await trx('character_wounds')
    .insert({
      char_sheet_id, location, severity, is_stabilized: false,
      occurred_at_game_minutes: occurredAtGameMinutes,
    })
    .returning('*')
  return { wound, promoted: false, deletedWounds: [] }
}

// undoEntries génériques { table, rowId, previousValues } pour un résultat de resolveWoundInsertion —
// une entrée par ligne supprimée par la cascade (previousValues = son contenu) + une pour la ligne
// insérée (previousValues: null). Convention Lot 2, docs/PLAN_FATIGUE_DOMMAGES.md §8.
export function buildWoundInsertionUndoEntries(insertionResult) {
  return [
    ...insertionResult.deletedWounds.map(w => ({ table: 'character_wounds', rowId: w.id, previousValues: w })),
    { table: 'character_wounds', rowId: insertionResult.wound.id, previousValues: null },
  ]
}

// Inverse de resolveWoundInsertion — ne cascade jamais (RAW : la guérison diminue la gravité d'un
// seul niveau par échéance, jamais plusieurs d'un coup). Supprime la case ; si une gravité inférieure
// existe, insère une case fraîche à ce niveau (nouvel horodatage — sa propre durée de guérison
// recommence à zéro à partir de maintenant, elle ne reprend pas celle de la case d'origine) ; sinon
// (Légère) la case disparaît simplement, la blessure est guérie.
export async function resolveWoundImprovement(trx, woundId) {
  const wound = await trx('character_wounds').where({ id: woundId }).first()
  if (!wound) throw new AppError(404, `Blessure "${woundId}" introuvable`)

  await trx('character_wounds').where({ id: woundId }).del()

  const prev = improvedSeverity(wound.severity)
  if (!prev) return { wound: null, healed: true }

  const occurredAtGameMinutes = await getResolvedGameMinutes(trx, wound.char_sheet_id)
  const [newWound] = await trx('character_wounds')
    .insert({
      char_sheet_id: wound.char_sheet_id,
      location: wound.location,
      severity: prev,
      is_stabilized: wound.is_stabilized,
      occurred_at_game_minutes: occurredAtGameMinutes,
    })
    .returning('*')
  return { wound: newWound, healed: false }
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
