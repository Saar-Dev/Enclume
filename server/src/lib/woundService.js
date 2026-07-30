import { resolveWoundInsertion, isShockTestRequired, getWorstWoundSeverity } from './woundUtils.js'
import { initializeWoundHealingEcheance } from './woundEvolutionService.js'
import { WS } from '../../../shared/events.js'

// Centralise l'insertion de blessure + broadcast WOUND_ADDED (6 call sites WS → 1).
// Retourne { finalSeverity, wound, promoted, shock_test_required, worst_wound_severity } — finalSeverity
// (post-promotion, P49) pour que le caller puisse appeler resolveShockTest, le reste pour les callers
// qui ont besoin de la blessure complète (ex. réponse HTTP d'une route d'ajout manuel).
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
    result = await db.transaction(async (trx) => {
      const insertion = await resolveWoundInsertion(trx, charSheetId, localisation, severity)
      // Guérison/Infection (Lot 2, docs/PLAN_BLESSURES_GUERISON.md §5) — sur la blessure finale
      // (post-promotion) uniquement ; les échéances d'éventuelles cases supprimées par la cascade
      // de promotion se terminent d'elles-mêmes sans effet (woundId introuvable, voir
      // woundEvolutionService.js).
      await initializeWoundHealingEcheance(trx, { campaignId, characterId, wound: insertion.wound })
      return insertion
    })
  } catch (err) {
    console.error('[woundService] applyWound — insertion échouée :', charSheetId, localisation, severity, err.message)
    return null
  }

  const finalSeverity = result.wound.severity  // P49 : post-promotion
  const worst_wound_severity = await getWorstWoundSeverity(db, charSheetId)
  const shock_test_required = isShockTestRequired(finalSeverity, result.wound.location)

  io.to(campaignId).emit(WS.WOUND_ADDED, {
    characterId,
    wound:    result.wound,
    promoted: result.promoted,
    shock_test_required,
    worst_wound_severity,
  })

  return {
    finalSeverity, worst_wound_severity, shock_test_required,
    wound: result.wound, promoted: result.promoted,
  }
}
