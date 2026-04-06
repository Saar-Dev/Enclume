import { WS } from '../../../shared/events.js'
import socketAuth from './auth.js'
import db from '../db/knex.js'

const initSocket = (io) => {

  // Authentification obligatoire pour toute connexion WebSocket
  io.use(socketAuth)

  io.on('connection', (socket) => {
    console.log(`[WS] Connecté : ${socket.user.username} (${socket.id})`)

    // ─── SESSION:JOIN ──────────────────────────────────────────────────────
    // Le client rejoint la room d'une campagne
    // Payload : { campaignId }
    socket.on(WS.SESSION_JOIN, async ({ campaignId }) => {
      try {
        // Vérifier que l'utilisateur est bien membre de la campagne
        const member = await db('campaign_members')
          .where({ campaign_id: campaignId, user_id: socket.user.id })
          .first()

        if (!member) {
          socket.emit('error', { message: 'Access denied' })
          return
        }

        // Rejoindre la room Socket.io de la campagne
        socket.join(campaignId)
        socket.campaignId = campaignId
        socket.role = member.role
        // Stocker userId dans socket.data — accessible via fetchSockets() contrairement à socket.user
        socket.data.userId = socket.user.id

        // Récupérer les utilisateurs déjà dans la room (avant le join du nouvel arrivant)
        const existingSockets = await io.in(campaignId).fetchSockets()
        const onlineUserIds = existingSockets
          .map(s => s.data.userId)
          .filter(id => id && id !== socket.user.id)

        // Confirmer au client qu'il a rejoint — inclut la liste des connectés
        socket.emit(WS.SESSION_JOINED, {
          campaignId,
          userId: socket.user.id,
          username: socket.user.username,
          role: member.role,
          onlineUserIds,
        })

        // Annoncer aux autres membres que quelqu'un a rejoint
        socket.to(campaignId).emit(WS.SESSION_USER_JOINED, {
          userId: socket.user.id,
          username: socket.user.username,
          role: member.role,
        })

        console.log(`[WS] ${socket.user.username} a rejoint la campagne ${campaignId}`)
      } catch (err) {
        console.error('[WS] session:join error:', err.message)
        socket.emit('error', { message: 'Server error' })
      }
    })

    // ─── TOKEN:MOVE ────────────────────────────────────────────────────────
    // Un joueur ou GM déplace un token
    // Payload : { tokenId, pos_x, pos_y, pos_z }
    socket.on(WS.TOKEN_MOVE, async ({ tokenId, pos_x, pos_y, pos_z }) => {
      try {
        const token = await db('tokens').where({ id: tokenId }).first()
        if (!token) return

        // Vérifier les droits : GM ou propriétaire du character lié au token
        const isGm = socket.role === 'gm'
        let isOwner = false
        if (token.character_id) {
          const character = await db('characters').where({ id: token.character_id }).first()
          isOwner = character?.user_id === socket.user.id
        }
        if (!isOwner && !isGm) {
          socket.emit('error', { message: 'Access denied' })
          return
        }

        // Mettre à jour en base — updated_at inclus pour cohérence avec les routes REST
        const [updated] = await db('tokens')
          .where({ id: tokenId })
          .update({ pos_x, pos_y, pos_z, updated_at: db.fn.now() })
          .returning(['id', 'pos_x', 'pos_y', 'pos_z', 'updated_at'])

        // Broadcaster à tous les membres de la campagne (y compris l'émetteur)
        // updated_at inclus — permet au client d'ignorer les events obsolètes
        io.to(socket.campaignId).emit(WS.TOKEN_MOVED, {
          tokenId: updated.id,
          pos_x: updated.pos_x,
          pos_y: updated.pos_y,
          pos_z: updated.pos_z,
          updated_at: updated.updated_at,
        })
      } catch (err) {
        console.error('[WS] token:move error:', err.message)
      }
    })

    // ─── TOKEN:CREATED ─────────────────────────────────────────────────────
    // Conservé temporairement — relique Chantier 1, à nettoyer chantier dédié.
    // GM a placé un token sur la carte
    // Payload : { tokenId }
    socket.on(WS.TOKEN_CREATED, async ({ tokenId }) => {
      try {
        const token = await db('tokens').where({ id: tokenId }).first()
        if (!token) return
        // Broadcast à toute la room — le joueur voit apparaître le token
        io.to(socket.campaignId).emit(WS.TOKEN_CREATED, { token })
      } catch (err) {
        console.error('[WS] token:created error:', err.message)
      }
    })

    // ─── TOKEN:DELETED ─────────────────────────────────────────────────────
    // Conservé temporairement — relique Chantier 1, à nettoyer chantier dédié.
    // Un token a été supprimé
    // Payload : { tokenId }
    socket.on(WS.TOKEN_DELETED, async ({ tokenId }) => {
      try {
        // Broadcast à toute la room
        io.to(socket.campaignId).emit(WS.TOKEN_DELETED, { tokenId })
      } catch (err) {
        console.error('[WS] token:deleted error:', err.message)
      }
    })

    // ─── VOXEL:ADD ─────────────────────────────────────────────────────────
    // Le GM pose un voxel sur la carte (mode édition)
    // Payload : { battlemapId, x, y, z, mat }
    socket.on(WS.VOXEL_ADD, async ({ battlemapId, x, y, z, mat }) => {
      try {
        if (socket.role !== 'gm') {
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
        const next = { ...voxels, [key]: mat }

        await db('battlemaps')
          .where({ id: battlemapId })
          .update({ voxel_data: JSON.stringify(next) })

        // Broadcaster à tous
        io.to(socket.campaignId).emit(WS.VOXEL_ADDED, { battlemapId, x, y, z, mat })
      } catch (err) {
        console.error('[WS] voxel:add error:', err.message)
      }
    })

    // ─── VOXEL:REMOVE ──────────────────────────────────────────────────────
    // Le GM supprime un voxel (mode édition ou destruction)
    // Payload : { battlemapId, x, y, z }
    socket.on(WS.VOXEL_REMOVE, async ({ battlemapId, x, y, z }) => {
      try {
        if (socket.role !== 'gm') {
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

        io.to(socket.campaignId).emit(WS.VOXEL_REMOVED, { battlemapId, x, y, z })
      } catch (err) {
        console.error('[WS] voxel:remove error:', err.message)
      }
    })

    // ─── MAP:SWITCH ────────────────────────────────────────────────────────
    // Le GM bascule un ou plusieurs joueurs vers une autre carte
    // Payload : { battlemapId, userIds } — userIds vide = tous les joueurs
    socket.on(WS.MAP_SWITCH, async ({ battlemapId, userIds = [] }) => {
      try {
        if (socket.role !== 'gm') {
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
            .where({ campaign_id: socket.campaignId, role: 'player' })
            .select('user_id')
          targets = members.map(m => m.user_id)
        }

        // Mettre à jour player_locations en base
        for (const userId of targets) {
          await db('player_locations')
            .insert({
              campaign_id: socket.campaignId,
              user_id: userId,
              battlemap_id: battlemapId,
            })
            .onConflict(['campaign_id', 'user_id'])
            .merge({ battlemap_id: battlemapId, updated_at: db.fn.now() })
        }

        // Broadcaster à tous — chaque client filtre s'il est concerné
        io.to(socket.campaignId).emit(WS.MAP_SWITCH, { battlemapId, userIds: targets })
      } catch (err) {
        console.error('[WS] map:switch error:', err.message)
      }
    })

    // ─── MAP:VIEWPORT ──────────────────────────────────────────────────────
    // Le GM partage sa position de caméra (Snap GM ou verrouillage)
    // Payload : { position, target, mode } — mode: 'snap' | 'lock' | 'free'
    socket.on(WS.MAP_VIEWPORT, ({ position, target, mode }) => {
      if (socket.role !== 'gm') return
      // Broadcaster aux joueurs uniquement (pas au GM lui-même)
      socket.to(socket.campaignId).emit(WS.MAP_VIEWPORT, { position, target, mode })
    })

    // ─── DICE:ROLL ─────────────────────────────────────────────────────────
    // Placeholder — sera implémenté avec le parser de dés
    // Payload : { formula } — ex: "2d6+3"
    socket.on(WS.DICE_ROLL, ({ formula }) => {
      // TODO Phase 2 — parser formule + calcul serveur + seed
      console.log(`[WS] dice:roll demandé par ${socket.user.username} : ${formula}`)
    })

    // ─── CHAT:MESSAGE ──────────────────────────────────────────────────────
    // Payload : { text }
    socket.on(WS.CHAT_MESSAGE, async ({ text }) => {
      if (!text || !socket.campaignId) return
      // Lire la couleur depuis la DB — pas dans le JWT
      let color = '#5b8dee'
      try {
        const userRow = await db('users').where({ id: socket.user.id }).select('color').first()
        if (userRow?.color) color = userRow.color
      } catch (_) {}
      io.to(socket.campaignId).emit(WS.CHAT_MESSAGE, {
        userId: socket.user.id,
        username: socket.user.username,
        color,
        text,
        timestamp: new Date().toISOString(),
      })
    })

    // ─── CHARACTER:UPDATED ─────────────────────────────────────────────────
    // Conservé temporairement — relique Chantier 1, à nettoyer chantier dédié.
    // Le GM a modifié un character (visible, assignation, etc.)
    // Payload : { characterId }
    socket.on(WS.CHARACTER_UPDATED, async ({ characterId }) => {
      try {
        if (socket.role !== 'gm') {
          socket.emit('error', { message: 'GM only' })
          return
        }

        const character = await db('characters')
          .where({ 'characters.id': characterId })
          .leftJoin('users', 'characters.user_id', 'users.id')
          .select(
            'characters.id',
            'characters.campaign_id',
            'characters.user_id',
            'characters.name',
            'characters.color',
            'characters.visible',
            'characters.glb_url',
            'characters.portrait_url',
            'characters.description',
            'characters.gm_notes',
            'characters.created_at',
            'characters.updated_at',
            'users.username as owner_username'
          )
          .first()

        if (!character) return

        const { gm_notes, ...characterPublic } = character
        io.to(socket.campaignId).emit(WS.CHARACTER_UPDATED, characterPublic)
      } catch (err) {
        console.error('[WS] character:updated error:', err.message)
      }
    })

    // ─── DÉCONNEXION ───────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[WS] Déconnecté : ${socket.user.username} (${socket.id})`)
      if (socket.campaignId) {
        socket.to(socket.campaignId).emit(WS.SESSION_USER_LEFT, {
          userId: socket.user.id,
          username: socket.user.username,
        })
      }
    })
  })
}

export default initSocket
