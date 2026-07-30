// server/src/lib/woundReviewService.js — Enrichissement des échéances Blessures pour un écran
// humain (docs/PLAN_BLESSURES_GUERISON.md §6.1). Le Lot 2 générique (`echeanceService.js`) reste
// agnostique du métier — `payload` n'y est qu'un identifiant opaque (`{ woundId }`). Cet
// enrichissement (jointure vers character_wounds/characters) est une responsabilité du domaine
// Blessures, jamais celle du moteur générique. Lecture seule via `db` (comme `previewDueEcheances`,
// même raison : hors transaction, jamais utilisée pour une décision serveur).
import db from '../db/knex.js'
import { WS } from '../../../shared/events.js'
import { getWorstWoundSeverity } from './woundUtils.js'

const WOUND_CONDITION_TYPES = ['wound_healing_check', 'wound_infection_check']

async function enrichWoundEcheances(rows) {
  if (!rows.length) return []

  const woundIds = [...new Set(rows.map(r => r.payload?.woundId).filter(Boolean))]
  const wounds = woundIds.length ? await db('character_wounds').whereIn('id', woundIds) : []
  const woundsById = Object.fromEntries(wounds.map(w => [w.id, w]))

  const characterIds = [...new Set(rows.map(r => r.character_id))]
  const characters = characterIds.length ? await db('characters').whereIn('id', characterIds) : []
  const charactersById = Object.fromEntries(characters.map(c => [c.id, c]))

  return rows.map(r => {
    const wound = woundsById[r.payload?.woundId] ?? null
    const character = charactersById[r.character_id] ?? null
    return {
      id: r.id,
      conditionType: r.condition_type,
      status: r.status,
      payload: r.payload,
      nextDueMinutes: r.next_due_minutes,
      intervalMinutes: r.interval_minutes,
      occurrencesRemaining: r.occurrences_remaining,
      characterId: r.character_id,
      characterName: character?.name ?? null,
      wound: wound ? {
        id: wound.id, location: wound.location, severity: wound.severity, isStabilized: wound.is_stabilized,
      } : null,
    }
  })
}

// Écran de revue MJ (§6) — pending_mj_review ET awaiting_player_roll (le MJ voit tout le lot, même
// les lignes en attente d'un jet joueur, pour suivre l'avancement — seul le joueur peut agir dessus).
export async function getPendingReviewForGm(campaignId) {
  const rows = await db('game_echeances')
    .where({ campaign_id: campaignId })
    .whereIn('condition_type', WOUND_CONDITION_TYPES)
    .whereIn('status', ['pending_mj_review', 'awaiting_player_roll'])
    .select('*')
  return enrichWoundEcheances(rows)
}

// Panneau joueur "Jets en attente" (§6) — uniquement les échéances awaiting_player_roll dont le
// personnage appartient à l'appelant. `isGm` : un MJ voit tous les jets en attente de la campagne
// (utile pour relancer/suivre pour le compte d'un PNJ ou un joueur absent).
export async function getPendingRollsForPlayer(campaignId, userId, { isGm = false } = {}) {
  let query = db('game_echeances')
    .join('characters', 'characters.id', 'game_echeances.character_id')
    .where({ 'game_echeances.campaign_id': campaignId, 'game_echeances.status': 'awaiting_player_roll' })
    .where({ 'game_echeances.condition_type': 'wound_infection_check' })

  if (!isGm) query = query.where({ 'characters.user_id': userId })

  const rows = await query.select('game_echeances.*')
  return enrichWoundEcheances(rows)
}

// Diffuse WOUND_UPDATED (événement déjà existant, `shared/events.js:64`, consommateur client déjà
// générique — voir docs/PLAN_BLESSURES_GUERISON.md §6.1) après la résolution d'une échéance
// Guérison/Infection. `charSheetIdForWorst` : capturé par l'appelant *avant* la résolution (une
// Amélioration/Infection peut supprimer la ligne de blessure ciblée, `getWorstWoundSeverity` a
// toujours besoin d'un char_sheet_id valable même si `woundId` a disparu entre-temps).
export async function broadcastWoundUpdate(io, campaignId, { characterId, charSheetIdForWorst, woundId }) {
  const [wound, worst_wound_severity] = await Promise.all([
    db('character_wounds').where({ id: woundId }).first(),
    getWorstWoundSeverity(db, charSheetIdForWorst),
  ])
  io.to(campaignId).emit(WS.WOUND_UPDATED, { characterId, wound: wound ?? null, worst_wound_severity })
}
