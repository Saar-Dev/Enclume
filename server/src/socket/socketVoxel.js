import { WS } from '../../../shared/events.js'
import db from '../db/knex.js'
import { collisionAddVoxel, collisionRemoveVoxel } from '../lib/redis.js'

export function registerVoxelHandlers(io, socket, { campaignId, isGm }) {
  // ─── VOXEL:ADD ─────────────────────────────────────────────────────────
  // Le GM pose un voxel sur la carte (mode édition)
  // Payload : { battlemapId, x, y, z, tex, geo, r }
  socket.on(WS.VOXEL_ADD, async ({ battlemapId, x, y, z, tex, geo, r }) => {
    try {
      if (!isGm) {
        socket.emit('error', { message: 'GM only' })
        return
      }

      // Guard Bug B — battlemapId undefined si battlemap null entre deux chargements
      if (!battlemapId) return

      // Récupérer les données voxel actuelles
      const battlemap = await db('battlemaps').where({ id: battlemapId }).first()
      if (!battlemap) return

      const voxels = battlemap.voxel_data || {}

      // Ajout ou remplacement — la clé "x:y:z" garantit l'unicité par position
      const key = `${x}:${y}:${z}`
      const next = { ...voxels, [key]: { tex, geo, r } }

      await db('battlemaps')
        .where({ id: battlemapId })
        .update({ voxel_data: JSON.stringify(next) })

      // Maintenance collision map Redis
      await collisionAddVoxel(battlemapId, x, y, z)

      // Broadcaster à tous
      io.to(campaignId).emit(WS.VOXEL_ADDED, { battlemapId, x, y, z, tex, geo, r })
    } catch (err) {
      console.error('[WS] voxel:add error:', err.message)
    }
  })

  // ─── VOXEL:REMOVE ──────────────────────────────────────────────────────
  // Le GM supprime un voxel (mode édition ou destruction)
  // Payload : { battlemapId, x, y, z }
  socket.on(WS.VOXEL_REMOVE, async ({ battlemapId, x, y, z }) => {
    try {
      if (!isGm) {
        socket.emit('error', { message: 'GM only' })
        return
      }

      const battlemap = await db('battlemaps').where({ id: battlemapId }).first()
      if (!battlemap) return

      const voxels = battlemap.voxel_data || {}
      const key = `${x}:${y}:${z}`
      const next = { ...voxels }
      delete next[key]

      await db('battlemaps')
        .where({ id: battlemapId })
        .update({ voxel_data: JSON.stringify(next) })

      // Maintenance collision map Redis
      await collisionRemoveVoxel(battlemapId, x, y, z)

      io.to(campaignId).emit(WS.VOXEL_REMOVED, { battlemapId, x, y, z })
    } catch (err) {
      console.error('[WS] voxel:remove error:', err.message)
    }
  })

  // ─── VOXEL:UPDATE ─────────────────────────────────────────────────────
  // Le GM tourne un voxel déjà posé (touche R sur un bloc existant)
  // Payload : { battlemapId, x, y, z, r }
  // Pas de maintenance Redis — la position ne change pas, seule la rotation change.
  socket.on(WS.VOXEL_UPDATE, async ({ battlemapId, x, y, z, r }) => {
    try {
      if (!isGm) {
        socket.emit('error', { message: 'GM only' })
        return
      }
      if (!battlemapId) return  // Guard identique VOXEL_ADD

      const battlemap = await db('battlemaps').where({ id: battlemapId }).first()
      if (!battlemap) return

      const voxels = battlemap.voxel_data || {}
      const key = `${x}:${y}:${z}`

      // Guard race condition — voxel supprimé entre émission et réception
      if (!voxels[key]) return

      const next = { ...voxels, [key]: { ...voxels[key], r } }

      await db('battlemaps')
        .where({ id: battlemapId })
        .update({ voxel_data: JSON.stringify(next) })

      io.to(campaignId).emit(WS.VOXEL_UPDATED, { battlemapId, x, y, z, r })
    } catch (err) {
      console.error('[WS] voxel:update error:', err.message)
    }
  })

  // ─── MAP:SWITCH ────────────────────────────────────────────────────────
  // Le GM bascule un ou plusieurs joueurs vers une autre carte
  // Payload : { battlemapId, userIds } — userIds vide = tous les joueurs
  socket.on(WS.MAP_SWITCH, async ({ battlemapId, userIds = [] }) => {
    try {
      if (!isGm) {
        socket.emit('error', { message: 'GM only' })
        return
      }

      const battlemap = await db('battlemaps').where({ id: battlemapId }).first()
      if (!battlemap) return

      // Déterminer les joueurs ciblés
      let targets = userIds
      if (targets.length === 0) {
        // Tous les joueurs de la campagne
        const members = await db('campaign_members')
          .where({ campaign_id: campaignId, role: 'player' })
          .select('user_id')
        targets = members.map(m => m.user_id)
      }

      // Mettre à jour player_locations en base
      for (const userId of targets) {
        await db('player_locations')
          .insert({
            campaign_id: campaignId,
            user_id: userId,
            battlemap_id: battlemapId,
          })
          .onConflict(['campaign_id', 'user_id'])
          .merge({ battlemap_id: battlemapId, updated_at: db.fn.now() })
      }

      // Broadcaster à tous — chaque client filtre s'il est concerné
      io.to(campaignId).emit(WS.MAP_SWITCH, { battlemapId, userIds: targets })
    } catch (err) {
      console.error('[WS] map:switch error:', err.message)
    }
  })

  // ─── MAP:VIEWPORT ──────────────────────────────────────────────────────
  // Le GM partage sa position de caméra (Snap GM ou verrouillage)
  // Payload : { position, target, mode } — mode: 'snap' | 'lock' | 'free'
  socket.on(WS.MAP_VIEWPORT, ({ position, target, mode }) => {
    if (!isGm) return
    // Broadcaster aux joueurs uniquement (pas au GM lui-même)
    socket.to(campaignId).emit(WS.MAP_VIEWPORT, { position, target, mode })
  })
}
