import { WS } from '../../../shared/events.js'
import socketAuth from './auth.js'
import db from '../db/knex.js'
import { parseDice } from '../lib/diceParser.js'
import {
  calcSkillTotal,
  calcAttributeAN,
  calcAttributeNA,
  getGenotypeModForAttr,
  ATTR_LABELS,
} from '../lib/charStats.js'
import {
  buildCollisionMap,
  isCaseOccupied,
  collisionAddToken,
  collisionRemoveToken,
  collisionMoveToken,
  collisionAddEntity,
  collisionRemoveEntity,
  collisionMoveEntity,
  collisionUpdateEntityState,
  collisionAddVoxel,
  collisionRemoveVoxel,
} from '../lib/redis.js'

// Map des timers de timeout actifs — { requestId: { timeoutHandle, ...pendingData } }
// Déclarée hors de initSocket — une seule instance, partagée entre toutes les connexions.
// Nettoyée à chaque résolution (ENTITY_ACTION_RESOLVE) ou expiration (timeout 60s — PE12).
const pendingEntityActions = new Map()

// Cache table marges de réussite Polaris — chargée une seule fois depuis DB au premier appel.
// Évite une requête SQL par jet de déplacement.
// Format : [{ mr_min, mr_max, dmax }] — seed dans migration 45.
let MR_TABLE = null
async function getMrTable() {
  if (!MR_TABLE) MR_TABLE = await db('polaris_mr').orderBy('mr_min')
  return MR_TABLE
}

// Retourne le modificateur LdB depuis la table MR chargée en mémoire.
// Source de vérité : LdB Polaris p.209 — migration 46.
// dmax = isSuccess ? modifier + 1 : 0  (calculé dans le handler, pas ici)
function getModifier(mrTable, mr) {
  const row = mrTable.find(r =>
    mr >= r.mr_min && (r.mr_max === null || mr <= r.mr_max)
  )
  return row?.modifier ?? 0
}

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
        // Stocker role dans socket.data — nécessaire pour ciblage GM via fetchSockets() (PE2)
        socket.data.role = member.role

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

        // ── Collision map Redis — reconstruction (PE23) ───────────────────
        // Reconstruite à chaque SESSION_JOIN, pas au démarrage serveur.
        // Nécessite la battlemap courante du joueur via player_locations.
        // Si pas de player_location → joueur sans carte, skip (normal à la première connexion).
        try {
          const playerLocation = await db('player_locations')
            .where({ campaign_id: campaignId, user_id: socket.user.id })
            .first()
          if (playerLocation?.battlemap_id) {
            await buildCollisionMap(playerLocation.battlemap_id)
          }
        } catch (err) {
          // Non bloquant — la collision map sera reconstruite au prochain SESSION_JOIN
          console.warn('[WS] session:join — buildCollisionMap error (non bloquant):', err.message)
        }

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
          .returning(['id', 'pos_x', 'pos_y', 'pos_z', 'layer', 'updated_at'])

        // Maintenance collision map Redis — hdel ancienne case + hset nouvelle
        await collisionMoveToken(token.battlemap_id, token, updated)

        // Broadcaster à tous les membres de la campagne (y compris l'émetteur)
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

    // ─── TOKEN:ROTATE ──────────────────────────────────────────────────────
    // Joueur ou GM fait pivoter son token de 45° (incrément r = (r+1) % 8)
    // Payload : { tokenId }
    // Le serveur est source de vérité pour l'incrément — le client n'envoie pas r.
    // PE21 : rotation.y = r * Math.PI / 4 côté client
    socket.on(WS.TOKEN_ROTATE, async ({ tokenId }) => {
      try {
        const token = await db('tokens').where({ id: tokenId }).first()
        if (!token) return

        // Ownership : GM ou propriétaire du character lié au token
        const isGm = socket.role === 'gm'
        let isOwner = false
        if (token.character_id) {
          const character = await db('characters').where({ id: token.character_id }).first()
          isOwner = character?.user_id === socket.data.userId
        }
        if (!isOwner && !isGm) return

        // Incrément 45° modulo 8 — r = 0..7
        const newR = ((token.r ?? 0) + 1) % 8

        const [updated] = await db('tokens')
          .where({ id: tokenId })
          .update({ r: newR, updated_at: db.fn.now() })
          .returning('*')

        // Broadcast TOKEN_UPDATED — réutilise l'event existant
        io.to(socket.campaignId).emit(WS.TOKEN_UPDATED, { token: updated })
      } catch (err) {
        console.error('[WS] token:rotate error:', err.message)
      }
    })

    // ─── TOKEN:CREATED ─────────────────────────────────────────────────────
    // Conservé temporairement — relique Chantier 1, à nettoyer chantier dédié.
    // La création REST (POST /tokens) gère déjà le broadcast ET la collision map.
    // Ce handler ne touche pas Redis — évite le double-traitement.
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
    // La suppression REST (DELETE /tokens/:id) gère déjà la collision map.
    // Ce handler ne touche pas Redis.
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
    // Payload : { battlemapId, x, y, z, tex, geo, r }
    socket.on(WS.VOXEL_ADD, async ({ battlemapId, x, y, z, tex, geo, r }) => {
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
        const next = { ...voxels, [key]: { tex, geo, r } }

        await db('battlemaps')
          .where({ id: battlemapId })
          .update({ voxel_data: JSON.stringify(next) })

        // Maintenance collision map Redis
        await collisionAddVoxel(battlemapId, x, y, z)

        // Broadcaster à tous
        io.to(socket.campaignId).emit(WS.VOXEL_ADDED, { battlemapId, x, y, z, tex, geo, r })
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

        // Maintenance collision map Redis
        await collisionRemoveVoxel(battlemapId, x, y, z)

        io.to(socket.campaignId).emit(WS.VOXEL_REMOVED, { battlemapId, x, y, z })
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
        if (socket.role !== 'gm') {
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

        io.to(socket.campaignId).emit(WS.VOXEL_UPDATED, { battlemapId, x, y, z, r })
      } catch (err) {
        console.error('[WS] voxel:update error:', err.message)
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
    // Le client demande un jet de dés.
    // Le serveur est le seul responsable du calcul — jamais le client.
    // Payload : { formula } — ex: "2d6+3", "d20", "3d6"
    socket.on(WS.DICE_ROLL, async ({ formula }) => {
      // Guard — le socket doit avoir rejoint une campagne
      if (!socket.campaignId) return

      try {
        const { rolls, total, formula: normalizedFormula, dieType, seed } = await parseDice(formula)

        let color = '#5b8dee'
        try {
          const userRow = await db('users').where({ id: socket.user.id }).select('color').first()
          if (userRow?.color) color = userRow.color
        } catch (_) {}

        let isCriticalSuccess = false
        let isCriticalFail = false

        try {
          const campaign = await db('campaigns').where({ id: socket.campaignId }).select('dice_config').first()
          const diceConfig = campaign?.dice_config

          if (diceConfig && dieType) {
            const dieCfg = diceConfig[dieType]
            if (dieCfg?.success) {
              isCriticalSuccess = total >= dieCfg.success.min && total <= dieCfg.success.max
            }
            if (dieCfg?.fail) {
              isCriticalFail = total >= dieCfg.fail.min && total <= dieCfg.fail.max
            }
          }
        } catch (_) {}

        const timestamp = new Date().toISOString()
        io.to(socket.campaignId).emit(WS.DICE_RESULT, {
          userId: socket.user.id,
          username: socket.user.username,
          color,
          formula: normalizedFormula,
          rolls,
          total,
          isCriticalSuccess,
          isCriticalFail,
          seed,
          timestamp,
        })

        console.log(`[WS] dice:roll — ${socket.user.username} : ${normalizedFormula} = ${total}`)
      } catch (err) {
        console.error(`[WS] dice:roll error (${socket.user.username}) : ${err.message}`)
      }
    })

    // ─── CHAT:MESSAGE ──────────────────────────────────────────────────────
    // Payload : { text }
    socket.on(WS.CHAT_MESSAGE, async ({ text }) => {
      if (!text || !socket.campaignId) return
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
            'users.username',
          )
          .first()

        if (!character) return
        io.to(socket.campaignId).emit(WS.CHARACTER_UPDATED, character)
      } catch (err) {
        console.error('[WS] character:updated error:', err.message)
      }
    })

    // ─── ENTITY:ACTION_REQUEST ─────────────────────────────────────────────
    // Payload : { requestId, characterId, entityId, interactionId, skillId }
    // skillTotal N'EST PAS reçu du client — le serveur calcule via charStats.js.
    // Timeout 60s — si le GM ne répond pas, refus automatique (PE12).
    socket.on(WS.ENTITY_ACTION_REQUEST, async ({ requestId, characterId, entityId, interactionId, skillId }) => {
      try {
        if (!socket.campaignId) return
        if (!requestId || !characterId || !entityId || !interactionId) return

        // Validation 1 — le character appartient bien au joueur émetteur
        const character = await db('characters').where({ id: characterId }).first()
        if (!character || character.user_id !== socket.user.id) {
          socket.emit('error', { message: 'Character non autorisé' })
          return
        }

        // Validation 2 — l'entité existe
        const entity = await db('entities').where({ id: entityId }).first()
        if (!entity) {
          socket.emit('error', { message: 'Entité introuvable' })
          return
        }

        // Validation 3 — l'interaction existe et n'est pas désactivée
        const blueprint = await db('entity_blueprints').where({ id: entity.blueprint_id }).first()
        if (!blueprint) return

        const interaction = (blueprint.interactions || []).find(i => i.id === interactionId)
        if (!interaction) {
          socket.emit('error', { message: 'Interaction introuvable' })
          return
        }
        if ((entity.disabled_interactions || []).includes(interactionId)) {
          socket.emit('error', { message: 'Interaction désactivée sur cette entité' })
          return
        }

        // Résolution difficulté effective (override instance si présent)
        const overrides = entity.interaction_overrides?.[interactionId] || {}
        const defaultDifficulty = overrides.difficulty_dc ?? interaction.difficulty_dc

        // Guard — pas de mécanique (skill_id ni attribute_id) → résolution directe sans GM
        if (!interaction.skill_id && !interaction.attribute_id) {
          await resolveEntityState(entityId, interactionId, socket.campaignId, io)
          console.log(`[WS] entity:action_request direct (no skill) — ${socket.user.username} → ${interaction.action_label}`)
          return
        }

        // Trouver le socket GM via socket.data.role (PE2 — fetchSockets expose socket.data)
        const roomSockets = await io.in(socket.campaignId).fetchSockets()
        const gmSocket = roomSockets.find(s => s.data.role === 'gm')

        if (!gmSocket) {
          socket.emit(WS.ENTITY_ACTION_RESULT, {
            requestId, isApproved: false, reason: 'no_gm',
          })
          return
        }

        // Timeout 60s (PE12) — stocké dans la Map pour nettoyage à la résolution
        const timeoutHandle = setTimeout(() => {
          pendingEntityActions.delete(requestId)
          socket.emit(WS.ENTITY_ACTION_RESULT, {
            requestId, isApproved: false, reason: 'timeout',
          })
          console.log(`[WS] entity:action timeout — requestId: ${requestId}`)
        }, 60000)

        pendingEntityActions.set(requestId, {
          timeoutHandle,
          playerSocketId: socket.id,
          playerUserId: socket.user.id,
          playerName: socket.user.username,
          characterId,
          characterName: character.name,
          entityId,
          entityLabel: entity.label_override || blueprint.label,
          interactionId,
          interactionLabel: interaction.action_label,
          skillId,
          attributeId: interaction.attribute_id || null,
          defaultDifficulty,
          campaignId: socket.campaignId,
        })

        gmSocket.emit(WS.ENTITY_ACTION_PENDING, {
          requestId,
          playerName: socket.user.username,
          characterName: character.name,
          entityLabel: entity.label_override || blueprint.label,
          interactionLabel: interaction.action_label,
          skillId,
          defaultDifficulty,
        })

        console.log(`[WS] entity:action_request — ${socket.user.username} → ${interaction.action_label}`)
      } catch (err) {
        console.error('[WS] entity:action_request error:', err.message)
      }
    })

    // ─── ENTITY:ACTION_RESOLVE ─────────────────────────────────────────────
    // Le GM prend une décision sur une demande d'interaction.
    // Payload : { requestId, isApproved, autoSuccess, gmModifier }
    socket.on(WS.ENTITY_ACTION_RESOLVE, async ({ requestId, isApproved, autoSuccess, gmModifier = 0 }) => {
      try {
        if (socket.role !== 'gm') return
        if (!requestId) return

        const pending = pendingEntityActions.get(requestId)
        if (!pending) return

        // Nettoyer le timer et la Map (PE12)
        clearTimeout(pending.timeoutHandle)
        pendingEntityActions.delete(requestId)

        const roomSockets = await io.in(pending.campaignId).fetchSockets()
        const playerSocket = roomSockets.find(s => s.id === pending.playerSocketId)

        // ── Refus ──────────────────────────────────────────────────────────
        if (!isApproved) {
          if (playerSocket) {
            playerSocket.emit(WS.ENTITY_ACTION_RESULT, {
              requestId, isApproved: false, reason: 'refused',
            })
          }
          return
        }

        // ── Réussite automatique (sans jet) ───────────────────────────────
        if (autoSuccess) {
          const timestamp = new Date().toISOString()
          io.to(pending.campaignId).emit(WS.DICE_RESULT, {
            userId: pending.playerUserId,
            username: pending.playerName,
            color: '#5b8dee',
            formula: pending.skillId,
            rolls: [],
            total: null,
            type: 'auto',
            isCriticalSuccess: false,
            isCriticalFail: false,
            timestamp,
          })
          await resolveEntityState(pending.entityId, pending.interactionId, pending.campaignId, io)
          return
        }

        // ── Skill absent → succès automatique sans jet (S34-2) ────────────
        if (!pending.skillId) {
          await resolveEntityState(pending.entityId, pending.interactionId, pending.campaignId, io)
          return
        }

        // ── Jet de dés (1d20 + total serveur vs DC) ───────────────────────
        try {
          const { rolls, total: diceRoll, formula: normalizedFormula, seed } = await parseDice('1d20')

          let mechanicalTotal = 0
          let formulaLabel = pending.skillId || pending.attributeId || '?'

          const sheet = pending.characterId
            ? await db('char_sheet').where({ character_id: pending.characterId }).first()
            : null

          if (sheet) {
            const [attrs, archetype, charSkillRow, refSkill] = await Promise.all([
              db('char_attributes').where({ char_sheet_id: sheet.id }),
              db('char_archetype').where({ char_sheet_id: sheet.id }).first(),
              pending.skillId
                ? db('char_skills').where({ char_sheet_id: sheet.id, skill_id: pending.skillId }).first()
                : Promise.resolve(null),
              pending.skillId
                ? db('ref_skills').where({ id: pending.skillId }).first()
                : Promise.resolve(null),
            ])

            const genotypeRow = archetype?.genotype_id
              ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
              : null

            if (pending.skillId && refSkill) {
              mechanicalTotal = calcSkillTotal(attrs, charSkillRow, refSkill, genotypeRow)
              formulaLabel = refSkill.label || pending.skillId
            } else if (pending.attributeId) {
              mechanicalTotal = calcAttributeAN(attrs, pending.attributeId, genotypeRow)
              formulaLabel = ATTR_LABELS[pending.attributeId] || pending.attributeId
            }
          } else {
            console.warn(`[WS] entity:action_resolve — char_sheet introuvable pour character ${pending.characterId}, fallback total=0`)
            if (pending.skillId) formulaLabel = pending.skillId
            else if (pending.attributeId) formulaLabel = ATTR_LABELS[pending.attributeId] || pending.attributeId
          }

          let color = '#5b8dee'
          try {
            const userRow = await db('users').where({ id: pending.playerUserId }).select('color').first()
            if (userRow?.color) color = userRow.color
          } catch (_) {}

          const totalDiffMod = pending.defaultDifficulty + gmModifier
          const chancesDeReussite = mechanicalTotal + totalDiffMod
          const isSuccess = diceRoll <= chancesDeReussite
          const diffLabel = totalDiffMod >= 0 ? `+${totalDiffMod}` : `${totalDiffMod}`

          const timestamp = new Date().toISOString()
          io.to(pending.campaignId).emit(WS.DICE_RESULT, {
            userId: pending.playerUserId,
            username: pending.playerName,
            color,
            formula: formulaLabel,
            rolls,
            total: diceRoll,
            type: 'entity_action',
            isCriticalSuccess: false,
            isCriticalFail: false,
            seed,
            timestamp,
            skillLabel: formulaLabel,
            mechanicalTotal,
            chancesDeReussite,
            diffLabel,
            isSuccess,
          })

          if (isSuccess) {
            await resolveEntityState(pending.entityId, pending.interactionId, pending.campaignId, io)
          }
        } catch (err) {
          console.error('[WS] entity:action_resolve dice error:', err.message)
        }
      } catch (err) {
        console.error('[WS] entity:action_resolve error:', err.message)
      }
    })

    // ─── ENTITY:ACTION_GM_DIRECT ──────────────────────────────────────────────
    // Le GM déclenche une interaction directement, sans arbitrage ni traçage.
    // Payload : { entityId, interactionId }
    socket.on(WS.ENTITY_ACTION_GM_DIRECT, async ({ entityId, interactionId }) => {
      try {
        if (socket.role !== 'gm') return
        if (!socket.campaignId) return
        if (!entityId || !interactionId) return
        await resolveEntityState(entityId, interactionId, socket.campaignId, io)
      } catch (err) {
        console.error('[WS] entity:action_gm_direct error:', err.message)
      }
    })

    // ─── ENTITY:CREATED ────────────────────────────────────────────────────
    // Le GM vient de poser une entité (après POST REST réussi).
    // Payload : { entityId }
    // La maintenance Redis collision est faite dans POST /entities (REST).
    // Ce handler gère uniquement le broadcast ciblé (gm_only).
    socket.on(WS.ENTITY_CREATED, async ({ entityId }) => {
      try {
        if (socket.role !== 'gm') return
        if (!socket.campaignId) return

        const row = await db('entities')
          .where({ 'entities.id': entityId })
          .join('entity_blueprints', 'entities.blueprint_id', 'entity_blueprints.id')
          .select(
            'entities.*',
            'entity_blueprints.label as bp_label',
            'entity_blueprints.glb_url as bp_glb_url',
            'entity_blueprints.geometry as bp_geometry',
            'entity_blueprints.states as bp_states',
            'entity_blueprints.interactions as bp_interactions',
            'entity_blueprints.deprecated as bp_deprecated',
            'entity_blueprints.created_by as bp_created_by',
            'entity_blueprints.pack_id as bp_pack_id',
          )
          .first()

        if (!row) return

        const { bp_label, bp_glb_url, bp_geometry, bp_states, bp_interactions, bp_deprecated, bp_created_by, bp_pack_id, ...instance } = row
        const entityWithBlueprint = {
          ...instance,
          blueprint: {
            id: instance.blueprint_id,
            label: bp_label,
            glb_url: bp_glb_url,
            geometry: bp_geometry,
            states: bp_states,
            interactions: bp_interactions,
            deprecated: bp_deprecated,
            created_by: bp_created_by,
            pack_id: bp_pack_id,
          },
        }

        // Broadcast ciblé — gm_only exclut les joueurs
        const roomSockets = await io.in(socket.campaignId).fetchSockets()
        for (const s of roomSockets) {
          if (s.data.role !== 'gm' && row.gm_only) continue
          s.emit(WS.ENTITY_CREATED, { entity: entityWithBlueprint })
        }
      } catch (err) {
        console.error('[WS] entity:created error:', err.message)
      }
    })

    // ─── ENTITY:DELETED ────────────────────────────────────────────────────
    // Le GM a supprimé une entité (après DELETE REST réussi).
    // La maintenance Redis collision est faite dans DELETE /entities/:id (REST).
    // Ce handler gère uniquement le broadcast.
    // Payload : { entityId }
    socket.on(WS.ENTITY_DELETED, async ({ entityId }) => {
      try {
        if (socket.role !== 'gm') return
        io.to(socket.campaignId).emit(WS.ENTITY_DELETED, { entityId })
      } catch (err) {
        console.error('[WS] entity:deleted error:', err.message)
      }
    })

    // ─── ENTITY:MOVED ──────────────────────────────────────────────────────
    // Le GM a déplacé une entité dans l'éditeur (après PUT REST réussi).
    // La maintenance Redis collision est faite dans PUT /entities/:id (REST).
    // Ce handler gère uniquement le broadcast.
    // Payload : { entityId, pos_x, pos_y, pos_z, r }
    socket.on(WS.ENTITY_MOVED, async ({ entityId, pos_x, pos_y, pos_z, r }) => {
      try {
        if (socket.role !== 'gm') return
        io.to(socket.campaignId).emit(WS.ENTITY_MOVED, { entityId, pos_x, pos_y, pos_z, r })
      } catch (err) {
        console.error('[WS] entity:moved error:', err.message)
      }
    })

    // ─── ENTITY:MOVE_REQUEST ───────────────────────────────────────────────
    // Un joueur demande à déplacer une entité (push/pull orthogonal — 9F-B).
    // Le serveur est source de vérité : il recalcule l'attribut, le jet, le Dmax,
    // et exécute le step-by-step en consultant la collision map Redis.
    //
    // Payload : { entityId, tokenId, interactionId, moveType, destX, destZ }
    //   moveType = 'push'|'pull' — calculé client par dot(AE,AD), revalidé serveur (PE27)
    //   destX    = pos_x base (= Three.js X, identiques)
    //   destZ    = pos_y base (profondeur — Three.js Z — PE14)
    //
    // Broadcasts : ENTITY_MOVED + TOKEN_MOVED → room
    // Résultat   : ENTITY_MOVE_RESULT → socket.id uniquement
    socket.on(WS.ENTITY_MOVE_REQUEST, async ({ entityId, tokenId, interactionId, moveType, destX, destZ }) => {
      try {
        console.log(`[DBG] ENTITY_MOVE_REQUEST reçu — entity:${entityId} token:${tokenId} destX:${destX} destZ:${destZ} moveType:${moveType}`)

        // ── Guards entrée ────────────────────────────────────────────────
        if (!socket.campaignId) { console.log('[DBG] RETURN — pas de campaignId'); return }
        if (!entityId || !tokenId || !interactionId) { console.log('[DBG] RETURN — IDs manquants'); return }
        if (destX === undefined || destZ === undefined) { console.log('[DBG] RETURN — dest manquant'); return }

        // Guard double-soumission — même entité déjà en attente (pendingEntityActions)
        const alreadyPending = [...pendingEntityActions.values()]
          .some(p => p.entityId === entityId)
        if (alreadyPending) { console.log('[DBG] RETURN — déjà en attente'); return }

        // ── Charger entité ───────────────────────────────────────────────
        const entity = await db('entities').where({ id: entityId }).first()
        if (!entity) { console.log('[DBG] RETURN — entité introuvable'); return }
        console.log(`[DBG] entité chargée — pos:(${entity.pos_x},${entity.pos_y},${entity.pos_z})`)

        // ── Charger blueprint + interaction ──────────────────────────────
        const blueprint = await db('entity_blueprints')
          .where({ id: entity.blueprint_id }).first()
        if (!blueprint) { console.log('[DBG] RETURN — blueprint introuvable'); return }

        const interaction = (blueprint.interactions || []).find(i => i.id === interactionId)
        if (!interaction) { console.log('[DBG] RETURN — interaction introuvable'); return }

        // Vérifier que c'est bien une interaction de déplacement
        if (!interaction.move_type) { console.log('[DBG] RETURN — interaction sans move_type'); return }

        // Vérifier que l'interaction n'est pas désactivée sur cette instance
        if ((entity.disabled_interactions || []).includes(interactionId)) { console.log('[DBG] RETURN — interaction désactivée'); return }

        // ── Charger token acteur + vérifier ownership ─────────────────
        const token = await db('tokens').where({ id: tokenId }).first()
        if (!token) { console.log('[DBG] RETURN — token introuvable'); return }
        console.log(`[DBG] token chargé — pos:(${token.pos_x},${token.pos_y},${token.pos_z})`)

        // Ownership : le character lié au token doit appartenir au joueur émetteur
        if (token.character_id) {
          const character = await db('characters')
            .where({ id: token.character_id }).first()
          if (!character || character.user_id !== socket.user.id) { console.log('[DBG] RETURN — ownership refusé'); return }
        } else {
          // Token sans character → seul le GM peut interagir
          console.log('[DBG] RETURN — token sans character')
          return
        }

        // ── Valider la portée — distance Tchebychev 3D ─────────────────
        const rangeDist = Math.max(
          Math.abs(entity.pos_x - token.pos_x),
          Math.abs(entity.pos_y - token.pos_y),
          Math.abs(entity.pos_z - token.pos_z),
        )
        const overrides = entity.interaction_overrides?.[interactionId] || {}
        const effectiveRange    = overrides.range         ?? interaction.range         ?? 1.5
        const effectiveDifficulty = overrides.difficulty_dc ?? interaction.difficulty_dc ?? 0
        console.log(`[DBG] portée — rangeDist:${rangeDist} effectiveRange:${effectiveRange}`)
        if (rangeDist > effectiveRange) { console.log('[DBG] RETURN — hors portée'); return }

        // ── Valider direction destination ────────────────────────────────
        const dPosX = destX - entity.pos_x
        const dPosY = destZ - entity.pos_y
        console.log(`[DBG] direction — dPosX:${dPosX} dPosY:${dPosY}`)

        if (dPosX === 0 && dPosY === 0) { console.log('[DBG] RETURN — destination = position actuelle'); return }

        const isDiagonal = dPosX !== 0 && dPosY !== 0
        if (isDiagonal && Math.abs(dPosX) !== Math.abs(dPosY)) { console.log(`[DBG] RETURN — diagonal invalide |dPosX|:${Math.abs(dPosX)} |dPosY|:${Math.abs(dPosY)}`); return }

        const dirPosX = Math.sign(dPosX)
        const dirPosY = Math.sign(dPosY)

        // ── Détermination et validation moveType par vecteur dot(AE, AD) — PE27 ──
        const AE = { x: entity.pos_x - token.pos_x, y: entity.pos_y - token.pos_y }
        const AD = { x: destX - token.pos_x,         y: destZ - token.pos_y }
        const dot = AE.x * AD.x + AE.y * AD.y
        console.log(`[DBG] dot — AE:(${AE.x},${AE.y}) AD:(${AD.x},${AD.y}) dot:${dot}`)
        if (dot === 0) { console.log('[DBG] RETURN — dot=0 ambigu'); return }
        const actualMoveType = dot > 0 ? 'push' : 'pull'
        console.log(`[DBG] moveType — client:${moveType} serveur:${actualMoveType}`)
        if (moveType && moveType !== actualMoveType) { console.log('[DBG] RETURN — moveType discordant'); return }

        // ── Charger stats character pour le jet d'attribut ───────────────
        const sheet = await db('char_sheet')
          .where({ character_id: token.character_id }).first()
        if (!sheet) return

        const [attrs, archetype] = await Promise.all([
          db('char_attributes').where({ char_sheet_id: sheet.id }),
          db('char_archetype').where({ char_sheet_id: sheet.id }).first(),
        ])
        const genotypeRow = archetype?.genotype_id
          ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
          : null

        // attribute_id depuis l'interaction (configurable — ex: 'FOR')
        const attributeId = interaction.attribute_id || 'FOR'
        const attributeNA = calcAttributeNA(attrs, attributeId, genotypeRow)

        // ── Jet 1d20 ────────────────────────────────────────────────────
        const { rolls, total: diceRoll, seed } = await parseDice('1d20')

        // ── Calcul seuil, réussite, MR et Dmax ──────────────────────────
        // Formule Polaris : chancesDeReussite = attributeNA + effectiveDifficulty (signé)
        // Réussite si diceRoll <= chancesDeReussite.
        // MR = chancesDeReussite - diceRoll (positif si réussite, négatif si échec).
        // modifier = getModifier(mrTable, mr) — LdB p.209, migration 46.
        // dmax = modifier + 1 si réussite (toute réussite = au moins 1 case), 0 si échec.
        const chancesDeReussite = attributeNA + effectiveDifficulty
        const isSuccess = diceRoll <= chancesDeReussite
        const mr = chancesDeReussite - diceRoll
        const mrTable = await getMrTable()
        const modifier = isSuccess ? getModifier(mrTable, mr) : 0
        let dmax = isSuccess ? modifier + 1 : 0

        // Override déplacement — dmax_override plafonne push ET pull (session 40)
        if (interaction.dmax_override !== null && interaction.dmax_override !== undefined) {
          dmax = Math.min(dmax, interaction.dmax_override)
        }

        // ── Couleur joueur pour DICE_RESULT ──────────────────────────────
        let color = '#5b8dee'
        try {
          const userRow = await db('users')
            .where({ id: socket.user.id }).select('color').first()
          if (userRow?.color) color = userRow.color
        } catch (_) {}

        const diffLabel = effectiveDifficulty >= 0
          ? `+${effectiveDifficulty}` : `${effectiveDifficulty}`
        const timestamp = new Date().toISOString()

        // Broadcast DICE_RESULT — visible dans le chat pour joueur et GM
        io.to(socket.campaignId).emit(WS.DICE_RESULT, {
          userId: socket.user.id,
          username: socket.user.username,
          color,
          formula: ATTR_LABELS[attributeId] || attributeId,
          rolls,
          total: diceRoll,
          type: 'entity_action',
          interactionType: 'displacement',
          isCriticalSuccess: false,
          isCriticalFail: false,
          seed,
          timestamp,
          skillLabel: ATTR_LABELS[attributeId] || attributeId,
          mechanicalTotal: attributeNA,
          chancesDeReussite,
          diffLabel,
          isSuccess,
          mr,
        })

        // ── Échec (Dmax = 0) → résultat immédiat, pas de mouvement ───────
        if (dmax === 0) {
          socket.emit(WS.ENTITY_MOVE_RESULT, {
            requestId: `${entityId}-${interactionId}-${Date.now()}`,
            diceResult: diceRoll,
            mr,
            dmax: 0,
            finalEntityPos: { pos_x: entity.pos_x, pos_y: entity.pos_y, pos_z: entity.pos_z },
            finalActorPos:  { pos_x: token.pos_x,  pos_y: token.pos_y,  pos_z: token.pos_z },
            success: false,
          })
          return
        }

        // ── Step-by-step ────────────────────────────────────────────────
        // excludeIds : token et entité s'excluent mutuellement (tunnel de swap — PE22)
        const excludeIds = [tokenId, entityId]

        // Distance Tchebychev jusqu'à la destination choisie par le joueur.
        // Le joueur clique sur une case précise — l'entité s'arrête là si possible.
        // dmax = plafond MR, stepsTarget = intention du joueur.
        // On prend le minimum des deux — Option A (design session 43).
        const stepsTarget = Math.max(
          Math.abs(destX - entity.pos_x),
          Math.abs(destZ - entity.pos_y)   // destZ = pos_y base (PE14)
        )
        const stepsMax = Math.min(dmax, stepsTarget)

        let stepsCompleted = 0
        for (let k = 1; k <= stepsMax; k++) {
          const nextEntityPosX = entity.pos_x + dirPosX * k
          const nextEntityPosY = entity.pos_y + dirPosY * k   // pos_y = profondeur (PE14)
          const nextActorPosX  = token.pos_x  + dirPosX * k
          const nextActorPosY  = token.pos_y  + dirPosY * k

          console.log(`[DBG] step k=${k} entité-next:(${nextEntityPosX},${nextEntityPosY},${entity.pos_z}) acteur-next:(${nextActorPosX},${nextActorPosY},${token.pos_z})`)

          // Vérifier collision entité (altitude pos_z inchangée — déplacement horizontal)
          const entityBlocked = await isCaseOccupied(
            entity.battlemap_id,
            nextEntityPosX, nextEntityPosY, entity.pos_z,
            excludeIds
          )
          if (entityBlocked) { console.log(`[DBG] entityBlocked à (${nextEntityPosX},${nextEntityPosY},${entity.pos_z})`); break }

          // Vérifier collision acteur
          // token.pos_z = altitude des pieds (même niveau que le sol).
          // On vérifie pos_z+1 = espace de marche — standard industrie VTT.
          // Évite le faux blocage avec les voxels sol (pos_z=0).
          const actorBlocked = await isCaseOccupied(
            entity.battlemap_id,
            nextActorPosX, nextActorPosY, token.pos_z + 1,
            excludeIds
          )
          if (actorBlocked) { console.log(`[DBG] actorBlocked à (${nextActorPosX},${nextActorPosY},${token.pos_z + 1})`); break }

          // Validation diagonale — règle D&D (PLAN_ENTITY.md §9)
          // Les deux cases adjacentes au coin diagonal sont vérifiées.
          // BLOQUÉ seulement si les DEUX sont occupées — libre si au moins UNE est libre.
          if (isDiagonal) {
            const cornerA = await isCaseOccupied(
              entity.battlemap_id,
              nextEntityPosX, entity.pos_y + dirPosY * (k - 1), entity.pos_z,
              excludeIds
            )
            const cornerB = await isCaseOccupied(
              entity.battlemap_id,
              entity.pos_x + dirPosX * (k - 1), nextEntityPosY, entity.pos_z,
              excludeIds
            )
            if (cornerA && cornerB) break
          }

          stepsCompleted = k
        }

        // Guard : 0 pas complétés = entité bloquée dès le premier pas (collision)
        // Malgré un Dmax > 0, la case (k=1) est occupée — pas de mouvement.
        if (stepsCompleted === 0) {
          socket.emit(WS.ENTITY_MOVE_RESULT, {
            requestId: `${entityId}-${interactionId}-${Date.now()}`,
            diceResult: diceRoll,
            mr,
            dmax,
            finalEntityPos: { pos_x: entity.pos_x, pos_y: entity.pos_y, pos_z: entity.pos_z },
            finalActorPos:  { pos_x: token.pos_x,  pos_y: token.pos_y,  pos_z: token.pos_z },
            success: false,
          })
          return
        }

        // Positions finales (stepsCompleted ≥ 1)
        const finalEntityPosX = entity.pos_x + dirPosX * stepsCompleted
        const finalEntityPosY = entity.pos_y + dirPosY * stepsCompleted
        const finalActorPosX  = token.pos_x  + dirPosX * stepsCompleted
        const finalActorPosY  = token.pos_y  + dirPosY * stepsCompleted

        // ── Update DB ────────────────────────────────────────────────────
        const [updatedEntity] = await db('entities')
          .where({ id: entityId })
          .update({
            pos_x: finalEntityPosX,
            pos_y: finalEntityPosY,
            // pos_z inchangé — déplacement horizontal uniquement
            updated_at: db.fn.now(),
          })
          .returning(['id', 'pos_x', 'pos_y', 'pos_z', 'battlemap_id', 'current_state_id', 'updated_at'])

        const [updatedToken] = await db('tokens')
          .where({ id: tokenId })
          .update({
            pos_x: finalActorPosX,
            pos_y: finalActorPosY,
            // pos_z inchangé
            updated_at: db.fn.now(),
          })
          .returning(['id', 'pos_x', 'pos_y', 'pos_z', 'layer', 'updated_at'])

        // ── Maintenance collision map Redis ──────────────────────────────
        await collisionMoveEntity(
          entity.battlemap_id,
          entity,        // oldEntity — positions de départ
          updatedEntity, // newEntity — positions finales + current_state_id inchangé
          blueprint
        )
        await collisionMoveToken(
          entity.battlemap_id,
          token,        // oldToken — positions de départ + layer original
          updatedToken  // newToken — positions finales + layer original (retourné par returning)
        )

        // ── Broadcasts room ──────────────────────────────────────────────
        io.to(socket.campaignId).emit(WS.ENTITY_MOVED, {
          entityId: updatedEntity.id,
          pos_x: updatedEntity.pos_x,
          pos_y: updatedEntity.pos_y,
          pos_z: updatedEntity.pos_z,
          updated_at: updatedEntity.updated_at,
        })

        io.to(socket.campaignId).emit(WS.TOKEN_MOVED, {
          tokenId: updatedToken.id,
          pos_x: updatedToken.pos_x,
          pos_y: updatedToken.pos_y,
          pos_z: updatedToken.pos_z,
          updated_at: updatedToken.updated_at,
        })

        // ── Résultat vers joueur uniquement ──────────────────────────────
        socket.emit(WS.ENTITY_MOVE_RESULT, {
          requestId: `${entityId}-${interactionId}-${Date.now()}`,
          diceResult: diceRoll,
          mr,
          dmax,
          finalEntityPos: {
            pos_x: updatedEntity.pos_x,
            pos_y: updatedEntity.pos_y,
            pos_z: updatedEntity.pos_z,
          },
          finalActorPos: {
            pos_x: updatedToken.pos_x,
            pos_y: updatedToken.pos_y,
            pos_z: updatedToken.pos_z,
          },
          success: stepsCompleted > 0,
        })

        console.log(`[WS] entity:move_request — ${socket.user.username} → ${actualMoveType} entité ${entityId} (MR:${mr} Dmax:${dmax} steps:${stepsCompleted})`)
      } catch (err) {
        console.error('[WS] entity:move_request error:', err.message)
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

// ─── Helper — résolution état entité après succès ─────────────────────────────
// Lit target_state_id de l'interaction, met à jour current_state_id en base,
// broadcaster ENTITY_UPDATED à toute la room,
// et maintient la collision map Redis selon is_blocking du nouvel état.
async function resolveEntityState(entityId, interactionId, campaignId, io) {
  try {
    const entity = await db('entities').where({ id: entityId }).first()
    if (!entity) return

    const blueprint = await db('entity_blueprints').where({ id: entity.blueprint_id }).first()
    if (!blueprint) return

    const interaction = (blueprint.interactions || []).find(i => i.id === interactionId)
    if (!interaction || interaction.target_state_id == null) return

    const [updated] = await db('entities')
      .where({ id: entityId })
      .update({
        current_state_id: interaction.target_state_id,
        updated_at: db.fn.now(),
      })
      .returning(['id', 'current_state_id', 'state', 'updated_at', 'pos_x', 'pos_y', 'pos_z', 'battlemap_id'])

    // Maintenance collision map Redis — is_blocking peut changer selon le nouvel état
    await collisionUpdateEntityState(updated.battlemap_id, entity, blueprint, updated.current_state_id)

    io.to(campaignId).emit(WS.ENTITY_UPDATED, {
      entityId: updated.id,
      current_state_id: updated.current_state_id,
      state: updated.state,
      updated_at: updated.updated_at,
    })
  } catch (err) {
    console.error('[WS] resolveEntityState error:', err.message)
  }
}