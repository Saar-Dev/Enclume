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

// Récursif — résout la promotion en cascade dans une transaction knex.
export async function resolveWoundInsertion(trx, char_sheet_id, location, severity) {
  const maxCount = WOUND_MAX_COUNTS[location]?.[severity]
  if (!maxCount) throw new AppError(400, `Gravité "${severity}" invalide pour "${location}"`)

  const { count } = await trx('character_wounds')
    .where({ char_sheet_id, location, severity })
    .count('* as count')
    .first()

  const currentCount = parseInt(count)
  const next = nextSeverity(severity)

  if (next && currentCount >= maxCount - 1) {
    await trx('character_wounds').where({ char_sheet_id, location, severity }).del()
    const result = await resolveWoundInsertion(trx, char_sheet_id, location, next)
    return { ...result, promoted: true }
  }

  if (currentCount >= maxCount) {
    throw new AppError(400, 'Ligne pleine — gravité maximale atteinte pour cette localisation')
  }

  const [wound] = await trx('character_wounds')
    .insert({ char_sheet_id, location, severity, is_stabilized: false })
    .returning('*')
  return { wound, promoted: false }
}

export async function getWorstWoundSeverity(db, charSheetId) {
  const ORDER = WOUND_SEVERITIES.slice().reverse()
  const wounds = await db('character_wounds').where({ char_sheet_id: charSheetId }).select('severity')
  if (!wounds.length) return null
  wounds.sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity))
  return wounds[0].severity
}
