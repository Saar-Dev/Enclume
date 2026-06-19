import { WS } from '../../../shared/events.js'
import socketAuth from './auth.js'
import db from '../db/knex.js'
import { buildCollisionMap } from '../lib/redis.js'
import { registerTokenHandlers } from './socketToken.js'
import { registerVoxelHandlers } from './socketVoxel.js'
import { registerDiceHandlers } from './socketDice.js'
import { registerEntityHandlers } from './socketEntity.js'
import { registerCombatHandlers } from './socketCombat.js'

// Map des timers de timeout actifs â€” { requestId: { timeoutHandle, ...pendingData } }
// DÃ©clarÃ©e hors de initSocket â€” une seule instance, partagÃ©e entre toutes les connexions.
// NettoyÃ©e Ã  chaque rÃ©solution (ENTITY_ACTION_RESOLVE) ou expiration (timeout 60s â€” PE12).
const pendingEntityActions = new Map()
const pendingDamageActions = new Map()
const pendingMeleeDefense  = new Map()  // key = defenderTokenId, valeur = donnÃ©es attaque en attente
const pendingStunActions   = new Map()  // key = targetTokenId, valeur = donnÃ©es stun en attente



// Map des timers combat actifs â€” Map<campaignId, Map<tokenId, timeoutId>>
// DÃ©clarÃ©e hors de initSocket â€” singleton, PC16.
// Sprint 1 : dÃ©clarÃ©e uniquement. Logique timer dÃ©marrÃ©e en Sprint 2.
const combatTimers = new Map()

// Cache Ã©phÃ©mÃ¨re des previews d'annonce en cours â€” Map<campaignId, previewPayload>
// Non persistÃ© : perdu sur restart serveur (perte tolÃ©rÃ©e â€” prÃ©sence Ã©phÃ©mÃ¨re LdB).
// SynchronisÃ© au client sur SESSION_JOIN. PurgÃ© sur declare / phase change / combat end.
const combatPreviews = new Map()

const initSocket = (io) => {

  // Authentification obligatoire pour toute connexion WebSocket
  io.use(socketAuth)

  io.on('connection', (socket) => {
    console.log(`[WS] ConnectÃ© : ${socket.user.username} (${socket.id})`)

    // â”€â”€â”€ SESSION:JOIN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Le client rejoint la room d'une campagne
    // Payload : { campaignId }
    socket.on(WS.SESSION_JOIN, async ({ campaignId }) => {
      try {
        // VÃ©rifier que l'utilisateur est bien membre de la campagne
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
        // Stocker userId dans socket.data â€” accessible via fetchSockets() contrairement Ã  socket.user
        socket.data.userId = socket.user.id
        // Stocker role dans socket.data â€” nÃ©cessaire pour ciblage GM via fetchSockets() (PE2)
        socket.data.role = member.role

        // RÃ©cupÃ©rer les utilisateurs dÃ©jÃ  dans la room (avant le join du nouvel arrivant)
        const existingSockets = await io.in(campaignId).fetchSockets()
        const onlineUserIds = existingSockets
          .map(s => s.data.userId)
          .filter(id => id && id !== socket.user.id)

        // Confirmer au client qu'il a rejoint â€” inclut la liste des connectÃ©s
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

        // â”€â”€ Collision map Redis â€” reconstruction (PE23) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Reconstruite Ã  chaque SESSION_JOIN, pas au dÃ©marrage serveur.
        // NÃ©cessite la battlemap courante du joueur via player_locations.
        // Si pas de player_location â†’ joueur sans carte, skip (normal Ã  la premiÃ¨re connexion).
        try {
          const playerLocation = await db('player_locations')
            .where({ campaign_id: campaignId, user_id: socket.user.id })
            .first()
          if (playerLocation?.battlemap_id) {
            await buildCollisionMap(playerLocation.battlemap_id)
          }
        } catch (err) {
          // Non bloquant â€” la collision map sera reconstruite au prochain SESSION_JOIN
          console.warn('[WS] session:join â€” buildCollisionMap error (non bloquant):', err.message)
        }

        // â”€â”€ Combat state sync â€” reconnexion en cours de combat (PC14) â”€â”€â”€â”€â”€â”€â”€â”€
        try {
          const activeCombat = await db('combat_state').where({ campaign_id: campaignId }).first()
          if (activeCombat) {
            const [roster, actions] = await Promise.all([
              db('combat_roster').where({ campaign_id: campaignId }),
              db('combat_actions').where({ campaign_id: campaignId }),
            ])
            socket.emit(WS.COMBAT_STATE_SYNC, { combatState: activeCombat, roster, actions })
            // Sync preview Ã©phÃ©mÃ¨re si un joueur est en train de dÃ©clarer
            const currentPreview = combatPreviews.get(campaignId)
            if (currentPreview) socket.emit(WS.COMBAT_ANNOUNCE_PREVIEW, currentPreview)
          }
        } catch (err) {
          console.warn('[WS] session:join â€” combat state sync error (non bloquant):', err.message)
        }

        const context = { campaignId, user: socket.user, isGm: socket.role === 'gm' }
        registerTokenHandlers(io, socket, context)
        registerVoxelHandlers(io, socket, context)
        registerDiceHandlers(io, socket, context)
        registerEntityHandlers(io, socket, context, pendingEntityActions)
        registerCombatHandlers(io, socket, context, { pendingDamageActions, pendingMeleeDefense, pendingStunActions, combatTimers, combatPreviews })

        socket.on('disconnect', () => {
          console.log(`[WS] Déconnecté : ${socket.user.username} (${socket.id})`)
          socket.to(campaignId).emit(WS.SESSION_USER_LEFT, {
            userId: socket.user.id,
            username: socket.user.username,
          })
        })


        console.log(`[WS] ${socket.user.username} a rejoint la campagne ${campaignId}`)
      } catch (err) {
        console.error('[WS] session:join error:', err.message)
        socket.emit('error', { message: 'Server error' })
      }
    })
  })
}

export default initSocket
