import db from '../db/knex.js'
import { AppError } from './AppError.js'

// docs/PLAN_FATIGUE_DOMMAGES.md §7 (Lot 1) — mutateur unique de l'horloge de campagne.
// game_time_minutes = compteur affiché/narratif, déplaçable dans les deux sens par le MJ.
// game_time_resolved_minutes = repère mécanique, strictement non-décroissant (GREATEST), jamais
// affiché — c'est resolvedBefore/resolvedAfter que le futur balayage du Lot 2 consomme, jamais
// displayed*. Un recul (deltaMinutes < 0) ou une avance qui reste sous resolved déjà atteint laisse
// resolved inchangé -> aucun effet mécanique, aucune double résolution (analyse à charge point 8).
export async function adjustGameTime(campaignId, deltaMinutes) {
  if (!Number.isInteger(deltaMinutes) || deltaMinutes === 0) {
    throw new AppError(400, 'deltaMinutes doit être un entier signé non nul')
  }

  return db.transaction(async (trx) => {
    const campaign = await trx('campaigns').where({ id: campaignId }).forUpdate().first()
    if (!campaign) throw new AppError(404, 'Campaign not found')

    const displayedBefore = campaign.game_time_minutes
    const resolvedBefore = campaign.game_time_resolved_minutes

    const displayedAfter = displayedBefore + deltaMinutes
    const resolvedAfter = Math.max(resolvedBefore, displayedAfter)

    await trx('campaigns').where({ id: campaignId }).update({
      game_time_minutes: displayedAfter,
      game_time_resolved_minutes: resolvedAfter,
    })

    return { displayedBefore, displayedAfter, resolvedBefore, resolvedAfter }
  })
}
