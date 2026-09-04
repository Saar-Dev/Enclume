import { WS } from '../../../shared/events.js'
import db from '../db/knex.js'

export function registerBattlemapHandlers(io, socket, { campaignId, user, isGm }) {
  // ─── MAP:SWITCH ────────────────────────────────────────────────────────
  // GM déplace le groupe vers une autre carte (useBattlemapManager.js, handleGroupMove). Le GM a déjà
  // rafraîchi sa propre vue via un GET REST direct (handleMapSwitch) — ce relai ne concerne que les
  // AUTRES membres de la campagne (patron WORLD_RUNTIME_UPDATED, docs/SYSTEME/EDITEUR.md §7.1).
  // Payload : { battlemapId, userIds } — userIds vide = tout le monde (filtré côté client,
  // useEntitySocket.js:onMapSwitch).
  // Ticket bug_tickets/AUDIT-SYSTEME : ce handler serveur avait été supprimé (commit d0ee0af) et
  // jamais recréé — le client émettait dans le vide, les joueurs ne suivaient jamais le GM.
  socket.on(WS.MAP_SWITCH, async ({ battlemapId, userIds = [] }) => {
    try {
      if (!isGm) return

      const battlemap = await db('battlemaps').where({ id: battlemapId }).first()
      if (!battlemap || battlemap.campaign_id !== campaignId) return

      // docs/PLANS/PLAN_CHAT_COMMANDES.md §4 — jusqu'ici ce relais ne persistait jamais « quelle est
      // la carte actuelle » (stateless). current_battlemap_id (migration 324) le rend durable, premier
      // consommateur : /heal (portée « carte active »).
      await db('campaigns').where({ id: campaignId }).update({ current_battlemap_id: battlemapId })

      socket.to(campaignId).emit(WS.MAP_SWITCH, { battlemapId, userIds })
    } catch (err) {
      console.error('[WS] map:switch error:', err.message)
    }
  })
}
