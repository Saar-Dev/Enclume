import { resolveWoundInsertion, isShockTestRequired, getWorstWoundSeverity } from './woundUtils.js'
import { WS } from '../../../shared/events.js'

// Centralise l'insertion de blessure + broadcast WOUND_ADDED (5 call sites WS → 1).
// Retourne { finalSeverity } (post-promotion, P49) pour que le caller puisse appeler resolveShockTest.
// Retourne null si severity ou charSheetId absents, ou si AppError (ligne pleine — comportement normal en jeu).
export async function applyWound(io, db, campaignId, {
  charSheetId,
  characterId,
  localisation,
  severity,
}) {
  if (!severity || !charSheetId) return null

  let result
  try {
    result = await db.transaction(trx =>
      resolveWoundInsertion(trx, charSheetId, localisation, severity)
    )
  } catch (err) {
    console.error('[woundService] applyWound — insertion échouée :', charSheetId, localisation, severity, err.message)
    return null
  }

  const finalSeverity = result.wound.severity  // P49 : post-promotion
  const worst_wound_severity = await getWorstWoundSeverity(db, charSheetId)

  io.to(campaignId).emit(WS.WOUND_ADDED, {
    characterId,
    wound:              result.wound,
    promoted:           result.promoted,
    shock_test_required: isShockTestRequired(finalSeverity, result.wound.location),
    worst_wound_severity,
  })

  return { finalSeverity }
}
