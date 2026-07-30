import { AppError } from './AppError.js'
import { WOUND_MAX_COUNTS, WOUND_SEVERITIES } from '../../../shared/woundConstants.js'

export function isShockTestRequired(severity, location) {
  if (severity === 'critique' || severity === 'mortelle') return true
  if (severity === 'grave' && (location === 'tete' || location === 'corps')) return true
  return false
}

export function nextSeverity(severity) {
  const idx = WOUND_SEVERITIES.indexOf(severity)
  return idx < WOUND_SEVERITIES.length - 1 ? WOUND_SEVERITIES[idx + 1] : null
}

export function previousSeverity(severity) {
  const idx = WOUND_SEVERITIES.indexOf(severity)
  return idx > 0 ? WOUND_SEVERITIES[idx - 1] : null
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

  if (next && currentCount >= maxCount - 1) {
    await trx('character_wounds').where({ char_sheet_id, location, severity }).del()
    const result = await resolveWoundInsertion(trx, char_sheet_id, location, next)
    return { ...result, promoted: true, deletedWounds: [...existingRows, ...result.deletedWounds] }
  }

  if (currentCount >= maxCount) {
    throw new AppError(400, 'Ligne pleine — gravité maximale atteinte pour cette localisation')
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

  const prev = previousSeverity(wound.severity)
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

export async function getWorstWoundSeverity(db, charSheetId) {
  const ORDER = WOUND_SEVERITIES.slice().reverse()
  const wounds = await db('character_wounds').where({ char_sheet_id: charSheetId }).select('severity')
  if (!wounds.length) return null
  wounds.sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity))
  return wounds[0].severity
}
