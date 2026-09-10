// server/src/lib/equipmentRepairReviewService.js — enrichissement des échéances `equipment_repair`
// pour les écrans humains (docs/PLANS/PLAN_USURE&INTEGRITE.md §8, L6). Parallèle à
// `woundReviewService.js` : chaque domaine enrichit ses propres échéances, le moteur générique
// (`echeanceService.js`) reste agnostique (`payload` = identifiant opaque). Lecture seule via `db`.
//
// `equipment_repair` n'est PAS pilotée par l'horloge (`advance_driven: false`) : contrairement aux
// blessures, aucune notion d'échéance « déjà due mais pas encore en revue » — la demande naît
// directement `pending_mj_review`. La requête est donc plus simple (statut seul, pas d'union avec
// `game_time_resolved_minutes`).

import db from '../db/knex.js'

// Enrichit un lot de lignes `game_echeances` (condition_type = 'equipment_repair') avec le nom du
// personnage, l'objet (nom + ITG FRAÎCHE — le payload ne porte qu'un instantané de la demande) et la
// compétence de réparation retenue.
async function enrichRepairEcheances(rows) {
  if (!rows.length) return []

  const itemIds = [...new Set(rows.map((r) => r.payload?.itemId).filter(Boolean))]
  const items = itemIds.length
    ? await db('char_inventory')
      .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
      .whereIn('char_inventory.id', itemIds)
      .select(
        'char_inventory.id', 'char_inventory.integrity_current', 'char_inventory.integrity_max',
        'char_inventory.malfunction_severity', 'char_inventory.custom_name', 'ref_equipment.name as ref_name',
      )
    : []
  const itemsById = Object.fromEntries(items.map((i) => [i.id, i]))

  const characterIds = [...new Set(rows.map((r) => r.character_id))]
  const characters = characterIds.length ? await db('characters').whereIn('id', characterIds) : []
  const charactersById = Object.fromEntries(characters.map((c) => [c.id, c]))

  const skillIds = [...new Set(rows.map((r) => r.payload?.skillId).filter(Boolean))]
  const skills = skillIds.length ? await db('ref_skills').whereIn('id', skillIds).select('id', 'label') : []
  const skillLabelById = Object.fromEntries(skills.map((s) => [s.id, s.label]))

  return rows.map((r) => {
    const item = itemsById[r.payload?.itemId] ?? null
    return {
      id: r.id,
      conditionType: r.condition_type,
      status: r.status,
      payload: r.payload,
      characterId: r.character_id,
      characterName: charactersById[r.character_id]?.name ?? null,
      item: item
        ? {
          id: item.id,
          name: item.custom_name || item.ref_name || r.payload?.itemName || 'Objet',
          integrityCurrent: item.integrity_current,
          integrityMax: item.integrity_max,
          malfunctionSeverity: item.malfunction_severity,
        }
        : { id: r.payload?.itemId ?? null, name: r.payload?.itemName ?? 'Objet (retiré)', integrityCurrent: null, integrityMax: null, malfunctionSeverity: null },
      suggestedSkillId: r.payload?.skillId ?? null,
      suggestedSkillLabel: skillLabelById[r.payload?.skillId] ?? r.payload?.skillId ?? null,
      ntMalus: r.payload?.ntMalus ?? 0,
    }
  })
}

// Boîte de réception MJ des demandes de réparation (§8.2, étape 2). `pending_mj_review` ET
// `awaiting_player_roll` : le MJ garde une vue sur les demandes qu'il a approuvées et qui attendent
// le jet du joueur (même principe que `getPendingReviewForGm` pour les blessures).
export async function getRepairRequestsForGm(campaignId) {
  const rows = await db('game_echeances')
    .where({ campaign_id: campaignId, condition_type: 'equipment_repair' })
    .whereIn('status', ['pending_mj_review', 'awaiting_player_roll'])
    .select('*')
  return enrichRepairEcheances(rows)
}

// Jets de réparation en attente pour un joueur (panneau « Jets en attente »). `awaiting_player_roll`
// seulement. `isGm` : le MJ voit tous les jets en attente de la campagne (relancer pour un absent).
// Renvoyé à côté des jets de blessure par la route `my-pending-rolls` (chaque domaine sa requête).
export async function getRepairRollsForPlayer(campaignId, userId, { isGm = false } = {}) {
  let query = db('game_echeances')
    .join('characters', 'characters.id', 'game_echeances.character_id')
    .where({
      'game_echeances.campaign_id': campaignId,
      'game_echeances.condition_type': 'equipment_repair',
      'game_echeances.status': 'awaiting_player_roll',
    })
  if (!isGm) query = query.where({ 'characters.user_id': userId })
  const rows = await query.select('game_echeances.*')
  return enrichRepairEcheances(rows)
}
