import { WS } from '../../../shared/events.js'
import socketAuth from './auth.js'
import db from '../db/knex.js'
import { registerTokenHandlers } from './socketToken.js'
import { registerDiceHandlers } from './socketDice.js'
import { registerEntityHandlers } from './socketEntity.js'
import { registerCombatHandlers } from './socketCombat.js'
import { pickNextTimelineStep } from './socketCombatHelpers.js'
import { registerTradeHandlers } from './socketTrade.js'
import { registerWizardHandlers } from './socketWizard.js'

// Map des timers de timeout actifs â€” { requestId: { timeoutHandle, ...pendingData } }
// DÃ©clarÃ©e hors de initSocket â€” une seule instance, partagÃ©e entre toutes les connexions.
// NettoyÃ©e Ã  chaque rÃ©solution (ENTITY_ACTION_RESOLVE) ou expiration (timeout 60s â€” PE12).
const pendingEntityActions = new Map()

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

        // â”€â”€ Combat state sync â€” reconnexion en cours de combat (PC14) â”€â”€â”€â”€â”€â”€â”€â”€
        try {
          const activeCombat = await db('combat_state').where({ campaign_id: campaignId }).first()
          if (activeCombat) {
            const [roster, actions] = await Promise.all([
              db('combat_roster').where({ campaign_id: campaignId }),
              // Bornée au Tour en cours (docs/PLAN_COMBAT_TIMELINE.md §6bis point 5) — combat_actions
              // n'est plus vidée à chaque Tour, l'historique des Tours précédents ne doit pas fuiter
              // dans la sync de reconnexion.
              db('combat_actions').where({ campaign_id: campaignId, turn_number: activeCombat.current_turn }),
            ])
            socket.emit(WS.COMBAT_STATE_SYNC, { combatState: activeCombat, roster, actions })
            // Sync preview Ã©phÃ©mÃ¨re si un joueur est en train de dÃ©clarer
            const currentPreview = combatPreviews.get(campaignId)
            if (currentPreview) socket.emit(WS.COMBAT_ANNOUNCE_PREVIEW, currentPreview)

            // C3 — restauration combat_pending sur reconnexion en phase RESOLUTION
            if (activeCombat.phase === 'RESOLUTION') {
              // Échelle de phases (docs/PLAN_COMBAT_TIMELINE.md Lot B) — un reconnectant doit revoir
              // l'état courant de la timeline, pas seulement roster/actions ci-dessus.
              const timelineEntries = await db('combat_timeline_entries')
                .where({ campaign_id: campaignId, turn_number: activeCombat.current_turn })
                .orderBy('phase_position', 'desc')
              const currentStep = await pickNextTimelineStep(campaignId, activeCombat.current_turn)
              socket.emit(WS.COMBAT_TIMELINE_UPDATED, {
                turnNumber: activeCombat.current_turn,
                entries: timelineEntries,
                currentStep,
              })

              const userToken = await db('tokens')
                .join('characters', 'tokens.character_id', 'characters.id')
                .where({ 'tokens.campaign_id': campaignId, 'characters.user_id': socket.user.id })
                .select('tokens.id as token_id')
                .first()
              const userTokenId = userToken?.token_id

              if (userTokenId) {
                // Plusieurs entrées 'damage' peuvent désormais coexister pour le même token
                // (docs/PLAN_COMBAT_ACTION_QUEUE.md §3) — consommées FIFO côté serveur, un seul prompt
                // visible à la fois côté client : ordonner par ancienneté et ne restaurer que la plus
                // ancienne, cohérent avec ce que COMBAT_DAMAGE_CONFIRM affiche déjà en jeu normal.
                const rows = await db('combat_pending')
                  .where({ campaign_id: campaignId, token_id: userTokenId })
                  .orderBy('created_at', 'asc')
                let damagePromptSent = false
                for (const row of rows) {
                  const p = row.payload
                  if (row.type === 'melee_defense') {
                    socket.emit(WS.COMBAT_MELEE_DEFENSE_PROMPT, {
                      attackerName:        p.attackerUsername,
                      attackerTokenId:     p.attackerTokenId,
                      defenderTokenId:     row.token_id,
                      rollAttaque:         p.rollAttaque,
                      chancesAttaque:      p.chancesAttaque,
                      chanceDefenseBase:   p.defenderSkillTotal + p.defenderEffectiveMalus + p.multiMalusDefenseur,
                      multiMalusDefenseur: p.multiMalusDefenseur,
                    })
                  } else if (row.type === 'damage') {
                    if (damagePromptSent) continue
                    socket.emit(WS.COMBAT_DAMAGE_PROMPT, {
                      tokenId:    row.token_id,
                      formula:    p.formula,
                      targetName: p.targetName,
                    })
                    damagePromptSent = true
                  } else if (row.type === 'stun') {
                    socket.emit(WS.COMBAT_STUN_PROMPT, {
                      tokenId: row.token_id,
                      outcome: p.outcome,
                    })
                  }
                }
              }

              // [R4-2] drone assault -- damage prompt cible sur la cible (pas l'attaquant)
              const pendingDmgDrone = await db('combat_pending')
                .where({ campaign_id: campaignId, type: 'damage' })
                .whereRaw('payload->>? = ?', ['targetUserId', socket.user.id])
                .first()
              if (pendingDmgDrone) {
                socket.emit(WS.COMBAT_DAMAGE_PROMPT, {
                  tokenId:    pendingDmgDrone.token_id,
                  formula:    pendingDmgDrone.payload.formula,
                  targetName: pendingDmgDrone.payload.targetName,
                })
              }
            }
          }
        } catch (err) {
          console.warn('[WS] session:join â€” combat state sync error (non bloquant):', err.message)
        }

        const context = { campaignId, user: socket.user, isGm: socket.role === 'gm' }
        registerTokenHandlers(io, socket, context)
        registerDiceHandlers(io, socket, context)
        registerEntityHandlers(io, socket, context, pendingEntityActions)
        registerCombatHandlers(io, socket, context, { combatTimers, combatPreviews })
        registerTradeHandlers(io, socket, context)
        registerWizardHandlers(io, socket, context)

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
