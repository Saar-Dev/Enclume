import { WS } from '../../../shared/events.js'
import socketAuth from './auth.js'
import db from '../db/knex.js'
import { parseDice } from '../lib/diceParser.js'
import {
  calcSkillTotal,
  calcAttributeAN,
  calcAttributeNA,
  calcREA,
  getGenotypeModForAttr,
  calcWoundPenalty,
  calcEncumbrancePenalty,
  calcResistanceDommages,
  calcSeuils,
  calcResistanceArmure,
  calcCarenceArmure,
  getShockMalus,
  getModDom,
  calcSouffle,
  calcResistanceDroguesInput,
  ATTR_LABELS,
  RD_TABLE,
  lookupTable,
} from '../lib/charStats.js'
import { resolveWoundInsertion, isShockTestRequired } from '../lib/woundUtils.js'
import { SLOT_TO_WOUND_LOCATION, LOCATION_LABELS } from '../../../shared/armorConstants.js'
import { SEVERITY_COLORS } from '../../../shared/woundConstants.js'
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
const pendingDamageActions = new Map()
const pendingMeleeDefense  = new Map()  // key = defenderTokenId, valeur = données attaque en attente
const pendingStunActions   = new Map()  // key = targetTokenId, durée D6 en attente de confirmation PJ

const LOC_TABLE = [
  { max: 2,  slot: 'T'  },
  { max: 8,  slot: 'C'  },
  { max: 11, slot: 'BD' },
  { max: 14, slot: 'BG' },
  { max: 17, slot: 'JD' },
  { max: 20, slot: 'JG' },
]

const LOC_TABLE_CONTACT = [
  { max: 2,  slot: 'T'  },
  { max: 8,  slot: 'C'  },
  { max: 11, slot: 'BD' },
  { max: 14, slot: 'BG' },
  { max: 17, slot: 'JD' },
  { max: 20, slot: 'JG' },
]

// Map des timers combat actifs — Map<campaignId, Map<tokenId, timeoutId>>
// Déclarée hors de initSocket — singleton, PC16.
// Sprint 1 : déclarée uniquement. Logique timer démarrée en Sprint 2.
const combatTimers = new Map()

// Cache éphémère des previews d'annonce en cours — Map<campaignId, previewPayload>
// Non persisté : perdu sur restart serveur (perte tolérée — présence éphémère LdB).
// Synchronisé au client sur SESSION_JOIN. Purgé sur declare / phase change / combat end.
const combatPreviews = new Map()

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

// ─── Breakdown jets de dé — tables et labels ────────────────────────────────
const PORTEE_MOD_COMP = {
  bout_portant: 5, courte: 0, moyenne: -5, longue: -10, extreme: -15,
}
const SITUATION_MODS = {
  cible_immobile: 3,
  cible_allure_moyenne: -3, cible_allure_rapide: -5, cible_allure_maximale: -7,
  tireur_allure_lente: -3, tireur_allure_moyenne: -5, tireur_allure_rapide: -7, tireur_allure_maximale: -99,
  couverture_partielle: -3, couverture_importante: -5,
  obscurite_legere: -3, obscurite_importante: -5, obscurite_totale: -99,
  // CaC §6.2 — préfixe cac_ évite les collisions avec keys ranged
  cac_attaquant_cote: -3,
  cac_attaquant_au_sol: -5,
  cac_espace_confine: -3,
  cac_espace_tres_confine: -5,
  cac_position_avantageuse: 3,
  cac_main_non_directrice: -5,
  // cac_terrain_instable : compétence limitative — traité séparément (Math.min)
}
const TAILLE_MODS = {
  minuscule: -10, tres_petite: -5, petite: -3, moyenne: 0,
  grande: 3, tres_grande: 5, enorme: 10, gigantesque: 15,
}
const SITUATION_LABELS = {
  cible_immobile:        'Cible immobile',
  cible_allure_moyenne:  'Cible allure moyenne',
  cible_allure_rapide:   'Cible allure rapide',
  cible_allure_maximale: 'Cible allure maximale',
  tireur_allure_lente:   'Tireur allure lente',
  tireur_allure_moyenne: 'Tireur allure moyenne',
  tireur_allure_rapide:  'Tireur allure rapide',
  couverture_partielle:  'Couverture partielle (50%)',
  couverture_importante: 'Couverture importante (75%)',
  obscurite_legere:      'Obscurité légère',
  obscurite_importante:  'Obscurité importante',
}
const PORTEE_LABELS = {
  bout_portant: 'À bout portant', courte: 'Portée courte',
  moyenne:      'Portée moyenne', longue: 'Portée longue', extreme: 'Portée extrême',
}
const TAILLE_LABELS = {
  minuscule:    'Cible minuscule (~30cm)', tres_petite: 'Cible très petite (~50cm)',
  petite:       'Cible petite (~1m)',      moyenne:     'Cible taille humaine',
  grande:       'Cible grande (~3m)',      tres_grande: 'Cible très grande (~5m)',
  enorme:       'Cible énorme (~7m)',      gigantesque: 'Cible gigantesque (10m+)',
}
const COMBAT_MODE_LABELS = {
  offensif: 'Mode offensif', charge:   'Mode charge',
  defensif: 'Mode défensif', retraite: 'Mode retraite',
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

        // ── Combat state sync — reconnexion en cours de combat (PC14) ────────
        try {
          const activeCombat = await db('combat_state').where({ campaign_id: campaignId }).first()
          if (activeCombat) {
            const [roster, actions] = await Promise.all([
              db('combat_roster').where({ campaign_id: campaignId }),
              db('combat_actions').where({ campaign_id: campaignId }),
            ])
            socket.emit(WS.COMBAT_STATE_SYNC, { combatState: activeCombat, roster, actions })
            // Sync preview éphémère si un joueur est en train de déclarer
            const currentPreview = combatPreviews.get(campaignId)
            if (currentPreview) socket.emit(WS.COMBAT_ANNOUNCE_PREVIEW, currentPreview)
          }
        } catch (err) {
          console.warn('[WS] session:join — combat state sync error (non bloquant):', err.message)
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

    // Joueur ou GM oriente son token vers une direction absolue (r = 0..7)
    // Payload : { tokenId, r } — r validé serveur, jamais fait confiance au client
    socket.on(WS.TOKEN_SET_ROTATION, async ({ tokenId, r }) => {
      try {
        if (!Number.isInteger(r) || r < 0 || r > 7) return

        const token = await db('tokens').where({ id: tokenId }).first()
        if (!token) return

        const isGm = socket.role === 'gm'
        let isOwner = false
        if (token.character_id) {
          const character = await db('characters').where({ id: token.character_id }).first()
          isOwner = character?.user_id === socket.data.userId
        }
        if (!isOwner && !isGm) return

        const [updated] = await db('tokens')
          .where({ id: tokenId })
          .update({ r, updated_at: db.fn.now() })
          .returning('*')

        io.to(socket.campaignId).emit(WS.TOKEN_UPDATED, { token: updated })
      } catch (err) {
        console.error('[WS] token:set_rotation error:', err.message)
      }
    })

    // ─── TOKEN:STATUS_TOGGLE ───────────────────────────────────────────────
    // GM ou propriétaire du token : ajoute ou retire un statut (toggle)
    // Payload : { tokenId, statusCode }
    socket.on(WS.TOKEN_STATUS_TOGGLE, async ({ tokenId, statusCode }) => {
      try {
        const token = await db('tokens').where({ id: tokenId }).first()
        if (!token) return

        const isGm = socket.role === 'gm'
        let isOwner = false
        if (token.character_id) {
          const character = await db('characters').where({ id: token.character_id }).first()
          isOwner = character?.user_id === socket.data.userId
        }
        if (!isOwner && !isGm) return

        const VALID_STATUS_CODES = new Set([
          'grappled', 'restrained', 'off_balance',
          'burning', 'acid', 'asphyxia', 'decompression', 'electrocuted',
          'stunned', 'unconscious', 'blinded',
          'hypothermia', 'infected', 'poisoned', 'irradiated',
        ])
        if (!VALID_STATUS_CODES.has(statusCode)) return

        const existing = await db('token_statuses')
          .where({ token_id: tokenId, status_code: statusCode })
          .first()

        if (existing) {
          await db('token_statuses').where({ id: existing.id }).delete()
        } else {
          await db('token_statuses').insert({
            token_id: tokenId,
            status_code: statusCode,
            applied_by: socket.user.id,
          })
        }

        await emitTokenStatusUpdated(io, socket.campaignId, tokenId)
      } catch (err) {
        console.error('[WS] token:status_toggle error:', err.message)
      }
    })

    // TOKEN_CREATED + TOKEN_DELETED : supprimés — la REST (POST/DELETE /tokens) est le seul
    // émetteur légitime (broadcast + collision map). Ces handlers WS étaient dead code
    // accessible à tout joueur authentifié (vecteur ghost-add/ghost-delete).

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
    // Payload : { formula, secret? } — ex: "2d6+3", "d20", "3d6"
    // secret=true : broadcast uniquement au lanceur + GM (PE2 socket.data.role)
    socket.on(WS.DICE_ROLL, async ({ formula, secret = false }) => {
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
        const payload = {
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
          secret: secret || false,
        }

        if (secret) {
          // Jet au MJ : visible uniquement par le lanceur et le(s) GM (PE2)
          socket.emit(WS.DICE_RESULT, payload)
          if (socket.role !== 'gm') {
            const roomSockets = await io.in(socket.campaignId).fetchSockets()
            const gmSockets = roomSockets.filter(s => s.data.role === 'gm')
            gmSockets.forEach(s => s.emit(WS.DICE_RESULT, payload))
          }
        } else {
          io.to(socket.campaignId).emit(WS.DICE_RESULT, payload)
        }

        console.log(`[WS] dice:roll — ${socket.user.username} : ${normalizedFormula} = ${total}${secret ? ' [secret]' : ''}`)
      } catch (err) {
        console.error(`[WS] dice:roll error (${socket.user.username}) : ${err.message}`)
      }
    })

    // ─── MACRO:ROLL ────────────────────────────────────────────────────────
    // Payload : { macroId, characterId, secret? }
    // Lance un jet lié aux stats vivantes du personnage (PLAN 13).
    socket.on(WS.MACRO_ROLL, async ({ macroId, characterId, secret = false }) => {
      if (!socket.campaignId) return
      try {
        // ── 1. Macro ──────────────────────────────────────────────────────
        const macro = await db('character_macros')
          .where({ id: macroId, character_id: characterId }).first()
        if (!macro) return

        // ── 2. Ownership : propriétaire OU GM ──────────────────────────
        const character = await db('characters').where({ id: characterId }).first()
        if (!character) return
        const isOwner = character.user_id === socket.user.id
        if (!isOwner && socket.role !== 'gm') return

        let color = '#aa8a30'
        try {
          const userRow = await db('users').where({ id: socket.user.id }).select('color').first()
          if (userRow?.color) color = userRow.color
        } catch (_) {}

        // ── 3. Stats du personnage ─────────────────────────────────────
        const sheet = await db('char_sheet').where({ character_id: characterId }).first()
        if (!sheet) return

        const [attrs, archetype] = await Promise.all([
          db('char_attributes').where({ char_sheet_id: sheet.id }),
          db('char_archetype').where({ char_sheet_id: sheet.id }).first(),
        ])
        const genotypeRow = archetype?.genotype_id
          ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
          : null

        // ── 4. Seuil (somme des sources + modificateur fixe) ──────────
        const na = (attrId) => calcAttributeNA(attrs, attrId, genotypeRow)

        const secondaryValue = (key) => {
          switch (key) {
            case 'rea':                return calcREA(na('ADA'), na('PER'))
            case 'seuil_etourdi':      return calcSeuils(na('FOR'), na('CON'), na('VOL')).etourdissement
            case 'seuil_incons':       return calcSeuils(na('FOR'), na('CON'), na('VOL')).inconscience
            case 'souffle':            return calcSouffle(na('CON'), na('VOL'))
            case 'resistance_drogues': return calcResistanceDroguesInput(na('CON'), na('VOL'))
            default:                   return 0
          }
        }

        let baseThreshold = 0
        for (const src of macro.sources) {
          if (src.type === 'attribute') {
            baseThreshold += na(src.ref_id)
          } else if (src.type === 'skill') {
            const [charSkill, refSkill] = await Promise.all([
              db('char_skills').where({ char_sheet_id: sheet.id, skill_id: src.ref_id }).first(),
              db('ref_skills').where({ id: src.ref_id }).first(),
            ])
            baseThreshold += calcSkillTotal(attrs, charSkill, refSkill, genotypeRow)
          } else if (src.type === 'secondary') {
            baseThreshold += secondaryValue(src.ref_id)
          }
        }
        const threshold = baseThreshold + macro.modifier

        // ── 5. Jet 1d20 ───────────────────────────────────────────────
        const { rolls, total: rollResult, seed } = await parseDice('1d20')

        // ── 6. Succès / critique (règles absolues Polaris) ────────────
        const isCriticalSuccess = rollResult === 1
        const isCriticalFail    = rollResult === 20
        const isSuccess = isCriticalFail ? false
          : isCriticalSuccess ? true
          : rollResult <= threshold

        // ── 7. Substitution template ──────────────────────────────────
        const sourceLabel  = macro.sources.map(s => s.ref_label).join(' + ')
        const successText  = isSuccess ? 'Succès' : 'Échec'
        const critiqueText = isCriticalSuccess ? 'critique !' : isCriticalFail ? 'fumble !' : ''
        const modDisplay   = macro.modifier > 0 ? `+${macro.modifier}`
          : macro.modifier < 0 ? `${macro.modifier}` : ''

        const tpl = macro.template || '{me} — {source} → {résultat}/{seuil} → {succès} {critique}'
        const formattedMessage = tpl
          .replace(/\{me\}/g,           character.name || '?')
          .replace(/\{source\}/g,       sourceLabel)
          .replace(/\{résultat\}/g,     String(rollResult))
          .replace(/\{seuil\}/g,        String(threshold))
          .replace(/\{modificateur\}/g, modDisplay)
          .replace(/\{succès\}/g,       successText)
          .replace(/\{critique\}/g,     critiqueText)
          .trim()

        // ── 8. Broadcast ───────────────────────────────────────────────
        const payload = {
          macroId,
          characterId,
          characterName:    character.name,
          color,
          sourceLabel,
          rollResult,
          threshold,
          modifier:         macro.modifier,
          isSuccess,
          isCriticalSuccess,
          isCriticalFail,
          formattedMessage,
          secret,
          seed,
          timestamp: new Date().toISOString(),
        }

        if (secret) {
          socket.emit(WS.MACRO_ROLL_RESULT, payload)
          if (socket.role !== 'gm') {
            const roomSockets = await io.in(socket.campaignId).fetchSockets()
            const gmSockets = roomSockets.filter(s => s.data.role === 'gm')
            gmSockets.forEach(s => s.emit(WS.MACRO_ROLL_RESULT, payload))
          }
        } else {
          io.to(socket.campaignId).emit(WS.MACRO_ROLL_RESULT, payload)
        }

        console.log(`[WS] macro:roll — ${socket.user.username} : ${macro.label} = ${rollResult}/${threshold} → ${successText}${secret ? ' [secret]' : ''}`)
      } catch (err) {
        console.error(`[WS] macro:roll error (${socket.user.username}) : ${err.message}`)
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
          let effectiveMalus = 0
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

            // ── Malus effectif (blessures + encombrement) ──────────────────────
            try {
              const wounds = await db('character_wounds').where({ char_sheet_id: sheet.id })
              const woundPenalty = calcWoundPenalty(wounds)

              const forAttr = attrs.find(a => a.attr_id === 'FOR')
              const forValue = (forAttr?.base_level ?? 7) + (forAttr?.pc_modifier ?? 0)

              const invItems = await db('char_inventory')
                .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
                .where({ 'char_inventory.character_id': pending.characterId })
                .select('char_inventory.container', 'ref_equipment.weight as ref_weight', 'char_inventory.quantity')

              const totalWeight = invItems.reduce((sum, item) => {
                if (item.container === 'Coffre') return sum
                if (item.ref_weight == null) return sum
                return sum + item.ref_weight * item.quantity
              }, 0)

              const encumbrancePenalty = calcEncumbrancePenalty(totalWeight, forValue)
              effectiveMalus = woundPenalty - encumbrancePenalty

              if (effectiveMalus < 0) console.log(`[DBG] entity:action_resolve — malus actif ${effectiveMalus} pour character ${pending.characterId}`)
            } catch (malusErr) {
              console.warn('[WS] entity:action_resolve — calcul malus échoué, fallback 0:', malusErr.message)
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
          const chancesDeReussite = mechanicalTotal + totalDiffMod + effectiveMalus
          const isSuccess = diceRoll <= chancesDeReussite
          const diffLabel = totalDiffMod >= 0 ? `+${totalDiffMod}` : `${totalDiffMod}`

          const breakdown = [
            { label: formulaLabel, value: mechanicalTotal, type: 'base' },
            ...(pending.defaultDifficulty !== 0 ? [{ label: 'Difficulté', value: pending.defaultDifficulty, type: pending.defaultDifficulty > 0 ? 'bonus' : 'malus' }] : []),
            ...(gmModifier !== 0 ? [{ label: 'Modificateur GM', value: gmModifier, type: gmModifier > 0 ? 'bonus' : 'malus' }] : []),
            ...(effectiveMalus !== 0 ? [{ label: 'Malus santé / encombrement', value: effectiveMalus, type: 'malus' }] : []),
            { label: 'Seuil', value: chancesDeReussite, type: 'total' },
          ]

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
            effectiveMalus,
            diffLabel,
            isSuccess,
            breakdown,
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
        const breakdownDisp = [
          { label: ATTR_LABELS[attributeId] || attributeId, value: attributeNA, type: 'base' },
          ...(effectiveDifficulty !== 0 ? [{ label: 'Difficulté', value: effectiveDifficulty, type: effectiveDifficulty > 0 ? 'bonus' : 'malus' }] : []),
          { label: 'Seuil', value: chancesDeReussite, type: 'total' },
        ]
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
          breakdown: breakdownDisp,
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

    // ─── COMBAT:START ─────────────────────────────────────────────────────
    // GM démarre un combat. Calcule le roster d'initiative depuis les tokens
    // présents sur la battlemap, insère combat_state + combat_roster en DB,
    // puis broadcast COMBAT_STARTED à toute la room.
    // Payload : { battlemap_id, surprisedTokenIds: UUID[] }
    socket.on(WS.COMBAT_START, async ({ battlemap_id, surprisedTokenIds = [], excludedTokenIds = [] }) => {
      if (socket.role !== 'gm') return
      const campaignId = socket.campaignId
      try {
        // Guard — combat déjà en cours
        const existing = await db('combat_state').where({ campaign_id: campaignId }).first()
        if (existing) {
          socket.emit('error', { message: 'Combat déjà en cours pour cette campagne' })
          return
        }

        // Lire le timer configuré pour cette campagne
        const campaignRow = await db('campaigns').where({ id: campaignId }).select('action_timer_sec').first()
        const actionTimerSec = campaignRow?.action_timer_sec ?? 0

        // Guard — tokens présents sur la carte (hors exclus GM)
        const allTokens = await db('tokens').where({ battlemap_id })
        const tokens = allTokens.filter(t => !excludedTokenIds.includes(t.id))
        if (tokens.length === 0) {
          socket.emit('error', { message: 'Aucun personnage sur la carte' })
          return
        }

        // Calcul base_ini (REA) pour chaque token via char_sheet
        const rosterData = []
        for (const token of tokens) {
          // Entité de décor (porte, console) — pas un personnage, ignorée en combat
          if (!token.character_id) {
            console.warn(`[COMBAT_START] Token ${token.id} sans character_id (Entité) — ignoré`)
            continue
          }
          let base_ini = 0
          let character = null
          try {
            // PD1 — fetcher character en premier pour détecter le type avant d'accéder à char_sheet
            character = await db('characters').where({ id: token.character_id }).first()

            if (character?.type === 'drone') {
              // Drone : INI 12 fixe (LdB p.320), pas de char_sheet, pas de surprise
              rosterData.push({ token, base_ini: 12, character, is_pnj: false, forcedNotSurprised: true })
              continue
            }

            const cs = await db('char_sheet').where({ character_id: token.character_id }).first()
            if (!cs) {
              console.warn(`[COMBAT_START] char_sheet introuvable pour token ${token.id}`)
            } else {
              const [attrs, archetype] = await Promise.all([
                db('char_attributes').where({ char_sheet_id: cs.id }),
                db('char_archetype').where({ char_sheet_id: cs.id }).first(),
              ])
              const genotypeRow = archetype?.genotype_id
                ? await db('ref_genotypes').where({ id: archetype.genotype_id }).first()
                : null
              const ada_na = calcAttributeNA(attrs, 'ADA', genotypeRow)
              const per_na = calcAttributeNA(attrs, 'PER', genotypeRow)
              base_ini = calcREA(ada_na, per_na)
            }
          } catch (err) {
            console.warn(`[COMBAT_START] Erreur calcul INI token ${token.id}:`, err.message)
          }
          const is_pnj = character?.type === 'pnj'
          rosterData.push({ token, base_ini, character, is_pnj })
        }

        // Tri DESC initiative — égalités résolues par Math.random() (LdB : simultanéité)
        rosterData.sort((a, b) => b.base_ini - a.base_ini || Math.random() - 0.5)

        // Construction des lignes roster
        const rosterRows = rosterData.map(({ token, base_ini, is_pnj, forcedNotSurprised }) => {
          const is_surprised = !forcedNotSurprised && surprisedTokenIds.includes(token.id)
          let surprise_roll = null
          let initiative = base_ini
          // PNJ surpris : jet auto côté serveur
          if (is_surprised && is_pnj) {
            surprise_roll = Math.ceil(Math.random() * 20)
            initiative = base_ini + surprise_roll
          }
          return {
            campaign_id: campaignId,
            token_id: token.id,
            is_surprised,
            surprise_roll,
            base_ini,
            initiative,
            status: 'active',
            has_announced: false,
            has_resolved: false,
          }
        })

        // Insertion DB
        await db('combat_state').insert({
          campaign_id: campaignId,
          battlemap_id,
          phase: 'ROSTER',
          current_turn: 1,
          active_slot_idx: 0,
          action_timer_sec: actionTimerSec,
        })
        const insertedRoster = await db('combat_roster').insert(rosterRows).returning('*')

        // Joueurs surpris (non-PNJ) : émettre COMBAT_SURPRISE_ROLL via fetchSockets
        const surprisedPlayers = rosterData.filter(({ token, is_pnj }) =>
          surprisedTokenIds.includes(token.id) && !is_pnj
        )
        if (surprisedPlayers.length > 0) {
          const roomSockets = await io.in(campaignId).fetchSockets()
          for (const { token, character } of surprisedPlayers) {
            const targetSocket = roomSockets.find(s => s.data.userId === character?.user_id)
            if (targetSocket) {
              targetSocket.emit(WS.COMBAT_SURPRISE_ROLL, { tokenId: token.id })
            }
          }
        }

        // Broadcast COMBAT_STARTED — sans surprise_roll (PC25)
        const broadcastRoster = insertedRoster.map(({ surprise_roll: _sr, ...rest }) => rest)
        io.to(campaignId).emit(WS.COMBAT_STARTED, { roster: broadcastRoster, phase: 'ROSTER' })

        console.log(`[WS] combat:start — ${socket.user.username} → ${tokens.length} participants (campagne ${campaignId})`)
      } catch (err) {
        console.error('[WS] combat:start error:', err.message)
        socket.emit('error', { message: 'Erreur lors du démarrage du combat' })
      }
    })

    // ─── COMBAT:END ───────────────────────────────────────────────────────
    // GM termine le combat. Nettoie tous les timers (PC19), supprime les 3
    // tables combat dans l'ordre des FK, puis broadcast COMBAT_ENDED.
    socket.on(WS.COMBAT_END, async () => {
      if (socket.role !== 'gm') return
      const campaignId = socket.campaignId
      try {
        // PC19 — clearTimeout AVANT delete
        const timers = combatTimers.get(campaignId)
        if (timers) {
          for (const timeoutId of timers.values()) {
            clearTimeout(timeoutId)
          }
          combatTimers.delete(campaignId)
        }

        await db('combat_actions').where({ campaign_id: campaignId }).delete()

        // Nettoyer les statuts stunned/unconscious des tokens du roster avant suppression
        const rosterTokenIds = await db('combat_roster')
          .where({ campaign_id: campaignId })
          .pluck('token_id')
        if (rosterTokenIds.length > 0) {
          const affected = await db('token_statuses')
            .whereIn('token_id', rosterTokenIds)
            .whereIn('status_code', ['stunned', 'unconscious'])
            .select('token_id')
          if (affected.length > 0) {
            await db('token_statuses')
              .whereIn('token_id', rosterTokenIds)
              .whereIn('status_code', ['stunned', 'unconscious'])
              .delete()
            const affectedIds = [...new Set(affected.map(r => r.token_id))]
            for (const tid of affectedIds) {
              await emitTokenStatusUpdated(io, campaignId, tid)
            }
          }
        }

        await db('combat_roster').where({ campaign_id: campaignId }).delete()
        await db('combat_state').where({ campaign_id: campaignId }).delete()

        combatPreviews.delete(campaignId)
        io.to(campaignId).emit(WS.COMBAT_ENDED)

        console.log(`[WS] combat:end — ${socket.user.username} (campagne ${campaignId})`)
      } catch (err) {
        console.error('[WS] combat:end error:', err.message)
        socket.emit('error', { message: 'Erreur lors de la fin du combat' })
      }
    })

    // ─── COMBAT:ANNOUNCE_START ────────────────────────────────────────────
    // GM passe de la phase ROSTER à ANNOUNCEMENT.
    // Démarre les timers auto-skip pour les joueurs (PC17 : skip si action_timer_sec > 0).
    socket.on(WS.COMBAT_ANNOUNCE_START, async () => {
      if (socket.role !== 'gm') return
      const campaignId = socket.campaignId
      try {
        // Guard phase — doit être en ROSTER
        const existing = await db('combat_state').where({ campaign_id: campaignId }).first()
        if (!existing || existing.phase !== 'ROSTER') return

        const [updated] = await db('combat_state')
          .where({ campaign_id: campaignId })
          .update({ phase: 'ANNOUNCEMENT', updated_at: db.fn.now() })
          .returning('action_timer_sec')
        if (!updated) return

        io.to(campaignId).emit(WS.COMBAT_PHASE_CHANGED, { phase: 'ANNOUNCEMENT' })

        // PC17 — timers auto-skip uniquement si action_timer_sec > 0
        await startAnnouncementTimers(io, campaignId, updated.action_timer_sec, socket.user.id)

        // LdB p.212 — annonce séquentielle : émettre le premier slot (base_ini ASC)
        const firstAnnounceSlot = await db('combat_roster')
          .where({ campaign_id: campaignId, has_announced: false, status: 'active' })
          .orderBy('base_ini', 'asc').orderBy('token_id', 'asc')
          .first()
        if (firstAnnounceSlot) {
          io.to(campaignId).emit(WS.COMBAT_SLOT_ADVANCED, { activeSlotIdx: 0, tokenId: firstAnnounceSlot.token_id })
        }

        console.log(`[WS] combat:announce_start — ${socket.user.username} (campagne ${campaignId})`)
      } catch (err) {
        console.error('[WS] combat:announce_start error:', err.message)
      }
    })

    // ─── COMBAT:INIT_STATE ────────────────────────────────────────────────
    // Joueur déclare son état initial (posture/arme/mode de tir) en phase ROSTER.
    socket.on(WS.COMBAT_INIT_STATE, async ({ tokenId, position, weapon, fire_mode }) => {
      if (socket.role === 'gm') return
      const campaignId = socket.campaignId
      try {
        const VALID_POS = new Set(['standing', 'crouching', 'prone'])
        const VALID_WPN = new Set(['holstered', 'ready', 'drawn'])
        const VALID_FM  = new Set(['cc', 'rc', 'rl'])
        if (!VALID_POS.has(position) || !VALID_WPN.has(weapon) || !VALID_FM.has(fire_mode)) return

        const existing = await db('combat_state').where({ campaign_id: campaignId }).first()
        if (!existing || existing.phase !== 'ROSTER') return

        const token = await db('tokens').where({ id: tokenId }).first()
        if (!token?.character_id) return
        const character = await db('characters').where({ id: token.character_id }).first()
        if (!character || character.user_id !== socket.user.id) return

        await db('combat_roster')
          .where({ campaign_id: campaignId, token_id: tokenId })
          .update({
            state_position:  position,
            state_weapon:    weapon,
            state_fire_mode: fire_mode,
            state_character: db.raw('state_character || ?::jsonb', [JSON.stringify({ init_state_confirmed: true })]),
          })

        const updatedRoster = await db('combat_roster').where({ campaign_id: campaignId })
        const broadcastRoster = updatedRoster.map(({ surprise_roll: _sr, ...rest }) => rest)
        io.to(campaignId).emit(WS.COMBAT_ROSTER_UPDATED, { roster: broadcastRoster })

        console.log(`[WS] combat:init_state — ${socket.user.username} pos:${position} wpn:${weapon} fm:${fire_mode}`)
      } catch (err) {
        console.error('[WS] combat:init_state error:', err.message)
      }
    })

    // ─── COMBAT:SURPRISE_RESULT ───────────────────────────────────────────
    // Joueur surpris déclenche son jet 1d20 — le serveur génère le dé côté serveur.
    // Payload : { tokenId }
    socket.on(WS.COMBAT_SURPRISE_RESULT, async ({ tokenId }) => {
      const campaignId = socket.campaignId
      try {
        // Validation ownership
        const token = await db('tokens').where({ id: tokenId }).first()
        if (!token) return
        const character = await db('characters').where({ id: token.character_id }).first()
        if (!character || character.user_id !== socket.user.id) return

        const entry = await db('combat_roster')
          .where({ campaign_id: campaignId, token_id: tokenId })
          .first()
        if (!entry || !entry.is_surprised) return

        // Génération serveur du d20 — résultat non manipulable par le client
        const { rolls, total: diceRoll, seed } = await parseDice('1d20')
        // Test de Réaction : roll ≤ base_ini → succès (LdB Polaris p.213-214)
        const isSuccess = diceRoll <= entry.base_ini
        const timestamp = new Date().toISOString()

        // Couleur joueur pour DICE_RESULT
        let color = '#5b8dee'
        try {
          const userRow = await db('users').where({ id: socket.user.id }).select('color').first()
          if (userRow?.color) color = userRow.color
        } catch (_) {}

        // Broadcast DICE_RESULT — chat + animation dés (pas de skillLabel → animation active)
        io.to(campaignId).emit(WS.DICE_RESULT, {
          userId: socket.user.id,
          username: socket.user.username,
          color,
          formula: '1d20',
          rolls,
          total: diceRoll,
          isCriticalSuccess: false,
          isCriticalFail: false,
          seed,
          timestamp,
        })

        if (isSuccess) {
          // Succès : initiative = résultat du dé (marge de réussite = le score du dé)
          console.log(`[DBG] surprise_result: SUCCÈS roll:${diceRoll} ≤ base_ini:${entry.base_ini} → ini:${diceRoll}`)
          const rowsUpdated = await db('combat_roster')
            .where({ campaign_id: campaignId, token_id: tokenId })
            .update({ surprise_roll: diceRoll, initiative: diceRoll, updated_at: db.fn.now() })
          console.log(`[DBG] surprise_result: rows updated=${rowsUpdated}`)
        } else {
          // Échec : initiative = 0, auto-skip, ne peut pas agir ce tour
          console.log(`[DBG] surprise_result: ÉCHEC roll:${diceRoll} > base_ini:${entry.base_ini} → ini:0`)
          const rowsUpdated = await db('combat_roster')
            .where({ campaign_id: campaignId, token_id: tokenId })
            .update({ surprise_roll: diceRoll, initiative: 0, has_announced: true, updated_at: db.fn.now() })
          console.log(`[DBG] surprise_result: rows updated=${rowsUpdated}`)
          await db('combat_actions').insert({
            campaign_id: campaignId,
            token_id: tokenId,
            type: 'skip',
            action_key: 'skip',
            sequence: 99,
            status: 'skipped',
          })
          // PC13 — tous annoncés → phase Résolution
          const [{ count }] = await db('combat_roster')
            .where({ campaign_id: campaignId, has_announced: false })
            .count('* as count')
          if (parseInt(count) === 0) {
            await startResolutionPhase(io, campaignId)
          }
        }

        // Broadcast roster mis à jour — sans surprise_roll (PC25)
        const updatedRoster = await db('combat_roster').where({ campaign_id: campaignId })
        console.log(`[DBG] surprise_result: roster fetched count=${updatedRoster.length} initiatives=${JSON.stringify(updatedRoster.map(r => ({ t: r.token_id.slice(-6), ini: r.initiative })))}`)
        const broadcastRoster = updatedRoster.map(({ surprise_roll: _sr, ...rest }) => rest)
        io.to(campaignId).emit(WS.COMBAT_ROSTER_UPDATED, { roster: broadcastRoster })

        console.log(`[WS] combat:surprise_result — ${socket.user.username} token:${tokenId} roll:${diceRoll} success:${isSuccess} ini:${isSuccess ? diceRoll : 0}`)
      } catch (err) {
        console.error('[WS] combat:surprise_result error:', err.message)
      }
    })

    // ─── COMBAT:ACTION_DECLARE v2 ─────────────────────────────────────────
    // Joueur (ou GM pour un PNJ) déclare son action pendant la phase ANNOUNCEMENT.
    // Payload v2 : { tokenId, state:{position,weapon,fire_mode,cover,vitesse}, mapActions:{move?,attack?,melee?,multi?,interact?}, quick:{observer,reperer,phrase} }
    socket.on(WS.COMBAT_ACTION_DECLARE, async ({ tokenId, state, mapActions, quick }) => {
      const campaignId = socket.campaignId
      try {
        if (!tokenId || !state) return

        // Valeurs autorisées par état
        const VALID_STATES = {
          position:     ['standing', 'crouching', 'prone'],
          weapon:       ['holstered', 'ready', 'drawn'],
          fire_mode:    ['cc', 'rc', 'rl'],
          cover:        ['exposed', 'partial', 'important'],
          vitesse:      ['normal', 'delayed', 'rushed'],
          combat_mode:  ['normal', 'offensif', 'charge', 'defensif', 'retraite'],
        }
        for (const [k, vals] of Object.entries(VALID_STATES)) {
          if (state[k] && !vals.includes(state[k])) return
        }

        // PC33 — coordonnées déplacement obligatoires si move (coords DB PE14)
        if (mapActions?.move) {
          const px = parseInt(mapActions.move.targetPosX)
          const py = parseInt(mapActions.move.targetPosY)
          const pz = parseInt(mapActions.move.targetPosZ ?? 0)
          if (isNaN(px) || isNaN(py) || isNaN(pz)) {
            socket.emit('error', { message: 'Coordonnées de déplacement invalides (PC33)' })
            return
          }
        }

        // Validation ownership (joueur pour PJ, GM pour PNJ)
        const token = await db('tokens').where({ id: tokenId }).first()
        if (!token) return
        // PC27 — entité de décor : ne déclare pas d'action en combat
        if (!token.character_id) return
        const character = await db('characters').where({ id: token.character_id }).first()
        if (!character) return
        if (character.type === 'pnj') {
          if (socket.role !== 'gm') return
        } else if (character.type === 'drone') {
          const isOwner = character.user_id && character.user_id === socket.user.id
          if (socket.role !== 'gm' && !isOwner) return
        } else {
          if (character.user_id !== socket.user.id) return
        }

        const entry = await db('combat_roster')
          .where({ campaign_id: campaignId, token_id: tokenId })
          .first()
        if (!entry || entry.has_announced) return

        // LdB p.212 — guard ordre d'annonce : seul le slot actuel (base_ini ASC) peut déclarer
        const announceState = await db('combat_state').where({ campaign_id: campaignId }).first()
        if (!announceState || announceState.phase !== 'ANNOUNCEMENT') return
        const firstNonAnnounced = await db('combat_roster')
          .where({ campaign_id: campaignId, has_announced: false, status: 'active' })
          .orderBy('base_ini', 'asc').orderBy('token_id', 'asc')
          .first()
        if (!firstNonAnnounced || firstNonAnnounced.token_id !== tokenId) {
          socket.emit(WS.COMBAT_DECLARE_ERROR, { message: "Ce n'est pas encore votre tour de déclarer" })
          return
        }

        // Stun guard — is_stunned lit depuis token_statuses (source unique post-Sprint 14-0)
        const stunRow = await db('token_statuses').where({ token_id: tokenId, status_code: 'stunned' }).first()
        if (stunRow) {
          if (mapActions?.attack) {
            socket.emit(WS.COMBAT_DECLARE_ERROR, { message: "Assommé — ne peut pas attaquer" })
            return
          }
          if (mapActions?.melee?.length > 0) {
            socket.emit(WS.COMBAT_DECLARE_ERROR, { message: "Assommé — ne peut pas attaquer au corps à corps" })
            return
          }
          const ak = mapActions?.move?.action_key
          if (ak === 'move_rapide' || ak === 'move_max') {
            socket.emit(WS.COMBAT_DECLARE_ERROR, { message: "Assommé — allure maximale : Moyenne" })
            return
          }
        }

        const isDrone = character.type === 'drone'

        // PC22 — arme requise pour assaut + PC23 (TIR_AUTOMATIQUE pour RC/RL)
        let assaultWeaponRefRange = null
        if (mapActions?.attack) {
          if (isDrone) {
            // Drone : validation droneWeaponInvId contre drone_weapons
            const { droneWeaponInvId } = mapActions.attack
            if (!droneWeaponInvId) {
              socket.emit('error', { message: 'Arme drone requise pour un assaut (PC22-D)' })
              return
            }
            const droneWeapon = await db('drone_weapons')
              .leftJoin('ref_equipment', 'drone_weapons.equipment_id', 'ref_equipment.id')
              .where({ 'drone_weapons.id': droneWeaponInvId, 'drone_weapons.character_id': character.id })
              .select('drone_weapons.*', 'ref_equipment.range as ref_range')
              .first()
            if (!droneWeapon) {
              socket.emit('error', { message: "Arme drone introuvable (PC22-D)" })
              return
            }
            assaultWeaponRefRange = droneWeapon.ref_range ?? null
          } else {
            // Humanoïde : validation char_inventory + PC23
            const { weaponInvId } = mapActions.attack
            if (!weaponInvId) {
              socket.emit('error', { message: 'Arme requise pour un assaut (PC22)' })
              return
            }
            const weapon = await db('char_inventory')
              .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
              .where({ 'char_inventory.id': weaponInvId, 'char_inventory.character_id': character.id })
              .select('char_inventory.slot', 'char_inventory.ammo_remaining', 'ref_equipment.range as ref_range', 'ref_equipment.fire_mode as ref_fire_mode')
              .first()
            if (!weapon) {
              socket.emit('error', { message: "Arme introuvable dans l'inventaire (PC22)" })
              return
            }
            if (!['MG', 'MD', '2M', 'Tr'].includes(weapon.slot)) {
              socket.emit('error', { message: "L'arme doit être équipée (slot arme) (PC22)" })
              return
            }
            // fire_mode vient de state.fire_mode (v2) — comparaison insensible à la casse
            const fireMode = (state.fire_mode ?? 'cc').toUpperCase()
            if (weapon.ref_fire_mode && !weapon.ref_fire_mode.toUpperCase().includes(fireMode)) {
              socket.emit('error', { message: `Mode de tir ${fireMode} non disponible pour cette arme` })
              return
            }
            assaultWeaponRefRange = weapon.ref_range ?? null
            // PC23 — TIR_AUTOMATIQUE requis pour RC/RL
            if (fireMode === 'RC' || fireMode === 'RL') {
              const sheet = await db('char_sheet').where({ character_id: character.id }).first()
              const autoSkill = sheet
                ? await db('char_skills').where({ char_sheet_id: sheet.id, skill_id: 'TIR_AUTOMATIQUE' }).first()
                : null
              if (!autoSkill) {
                socket.emit('error', { message: 'Compétence Tir Automatique requise (PC23)' })
                return
              }
            }
            // Vérification munitions ANNOUNCEMENT (MANUELSYSCOMBAT §4)
            // ammo_remaining null = tracking désactivé (arme sans chargeur) → pas de vérification
            const bulletCount = mapActions.attack.bulletCount ?? 1
            if (weapon.ammo_remaining !== null && weapon.ammo_remaining < bulletCount) {
              let pnjUnlimited = false
              if (character.type === 'pnj') {
                const campaign = await db('campaigns').where({ id: campaignId }).select('pnj_unlimited_ammo').first()
                pnjUnlimited = campaign?.pnj_unlimited_ammo ?? false
              }
              if (!pnjUnlimited) {
                socket.emit(WS.COMBAT_DECLARE_ERROR, { message: "Munitions insuffisantes — rechargez d'abord" })
                return
              }
            }
          }
        }

        // Matrices de coût de transition INI (miroir de STATE_DEFS dans combatSections.js)
        const STATE_COSTS = {
          position:  { standing: { crouching: -3, prone: -5 }, crouching: { standing: -3, prone: -5 }, prone: { standing: -10, crouching: -10 } },
          weapon:    { holstered: { ready: -3, drawn: -5 }, ready: { holstered: -5, drawn: -3 }, drawn: { holstered: -10, ready: -3 } },
          fire_mode: { cc: { rc: -3, rl: -3 }, rc: { cc: -3, rl: -3 }, rl: { cc: -3, rc: -3 } },
          cover:     {},
          vitesse:   { delayed: { normal: 0, rushed: 3 }, normal: { delayed: 0, rushed: 3 }, rushed: { delayed: 0, normal: 0 } },
        }
        const transitionCost = (costs, from, to) => from === to ? 0 : (costs?.[from]?.[to] ?? 0)

        let iniDelta = 0
        if (!isDrone) {
          for (const key of ['position', 'weapon', 'fire_mode', 'cover', 'vitesse']) {
            const from = entry['state_' + key]
            const to   = state[key] ?? from
            iniDelta += transitionCost(STATE_COSTS[key], from, to)
          }
          // Charge/Retraite : déplacement gratuit — override ini_mod serveur (non trusté client)
          const freeMove = (state.combat_mode === 'charge' || state.combat_mode === 'retraite') && !!mapActions?.move
          if (mapActions?.move)  iniDelta += freeMove ? 0 : (mapActions.move.ini_mod ?? 0)
          if (Array.isArray(mapActions?.melee) && mapActions.melee.length > 0) {
            iniDelta += -3
            if (mapActions.melee.length > 1) iniDelta += -5
          }
          if (mapActions?.attack?.cover_shot) {
            iniDelta += state.cover === 'important' ? -5 : -3
          }
          iniDelta += (quick?.observer ?? 0) * -5
          iniDelta += (quick?.reperer  ?? 0) * -5
          if (quick?.phrase) iniDelta += -3
        }

        // Construction des lignes combat_actions (PC32 — sequence attribué serveur)
        const getType = (key) => {
          if (key === 'assault') return 'assault'
          if (key === 'move_lente') return 'move_short'
          if (key.startsWith('move_')) return 'move_long'
          return 'micro'
        }

        const actionRows = []

        if (mapActions?.move) {
          const px = parseInt(mapActions.move.targetPosX)
          const py = parseInt(mapActions.move.targetPosY)
          const pz = parseInt(mapActions.move.targetPosZ ?? 0)
          const ak = mapActions.move.action_key
          actionRows.push({
            campaign_id: campaignId, token_id: tokenId,
            action_key: ak, type: getType(ak), sequence: 1,
            target_pos_x: px, target_pos_y: py, target_pos_z: pz,
            modifiers: JSON.stringify({ ini_mod: mapActions.move.ini_mod ?? 0 }),
            status: 'pending',
          })
        }

        if (mapActions?.attack) {
          const { weaponInvId, droneWeaponInvId, targetTokenId, bulletCount, fireModeBonusComp, fireModeBonusDmg, isDualWield, dualWieldBonusComp } = mapActions.attack
          actionRows.push({
            campaign_id:          campaignId, token_id: tokenId,
            action_key:           'assault', type: 'assault', sequence: 3,
            weapon_inv_id:        isDrone ? null : (weaponInvId ?? null),
            drone_weapon_inv_id:  isDrone ? (droneWeaponInvId ?? null) : null,
            target_token_id:      targetTokenId ?? null,
            fire_mode:            state.fire_mode ?? null,
            bullet_count:         bulletCount ?? null,
            fire_mode_bonus_comp: fireModeBonusComp ?? null,
            fire_mode_bonus_dmg:  fireModeBonusDmg ?? null,
            modifiers:            JSON.stringify({ ini_mod: 0, ref_range: assaultWeaponRefRange, dual_wield: isDualWield ?? false, dual_wield_bonus_comp: dualWieldBonusComp ?? 0 }),
            status:               'pending',
          })
        }

        // Phase 1 : intention enregistrée sans validation distance (vérifiée en Phase 2)
        // mapActions.melee est un array : [{ targetTokenId, weaponInvId }, ...]
        if (Array.isArray(mapActions?.melee)) {
          for (const { targetTokenId: meleeTargetId, weaponInvId: meleeWeaponId } of mapActions.melee) {
            if (meleeTargetId) {
              actionRows.push({
                campaign_id: campaignId, token_id: tokenId,
                action_key: 'melee', type: 'melee', sequence: 3,
                weapon_inv_id: meleeWeaponId ?? null,
                target_token_id: meleeTargetId,
                modifiers: JSON.stringify({ ini_mod: -3 }),
                status: 'pending',
              })
            }
          }
        }

        if (mapActions?.interact) {
          actionRows.push({
            campaign_id: campaignId, token_id: tokenId,
            action_key: 'interact', type: 'micro', sequence: 2,
            modifiers: JSON.stringify({ ini_mod: 0 }), status: 'pending',
          })
        }

        if (mapActions?.reload) {
          const reloadData = typeof mapActions.reload === 'object' ? mapActions.reload : {}
          actionRows.push({
            campaign_id:  campaignId, token_id: tokenId,
            action_key:   'reload', type: 'reload', sequence: 3,
            weapon_inv_id: reloadData.weapon_inv_id ?? null,
            modifiers:    JSON.stringify({ ini_mod: 0, ammo_item_id: reloadData.ammo_item_id ?? null }),
            status:       'pending',
          })
        }

        if ((quick?.observer ?? 0) > 0) {
          actionRows.push({
            campaign_id: campaignId, token_id: tokenId,
            action_key: 'observer', type: 'micro', sequence: 2,
            modifiers: JSON.stringify({ ini_mod: quick.observer * -5 }), status: 'pending',
          })
        }

        if ((quick?.reperer ?? 0) > 0) {
          actionRows.push({
            campaign_id: campaignId, token_id: tokenId,
            action_key: 'reperer', type: 'micro', sequence: 2,
            modifiers: JSON.stringify({ ini_mod: quick.reperer * -5 }), status: 'pending',
          })
        }

        if (quick?.phrase) {
          actionRows.push({
            campaign_id: campaignId, token_id: tokenId,
            action_key: 'phrase', type: 'micro', sequence: 2,
            modifiers: JSON.stringify({ ini_mod: -3 }), status: 'pending',
          })
        }

        // Guard : CaC déclaré sans aucune cible → has_announced non settée, erreur explicite
        if (Array.isArray(mapActions?.melee) && mapActions.melee.length > 0
            && !mapActions.melee.some(m => m.targetTokenId)) {
          socket.emit(WS.COMBAT_DECLARE_ERROR, { message: 'Corps à corps : sélectionner une cible avant de valider.' })
          return
        }

        // UPDATE combat_roster — états + initiative + has_announced
        const [updated] = await db('combat_roster')
          .where({ campaign_id: campaignId, token_id: tokenId })
          .update({
            state_position:    state.position     ?? entry.state_position,
            state_weapon:      state.weapon       ?? entry.state_weapon,
            state_fire_mode:   state.fire_mode ?? entry.state_fire_mode,
            state_cover:       state.cover        ?? entry.state_cover,
            state_vitesse:     state.vitesse      ?? entry.state_vitesse,
            state_combat_mode: state.combat_mode  ?? entry.state_combat_mode,
            initiative:        db.raw('initiative + ?', [iniDelta]),
            has_announced:     true,
            updated_at:        db.fn.now(),
          })
          .returning(['initiative'])

        const updatedInitiative = updated.initiative

        if (actionRows.length > 0) await db('combat_actions').insert(actionRows)

        // Dériver actionType pour le broadcast
        let actionType = 'micro'
        if (mapActions?.attack)      actionType = 'assault'
        else if (mapActions?.move)   actionType = getType(mapActions.move.action_key)
        else if (mapActions?.melee)  actionType = 'melee'
        else if (mapActions?.reload) actionType = 'reload'

        io.to(campaignId).emit(WS.COMBAT_ACTION_DECLARED, {
          tokenId,
          actionType,
          initiative_score: updatedInitiative,
          initiative:       updatedInitiative,
          // Coords PE14 destination déplacement (pour ghost spectateurs)
          moveTarget: mapActions?.move
            ? { x: mapActions.move.targetPosX, y: mapActions.move.targetPosY, z: mapActions.move.targetPosZ }
            : null,
          // Token cible (tir ou CaC, pour ligne d'annonce spectateurs)
          attackTargetId: mapActions?.attack?.targetTokenId
            ?? mapActions?.melee?.[0]?.targetTokenId
            ?? null,
        })

        // Nettoyer le timer auto-skip si actif
        const campaignTimersMap = combatTimers.get(campaignId)
        if (campaignTimersMap?.has(tokenId)) {
          clearTimeout(campaignTimersMap.get(tokenId))
          campaignTimersMap.delete(tokenId)
        }

        // Purger le preview éphémère — le joueur a confirmé sa déclaration
        combatPreviews.delete(campaignId)

        // PC13 — tous annoncés → phase Résolution, sinon émettre le slot suivant (LdB p.212)
        const [{ count }] = await db('combat_roster')
          .where({ campaign_id: campaignId, has_announced: false })
          .count('* as count')
        if (parseInt(count) === 0) {
          await startResolutionPhase(io, campaignId)
        } else {
          const nextAnnounceSlot = await db('combat_roster')
            .where({ campaign_id: campaignId, has_announced: false, status: 'active' })
            .orderBy('base_ini', 'asc').orderBy('token_id', 'asc')
            .first()
          if (nextAnnounceSlot) {
            io.to(campaignId).emit(WS.COMBAT_SLOT_ADVANCED, { activeSlotIdx: 0, tokenId: nextAnnounceSlot.token_id })
          }
        }

        console.log(`[WS] combat:action_declare v2 — ${socket.user.username} state:${JSON.stringify(state)} iniDelta:${iniDelta} -> ${updatedInitiative}`)
      } catch (err) {
        console.error('[WS] combat:action_declare error:', err.message)
      }
    })

    // ─── COMBAT:SKIP_PLAYER ───────────────────────────────────────────────
    // GM passe le tour d'un joueur pendant la phase ANNOUNCEMENT.
    // Payload : { tokenId }
    socket.on(WS.COMBAT_SKIP_PLAYER, async ({ tokenId }) => {
      if (socket.role !== 'gm') return
      const campaignId = socket.campaignId
      try {
        // Nettoyer le timer auto-skip si actif
        const campaignTimersMap = combatTimers.get(campaignId)
        if (campaignTimersMap?.has(tokenId)) {
          clearTimeout(campaignTimersMap.get(tokenId))
          campaignTimersMap.delete(tokenId)
        }
        await skipPlayer(io, campaignId, tokenId)
      } catch (err) {
        console.error('[WS] combat:skip_player error:', err.message)
      }
    })

    // ─── COMBAT:ANNOUNCE_PREVIEW — Preview éphémère en cours de déclaration ─
    // PJ émet ses sélections en cours (debounce client). Relay sans DB write.
    // Payload : { tokenId, actions[], assaultTargetId, meleeTargetIds[], moveDestination, combatMode }
    socket.on(WS.COMBAT_ANNOUNCE_PREVIEW, async (payload) => {
      const campaignId = socket.campaignId
      if (!campaignId || !payload?.tokenId) return
      try {
        const token = await db('tokens').where({ id: payload.tokenId }).first()
        if (!token?.character_id) return
        const character = await db('characters').where({ id: token.character_id }).first()
        if (!character || character.user_id !== socket.user.id) return
        combatPreviews.set(campaignId, payload)
        io.to(campaignId).emit(WS.COMBAT_ANNOUNCE_PREVIEW, payload)
      } catch (err) {
        console.error('[WS] COMBAT_ANNOUNCE_PREVIEW error:', err.message)
      }
    })

    // ─── COMBAT_ACTION_CONFIRM — Phase Résolution ─────────────────────────
    // Joueur (ou GM pour PNJ) confirme l'exécution du slot actif.
    // Résout les actions dans l'ordre sequence ASC, avance au slot suivant.
    // Payload : { tokenId, confirmedModifiers? }
    socket.on(WS.COMBAT_ACTION_CONFIRM, async ({ tokenId, confirmedModifiers }) => {
      console.log(`[DBG] COMBAT_ACTION_CONFIRM — tokenId:${tokenId} mods:${JSON.stringify(confirmedModifiers ?? null)}`)
      const campaignId = socket.campaignId
      try {
        // Guard : phase = RESOLUTION
        const state = await db('combat_state').where({ campaign_id: campaignId }).first()
        if (!state || state.phase !== 'RESOLUTION') return

        // Slots ordonnés par initiative DESC — source de vérité pour active_slot_idx
        const slots = await db('combat_roster')
          .where({ campaign_id: campaignId, status: 'active', has_announced: true })
          .orderBy('initiative', 'desc')
          .select('token_id', 'initiative')

        const activeSlot = slots[state.active_slot_idx]
        if (!activeSlot || activeSlot.token_id !== tokenId) return

        // Guard ownership — GM peut confirmer n'importe quel slot, joueur uniquement le sien
        const token = await db('tokens').where({ id: tokenId }).first()
        if (!token) return
        if (!token.character_id) return
        const character = await db('characters').where({ id: token.character_id }).first()
        if (!character) return
        if (socket.role !== 'gm') {
          if (character.user_id !== socket.user.id) return
        }

        // Lire les actions pendantes pour ce token, dans l'ordre d'exécution
        const actions = await db('combat_actions')
          .where({ campaign_id: campaignId, token_id: tokenId, status: 'pending' })
          .orderBy('sequence', 'asc')

        // Séparer melee (traitement séquentiel multi-attaque) du reste
        const nonMeleeActions = actions.filter(a => a.type !== 'melee')
        const meleeActions    = actions.filter(a => a.type === 'melee')

        // Résolution actions non-melee (move, assault, reload, micro)
        let needsDefenseWait = false
        for (const action of nonMeleeActions) {
          if (action.type === 'move_short' || action.type === 'move_long') {
            const tx = action.target_pos_x
            const ty = action.target_pos_y
            const tz = action.target_pos_z ?? 0
            // PE29 — vérifier l'espace de marche (pos_z + 1)
            const occupied = await isCaseOccupied(token.battlemap_id, tx, ty, tz + 1, [tokenId])
            if (!occupied) {
              const [updated] = await db('tokens')
                .where({ id: tokenId })
                .update({ pos_x: tx, pos_y: ty, pos_z: tz, updated_at: db.fn.now() })
                .returning(['id', 'pos_x', 'pos_y', 'pos_z', 'layer'])
              await collisionMoveToken(token.battlemap_id, token, updated)
              io.to(campaignId).emit(WS.TOKEN_MOVED, {
                tokenId: updated.id,
                pos_x: updated.pos_x,
                pos_y: updated.pos_y,
                pos_z: updated.pos_z,
              })
              // Mettre à jour la ref locale pour les éventuelles actions suivantes
              token.pos_x = tx; token.pos_y = ty; token.pos_z = tz
            } else {
              console.log(`[WS] COMBAT_ACTION_CONFIRM — déplacement bloqué (case occupée) token:${tokenId}`)
            }
          } else if (action.type === 'assault') {
            if (!confirmedModifiers && character.type !== 'drone') {
              console.warn(`[WS] COMBAT_ACTION_CONFIRM — assault sans confirmedModifiers. token:${tokenId}`)
            } else {
              await resolveAssaultAction(io, socket, campaignId, action, confirmedModifiers, character)
            }
          } else if (action.type === 'reload') {
            await resolveReloadAction(io, socket, campaignId, character, action)
          }
          // micro / skip : resolved direct, pas d'effet V1
          await db('combat_actions')
            .where({ id: action.id })
            .update({ status: 'resolved', updated_at: db.fn.now() })
        }

        // Résolution melee : marquer toutes les rows resolved upfront, puis traiter séquentiellement
        if (meleeActions.length > 0) {
          for (const a of meleeActions) {
            await db('combat_actions').where({ id: a.id }).update({ status: 'resolved', updated_at: db.fn.now() })
          }
          needsDefenseWait = await resolveMeleeAction(
            io, socket, campaignId, meleeActions[0], character,
            meleeActions.slice(1), meleeActions.length, confirmedModifiers
          )
        }

        // Slot bloqué si on attend le jet de défense d'un PJ
        if (!needsDefenseWait) {
          await advanceSlot(io, campaignId, slots, state.active_slot_idx + 1)
        }
      } catch (err) {
        console.error('[WS] COMBAT_ACTION_CONFIRM error:', err.message)
      }
    })

    // ─── COMBAT_DAMAGE_CONFIRM — PJ lance les dés (calcul serveur) ────────────
    socket.on(WS.COMBAT_DAMAGE_CONFIRM, async ({ tokenId }) => {
      const pending = pendingDamageActions.get(tokenId)
      if (!pending) {
        console.warn(`[WS] COMBAT_DAMAGE_CONFIRM — pas de pending pour token:${tokenId}`)
        return
      }
      if (pending.userId !== socket.user.id && socket.role !== 'gm') return
      pendingDamageActions.delete(tokenId)

      const {
        campaignId, targetTokenId, characterIdCible, cibleType = null, char_sheet_id_cible,
        mr, portee, fire_mode_bonus_dmg, formula,
        for_na_cible, con_na_cible, vol_na_cible,
        tireurUsername, tireurColor, userId, targetName,
        type: pendingType, modDom, combatModeBonus,
      } = pending

      try {
        // 1. Jet localisation
        const { total: rollLoc, rolls: locRolls, seed: locSeed } = await parseDice('1d20')
        const locTable = pendingType === 'melee' ? LOC_TABLE_CONTACT : LOC_TABLE
        const slotCode = (locTable.find(r => rollLoc <= r.max) ?? locTable[locTable.length - 1]).slot
        const localisation = SLOT_TO_WOUND_LOCATION[slotCode] ?? 'corps'

        // 2. Armures de la cible (dépend du slotCode)
        let etq = null
        if (char_sheet_id_cible && characterIdCible) {
          const armuresCible = await db('char_inventory')
            .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
            .where({ 'char_inventory.character_id': characterIdCible })
            .whereNotNull('char_inventory.slot')
            .select('char_inventory.slot', 'ref_equipment.protection as ref_protection', 'ref_equipment.protection_shock as ref_protection_shock')
          const armuresSlot = armuresCible.filter(a =>
            a.slot && ('/' + a.slot + '/').includes('/' + slotCode + '/')  // PI8
          )
          const resistanceArmure = calcResistanceArmure(armuresSlot)
          etq = resistanceArmure.etq
        }

        // 3. Calcul dégâts (branche melee vs assault)
        const { total: rawDice, rolls: dmgRolls, seed: dmgSeed } = await parseDice(formula.replace(/\s/g, ''))
        let degautsBruts
        if (pendingType === 'melee') {
          degautsBruts = rawDice + (modDom ?? 0) + (combatModeBonus ?? 0)
        } else {
          const mrTable = await getMrTable()
          const modDomAttaque = getModifier(mrTable, mr)
          const isShortRange = ['bout_portant', 'courte'].includes(portee)
          const modDegatsMode = isShortRange ? fire_mode_bonus_dmg : 0
          degautsBruts = rawDice + modDomAttaque + modDegatsMode
        }
        // Branche drone — cible sans char_sheet, résistance = blindage + intégrité×2 (§7.6)
        if (cibleType === 'drone' && characterIdCible) {
          const droneSheet = await db('drone_sheet').where({ character_id: characterIdCible }).first()
          if (droneSheet) {
            const etqDrone  = droneSheet.blindage ?? 0
            const rdDrone   = calcDroneRD(droneSheet.integrite_actuelle)
            const degatsNetsDrone = Math.max(0, degautsBruts - etqDrone - rdDrone)
            await resolveDroneIntegrityLoss(io, campaignId, characterIdCible, targetTokenId, droneSheet, degatsNetsDrone)
            socket.emit(WS.COMBAT_DAMAGE_RESULT, {
              rollLoc: null, locLabel: null,
              degautsBruts, degatsNets: degatsNetsDrone,
              dmgRolls, severity: null, severityColor: tireurColor, shockResult: null,
            })
            const now = new Date().toISOString()
            io.to(campaignId).emit(WS.DICE_RESULT, {
              userId, username: tireurUsername, color: tireurColor,
              formula, rolls: dmgRolls, total: degautsBruts,
              isCriticalSuccess: false, isCriticalFail: false,
              seed: dmgSeed, timestamp: now,
              skillLabel: `Dégâts — drone`,
              mechanicalTotal: rawDice,
              diffLabel: `Blindage:${etqDrone} RD:${rdDrone}`,
              chancesDeReussite: degatsNetsDrone,
              isSuccess: degatsNetsDrone > 0,
            })
            io.to(campaignId).emit(WS.COMBAT_ATTACK_RESULT, {
              tireurId: tokenId, cibleId: targetTokenId,
              localisation: null,
              degautsBruts, degatsNets: degatsNetsDrone,
              severity: null, is_lethal: false, isSuccess: true, shockResult: null,
            })
          }
          return
        }

        const rd = calcResistanceDommages(for_na_cible, con_na_cible)
        const degatsNets = Math.max(0, degautsBruts - (etq ?? 0) - rd)

        // 4. Sévérité
        let severity = null, is_lethal = false
        if      (degatsNets >= 30) { severity = 'mortelle'; is_lethal = true }
        else if (degatsNets >= 25) { severity = 'mortelle' }
        else if (degatsNets >= 20) { severity = 'critique' }
        else if (degatsNets >= 15) { severity = 'grave'    }
        else if (degatsNets >= 10) { severity = 'moyenne'  }
        else if (degatsNets >=  5) { severity = 'legere'   }

        // 5. Blessure
        let finalSeverity = severity
        let shockResult = null
        if (severity && char_sheet_id_cible) {
          const result = await db.transaction(trx =>
            resolveWoundInsertion(trx, char_sheet_id_cible, localisation, severity)
          )
          io.to(campaignId).emit(WS.WOUND_ADDED, {
            characterId: characterIdCible,
            wound: result.wound,
            promoted: result.promoted,
            shock_test_required: isShockTestRequired(result.wound.severity, result.wound.location),
          })
          finalSeverity = result.wound.severity  // P49

          shockResult = await resolveShockBlock(io, campaignId, {
            finalSeverity, localisation, is_lethal,
            for_na: for_na_cible, con_na: con_na_cible, vol_na: vol_na_cible,
            targetTokenId,
            userId, username: tireurUsername, color: tireurColor,
          }) ?? null
        }

        const severityColor = finalSeverity ? (SEVERITY_COLORS[finalSeverity] ?? tireurColor) : tireurColor

        // 6. COMBAT_DAMAGE_RESULT → socket tireur uniquement (affichage fenêtre)
        socket.emit(WS.COMBAT_DAMAGE_RESULT, {
          rollLoc,
          locLabel: LOCATION_LABELS[localisation] ?? localisation,
          degautsBruts,
          degatsNets,
          dmgRolls,
          severity: finalSeverity,
          severityColor,
          shockResult,
        })

        // 7. DICE_RESULT broadcast chat
        const now = new Date().toISOString()
        io.to(campaignId).emit(WS.DICE_RESULT, {
          userId, username: tireurUsername, color: tireurColor,
          formula: '1d20', rolls: locRolls, total: rollLoc,
          isCriticalSuccess: false, isCriticalFail: false,
          seed: locSeed, timestamp: now,
          skillLabel: 'Localisation — Distance',
          mechanicalTotal: rollLoc, diffLabel: '',
          chancesDeReussite: LOCATION_LABELS[localisation] ?? localisation,
          isSuccess: true,
        })
        io.to(campaignId).emit(WS.DICE_RESULT, {
          userId, username: tireurUsername, color: tireurColor,
          formula, rolls: dmgRolls, total: degautsBruts,
          isCriticalSuccess: false, isCriticalFail: false,
          seed: dmgSeed, timestamp: now,
          skillLabel: `Dégâts — ${LOCATION_LABELS[localisation] ?? localisation}`,
          mechanicalTotal: rawDice,
          diffLabel: `ETQ:${etq ?? 0} RD:${rd}`,
          chancesDeReussite: degatsNets,
          isSuccess: degatsNets > 0,
        })

        // 8. Message narratif combat_damage
        if (finalSeverity) {
          io.to(campaignId).emit(WS.DICE_RESULT, {
            userId, username: tireurUsername, color: severityColor,
            formula: '', rolls: [], total: degatsNets,
            isCriticalSuccess: false, isCriticalFail: false,
            seed: '', timestamp: now,
            interactionType: 'combat_damage',
            skillLabel: `${tireurUsername} inflige ${degatsNets} dégâts`,
            targetName,
            localisation: LOCATION_LABELS[localisation] ?? localisation,
            severity: finalSeverity,
            severityColor,
            isSuccess: true,
          })
        }

        io.to(campaignId).emit(WS.COMBAT_ATTACK_RESULT, {
          tireurId:    tokenId,
          cibleId:     targetTokenId,
          localisation,
          degautsBruts,
          degatsNets,
          severity:    finalSeverity,
          is_lethal,
          isSuccess:   true,
          shockResult: shockResult ?? null,
        })
      } catch (err) {
        console.error('[WS] COMBAT_DAMAGE_CONFIRM error:', err.message)
      }
    })

    // ─── COMBAT_STUN_CONFIRM — PJ cible lance son 1D6 de durée étourdissement ──
    socket.on(WS.COMBAT_STUN_CONFIRM, async ({ tokenId }) => {
      const pending = pendingStunActions.get(tokenId)
      if (!pending) {
        console.warn(`[WS] COMBAT_STUN_CONFIRM — pas de pending pour token:${tokenId}`)
        return
      }
      if (pending.targetUserId !== socket.user?.id && socket.role !== 'gm') return
      pendingStunActions.delete(tokenId)
      const { campaignId, outcome, currentTurn, userId, username, color } = pending
      try {
        const { total: d6Raw, rolls: d6Rolls, seed: d6Seed } = await parseDice('1d6')
        const stunDuration  = outcome === 'inconscient' ? d6Raw * 10 : d6Raw
        io.to(campaignId).emit(WS.DICE_RESULT, {
          userId, username, color,
          formula: '1d6', rolls: d6Rolls, total: stunDuration,
          isCriticalSuccess: false, isCriticalFail: false,
          seed: d6Seed, timestamp: new Date().toISOString(),
          skillLabel: 'Durée étourdissement',
          mechanicalTotal: d6Raw,
          diffLabel: outcome === 'inconscient' ? ' ×10 (min→tours)' : ' tour(s)',
          chancesDeReussite: stunDuration,
          isSuccess: true,
        })
        await applyStunWithDuration(io, campaignId, tokenId, outcome, stunDuration, currentTurn)
      } catch (err) {
        console.error('[WS] COMBAT_STUN_CONFIRM error:', err.message)
      }
    })

    // ─── COMBAT_MELEE_DEFENSE_CONFIRM — défenseur PJ valide son jet ───────────
    // Résout l'opposition (rollAttaque vs rollDefense), gère les dégâts, avance le slot.
    socket.on(WS.COMBAT_MELEE_DEFENSE_CONFIRM, async ({ tokenId }) => {
      const pending = pendingMeleeDefense.get(tokenId)
      if (!pending) {
        console.warn(`[WS] COMBAT_MELEE_DEFENSE_CONFIRM — pas de pending pour defender:${tokenId}`)
        return
      }
      if (pending.defenderUserId !== socket.user.id && socket.role !== 'gm') return
      pendingMeleeDefense.delete(tokenId)

      const {
        campaignId: meleeCampaignId,
        attackerTokenId, attackerCharacter,
        attackerUsername, attackerColor,
        rollAttaque, chancesAttaque,
        defenderSkillTotal, defenderEffectiveMalus,
        multiMalusDefenseur,
        damageFormula, modDom, combatModeBonus,
        characterIdCible, char_sheet_id_cible,
        for_na_cible, con_na_cible, vol_na_cible,
        targetName, userId,
        remainingMeleeActions: pendingRemainingMelee = [],
        totalMeleeCount: pendingTotalMeleeCount = 1,
        confirmedModifiers: pendingConfirmedModifiers,
        situationDef: pendingSituationDef = [],
      } = pending

      try {
        // 1. Roll défense D20 (serveur)
        const { total: rollDefense, rolls: defRolls, seed: defSeed } = await parseDice('1d20')
        // Mode combat du défenseur PJ — Offensif/Charge → pénalité, Défensif/Retraite → bonus (CaC3)
        const rosterDef = await db('combat_roster').where({ campaign_id: meleeCampaignId, token_id: tokenId }).first()
        const defCombatMode = rosterDef?.state_combat_mode ?? 'normal'
        let chanceDefense = defenderSkillTotal + defenderEffectiveMalus + (multiMalusDefenseur ?? 0)
        if      (defCombatMode === 'offensif') chanceDefense -= 5
        else if (defCombatMode === 'charge')   chanceDefense -= 7
        else if (defCombatMode === 'defensif') chanceDefense += 3
        else if (defCombatMode === 'retraite') chanceDefense += 5

        // Terrain instable défenseur PJ — compétence limitative ACROBATIE_EQUILIBRE
        let terrainInstableModDef = 0, acrobatieDefTotal = defenderSkillTotal
        if (pendingSituationDef.includes('cac_terrain_instable') && char_sheet_id_cible) {
          const [attrsCibleDef, archetypeCibleDef, acrobatieCharDef, acrobatieRefDef] = await Promise.all([
            db('char_attributes').where({ char_sheet_id: char_sheet_id_cible }),
            db('char_archetype').where({ char_sheet_id: char_sheet_id_cible }).first(),
            db('char_skills').where({ char_sheet_id: char_sheet_id_cible, skill_id: 'ACROBATIE_EQUILIBRE' }).first(),
            db('ref_skills').where({ id: 'ACROBATIE_EQUILIBRE' }).first(),
          ])
          const genoCibleDef = archetypeCibleDef?.genotype_id
            ? await db('ref_genotypes').where({ id: archetypeCibleDef.genotype_id }).first() : null
          acrobatieDefTotal = acrobatieRefDef
            ? calcSkillTotal(attrsCibleDef, acrobatieCharDef, acrobatieRefDef, genoCibleDef)
            : defenderSkillTotal
          terrainInstableModDef = Math.min(0, acrobatieDefTotal - defenderSkillTotal)
          chanceDefense += terrainInstableModDef
        }

        // 2. Résolution Polaris §6.2 : les deux réussissent → meilleure MR l'emporte, égalité = rien
        const mrAttaque      = chancesAttaque - rollAttaque
        const mrDefense      = chanceDefense  - rollDefense
        const attackSuccess  = rollAttaque  <= chancesAttaque
        const defenseSuccess = rollDefense  <= chanceDefense
        const hit = attackSuccess && (!defenseSuccess || mrAttaque > mrDefense)

        const modeCombatDefPj = defCombatMode === 'offensif' ? -5 : defCombatMode === 'charge' ? -7 : defCombatMode === 'defensif' ? 3 : defCombatMode === 'retraite' ? 5 : 0
        const breakdownDefPj = [
          { label: 'Compétence', value: defenderSkillTotal, type: 'base' },
          ...(modeCombatDefPj !== 0 ? [{ label: COMBAT_MODE_LABELS[defCombatMode] ?? defCombatMode, value: modeCombatDefPj, type: modeCombatDefPj > 0 ? 'bonus' : 'malus' }] : []),
          ...((multiMalusDefenseur ?? 0) !== 0 ? [{ label: 'Multi-adversaires', value: multiMalusDefenseur, type: 'malus' }] : []),
          ...(defenderEffectiveMalus !== 0 ? [{ label: 'Malus santé / encombrement', value: defenderEffectiveMalus, type: 'malus' }] : []),
          ...(terrainInstableModDef !== 0 ? [{ label: `Terrain instable (Acrobatie/Équilibre: ${acrobatieDefTotal})`, value: terrainInstableModDef, type: 'malus' }] : []),
          { label: 'Seuil', value: chanceDefense, type: 'total' },
        ]
        console.log(`[WS] melee défense — rollAtk:${rollAttaque}/${chancesAttaque} rollDef:${rollDefense}/${chanceDefense} → ${hit ? 'TOUCHÉ' : 'ESQUIVÉ/RATÉ'}`)

        // Broadcast roll défense au chat
        const now = new Date().toISOString()
        io.to(meleeCampaignId).emit(WS.DICE_RESULT, {
          userId: socket.user?.id, username: socket.user?.username ?? 'Défenseur',
          color: '#6060c0',
          formula: '1d20', rolls: defRolls, total: rollDefense,
          isCriticalSuccess: rollDefense === 1, isCriticalFail: rollDefense === 20,
          seed: defSeed, timestamp: now,
          skillLabel:        'Jet pour défendre (contact)',
          mechanicalTotal:   defenderSkillTotal,
          diffLabel:         chanceDefense - defenderSkillTotal >= 0 ? `+${chanceDefense - defenderSkillTotal}` : `${chanceDefense - defenderSkillTotal}`,
          chancesDeReussite: chanceDefense,
          isSuccess:         defenseSuccess,
          mr:                chanceDefense - rollDefense,
          breakdown:         breakdownDefPj,
        })

        // 3. Résultat opposition → room
        io.to(meleeCampaignId).emit(WS.COMBAT_MELEE_RESULT, {
          attaquantId: attackerTokenId,
          defenseurId: tokenId,
          rollAttaque, chancesAttaque,
          rollDefense, chanceDefense,
          hit,
          multiMalusAttaquant: pending.multiMalusAttaquant ?? 0,
          multiMalusDefenseur: pending.multiMalusDefenseur ?? 0,
        })

        // 4. Dégâts si touche
        if (hit) {
          if (attackerCharacter.type === 'pj') {
            // PJ attaquant : invite à lancer les dés de dégâts (CombatDamageWindow existant)
            pendingDamageActions.set(attackerTokenId, {
              type: 'melee',
              campaignId: meleeCampaignId,
              targetTokenId: tokenId,
              characterIdCible,
              char_sheet_id_cible,
              modDom,
              combatModeBonus,
              formula: damageFormula,
              for_na_cible,
              con_na_cible,
              vol_na_cible,
              tireurUsername: attackerUsername,
              tireurColor: attackerColor,
              userId,
              targetName,
            })
            // Trouver le socket de l'attaquant PJ
            const sockets = await io.fetchSockets()
            const attackerSocket = sockets.find(s =>
              s.campaignId === meleeCampaignId && s.user?.id === attackerCharacter.user_id
            )
            const prompt = { tokenId: attackerTokenId, formula: damageFormula, targetName }
            if (attackerSocket) {
              attackerSocket.emit(WS.COMBAT_DAMAGE_PROMPT, prompt)
            } else {
              socket.emit(WS.COMBAT_DAMAGE_PROMPT, prompt)  // fallback : même socket (rare)
            }
          } else {
            // PNJ attaquant : résolution auto des dégâts
            const { total: rollLoc } = await parseDice('1d20')
            const slotCode = (LOC_TABLE_CONTACT.find(r => rollLoc <= r.max) ?? LOC_TABLE_CONTACT[LOC_TABLE_CONTACT.length - 1]).slot
            const localisation = SLOT_TO_WOUND_LOCATION[slotCode] ?? 'corps'

            let etq = null
            if (char_sheet_id_cible && characterIdCible) {
              const armuresCible = await db('char_inventory')
                .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
                .where({ 'char_inventory.character_id': characterIdCible })
                .whereNotNull('char_inventory.slot')
                .select('char_inventory.slot', 'ref_equipment.protection as ref_protection', 'ref_equipment.protection_shock as ref_protection_shock')
              const armuresSlot = armuresCible.filter(a =>
                a.slot && ('/' + a.slot + '/').includes('/' + slotCode + '/')
              )
              etq = calcResistanceArmure(armuresSlot).etq
            }

            const { total: rawDice } = await parseDice(damageFormula.replace(/\s/g, ''))
            const degautsBruts = rawDice + (modDom ?? 0) + (combatModeBonus ?? 0)
            const rd = calcResistanceDommages(for_na_cible, con_na_cible)
            const degatsNets = Math.max(0, degautsBruts - (etq ?? 0) - rd)

            let severity = null, is_lethal = false
            if      (degatsNets >= 30) { severity = 'mortelle'; is_lethal = true }
            else if (degatsNets >= 25) { severity = 'mortelle' }
            else if (degatsNets >= 20) { severity = 'critique' }
            else if (degatsNets >= 15) { severity = 'grave'    }
            else if (degatsNets >= 10) { severity = 'moyenne'  }
            else if (degatsNets >=  5) { severity = 'legere'   }

            let finalSeverity = severity
            let shockResult = null
            if (severity && char_sheet_id_cible) {
              try {
                const result = await db.transaction(trx =>
                  resolveWoundInsertion(trx, char_sheet_id_cible, localisation, severity)
                )
                finalSeverity = result.wound.severity
                io.to(meleeCampaignId).emit(WS.WOUND_ADDED, {
                  characterId: characterIdCible,
                  wound: result.wound,
                  promoted: result.promoted,
                  shock_test_required: isShockTestRequired(finalSeverity, result.wound.location),
                })
                shockResult = await resolveShockBlock(io, meleeCampaignId, {
                  finalSeverity, localisation, is_lethal,
                  for_na: for_na_cible, con_na: con_na_cible, vol_na: vol_na_cible,
                  targetTokenId: tokenId,
                  userId, username: attackerUsername, color: attackerColor,
                }) ?? null
              } catch (woundErr) {
                console.error('[WS] COMBAT_MELEE_DEFENSE_CONFIRM (PNJ dmg) — wound error:', woundErr.message)
              }
            }

            io.to(meleeCampaignId).emit(WS.COMBAT_ATTACK_RESULT, {
              tireurId:    attackerTokenId,
              cibleId:     tokenId,
              localisation,
              degautsBruts,
              degatsNets,
              severity:    finalSeverity,
              is_lethal,
              isSuccess:   true,
              isPnj:       true,
              roll:        rollAttaque,
              chancesDeReussite: chancesAttaque,
              shockResult,
            })
          }
        }

        // 5. Attaque suivante (CaC 4b multi-attack) ou avance le slot
        if (pendingRemainingMelee.length > 0) {
          const [nextAction, ...restActions] = pendingRemainingMelee
          const allSockets = await io.fetchSockets()
          const attackerSocket = allSockets.find(
            s => s.campaignId === meleeCampaignId && s.user?.id === attackerCharacter.user_id
          ) || socket
          const waitForNext = await resolveMeleeAction(
            io, attackerSocket, meleeCampaignId,
            nextAction, attackerCharacter,
            restActions, pendingTotalMeleeCount, pendingConfirmedModifiers
          )
          if (!waitForNext) {
            const state = await db('combat_state').where({ campaign_id: meleeCampaignId }).first()
            const slots = await db('combat_roster')
              .where({ campaign_id: meleeCampaignId, status: 'active', has_announced: true })
              .orderBy('initiative', 'desc')
              .select('token_id', 'initiative')
            await advanceSlot(io, meleeCampaignId, slots, state.active_slot_idx + 1)
          }
        } else {
          const state = await db('combat_state').where({ campaign_id: meleeCampaignId }).first()
          const slots = await db('combat_roster')
            .where({ campaign_id: meleeCampaignId, status: 'active', has_announced: true })
            .orderBy('initiative', 'desc')
            .select('token_id', 'initiative')
          await advanceSlot(io, meleeCampaignId, slots, state.active_slot_idx + 1)
        }
      } catch (err) {
        console.error('[WS] COMBAT_MELEE_DEFENSE_CONFIRM error:', err.message)
      }
    })

    // ─── COMBAT_APPLY_STUN — GM applique manuellement is_stunned avec durée ──
    socket.on(WS.COMBAT_APPLY_STUN, async ({ tokenId, outcome, duration }) => {
      if (socket.role !== 'gm') return
      const campaignId = socket.campaignId
      if (!campaignId || !tokenId || !['etourdi', 'inconscient'].includes(outcome)) return
      if (!Number.isInteger(duration) || duration < 1 || duration > 60) {
        socket.emit('error', { message: 'Durée invalide (1–60 tours requis)' })
        return
      }
      try {
        const combatSt = await db('combat_state').where({ campaign_id: campaignId }).select('current_turn').first()
        await applyStunWithDuration(io, campaignId, tokenId, outcome, duration, combatSt?.current_turn ?? 1)
        console.log(`[WS] COMBAT_APPLY_STUN — is_stunned posé manuellement. token:${tokenId} outcome:${outcome} duration:${duration} campaign:${campaignId}`)
      } catch (err) {
        console.error('[WS] COMBAT_APPLY_STUN error:', err.message)
        socket.emit('error', { message: 'Erreur lors de l\'application de l\'étourdissement' })
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

// ─── Helper — démarrer les timers auto-skip pour la phase ANNONCE ─────────────
// PC17 : skip uniquement si timerSec > 0. Exclut PNJs et tokens du GM (gmUserId).
async function startAnnouncementTimers(io, campaignId, timerSec, gmUserId) {
  if (!timerSec || timerSec <= 0) return
  const rosterEntries = await db('combat_roster')
    .where({ campaign_id: campaignId, has_announced: false, status: 'active' })
  if (!combatTimers.has(campaignId)) combatTimers.set(campaignId, new Map())
  const campaignTimersMap = combatTimers.get(campaignId)
  for (const entry of rosterEntries) {
    const token = await db('tokens').where({ id: entry.token_id }).first()
    if (!token?.character_id) continue
    const character = await db('characters').where({ id: token.character_id }).first()
    if (!character || character.user_id === gmUserId) continue  // PNJ ou GM → pas de timer
    const timeoutId = setTimeout(async () => {
      await skipPlayer(io, campaignId, entry.token_id)
    }, timerSec * 1000)
    campaignTimersMap.set(entry.token_id, timeoutId)
  }
}

// ─── Helper — skip d'un participant pendant la phase ANNONCE ──────────────────
// Appelé par COMBAT_SKIP_PLAYER (GM) et par le timer auto-skip (PC17).
// Race condition guard : re-vérifie has_announced avant d'agir.
async function skipPlayer(io, campaignId, tokenId) {
  try {
    const entry = await db('combat_roster')
      .where({ campaign_id: campaignId, token_id: tokenId })
      .first()
    if (!entry || entry.has_announced) return

    await db('combat_roster')
      .where({ campaign_id: campaignId, token_id: tokenId })
      .update({ has_announced: true, updated_at: db.fn.now() })

    // Insérer action 'skip' en base
    await db('combat_actions').insert({
      campaign_id: campaignId,
      token_id: tokenId,
      type: 'skip',
      action_key: 'skip',
      sequence: 99,
      status: 'skipped',
    })

    // Bug 2 fix : tokenLabel dans le payload — évite stale closure client
    const token = await db('tokens').where({ id: tokenId }).first()
    const tokenLabel = token?.label ?? 'Inconnu'

    // Bug 1 fix : émettre COMBAT_TURN_SKIPPED AVANT de vérifier PC13
    io.to(campaignId).emit(WS.COMBAT_TURN_SKIPPED, { tokenId, tokenLabel })

    // PC13 — tous annoncés → phase Résolution, sinon émettre le slot suivant (LdB p.212)
    const [{ count }] = await db('combat_roster')
      .where({ campaign_id: campaignId, has_announced: false })
      .count('* as count')
    if (parseInt(count) === 0) {
      await startResolutionPhase(io, campaignId)
    } else {
      const nextAnnounceSlot = await db('combat_roster')
        .where({ campaign_id: campaignId, has_announced: false, status: 'active' })
        .orderBy('base_ini', 'asc').orderBy('token_id', 'asc')
        .first()
      if (nextAnnounceSlot) {
        io.to(campaignId).emit(WS.COMBAT_SLOT_ADVANCED, { activeSlotIdx: 0, tokenId: nextAnnounceSlot.token_id })
      }
    }
  } catch (err) {
    console.error('[WS] skipPlayer error:', err.message)
  }
}

// ─── Helper — transition vers la phase RÉSOLUTION ─────────────────────────────
// Appelé automatiquement quand tous les participants ont annoncé (PC13).
// Sprint 2 : stub — met à jour la phase et broadcast COMBAT_PHASE_CHANGED.
// Sprint 3/4 : résolution pas-à-pas par initiative_score DESC.
async function startResolutionPhase(io, campaignId) {
  try {
    await db('combat_state')
      .where({ campaign_id: campaignId })
      .update({ phase: 'RESOLUTION', active_slot_idx: 0, updated_at: db.fn.now() })

    const [announcedRoster, pendingActions, fullRoster] = await Promise.all([
      db('combat_roster')
        .where({ campaign_id: campaignId, status: 'active', has_announced: true })
        .orderBy('initiative', 'desc'),
      db('combat_actions')
        .where({ campaign_id: campaignId, status: 'pending' })
        .orderBy('sequence', 'asc'),
      db('combat_roster')
        .where({ campaign_id: campaignId })
        .orderBy('initiative', 'desc'),
    ])

    const broadcastRoster = fullRoster.map(({ surprise_roll: _sr, ...rest }) => rest)

    combatPreviews.delete(campaignId)

    io.to(campaignId).emit(WS.COMBAT_PHASE_CHANGED, {
      phase: 'RESOLUTION',
      roster: broadcastRoster,
      actions: pendingActions,
    })

    io.to(campaignId).emit(WS.COMBAT_SLOT_ADVANCED, {
      activeSlotIdx: 0,
      tokenId: announcedRoster[0]?.token_id ?? null,
    })

    console.log(`[WS] startResolutionPhase — campagne ${campaignId}`)
  } catch (err) {
    console.error('[WS] startResolutionPhase error:', err.message)
  }
}

// ─── Helper — avancer au slot suivant pendant la phase RÉSOLUTION ─────────────
// nextIdx >= slots.length → fin de tour (endTurn).
// Sinon : met à jour active_slot_idx en DB + broadcast COMBAT_SLOT_ADVANCED.
async function advanceSlot(io, campaignId, slots, nextIdx) {
  try {
    if (nextIdx >= slots.length) {
      await endTurn(io, campaignId)
      return
    }
    await db('combat_state')
      .where({ campaign_id: campaignId })
      .update({ active_slot_idx: nextIdx, updated_at: db.fn.now() })
    io.to(campaignId).emit(WS.COMBAT_SLOT_ADVANCED, {
      activeSlotIdx: nextIdx,
      tokenId: slots[nextIdx].token_id,
    })
  } catch (err) {
    console.error('[WS] advanceSlot error:', err.message)
  }
}

// ─── Helper — fin de tour : reset roster + actions, retour ANNOUNCEMENT ──────
// PC18 : 1 seul UPDATE bulk sur combat_roster.
// PC28 : DELETE combat_actions — queue nettoyée entre chaque tour.
async function endTurn(io, campaignId) {
  try {
    // PC18 — reset announced/resolved + états per-tour (position/cover/vitesse)
    await db('combat_roster')
      .where({ campaign_id: campaignId, status: 'active' })
      .update({
        has_announced:     false,
        has_resolved:      false,
        state_position:    'standing',
        state_cover:       'exposed',
        state_vitesse:     'normal',
        state_combat_mode: 'normal',
        updated_at:        db.fn.now(),
      })

    // PC28 — vider la queue des actions
    await db('combat_actions').where({ campaign_id: campaignId }).delete()

    // Incrémenter le tour, retour à ANNOUNCEMENT
    const [updatedState] = await db('combat_state')
      .where({ campaign_id: campaignId })
      .update({
        phase: 'ANNOUNCEMENT',
        current_turn: db.raw('current_turn + 1'),
        active_slot_idx: 0,
        updated_at: db.fn.now(),
      })
      .returning(['action_timer_sec', 'current_turn'])

    // Purge universelle — statuts expirés ce tour (stunned, unconscious, surprised…)
    const newTurn = updatedState?.current_turn ?? 1
    const rosterTids = await db('combat_roster').where({ campaign_id: campaignId }).pluck('token_id')
    if (rosterTids.length > 0) {
      const expiredRows = await db('token_statuses')
        .whereIn('token_id', rosterTids)
        .whereNotNull('expires_at_turn')
        .where('expires_at_turn', '<=', newTurn)
        .select('token_id', 'status_code')
      if (expiredRows.length > 0) {
        const expiredStunIds = [...new Set(
          expiredRows.filter(r => r.status_code === 'stunned' || r.status_code === 'unconscious').map(r => r.token_id)
        )]
        const allExpiredIds = [...new Set(expiredRows.map(r => r.token_id))]
        await db('token_statuses')
          .whereIn('token_id', rosterTids)
          .whereNotNull('expires_at_turn')
          .where('expires_at_turn', '<=', newTurn)
          .delete()
        for (const token_id of allExpiredIds) {
          await emitTokenStatusUpdated(io, campaignId, token_id)
        }
        for (const token_id of expiredStunIds) {
          io.to(campaignId).emit(WS.COMBAT_STUN_EXPIRED, { tokenId: token_id })
          console.log(`[WS] endTurn — étourdissement expiré. token:${token_id} turn:${newTurn}`)
        }
      }
    }

    const roster = await db('combat_roster')
      .where({ campaign_id: campaignId })
      .orderBy('initiative', 'desc')
    const broadcastRoster = roster.map(({ surprise_roll: _sr, ...rest }) => rest)

    io.to(campaignId).emit(WS.COMBAT_PHASE_CHANGED, { phase: 'ANNOUNCEMENT', roster: broadcastRoster })

    // LdB p.212 — émettre le premier slot d'annonce du nouveau tour (base_ini ASC)
    const firstAnnounceSlotNewTurn = await db('combat_roster')
      .where({ campaign_id: campaignId, has_announced: false, status: 'active' })
      .orderBy('base_ini', 'asc').orderBy('token_id', 'asc')
      .first()
    if (firstAnnounceSlotNewTurn) {
      io.to(campaignId).emit(WS.COMBAT_SLOT_ADVANCED, { activeSlotIdx: 0, tokenId: firstAnnounceSlotNewTurn.token_id })
    }

    // Relancer les timers pour le nouveau tour
    const gmMember = await db('campaign_members')
      .where({ campaign_id: campaignId, role: 'gm' })
      .select('user_id')
      .first()
    await startAnnouncementTimers(io, campaignId, updatedState?.action_timer_sec ?? 0, gmMember?.user_id)

    console.log(`[WS] endTurn — campagne ${campaignId}`)
  } catch (err) {
    console.error('[WS] endTurn error:', err.message)
  }
}

// ─── Helper — émettre TOKEN_STATUS_UPDATED avec statuses + statusExpiries ─────
async function emitTokenStatusUpdated(io, campaignId, tokenId) {
  const rows = await db('token_statuses').where({ token_id: tokenId }).select('status_code', 'expires_at_turn')
  const statuses = rows.map(r => r.status_code)
  const statusExpiries = Object.fromEntries(rows.map(r => [r.status_code, r.expires_at_turn]))
  io.to(campaignId).emit(WS.TOKEN_STATUS_UPDATED, { tokenId, statuses, statusExpiries })
}

// ─── Helper — appliquer stunned/unconscious dans token_statuses avec expires_at_turn ─
// onConflict merge : re-stun étend la durée sans dupliquer la ligne.
async function applyStunWithDuration(io, campaignId, tokenId, outcome, stunDuration, currentTurn) {
  const stunUntil = currentTurn + stunDuration
  const statusCode = outcome === 'inconscient' ? 'unconscious' : 'stunned'
  try {
    await db('token_statuses')
      .insert({ token_id: tokenId, status_code: statusCode, expires_at_turn: stunUntil })
      .onConflict(['token_id', 'status_code'])
      .merge(['expires_at_turn'])
    await emitTokenStatusUpdated(io, campaignId, tokenId)
  } catch (err) {
    console.error('[WS] applyStunWithDuration error:', err.message)
  }
  console.log(`[WS] applyStunWithDuration — token:${tokenId} outcome:${outcome} duration:${stunDuration} until_turn:${stunUntil}`)
}

// ─── Helper — résoudre le bloc Test de Choc complet (D20 + D6 durée + broadcast) ──
// Retourne shockResult ou null si pas de test requis.
// Le D6 durée est broadcasté comme DICE_RESULT pour le rendre visible dans le chat.
async function resolveShockBlock(io, campaignId, {
  finalSeverity, localisation, is_lethal,
  for_na, con_na, vol_na,
  targetTokenId,
  userId, username, color,
}) {
  if (!isShockTestRequired(finalSeverity, localisation)) return null
  const shockCampaign = await db('campaigns').where({ id: campaignId }).select('shock_auto_stun').first()
  const shockAutoStun = shockCampaign?.shock_auto_stun ?? true
  const seuils     = calcSeuils(for_na, con_na, vol_na)
  const shockMalus = getShockMalus(finalSeverity, localisation, is_lethal)
  const { total: rollChoc } = await parseDice('1d20')
  let outcome
  if      (rollChoc <= seuils.etourdissement + shockMalus) outcome = 'ok'
  else if (rollChoc <= seuils.inconscience    + shockMalus) outcome = 'etourdi'
  else                                                       outcome = 'inconscient'
  let stunDuration = null, stunUntilTurn = null, stunPending = false
  if (outcome !== 'ok' && shockAutoStun) {
    // Déterminer si la cible est un PJ → prompt interactif, sinon résolution auto
    const targetTok  = await db('tokens').where({ id: targetTokenId }).select('character_id').first()
    const targetChar = targetTok?.character_id
      ? await db('characters').where({ id: targetTok.character_id }).select('user_id', 'type').first()
      : null
    const targetUserId = targetChar?.type === 'pj' ? targetChar.user_id : null

    const combatSt   = await db('combat_state').where({ campaign_id: campaignId }).select('current_turn').first()
    const currentTurn = combatSt?.current_turn ?? 1

    if (targetUserId) {
      // PJ cible → lui envoyer un prompt pour qu'il lance son propre 1D6
      pendingStunActions.set(targetTokenId, { campaignId, outcome, currentTurn, userId, username, color, targetUserId })
      const sockets = await io.fetchSockets()
      const pjSocket = sockets.find(s => s.campaignId === campaignId && s.user?.id === targetUserId)
      if (pjSocket) {
        pjSocket.emit(WS.COMBAT_STUN_PROMPT, { tokenId: targetTokenId, outcome })
        stunPending = true
      } else {
        // PJ déconnecté → résolution auto côté serveur
        pendingStunActions.delete(targetTokenId)
        const { total: d6Raw, rolls: d6Rolls, seed: d6Seed } = await parseDice('1d6')
        stunDuration  = outcome === 'inconscient' ? d6Raw * 10 : d6Raw
        stunUntilTurn = currentTurn + stunDuration
        io.to(campaignId).emit(WS.DICE_RESULT, {
          userId, username, color,
          formula: '1d6', rolls: d6Rolls, total: stunDuration,
          isCriticalSuccess: false, isCriticalFail: false,
          seed: d6Seed, timestamp: new Date().toISOString(),
          skillLabel: 'Durée étourdissement',
          mechanicalTotal: d6Raw,
          diffLabel: outcome === 'inconscient' ? ' ×10 (min→tours)' : ' tour(s)',
          chancesDeReussite: stunDuration,
          isSuccess: true,
        })
        await applyStunWithDuration(io, campaignId, targetTokenId, outcome, stunDuration, currentTurn)
      }
    } else {
      // PNJ cible → résolution auto
      const { total: d6Raw, rolls: d6Rolls, seed: d6Seed } = await parseDice('1d6')
      stunDuration  = outcome === 'inconscient' ? d6Raw * 10 : d6Raw
      stunUntilTurn = currentTurn + stunDuration
      io.to(campaignId).emit(WS.DICE_RESULT, {
        userId, username, color,
        formula: '1d6', rolls: d6Rolls, total: stunDuration,
        isCriticalSuccess: false, isCriticalFail: false,
        seed: d6Seed, timestamp: new Date().toISOString(),
        skillLabel: 'Durée étourdissement',
        mechanicalTotal: d6Raw,
        diffLabel: outcome === 'inconscient' ? ' ×10 (min→tours)' : ' tour(s)',
        chancesDeReussite: stunDuration,
        isSuccess: true,
      })
      await applyStunWithDuration(io, campaignId, targetTokenId, outcome, stunDuration, currentTurn)
    }
  }
  return {
    triggered:    true,
    roll:         rollChoc,
    outcome,
    shockMalus,
    seuilEtourdi: seuils.etourdissement + shockMalus,
    seuilIncons:  seuils.inconscience   + shockMalus,
    stun_applied:       outcome !== 'ok' && shockAutoStun && !stunPending,
    stun_pending:       stunPending,
    stun_duration:      stunDuration,
    stunned_until_turn: stunUntilTurn,
  }
}

// ─── MULTI-ADVERSAIRES — helpers ─────────────────────────────────────────────
// Malus LdB p.224 : confronté à N adversaires distincts en CaC.
// V1 : PNJ = ennemi du PJ, PJ = ennemi du PNJ. PNJ alliés non distingués.
function multiAdversaryMalus(n) {
  return n >= 4 ? -10 : n === 3 ? -7 : n === 2 ? -5 : 0
}

// Compte les tokens ennemis actifs (enemyType) dans le roster à portée de tokenPos.
// Portée = 3m + allonge maximale de l'adversaire (arme de contact équipée).
// excludeId : token à exclure (soi-même).
function countAdversaires(tokenPos, rosterTokens, excludeId, enemyType) {
  let count = 0
  for (const t of rosterTokens) {
    if (t.char_type !== enemyType || t.token_id === excludeId) continue
    const dx = (tokenPos.pos_x ?? 0) - (t.pos_x ?? 0)
    const dz = (tokenPos.pos_y ?? 0) - (t.pos_y ?? 0)
    const maxAllonge = parseInt(t.max_allonge) || 0
    if (Math.sqrt(dx * dx + dz * dz) <= 3 + maxAllonge) count++
  }
  return count
}

// ─── RÉSOLUTION RECHARGEMENT ────────────────────────────────────────────────
// Appelée depuis COMBAT_ACTION_CONFIRM quand action.type==='melee'.
// Retourne true si le slot doit rester bloqué (défenseur PJ en attente), false sinon.
async function resolveMeleeAction(io, socket, campaignId, action, character, remainingMeleeActions = [], totalMeleeCount = 1, confirmedModifiers = null) {
  try {
    const weaponInvId   = action.weapon_inv_id ?? null
    const targetTokenId = action.target_token_id
    if (!targetTokenId) return false

    // ── 1. Données attaquant ──────────────────────────────────────────────────
    const sheetAttaquant = await db('char_sheet').where({ character_id: character.id }).first()
    if (!sheetAttaquant) return false

    // Arme + formule dégâts + allonge
    let weapon = null, damageFormula = '1D4'
    if (weaponInvId) {
      weapon = await db('char_inventory')
        .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
        .where({ 'char_inventory.id': weaponInvId })
        .select('ref_equipment.damage_h as ref_damage_h', 'char_inventory.equipment_id',
                'ref_equipment.range as ref_range')
        .first()
      if (weapon?.ref_damage_h) damageFormula = weapon.ref_damage_h
    }
    const allonge = parseInt(weapon?.ref_range) || 0

    // Validation distance Phase 2 — positions post-déplacement (PE14)
    const [myTokenPos, targetTokenPos] = await Promise.all([
      db('tokens').where({ id: action.token_id }).select('pos_x','pos_y').first(),
      db('tokens').where({ id: targetTokenId }).select('pos_x','pos_y').first(),
    ])
    const dxChk = (myTokenPos?.pos_x ?? 0) - (targetTokenPos?.pos_x ?? 0)
    const dzChk = (myTokenPos?.pos_y ?? 0) - (targetTokenPos?.pos_y ?? 0)
    const dist2dChk = Math.sqrt(dxChk * dxChk + dzChk * dzChk)
    if (dist2dChk > 3 + allonge) {
      console.warn(`[WS] resolveMeleeAction — hors portée: ${dist2dChk.toFixed(1)}m max:${3 + allonge}m token:${action.token_id}`)
      socket.emit(WS.COMBAT_DECLARE_ERROR, {
        message: `Corps à corps impossible — distance : ${dist2dChk.toFixed(1)}m, portée max : ${3 + allonge}m`,
      })
      return false
    }

    // Skill associé à l'arme (via ref_equipment_skill_assoc) ou COMBAT_A_MAINS_NUES (mains nues)
    let skillId = 'COMBAT_A_MAINS_NUES'
    if (weapon?.equipment_id) {
      const skillAssoc = await db('ref_equipment_skill_assoc').where({ item_id: weapon.equipment_id }).first()
      if (skillAssoc) skillId = skillAssoc.skill_id
    }

    const [attrsAttaquant, archetypeAttaquant, charSkill, refSkill, woundsAttaquant, invAttaquant, rosterTokens] = await Promise.all([
      db('char_attributes').where({ char_sheet_id: sheetAttaquant.id }),
      db('char_archetype').where({ char_sheet_id: sheetAttaquant.id }).first(),
      db('char_skills').where({ char_sheet_id: sheetAttaquant.id, skill_id: skillId }).first(),
      db('ref_skills').where({ id: skillId }).first(),
      db('character_wounds').where({ char_sheet_id: sheetAttaquant.id }),
      db('char_inventory')
        .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
        .where({ 'char_inventory.character_id': character.id })
        .select('char_inventory.container', 'char_inventory.slot', 'char_inventory.quantity',
                'ref_equipment.weight as ref_weight', 'ref_equipment.min_str as ref_min_str',
                'ref_equipment.category as ref_category'),
      // Tous les tokens actifs du roster avec leur type et leur allonge max (arme de contact équipée).
      // Utilisé pour le calcul multi-adversaires (positions post-déplacement garanties).
      db('tokens as t')
        .join('combat_roster as cr', 'cr.token_id', 't.id')
        .join('characters as c', 'c.id', 't.character_id')
        .leftJoin('char_inventory as ci',
          db.raw(`ci.character_id = c.id AND ci.slot IN ('MG', 'MD', '2M')`))
        .leftJoin('ref_equipment as re',
          db.raw(`re.id = ci.equipment_id AND re.category = 'Arme de contact'`))
        .where('cr.campaign_id', campaignId)
        .where('cr.status', 'active')
        .groupBy('t.id', 't.pos_x', 't.pos_y', 'c.type')
        .select(
          't.id as token_id',
          't.pos_x',
          't.pos_y',
          'c.type as char_type',
          db.raw(`COALESCE(MAX(CASE WHEN re.range ~ '^[0-9]+$' THEN re.range::INTEGER ELSE 0 END), 0) as max_allonge`)
        ),
    ])
    const genoAttaquant = archetypeAttaquant?.genotype_id
      ? await db('ref_genotypes').where({ id: archetypeAttaquant.genotype_id }).first()
      : null

    const attackerSkillTotal = refSkill ? calcSkillTotal(attrsAttaquant, charSkill, refSkill, genoAttaquant) : 0
    const woundPenalty = calcWoundPenalty(woundsAttaquant)
    const forAttr = attrsAttaquant.find(a => a.attr_id === 'FOR')
    const forValue = (forAttr?.base_level ?? 7) + (forAttr?.pc_modifier ?? 0)
    const totalWeight = invAttaquant.reduce((sum, i) =>
      (i.container === 'Coffre' || i.ref_weight == null) ? sum : sum + i.ref_weight * i.quantity, 0
    )
    const effectiveMalusAttaquant = woundPenalty - calcEncumbrancePenalty(totalWeight, forValue)
    const for_na_attaquant = calcAttributeNA(attrsAttaquant, 'FOR', genoAttaquant)
    const equippedAttaquant = invAttaquant.filter(i => i.slot != null)
    const carenceAttaquant  = calcCarenceArmure(equippedAttaquant, for_na_attaquant)
    const modDom = getModDom(for_na_attaquant)

    const rosterAttaquant = await db('combat_roster').where({ campaign_id: campaignId, token_id: action.token_id }).first()
    if (rosterAttaquant?.state_combat_mode === 'charge' && dist2dChk <= 3) {
      socket.emit(WS.COMBAT_DECLARE_ERROR, { message: 'Charge impossible — distance ≤ 3m (élan insuffisant)' })
      return false
    }
    const isRushedMod    = rosterAttaquant?.state_vitesse === 'rushed' ? -5 : 0
    const combatModeAtk  = rosterAttaquant?.state_combat_mode ?? 'normal'
    const attackModeBonus = (combatModeAtk === 'offensif' || combatModeAtk === 'charge') ? 3 : 0
    const combatModeBonus = combatModeAtk === 'charge' ? 3 : 0   // +3 dégâts Charge

    // Multi-adversaires : malus si l'attaquant est lui-même entouré d'ennemis
    const atkEnemyType = character.type === 'pj' ? 'pnj' : 'pj'
    const multiMalusAttaquant = multiAdversaryMalus(
      countAdversaires(myTokenPos, rosterTokens, action.token_id, atkEnemyType)
    )

    // CaC 4b — malus attaque multiple (LdB p.218) : −5 pour 2 attaques, −7 pour 3+
    const multiAttackMalus = totalMeleeCount === 2 ? -5 : totalMeleeCount >= 3 ? -7 : 0

    // Mods situation CaC (§6.2)
    const deuxArmesSlots = invAttaquant.filter(i => ['MD', 'MG'].includes(i.slot) && i.ref_category === 'Arme de contact')
    const deuxArmesBonus = deuxArmesSlots.length >= 2 ? 3 : 0
    const situationMods = (confirmedModifiers?.situation ?? []).filter(k => k !== 'cac_terrain_instable')
    const situationModComp = situationMods.reduce((sum, k) => sum + (SITUATION_MODS[k] ?? 0), 0)
    const tailleMod = TAILLE_MODS[confirmedModifiers?.taille ?? 'moyenne'] ?? 0
    let terrainInstableMod = 0, acrobatieTotal = attackerSkillTotal
    if ((confirmedModifiers?.situation ?? []).includes('cac_terrain_instable')) {
      const [acrobatieRefSkill, acrobatieCharSkill] = await Promise.all([
        db('ref_skills').where({ id: 'ACROBATIE_EQUILIBRE' }).first(),
        db('char_skills').where({ char_sheet_id: sheetAttaquant.id, skill_id: 'ACROBATIE_EQUILIBRE' }).first(),
      ])
      acrobatieTotal = acrobatieRefSkill
        ? calcSkillTotal(attrsAttaquant, acrobatieCharSkill, acrobatieRefSkill, genoAttaquant)
        : attackerSkillTotal
      terrainInstableMod = Math.min(0, acrobatieTotal - attackerSkillTotal)
    }

    const chancesAttaque  = attackerSkillTotal + effectiveMalusAttaquant - carenceAttaquant + isRushedMod + attackModeBonus + multiMalusAttaquant + multiAttackMalus + situationModComp + tailleMod + terrainInstableMod + deuxArmesBonus

    // Roll attaquant
    const { total: rollAttaque, rolls: attackRolls, seed: attackSeed } = await parseDice('1d20')

    // Info affichage
    const userRow = character.user_id
      ? await db('users').where({ id: character.user_id }).select('color', 'username').first()
      : null
    const attackerColor    = userRow?.color    ?? '#c86030'
    const attackerUsername = userRow?.username ?? character.name ?? 'Inconnu'

    const breakdownAtk = [
      { label: 'Compétence', value: attackerSkillTotal, type: 'base' },
      ...(attackModeBonus !== 0 ? [{ label: COMBAT_MODE_LABELS[combatModeAtk] ?? combatModeAtk, value: attackModeBonus, type: 'bonus' }] : []),
      ...(isRushedMod !== 0 ? [{ label: 'Précipitation', value: isRushedMod, type: 'malus' }] : []),
      ...(multiMalusAttaquant !== 0 ? [{ label: 'Multi-adversaires (attaquant)', value: multiMalusAttaquant, type: 'malus' }] : []),
      ...(multiAttackMalus !== 0 ? [{ label: 'Attaque multiple', value: multiAttackMalus, type: 'malus' }] : []),
      ...(effectiveMalusAttaquant !== 0 ? [{ label: 'Malus santé / encombrement', value: effectiveMalusAttaquant, type: 'malus' }] : []),
      ...(carenceAttaquant !== 0 ? [{ label: 'Carence armure', value: -carenceAttaquant, type: 'malus' }] : []),
      ...(situationModComp !== 0 ? [{ label: 'Mods situation', value: situationModComp, type: situationModComp > 0 ? 'bonus' : 'malus' }] : []),
      ...(tailleMod !== 0 ? [{ label: 'Taille cible', value: tailleMod, type: tailleMod > 0 ? 'bonus' : 'malus' }] : []),
      ...(terrainInstableMod !== 0 ? [{ label: `Terrain instable (Acrobatie/Équilibre: ${acrobatieTotal})`, value: terrainInstableMod, type: 'malus' }] : []),
      ...(deuxArmesBonus !== 0 ? [{ label: 'Deux armes au contact', value: deuxArmesBonus, type: 'bonus' }] : []),
      { label: 'Seuil', value: chancesAttaque, type: 'total' },
    ]
    console.log(`[WS] melee attaque — roll:${rollAttaque} Seuil:${chancesAttaque} token:${action.token_id}`)
    console.log(`[DBG] melee seuil — skill:${attackerSkillTotal} eff:${effectiveMalusAttaquant} carence:${-carenceAttaquant} mode:${attackModeBonus} rush:${isRushedMod} multi:${multiMalusAttaquant} multiAtk:${multiAttackMalus} sit:${situationModComp} taille:${tailleMod} terrain:${terrainInstableMod} deuxArmes:${deuxArmesBonus} → seuil:${chancesAttaque}`)
    io.to(campaignId).emit(WS.DICE_RESULT, {
      userId: character.user_id, username: attackerUsername, color: attackerColor,
      formula: '1d20', rolls: attackRolls, total: rollAttaque,
      isCriticalSuccess: rollAttaque === 1, isCriticalFail: rollAttaque === 20,
      seed: attackSeed, timestamp: new Date().toISOString(),
      skillLabel:        'Jet pour toucher (contact)',
      mechanicalTotal:   attackerSkillTotal,
      diffLabel:         chancesAttaque - attackerSkillTotal >= 0 ? `+${chancesAttaque - attackerSkillTotal}` : `${chancesAttaque - attackerSkillTotal}`,
      chancesDeReussite: chancesAttaque,
      isSuccess:         rollAttaque <= chancesAttaque,
      mr:                chancesAttaque - rollAttaque,
      breakdown:         breakdownAtk,
    })

    // ── 2. Cible ──────────────────────────────────────────────────────────────
    const targetToken = await db('tokens').where({ id: targetTokenId }).first()
    if (!targetToken?.character_id) {
      // Entité de décor — pas de défense ni dégâts
      io.to(campaignId).emit(WS.COMBAT_MELEE_RESULT, {
        attaquantId: action.token_id, defenseurId: targetTokenId,
        rollAttaque, chancesAttaque, rollDefense: null, chanceDefense: null, hit: false,
      })
      return false
    }

    const defenderCharacter = await db('characters').where({ id: targetToken.character_id }).first()
    if (!defenderCharacter) return false

    const targetName = defenderCharacter.name ?? targetToken.label ?? 'Cible'

    // Multi-adversaires : malus si le défenseur est entouré d'ennemis (positions post-déplacement)
    const defEnemyType = defenderCharacter.type === 'pj' ? 'pnj' : 'pj'
    const multiMalusDefenseur = multiAdversaryMalus(
      countAdversaires(targetTokenPos, rosterTokens, targetTokenId, defEnemyType)
    )

    // ── 3. Données défenseur ──────────────────────────────────────────────────
    const sheetCible = await db('char_sheet').where({ character_id: defenderCharacter.id }).first()
    let defenderSkillTotal = 0, defenderEffectiveMalus = 0
    let for_na_cible = 8, con_na_cible = 8, vol_na_cible = 8
    let char_sheet_id_cible = null

    if (sheetCible) {
      char_sheet_id_cible = sheetCible.id

      // Round 1 — parallèle : données défenseur + armes de contact équipées
      const [attrsCible, archetypeCible, woundsCible, invCible, defContactWeapons] = await Promise.all([
        db('char_attributes').where({ char_sheet_id: sheetCible.id }),
        db('char_archetype').where({ char_sheet_id: sheetCible.id }).first(),
        db('character_wounds').where({ char_sheet_id: sheetCible.id }),
        db('char_inventory')
          .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
          .where({ 'char_inventory.character_id': defenderCharacter.id })
          .select('char_inventory.container', 'char_inventory.slot', 'char_inventory.quantity',
                  'ref_equipment.weight as ref_weight'),
        db('char_inventory')
          .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
          .where({ 'char_inventory.character_id': defenderCharacter.id })
          .whereIn('char_inventory.slot', ['MD', 'MG', '2M'])
          .where('ref_equipment.category', 'Arme de contact')
          .select('char_inventory.slot', 'char_inventory.equipment_id'),
      ])

      // B1 — compétence défenseur selon arme équipée (priorité main directrice)
      const slotPriority = (sheetCible.hand_pref ?? 'R') === 'L' ? ['MG', 'MD', '2M'] : ['MD', 'MG', '2M']
      const defWeapon = slotPriority.map(s => defContactWeapons.find(w => w.slot === s)).find(w => w != null) ?? null
      let defSkillId = 'COMBAT_A_MAINS_NUES'
      if (defWeapon?.equipment_id) {
        const assoc = await db('ref_equipment_skill_assoc').where({ item_id: defWeapon.equipment_id }).first()
        if (assoc) defSkillId = assoc.skill_id
      }

      // Round 2 — parallèle : compétence défenseur + génotype
      const [charSkillDef, refSkillDef, genoCible] = await Promise.all([
        db('char_skills').where({ char_sheet_id: sheetCible.id, skill_id: defSkillId }).first(),
        db('ref_skills').where({ id: defSkillId }).first(),
        archetypeCible?.genotype_id
          ? db('ref_genotypes').where({ id: archetypeCible.genotype_id }).first()
          : Promise.resolve(null),
      ])

      for_na_cible = calcAttributeNA(attrsCible, 'FOR', genoCible)
      con_na_cible = calcAttributeNA(attrsCible, 'CON', genoCible)
      vol_na_cible = calcAttributeNA(attrsCible, 'VOL', genoCible)

      if (refSkillDef) defenderSkillTotal = calcSkillTotal(attrsCible, charSkillDef, refSkillDef, genoCible)

      const woundPenaltyDef = calcWoundPenalty(woundsCible)
      const forAttrDef = attrsCible.find(a => a.attr_id === 'FOR')
      const forValueDef = (forAttrDef?.base_level ?? 7) + (forAttrDef?.pc_modifier ?? 0)
      const totalWeightDef = invCible.reduce((sum, i) =>
        (i.container === 'Coffre' || i.ref_weight == null) ? sum : sum + i.ref_weight * i.quantity, 0
      )
      defenderEffectiveMalus = woundPenaltyDef - calcEncumbrancePenalty(totalWeightDef, forValueDef)
    }

    const commonPending = {
      campaignId,
      attackerTokenId: action.token_id,
      attackerCharacter: character,
      attackerUsername,
      attackerColor,
      rollAttaque,
      chancesAttaque,
      defenderSkillTotal,
      defenderEffectiveMalus,
      multiMalusAttaquant,
      multiMalusDefenseur,
      damageFormula,
      modDom,
      combatModeBonus,
      characterIdCible: defenderCharacter.id,
      cibleType: defenderCharacter.type,
      char_sheet_id_cible,
      for_na_cible,
      con_na_cible,
      vol_na_cible,
      targetName,
      userId: character.user_id,
      defenderUserId: defenderCharacter.user_id,
      // CaC 4b — attaque multiple
      remainingMeleeActions,
      totalMeleeCount,
      confirmedModifiers,
      situationDef: confirmedModifiers?.situationDef ?? [],
    }

    // ── 4. PNJ défenseur : auto-résolution ────────────────────────────────────
    if (defenderCharacter.type === 'pnj') {
      const { total: rollDefense, rolls: defRolls, seed: defSeed } = await parseDice('1d20')
      // Mode combat du défenseur — Offensif/Charge → pénalité défense
      const rosterDef = await db('combat_roster').where({ campaign_id: campaignId, token_id: targetTokenId }).first()
      const defCombatMode = rosterDef?.state_combat_mode ?? 'normal'
      let chanceDefense = defenderSkillTotal + defenderEffectiveMalus + multiMalusDefenseur
      if      (defCombatMode === 'offensif') chanceDefense -= 5
      else if (defCombatMode === 'charge')   chanceDefense -= 7
      else if (defCombatMode === 'defensif') chanceDefense += 3
      else if (defCombatMode === 'retraite') chanceDefense += 5
      // Terrain instable défenseur PNJ — compétence limitative ACROBATIE_EQUILIBRE
      // attrsCible/genoCible hors scope (déclarés dans if(sheetCible)) → re-fetch conditionnel
      let terrainInstableModDef = 0, acrobatieDefTotal = defenderSkillTotal
      if ((confirmedModifiers?.situationDef ?? []).includes('cac_terrain_instable') && char_sheet_id_cible) {
        const [attrsDef, archetypeDef, acrobatieCharDef, acrobatieRefDef] = await Promise.all([
          db('char_attributes').where({ char_sheet_id: char_sheet_id_cible }),
          db('char_archetype').where({ char_sheet_id: char_sheet_id_cible }).first(),
          db('char_skills').where({ char_sheet_id: char_sheet_id_cible, skill_id: 'ACROBATIE_EQUILIBRE' }).first(),
          db('ref_skills').where({ id: 'ACROBATIE_EQUILIBRE' }).first(),
        ])
        const genoDef = archetypeDef?.genotype_id
          ? await db('ref_genotypes').where({ id: archetypeDef.genotype_id }).first() : null
        acrobatieDefTotal = acrobatieRefDef
          ? calcSkillTotal(attrsDef, acrobatieCharDef, acrobatieRefDef, genoDef)
          : defenderSkillTotal
        terrainInstableModDef = Math.min(0, acrobatieDefTotal - defenderSkillTotal)
        chanceDefense += terrainInstableModDef
      }
      const mrAttaque      = chancesAttaque - rollAttaque
      const mrDefense      = chanceDefense  - rollDefense
      const attackSuccess  = rollAttaque  <= chancesAttaque
      const defenseSuccess = rollDefense  <= chanceDefense
      const hit = attackSuccess && (!defenseSuccess || mrAttaque > mrDefense)

      const modeCombatDef = defCombatMode === 'offensif' ? -5 : defCombatMode === 'charge' ? -7 : defCombatMode === 'defensif' ? 3 : defCombatMode === 'retraite' ? 5 : 0
      const breakdownDef = [
        { label: 'Compétence', value: defenderSkillTotal, type: 'base' },
        ...(modeCombatDef !== 0 ? [{ label: COMBAT_MODE_LABELS[defCombatMode] ?? defCombatMode, value: modeCombatDef, type: modeCombatDef > 0 ? 'bonus' : 'malus' }] : []),
        ...(multiMalusDefenseur !== 0 ? [{ label: 'Multi-adversaires', value: multiMalusDefenseur, type: 'malus' }] : []),
        ...(defenderEffectiveMalus !== 0 ? [{ label: 'Malus santé / encombrement', value: defenderEffectiveMalus, type: 'malus' }] : []),
        ...(terrainInstableModDef !== 0 ? [{ label: `Terrain instable (Acrobatie/Équilibre: ${acrobatieDefTotal})`, value: terrainInstableModDef, type: 'malus' }] : []),
        { label: 'Seuil', value: chanceDefense, type: 'total' },
      ]
      console.log(`[WS] melee défense PNJ — rollDef:${rollDefense}/${chanceDefense} → ${hit ? 'TOUCHÉ' : 'ESQUIVÉ/RATÉ'}`)

      io.to(campaignId).emit(WS.DICE_RESULT, {
        userId: null, username: defenderCharacter.name ?? 'PNJ', color: '#808080',
        formula: '1d20', rolls: defRolls, total: rollDefense,
        isCriticalSuccess: rollDefense === 1, isCriticalFail: rollDefense === 20,
        seed: defSeed, timestamp: new Date().toISOString(),
        skillLabel:        'Jet pour défendre (contact)',
        mechanicalTotal:   defenderSkillTotal,
        diffLabel:         chanceDefense - defenderSkillTotal >= 0 ? `+${chanceDefense - defenderSkillTotal}` : `${chanceDefense - defenderSkillTotal}`,
        chancesDeReussite: chanceDefense,
        isSuccess:         defenseSuccess,
        mr:                chanceDefense - rollDefense,
        breakdown:         breakdownDef,
      })

      io.to(campaignId).emit(WS.COMBAT_MELEE_RESULT, {
        attaquantId: action.token_id, defenseurId: targetTokenId,
        rollAttaque, chancesAttaque, rollDefense, chanceDefense, hit,
        multiMalusAttaquant, multiMalusDefenseur,
      })

      if (hit) {
        // Dégâts auto (même logique que PNJ dans resolveAssaultAction)
        const { total: rollLoc } = await parseDice('1d20')
        const slotCode    = (LOC_TABLE_CONTACT.find(r => rollLoc <= r.max) ?? LOC_TABLE_CONTACT[LOC_TABLE_CONTACT.length - 1]).slot
        const localisation = SLOT_TO_WOUND_LOCATION[slotCode] ?? 'corps'

        let etq = null
        if (char_sheet_id_cible && defenderCharacter.id) {
          const armuresCible = await db('char_inventory')
            .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
            .where({ 'char_inventory.character_id': defenderCharacter.id })
            .whereNotNull('char_inventory.slot')
            .select('char_inventory.slot', 'ref_equipment.protection as ref_protection', 'ref_equipment.protection_shock as ref_protection_shock')
          const armuresSlot = armuresCible.filter(a =>
            a.slot && ('/' + a.slot + '/').includes('/' + slotCode + '/')
          )
          etq = calcResistanceArmure(armuresSlot).etq
        }

        const { total: rawDice } = await parseDice(damageFormula.replace(/\s/g, ''))
        const degautsBruts = rawDice + (modDom ?? 0) + combatModeBonus
        const rd = calcResistanceDommages(for_na_cible, con_na_cible)
        const degatsNets = Math.max(0, degautsBruts - (etq ?? 0) - rd)

        let severity = null, is_lethal = false
        if      (degatsNets >= 30) { severity = 'mortelle'; is_lethal = true }
        else if (degatsNets >= 25) { severity = 'mortelle' }
        else if (degatsNets >= 20) { severity = 'critique' }
        else if (degatsNets >= 15) { severity = 'grave'    }
        else if (degatsNets >= 10) { severity = 'moyenne'  }
        else if (degatsNets >=  5) { severity = 'legere'   }

        let finalSeverity = severity, shockResult = null
        if (severity && char_sheet_id_cible) {
          try {
            const result = await db.transaction(trx =>
              resolveWoundInsertion(trx, char_sheet_id_cible, localisation, severity)
            )
            finalSeverity = result.wound.severity
            io.to(campaignId).emit(WS.WOUND_ADDED, {
              characterId: defenderCharacter.id,
              wound: result.wound, promoted: result.promoted,
              shock_test_required: isShockTestRequired(finalSeverity, result.wound.location),
            })
            shockResult = await resolveShockBlock(io, campaignId, {
              finalSeverity, localisation, is_lethal,
              for_na: for_na_cible, con_na: con_na_cible, vol_na: vol_na_cible,
              targetTokenId,
              userId: character.user_id, username: attackerUsername, color: attackerColor,
            }) ?? null
          } catch (woundErr) {
            console.error('[WS] resolveMeleeAction (PNJ dmg) — wound error:', woundErr.message)
          }
        }

        io.to(campaignId).emit(WS.COMBAT_ATTACK_RESULT, {
          tireurId:    action.token_id, cibleId: targetTokenId,
          localisation, degautsBruts, degatsNets,
          severity: finalSeverity, is_lethal, isSuccess: true, isPnj: true,
          roll: rollAttaque, chancesDeReussite: chancesAttaque, shockResult,
        })
      }

      // CaC 4b — attaque suivante si multi-attack
      if (remainingMeleeActions.length > 0) {
        return await resolveMeleeAction(
          io, socket, campaignId,
          remainingMeleeActions[0], character,
          remainingMeleeActions.slice(1), totalMeleeCount, confirmedModifiers
        )
      }
      return false  // slot avance immédiatement
    } else if (defenderCharacter.type === 'drone') {
      // §7.4 : sans programme esquive, le drone ne peut pas se défendre — test simple
      const hit = rollAttaque <= chancesAttaque
      io.to(campaignId).emit(WS.COMBAT_MELEE_RESULT, {
        attaquantId: action.token_id, defenseurId: targetTokenId,
        rollAttaque, chancesAttaque, rollDefense: null, chanceDefense: null, hit,
        multiMalusAttaquant,
      })
      if (hit) {
        const droneSheet = await db('drone_sheet').where({ character_id: defenderCharacter.id }).first()
        if (droneSheet) {
          const { total: rawDice } = await parseDice(damageFormula.replace(/\s/g, ''))
          const degautsBruts = rawDice + (modDom ?? 0) + combatModeBonus
          const etqDrone = droneSheet.blindage ?? 0
          const rdDrone  = calcDroneRD(droneSheet.integrite_actuelle)
          const degatsNetsDrone = Math.max(0, degautsBruts - etqDrone - rdDrone)
          await resolveDroneIntegrityLoss(io, campaignId, defenderCharacter.id, targetTokenId, droneSheet, degatsNetsDrone)
          io.to(campaignId).emit(WS.COMBAT_ATTACK_RESULT, {
            tireurId: action.token_id, cibleId: targetTokenId,
            localisation: null, degautsBruts, degatsNets: degatsNetsDrone,
            severity: null, is_lethal: false, isSuccess: true, isPnj: true,
            roll: rollAttaque, chancesDeReussite: chancesAttaque, shockResult: null,
          })
        }
      }
      if (remainingMeleeActions.length > 0) {
        return await resolveMeleeAction(io, socket, campaignId,
          remainingMeleeActions[0], character, remainingMeleeActions.slice(1), totalMeleeCount, confirmedModifiers)
      }
      return false
    }

    // ── 5. PJ défenseur : bloquer le slot, émettre le prompt ─────────────────
    pendingMeleeDefense.set(targetTokenId, commonPending)

    // Cibler le socket du défenseur PJ
    const sockets = await io.fetchSockets()
    const defSocket = sockets.find(s => s.campaignId === campaignId && s.user?.id === defenderCharacter.user_id)
    const prompt = {
      attackerName:    attackerUsername,
      attackerTokenId: action.token_id,
      defenderTokenId: targetTokenId,
      rollAttaque,
      chancesAttaque,
      // Défenseur : Seuil de base (sans ajustement combat_mode, résolu au confirm) + malus encerclement
      chanceDefenseBase: defenderSkillTotal + defenderEffectiveMalus + multiMalusDefenseur,
      multiMalusDefenseur,
    }
    if (defSocket) {
      defSocket.emit(WS.COMBAT_MELEE_DEFENSE_PROMPT, prompt)
    } else {
      // Fallback : broadcast à toute la room (cas GM remplaçant)
      io.to(campaignId).emit(WS.COMBAT_MELEE_DEFENSE_PROMPT, { ...prompt, allPlayers: true })
    }

    return true  // slot bloqué jusqu'à COMBAT_MELEE_DEFENSE_CONFIRM
  } catch (err) {
    console.error('[WS] resolveMeleeAction error:', err.message)
    return false
  }
}

// Appelée depuis COMBAT_ACTION_CONFIRM quand action.type==='reload'.
//Utilise weapon_inv_id + modifiers.ammo_item_id (déclaration PJ) ou auto-sélection (PNJ).
// PNJ + pnj_unlimited_ammo : recharge sans consommer de munitions.
async function resolveReloadAction(io, socket, campaignId, character, action) {
  const characterId = character.id
  console.log(`[DBG] resolveReload — début. characterId:${characterId} type:${character.type} campaignId:${campaignId}`)

  const campaign = await db('campaigns').where({ id: campaignId }).select('pnj_unlimited_ammo', 'reload_mode').first()
  const pnjUnlimited = campaign?.pnj_unlimited_ammo && character.type === 'pnj'
  const reloadMode   = campaign?.reload_mode ?? 'magazine'
  console.log(`[DBG] resolveReload — pnj_unlimited_ammo:${campaign?.pnj_unlimited_ammo} pnjUnlimited:${pnjUnlimited} reloadMode:${reloadMode}`)

  const parseCount = (s) => { const m = String(s ?? '').match(/\d+/); return m ? parseInt(m[0], 10) : 0 }

  // Émet le résultat ciblé vers le socket du joueur (pas pour les PNJs)
  const emitResult = async (payload) => {
    if (!character.user_id) return
    if (socket.user?.id === character.user_id) {
      socket.emit(WS.COMBAT_RELOAD_RESULT, payload)
    } else {
      // GM a cliqué Agir pour le slot du joueur — trouver le socket du joueur
      const allSockets = await io.fetchSockets()
      const playerSock = allSockets.find(sock =>
        sock.campaignId === campaignId && sock.user?.id === character.user_id
      )
      if (playerSock) playerSock.emit(WS.COMBAT_RELOAD_RESULT, payload)
    }
  }

  // Identifier l'arme : weapon_inv_id stocké en Phase 1 (PJ) ou auto-détection MG/MD (PNJ)
  const weaponSelect = [
    'char_inventory.id',
    'char_inventory.equipment_id as weapon_equip_id',
    'char_inventory.current_ammo',
    'char_inventory.ammo_remaining',
    'ref_equipment.caliber as ref_caliber',
    'ref_equipment.ammo_count as ref_ammo_count',
  ]
  let weapons
  if (action?.weapon_inv_id) {
    const w = await db('char_inventory')
      .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
      .where({ 'char_inventory.id': action.weapon_inv_id, 'char_inventory.character_id': characterId })
      .whereNotNull('ref_equipment.caliber')
      .select(weaponSelect)
      .first()
    weapons = w ? [w] : []
  } else {
    weapons = await db('char_inventory')
      .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
      .where({ 'char_inventory.character_id': characterId })
      .whereIn('char_inventory.slot', ['MG', 'MD'])
      .whereNotNull('ref_equipment.caliber')
      .select(weaponSelect)
  }
  console.log(`[DBG] resolveReload — ${weapons.length} arme(s) à recharger`)

  for (const weapon of weapons) {
    const clipSize = parseCount(weapon.ref_ammo_count)
    console.log(`[DBG] resolveReload — arme:${weapon.id} caliber:${weapon.ref_caliber} clipSize:${clipSize}`)
    if (clipSize === 0) { console.log('[DBG] resolveReload — clipSize=0, ignorée'); continue }

    if (pnjUnlimited) {
      console.log(`[DBG] resolveReload — PNJ unlimited, rechargement direct à ${clipSize}`)
      await db('char_inventory').where({ id: weapon.id }).update({ ammo_remaining: clipSize, updated_at: db.fn.now() })
      io.to(campaignId).emit(WS.INVENTORY_UPDATED, { characterId, item: { id: weapon.id, ammo_remaining: clipSize } })
    } else {
      // Identifier la munition : sélectionnée en Phase 1 (ammo_item_id) ou auto-sélection
      const ammoItemId = action?.modifiers?.ammo_item_id ?? null
      let ammoItem = null

      if (ammoItemId) {
        ammoItem = await db('char_inventory')
          .where({ id: ammoItemId, character_id: characterId })
          .select('id', 'equipment_id', 'quantity')
          .first()
        if (!ammoItem || ammoItem.quantity <= 0) {
          console.log(`[DBG] resolveReload — munition sélectionnée introuvable ou épuisée : ${ammoItemId}`)
          await emitResult({ success: false, characterId, caliber: weapon.ref_caliber })
          continue
        }
      } else {
        // Fallback : première munition compatible hors Coffre
        const ammoItems = await db('char_inventory')
          .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
          .where({ 'char_inventory.character_id': characterId })
          .where(function() { this.whereNull('char_inventory.container').orWhereNot('char_inventory.container', 'Coffre') })
          .whereNot({ 'char_inventory.id': weapon.id })
          .where({ 'ref_equipment.caliber': weapon.ref_caliber })
          .select('char_inventory.id', 'char_inventory.equipment_id', 'char_inventory.quantity')
        console.log(`[DBG] resolveReload — fallback : ${ammoItems.length} munition(s) caliber:${weapon.ref_caliber}`)
        if (ammoItems.length === 0) {
          console.log(`[DBG] resolveReload — aucune munition disponible, tour consommé`)
          await emitResult({ success: false, characterId, caliber: weapon.ref_caliber })
          continue
        }
        const preferred = weapon.current_ammo ? ammoItems.find(a => a.equipment_id === weapon.current_ammo) : null
        ammoItem = preferred ?? ammoItems[0]
      }

      const currentAmmo = weapon.ammo_remaining ?? 0
      let roundsConsumed, newAmmo
      if (reloadMode === 'topup') {
        const needed   = clipSize - currentAmmo
        roundsConsumed = Math.min(needed, ammoItem.quantity)
        newAmmo        = currentAmmo + roundsConsumed
      } else {
        roundsConsumed = Math.min(clipSize, ammoItem.quantity)
        newAmmo        = roundsConsumed
      }
      console.log(`[DBG] resolveReload — mode:${reloadMode} consumed:${roundsConsumed} new_ammo:${newAmmo}`)

      await db.transaction(async (trx) => {
        await trx('char_inventory').where({ id: weapon.id }).update({
          current_ammo: ammoItem.equipment_id, ammo_remaining: newAmmo, updated_at: db.fn.now(),
        })
        if (ammoItem.quantity - roundsConsumed <= 0) {
          await trx('char_inventory').where({ id: ammoItem.id }).delete()
          io.to(campaignId).emit(WS.INVENTORY_REMOVED, { characterId, itemId: ammoItem.id })
        } else {
          const newQty = ammoItem.quantity - roundsConsumed
          await trx('char_inventory').where({ id: ammoItem.id }).update({ quantity: newQty, updated_at: db.fn.now() })
          io.to(campaignId).emit(WS.INVENTORY_UPDATED, { characterId, item: { id: ammoItem.id, quantity: newQty } })
        }
      })
      io.to(campaignId).emit(WS.INVENTORY_UPDATED, { characterId, item: { id: weapon.id, ammo_remaining: newAmmo } })
      await emitResult({ success: true, characterId, newAmmo, clipSize, caliber: weapon.ref_caliber })
    }
  }
  console.log(`[DBG] resolveReload — FIN. personnage ${characterId}`)
}

// ─── RÉSOLUTION ASSAUT ──────────────────────────────────────────────────────
// Appelée depuis COMBAT_ACTION_CONFIRM quand action.type==='assault' + confirmedModifiers présents.
// Jets : attaque 1d20 / localisation 1d20 / dégâts selon ref_damage_h.
// Blessures : resolveWoundInsertion (promotions en cascade) + test choc si requis.
// ─── resolveDroneAssaultAction — résolution attaque drone (Sprint 2c) ────────
// Appelé depuis resolveAssaultAction quand character.type === 'drone'.
// §7.3 MANUELSYSCOMBAT : D20 ≤ programme.level, modificateurs situationnels standard,
// pas de malus blessures/encombrement, pas de Test de Choc.
async function resolveDroneAssaultAction(io, socket, campaignId, action, confirmedModifiers, character) {
  try {
    // 1. Arme drone
    const weapon = await db('drone_weapons')
      .leftJoin('ref_equipment', 'drone_weapons.equipment_id', 'ref_equipment.id')
      .where({ 'drone_weapons.id': action.drone_weapon_inv_id })
      .select(
        'drone_weapons.fire_mode',
        db.raw(`COALESCE(drone_weapons.damage_formula, ref_equipment.damage_h) as effective_formula`),
        db.raw(`COALESCE(drone_weapons.label_override, drone_weapons.name, ref_equipment.name) as display_name`),
      )
      .first()

    if (!weapon?.effective_formula) {
      console.warn(`[WS] resolveDroneAssaultAction — arme sans formule. drone_weapon_inv_id:${action.drone_weapon_inv_id}`)
      io.to(campaignId).emit(WS.DICE_RESULT, {
        userId: null, username: character.name ?? 'Drone', color: '#30aaaa',
        formula: '—', rolls: [], total: 0,
        isCriticalSuccess: false, isCriticalFail: false, seed: null,
        timestamp: new Date().toISOString(),
        skillLabel: `Armement Drone — arme sans formule de dégâts`,
        mechanicalTotal: 0, diffLabel: '', chancesDeReussite: 0, isSuccess: false,
      })
      return
    }

    // 2. Programme armement (§7.3 — category selon fire_mode)
    const category = weapon.fire_mode === 'cc' ? 'armement_contact' : 'armement_distance'
    const programme = await db('drone_programs')
      .where({ character_id: character.id, category })
      .orderBy('level', 'desc')
      .first()

    if (!programme) {
      console.warn(`[WS] resolveDroneAssaultAction — programme ${category} introuvable pour drone ${character.id}`)
      io.to(campaignId).emit(WS.DICE_RESULT, {
        userId: null, username: character.name ?? 'Drone', color: '#30aaaa',
        formula: '—', rolls: [], total: 0,
        isCriticalSuccess: false, isCriticalFail: false, seed: null,
        timestamp: new Date().toISOString(),
        skillLabel: `Armement Drone — programme "${category}" manquant`,
        mechanicalTotal: 0, diffLabel: 'Configurer le programme dans la fiche drone', chancesDeReussite: 0, isSuccess: false,
      })
      return
    }

    // 3. Calcul chancesDeReussite (§7.3 — même modificateurs que humanoïdes)
    // armement_contact : portée = null → PORTEE_MOD_COMP[null]??0 = 0 (contact physique, pas de modificateur portée)
    const portee = category !== 'armement_contact' ? (confirmedModifiers?.portee ?? 'courte') : null
    let totalModComp = PORTEE_MOD_COMP[portee] ?? 0
    if (confirmedModifiers?.taille) totalModComp += TAILLE_MODS[confirmedModifiers.taille] ?? 0
    const situationMods = confirmedModifiers?.situation ?? []
    totalModComp += situationMods.reduce((sum, k) => sum + (SITUATION_MODS[k] ?? 0), 0)
    const chancesDeReussite = programme.level + totalModComp

    // 4. Jet D20
    const { total: roll, rolls: attRolls, seed: attSeed } = await parseDice('1d20')
    const isSuccess = roll <= chancesDeReussite
    const mr        = chancesDeReussite - roll

    // 5. Display data tireur
    const userRow        = character.user_id ? await db('users').where({ id: character.user_id }).select('color', 'username').first() : null
    const tireurColor    = userRow?.color    ?? '#888888'
    const tireurUsername = userRow?.username ?? character.name ?? 'Drone'
    const userId         = character.user_id ?? null
    const now            = new Date().toISOString()

    // 6. Broadcast jet programme
    const porteeModDrone = PORTEE_MOD_COMP[portee] ?? 0
    const tailleModDrone = confirmedModifiers?.taille ? (TAILLE_MODS[confirmedModifiers.taille] ?? 0) : 0
    const breakdownDrone = [
      { label: `Programme (niv. ${programme.level})`, value: programme.level, type: 'base' },
      ...(porteeModDrone !== 0 ? [{ label: PORTEE_LABELS[portee] ?? portee, value: porteeModDrone, type: porteeModDrone > 0 ? 'bonus' : 'malus' }] : []),
      ...situationMods.reduce((acc, k) => {
        const v = SITUATION_MODS[k]
        if (v !== undefined && v !== 0) acc.push({ label: SITUATION_LABELS[k] ?? k, value: v, type: v > 0 ? 'bonus' : 'malus' })
        return acc
      }, []),
      ...(tailleModDrone !== 0 ? [{ label: TAILLE_LABELS[confirmedModifiers.taille] ?? confirmedModifiers.taille, value: tailleModDrone, type: tailleModDrone > 0 ? 'bonus' : 'malus' }] : []),
      { label: 'Seuil', value: chancesDeReussite, type: 'total' },
    ]
    io.to(campaignId).emit(WS.DICE_RESULT, {
      userId, username: tireurUsername, color: tireurColor,
      formula: '1d20', rolls: attRolls, total: roll,
      isCriticalSuccess: false, isCriticalFail: false,
      seed: attSeed, timestamp: now,
      skillLabel: `${weapon.display_name ?? 'Armement'} — Drone`,
      mechanicalTotal: roll,
      diffLabel: `${chancesDeReussite} (Prog. niv. ${programme.level})`,
      chancesDeReussite, isSuccess,
      breakdown: breakdownDrone,
    })

    if (!isSuccess) {
      io.to(campaignId).emit(WS.COMBAT_ATTACK_RESULT, {
        tireurId: action.token_id, cibleId: action.target_token_id,
        localisation: null, degautsBruts: 0, degatsNets: 0,
        severity: null, is_lethal: false, isSuccess: false, shockResult: null,
      })
      return
    }

    // 7. Identifier la cible
    const cibleToken     = await db('tokens').where({ id: action.target_token_id }).first()
    const cibleCharacter = cibleToken?.character_id
      ? await db('characters').where({ id: cibleToken.character_id }).first()
      : null
    const formula = weapon.effective_formula.replace(/\s/g, '')

    // Helper : fetch attributs NA cible avec genotype
    const fetchCibleNA = async (charId, sheetId) => {
      const [attrsCible, archetypeCible] = await Promise.all([
        db('char_attributes').where({ char_sheet_id: sheetId }),
        db('char_archetype').where({ char_sheet_id: sheetId }).first(),
      ])
      const genoCible = archetypeCible?.genotype_id
        ? await db('ref_genotypes').where({ id: archetypeCible.genotype_id }).first()
        : null
      return {
        for_na: calcAttributeNA(attrsCible, 'FOR', genoCible),
        con_na: calcAttributeNA(attrsCible, 'CON', genoCible),
        vol_na: calcAttributeNA(attrsCible, 'VOL', genoCible),
      }
    }

    // 8a. Cible = drone (§7.6 — blindage + RD intégrité, auto-resolve)
    if (cibleCharacter?.type === 'drone') {
      const droneSheet = await db('drone_sheet').where({ character_id: cibleCharacter.id }).first()
      if (!droneSheet) return
      const { total: rawDice, rolls: dmgRolls, seed: dmgSeed } = await parseDice(formula)
      const mrTable       = await getMrTable()
      const modDomAttaque = getModifier(mrTable, mr)
      const degautsBruts  = rawDice + modDomAttaque
      const etqDrone      = droneSheet.blindage ?? 0
      const rdDrone       = calcDroneRD(droneSheet.integrite_actuelle)
      const degatsNets    = Math.max(0, degautsBruts - etqDrone - rdDrone)
      await resolveDroneIntegrityLoss(io, campaignId, cibleCharacter.id, action.target_token_id, droneSheet, degatsNets)
      const newIntegrite = degatsNets >= 30 ? 0 : Math.max(0, droneSheet.integrite_actuelle - 1)
      io.to(campaignId).emit(WS.DICE_RESULT, {
        userId, username: tireurUsername, color: tireurColor,
        formula, rolls: dmgRolls, total: degautsBruts,
        isCriticalSuccess: false, isCriticalFail: false,
        seed: dmgSeed, timestamp: now,
        skillLabel: `Dégâts — ${cibleCharacter.name} · Intégrité : ${droneSheet.integrite_actuelle} → ${newIntegrite}`,
        mechanicalTotal: rawDice,
        diffLabel: `+${modDomAttaque} MR · −${etqDrone} blindage · RD ${rdDrone}`,
        chancesDeReussite: degatsNets,
        isSuccess: degatsNets > 0,
        cardType: 'drone_damage',
      })
      io.to(campaignId).emit(WS.COMBAT_ATTACK_RESULT, {
        tireurId: action.token_id, cibleId: action.target_token_id,
        localisation: droneSheet.localisation_ref ?? 'corps', degautsBruts, degatsNets,
        severity: null, is_lethal: false, isSuccess: true, shockResult: null,
      })
      return
    }

    // 8b. Cible = PNJ : auto-resolve
    if (!cibleCharacter || cibleCharacter.type === 'pnj') {
      const cibleSheet    = cibleCharacter ? await db('char_sheet').where({ character_id: cibleCharacter.id }).first() : null
      const { for_na, con_na, vol_na } = cibleSheet ? await fetchCibleNA(cibleCharacter.id, cibleSheet.id) : { for_na: 8, con_na: 8, vol_na: 8 }

      const { total: rollLoc, rolls: locRolls, seed: locSeed } = await parseDice('1d20')
      const slotCode     = (LOC_TABLE.find(r => rollLoc <= r.max) ?? LOC_TABLE[LOC_TABLE.length - 1]).slot
      const localisation = SLOT_TO_WOUND_LOCATION[slotCode] ?? 'corps'

      let etq = null
      if (cibleSheet && cibleCharacter) {
        const armuresCible = await db('char_inventory')
          .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
          .where({ 'char_inventory.character_id': cibleCharacter.id })
          .whereNotNull('char_inventory.slot')
          .select('char_inventory.slot', 'ref_equipment.protection as ref_protection', 'ref_equipment.protection_shock as ref_protection_shock')
        const armuresSlot = armuresCible.filter(a => a.slot && ('/' + a.slot + '/').includes('/' + slotCode + '/'))
        etq = calcResistanceArmure(armuresSlot).etq
      }

      const { total: rawDice, rolls: dmgRolls, seed: dmgSeed } = await parseDice(formula)
      const mrTable       = await getMrTable()
      const modDomAttaque = getModifier(mrTable, mr)
      const degautsBruts  = rawDice + modDomAttaque
      const rd            = calcResistanceDommages(for_na, con_na)
      const degatsNets    = Math.max(0, degautsBruts - (etq ?? 0) - rd)

      let severity = null, is_lethal = false
      if      (degatsNets >= 30) { severity = 'mortelle'; is_lethal = true }
      else if (degatsNets >= 25) { severity = 'mortelle' }
      else if (degatsNets >= 20) { severity = 'critique' }
      else if (degatsNets >= 15) { severity = 'grave'    }
      else if (degatsNets >= 10) { severity = 'moyenne'  }
      else if (degatsNets >=  5) { severity = 'legere'   }

      let finalSeverity = severity
      let shockResult = null
      if (severity && cibleSheet?.id) {
        const result = await db.transaction(trx => resolveWoundInsertion(trx, cibleSheet.id, localisation, severity))
        io.to(campaignId).emit(WS.WOUND_ADDED, {
          characterId: cibleCharacter.id, wound: result.wound, promoted: result.promoted,
          shock_test_required: isShockTestRequired(result.wound.severity, result.wound.location),
        })
        finalSeverity = result.wound.severity
        shockResult = await resolveShockBlock(io, campaignId, {
          finalSeverity, localisation, is_lethal,
          for_na, con_na, vol_na,
          targetTokenId: action.target_token_id,
          userId, username: tireurUsername, color: tireurColor,
        }) ?? null
      }

      const severityColor = finalSeverity ? (SEVERITY_COLORS[finalSeverity] ?? tireurColor) : tireurColor

      io.to(campaignId).emit(WS.DICE_RESULT, {
        userId, username: tireurUsername, color: tireurColor,
        formula: '1d20', rolls: locRolls, total: rollLoc,
        isCriticalSuccess: false, isCriticalFail: false,
        seed: locSeed, timestamp: now,
        skillLabel: 'Localisation — Drone', mechanicalTotal: rollLoc, diffLabel: '',
        chancesDeReussite: LOCATION_LABELS[localisation] ?? localisation, isSuccess: true,
      })
      io.to(campaignId).emit(WS.DICE_RESULT, {
        userId, username: tireurUsername, color: tireurColor,
        formula, rolls: dmgRolls, total: degautsBruts,
        isCriticalSuccess: false, isCriticalFail: false,
        seed: dmgSeed, timestamp: now,
        skillLabel: `Dégâts — ${LOCATION_LABELS[localisation] ?? localisation}`,
        mechanicalTotal: rawDice, diffLabel: `Armure:${etq ?? 0} RD:${rd}`,
        chancesDeReussite: degatsNets, isSuccess: degatsNets > 0,
      })
      io.to(campaignId).emit(WS.COMBAT_ATTACK_RESULT, {
        tireurId: action.token_id, cibleId: action.target_token_id,
        localisation, degautsBruts, degatsNets,
        severity: finalSeverity, is_lethal, isSuccess: true, shockResult: shockResult ?? null,
      })
      return
    }

    // 8c. Cible = PJ → COMBAT_DAMAGE_PROMPT
    const cibleSheet    = await db('char_sheet').where({ character_id: cibleCharacter.id }).first()
    const { for_na, con_na, vol_na } = cibleSheet
      ? await fetchCibleNA(cibleCharacter.id, cibleSheet.id)
      : { for_na: 8, con_na: 8, vol_na: 8 }
    const targetName = cibleCharacter.name ?? 'Cible'

    pendingDamageActions.set(action.token_id, {
      campaignId,
      targetTokenId:       action.target_token_id,
      characterIdCible:    cibleCharacter.id,
      cibleType:           null,
      char_sheet_id_cible: cibleSheet?.id ?? null,
      mr, portee,
      fire_mode_bonus_dmg: 0,
      formula,
      for_na_cible:  for_na,
      con_na_cible:  con_na,
      vol_na_cible:  vol_na,
      tireurUsername, tireurColor, userId, targetName,
      type: 'assault', modDom: null, combatModeBonus: null,
    })

    const damagePayload = { tokenId: action.token_id, formula, targetName }
    const allSockets    = await io.fetchSockets()
    const cibleSocket   = allSockets.find(s => s.user?.id === cibleCharacter.user_id && s.campaignId === campaignId)
    if (cibleSocket) {
      cibleSocket.emit(WS.COMBAT_DAMAGE_PROMPT, damagePayload)
    } else {
      socket.emit(WS.COMBAT_DAMAGE_PROMPT, damagePayload)
    }

  } catch (err) {
    console.error('[WS] resolveDroneAssaultAction error:', err.message)
  }
}

async function resolveAssaultAction(io, socket, campaignId, action, confirmedModifiers, character) {
  try {
    // Branchement drone — avant le guard weapon_inv_id (§7 MANUELSYSCOMBAT)
    if (character.type === 'drone') {
      return resolveDroneAssaultAction(io, socket, campaignId, action, confirmedModifiers, character)
    }
    if (!action.weapon_inv_id || !action.target_token_id) return

    const [weapon, rosterTireur] = await Promise.all([
      db('char_inventory')
        .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
        .where({ 'char_inventory.id': action.weapon_inv_id })
        .select(
          'ref_equipment.damage_h as ref_damage_h',
          'char_inventory.equipment_id',
          'char_inventory.ammo_remaining',
          'ref_equipment.ammo_count as ref_ammo_count',
        )
        .first(),
      db('combat_roster').where({ campaign_id: campaignId, token_id: action.token_id }).first(),
    ])

    if (!weapon?.ref_damage_h) {
      console.warn(`[WS] resolveAssaultAction — arme sans damage_h. weapon_inv_id:${action.weapon_inv_id}`)
      return
    }

    const userRow = character.user_id
      ? await db('users').where({ id: character.user_id }).select('color', 'username').first()
      : null
    const tireurColor    = userRow?.color    ?? '#c86030'
    const tireurUsername = userRow?.username ?? character.name ?? 'Inconnu'

    let skillTotal = 0, effectiveMalus = 0, carenceArmure = 0

    const sheetTireur = character?.id
      ? await db('char_sheet').where({ character_id: character.id }).first()
      : null

    if (sheetTireur) {
      const [attrsTireur, archetypeTireur, skillAssoc, woundsTireur, invTireur] = await Promise.all([
        db('char_attributes').where({ char_sheet_id: sheetTireur.id }),
        db('char_archetype').where({ char_sheet_id: sheetTireur.id }).first(),
        db('ref_equipment_skill_assoc').where({ item_id: weapon.equipment_id }).first(),
        db('character_wounds').where({ char_sheet_id: sheetTireur.id }),
        db('char_inventory')
          .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
          .where({ 'char_inventory.character_id': character.id })
          .select(
            'char_inventory.container', 'char_inventory.slot', 'char_inventory.quantity',
            'ref_equipment.weight as ref_weight', 'ref_equipment.min_str as ref_min_str',
          ),
      ])

      const genoTireur = archetypeTireur?.genotype_id
        ? await db('ref_genotypes').where({ id: archetypeTireur.genotype_id }).first()
        : null

      if (skillAssoc) {
        const [refSkill, charSkill] = await Promise.all([
          db('ref_skills').where({ id: skillAssoc.skill_id }).first(),
          db('char_skills').where({ char_sheet_id: sheetTireur.id, skill_id: skillAssoc.skill_id }).first(),
        ])
        if (refSkill) skillTotal = calcSkillTotal(attrsTireur, charSkill, refSkill, genoTireur)
      }

      const woundPenalty = calcWoundPenalty(woundsTireur)
      const forAttr = attrsTireur.find(a => a.attr_id === 'FOR')
      const forValue = (forAttr?.base_level ?? 7) + (forAttr?.pc_modifier ?? 0)  // PI4
      const totalWeight = invTireur.reduce((sum, i) => {
        if (i.container === 'Coffre' || i.ref_weight == null) return sum
        return sum + i.ref_weight * i.quantity
      }, 0)
      effectiveMalus = woundPenalty - calcEncumbrancePenalty(totalWeight, forValue)

      const for_na_tireur = calcAttributeNA(attrsTireur, 'FOR', genoTireur)
      const equippedTireur = invTireur.filter(i => i.slot != null)
      carenceArmure = calcCarenceArmure(equippedTireur, for_na_tireur)
    }

    const porteeModComp    = PORTEE_MOD_COMP[confirmedModifiers.portee] ?? 0
    const situationModComp = (confirmedModifiers.situation ?? [])
      .reduce((sum, k) => sum + (SITUATION_MODS[k] ?? 0), 0)
    const tailleModComp    = TAILLE_MODS[confirmedModifiers.taille] ?? 0
    const isRushedMod      = rosterTireur?.state_vitesse === 'rushed' ? -5 : 0
    const fireModeComp     = action.fire_mode_bonus_comp ?? 0
    const totalModComp     = porteeModComp + situationModComp + tailleModComp + isRushedMod + fireModeComp

    const chancesDeReussite = skillTotal + totalModComp + effectiveMalus - carenceArmure
    const { total: rollAttaque, rolls: attackRolls, seed: attackSeed } = await parseDice('1d20')
    const isSuccess = rollAttaque <= chancesDeReussite
    const mr = chancesDeReussite - rollAttaque
    const breakdown = [
      { label: 'Compétence', value: skillTotal, type: 'base' },
      ...(porteeModComp !== 0 ? [{ label: PORTEE_LABELS[confirmedModifiers.portee] ?? confirmedModifiers.portee, value: porteeModComp, type: porteeModComp > 0 ? 'bonus' : 'malus' }] : []),
      ...(fireModeComp !== 0 ? [{ label: `Mode de tir (×${action.bullet_count ?? 1})`, value: fireModeComp, type: 'bonus' }] : []),
      ...((confirmedModifiers.situation ?? []).reduce((acc, k) => {
        const v = SITUATION_MODS[k] ?? 0
        if (v !== 0) acc.push({ label: SITUATION_LABELS[k] ?? k, value: v, type: v > 0 ? 'bonus' : 'malus' })
        return acc
      }, [])),
      ...(tailleModComp !== 0 ? [{ label: TAILLE_LABELS[confirmedModifiers.taille] ?? confirmedModifiers.taille, value: tailleModComp, type: tailleModComp > 0 ? 'bonus' : 'malus' }] : []),
      ...(isRushedMod !== 0 ? [{ label: 'Précipitation', value: isRushedMod, type: 'malus' }] : []),
      ...(effectiveMalus !== 0 ? [{ label: 'Malus santé / encombrement', value: effectiveMalus, type: 'malus' }] : []),
      ...(carenceArmure !== 0 ? [{ label: 'Carence armure', value: -carenceArmure, type: 'malus' }] : []),
      { label: 'Seuil', value: chancesDeReussite, type: 'total' },
    ]
    console.log(`[WS] assault — roll:${rollAttaque} Seuil:${chancesDeReussite} → ${isSuccess ? 'TOUCHE' : 'RATÉ'} MR:${mr}`)
    io.to(campaignId).emit(WS.DICE_RESULT, {
      userId:            character.user_id,
      username:          tireurUsername,
      color:             tireurColor,
      formula:           '1d20',
      rolls:             attackRolls,
      total:             rollAttaque,
      isCriticalSuccess: rollAttaque === 1,
      isCriticalFail:    rollAttaque === 20,
      seed:              attackSeed,
      timestamp:         new Date().toISOString(),
      skillLabel:        'Jet pour toucher (distance)',
      mechanicalTotal:   skillTotal,
      diffLabel:         chancesDeReussite - skillTotal >= 0 ? `+${chancesDeReussite - skillTotal}` : `${chancesDeReussite - skillTotal}`,
      chancesDeReussite,
      isSuccess,
      mr,
      breakdown,
    })

    // ── Décompte munitions ──────────────────────────────────────────────────────
    // Balles consommées quel que soit le résultat (touché ou raté).
    // Skip si ammo_remaining = NULL (arme non initialisée = pas encore suivie).
    // Skip pour les PNJ si pnj_unlimited_ammo = true (option campagne).
    if (action.weapon_inv_id && weapon.ammo_remaining !== null && weapon.ammo_remaining !== undefined) {
      const isPnj = character.type === 'pnj'
      let skipDecrement = false
      if (isPnj) {
        const campaign = await db('campaigns').where({ id: campaignId }).select('pnj_unlimited_ammo').first()
        skipDecrement = campaign?.pnj_unlimited_ammo ?? true
      }
      if (!skipDecrement) {
        const bulletsFired = action.bullet_count ?? 1
        const newRemaining = Math.max(0, weapon.ammo_remaining - bulletsFired)
        await db('char_inventory').where({ id: action.weapon_inv_id }).update({ ammo_remaining: newRemaining })
      }
    }

    if (isSuccess) {
      // Fetch stats de la cible (commun PJ et PNJ)
      const cibleToken = await db('tokens').where({ id: action.target_token_id }).first()
      let char_sheet_id_cible = null
      let for_na_cible = 8, con_na_cible = 8, vol_na_cible = 8
      let cibleCharacter = null

      if (cibleToken?.character_id) {
        cibleCharacter = await db('characters').where({ id: cibleToken.character_id }).first()
        if (cibleCharacter) {
          const sheetCible = await db('char_sheet').where({ character_id: cibleCharacter.id }).first()
          if (sheetCible) {
            char_sheet_id_cible = sheetCible.id
            const [attrsCible, archetypeCible] = await Promise.all([
              db('char_attributes').where({ char_sheet_id: sheetCible.id }),
              db('char_archetype').where({ char_sheet_id: sheetCible.id }).first(),
            ])
            const genoCible = archetypeCible?.genotype_id
              ? await db('ref_genotypes').where({ id: archetypeCible.genotype_id }).first()
              : null
            for_na_cible = calcAttributeNA(attrsCible, 'FOR', genoCible)
            con_na_cible = calcAttributeNA(attrsCible, 'CON', genoCible)
            vol_na_cible = calcAttributeNA(attrsCible, 'VOL', genoCible)
          }
        }
      }

      const targetName = cibleCharacter?.name ?? cibleToken?.label ?? 'Cible'

      if (character.type === 'pj') {
        // PJ — stocker paramètres bruts, le joueur lance les dés via CombatDamageWindow
        socket.emit(WS.COMBAT_ATTACK_PLAYER_RESULT, {
          hit: true,
          roll: rollAttaque,
          seuil: chancesDeReussite,
          tireurTokenId: action.token_id,
          cibleTokenId: action.target_token_id,
        })
        pendingDamageActions.set(action.token_id, {
          campaignId,
          targetTokenId: action.target_token_id,
          characterIdCible: cibleToken?.character_id ?? null,
          cibleType: cibleCharacter?.type ?? null,
          char_sheet_id_cible,
          mr,
          portee: confirmedModifiers.portee,
          fire_mode_bonus_dmg: action.fire_mode_bonus_dmg ?? 0,
          formula: weapon.ref_damage_h,
          for_na_cible,
          con_na_cible,
          vol_na_cible,
          tireurUsername,
          tireurColor,
          userId: character.user_id,
          targetName,
        })
        socket.emit(WS.COMBAT_DAMAGE_PROMPT, {
          tokenId: action.token_id,
          formula: weapon.ref_damage_h,
          targetName,
        })
      } else {
        // PNJ — calcul complet immédiat, invisible aux joueurs
        const { total: rollLoc } = await parseDice('1d20')
        const slotCode = (LOC_TABLE.find(r => rollLoc <= r.max) ?? LOC_TABLE[LOC_TABLE.length - 1]).slot
        const localisation = SLOT_TO_WOUND_LOCATION[slotCode] ?? 'corps'

        let etq = null
        if (char_sheet_id_cible && cibleToken?.character_id) {
          const armuresCible = await db('char_inventory')
            .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
            .where({ 'char_inventory.character_id': cibleToken.character_id })
            .whereNotNull('char_inventory.slot')
            .select('char_inventory.slot', 'ref_equipment.protection as ref_protection', 'ref_equipment.protection_shock as ref_protection_shock')
          const armuresSlot = armuresCible.filter(a =>
            a.slot && ('/' + a.slot + '/').includes('/' + slotCode + '/')  // PI8
          )
          const resistanceArmure = calcResistanceArmure(armuresSlot)
          etq = resistanceArmure.etq
        }

        const mrTable = await getMrTable()
        const modDomAttaque = getModifier(mrTable, mr)
        const isShortRange = ['bout_portant', 'courte'].includes(confirmedModifiers.portee)
        const modDegatsMode = isShortRange ? (action.fire_mode_bonus_dmg ?? 0) : 0
        const { total: rawDice } = await parseDice(weapon.ref_damage_h.replace(/\s/g, ''))
        const degautsBruts = rawDice + modDomAttaque + modDegatsMode

        // Branche drone — cible sans char_sheet, résistance = blindage + intégrité×2 (§7.6)
        if (cibleCharacter?.type === 'drone') {
          const droneSheet = await db('drone_sheet').where({ character_id: cibleCharacter.id }).first()
          if (droneSheet) {
            const etqDrone  = droneSheet.blindage ?? 0
            const rdDrone   = calcDroneRD(droneSheet.integrite_actuelle)
            const degatsNetsDrone = Math.max(0, degautsBruts - etqDrone - rdDrone)
            await resolveDroneIntegrityLoss(io, campaignId, cibleCharacter.id, action.target_token_id, droneSheet, degatsNetsDrone)
            io.to(campaignId).emit(WS.COMBAT_ATTACK_RESULT, {
              tireurId: action.token_id, cibleId: action.target_token_id,
              localisation: null,
              degautsBruts, degatsNets: degatsNetsDrone,
              severity: null, is_lethal: false, isSuccess: true,
              isPnj: true, roll: rollAttaque, chancesDeReussite, shockResult: null,
            })
          }
          return
        }

        const rd = calcResistanceDommages(for_na_cible, con_na_cible)
        const degatsNets = Math.max(0, degautsBruts - (etq ?? 0) - rd)

        let severity = null, is_lethal = false
        if      (degatsNets >= 30) { severity = 'mortelle'; is_lethal = true }
        else if (degatsNets >= 25) { severity = 'mortelle' }
        else if (degatsNets >= 20) { severity = 'critique' }
        else if (degatsNets >= 15) { severity = 'grave'    }
        else if (degatsNets >= 10) { severity = 'moyenne'  }
        else if (degatsNets >=  5) { severity = 'legere'   }

        let finalSeverity = severity
        let shockResult = null
        if (severity && char_sheet_id_cible) {
          try {
            const result = await db.transaction(trx =>
              resolveWoundInsertion(trx, char_sheet_id_cible, localisation, severity)
            )
            finalSeverity = result.wound.severity
            io.to(campaignId).emit(WS.WOUND_ADDED, {
              characterId: cibleToken.character_id,
              wound: result.wound,
              promoted: result.promoted,
              shock_test_required: isShockTestRequired(finalSeverity, result.wound.location),
            })
            shockResult = await resolveShockBlock(io, campaignId, {
              finalSeverity, localisation, is_lethal,
              for_na: for_na_cible, con_na: con_na_cible, vol_na: vol_na_cible,
              targetTokenId: action.target_token_id,
              userId: character.user_id, username: tireurUsername, color: tireurColor,
            }) ?? null
          } catch (woundErr) {
            console.error('[WS] resolveAssaultAction (PNJ) — wound error:', woundErr.message)
          }
        }
        io.to(campaignId).emit(WS.COMBAT_ATTACK_RESULT, {
          tireurId:    action.token_id,
          cibleId:     action.target_token_id,
          localisation,
          degautsBruts,
          degatsNets,
          severity:    finalSeverity,
          is_lethal,
          isSuccess,
          isPnj:       true,
          roll:        rollAttaque,
          chancesDeReussite,
          shockResult,
        })
      }
    } else if (character.type === 'pj') {
      socket.emit(WS.COMBAT_ATTACK_PLAYER_RESULT, {
        hit: false,
        roll: rollAttaque,
        seuil: chancesDeReussite,
        tireurTokenId: action.token_id,
        cibleTokenId: action.target_token_id,
      })
    } else {
      io.to(campaignId).emit(WS.COMBAT_ATTACK_RESULT, {
        tireurId:         action.token_id,
        cibleId:          action.target_token_id,
        isSuccess:        false,
        isPnj:            true,
        roll:             rollAttaque,
        chancesDeReussite,
        localisation:     null,
        degautsBruts:     null,
        degatsNets:       null,
        severity:         null,
        is_lethal:        false,
        shockResult:      null,
      })
    }
  } catch (err) {
    console.error('[WS] resolveAssaultAction error:', err.message)
  }
}

// ─── Drones — fonctions de résolution ────────────────────────────────────────

// RD drone : integrite × 2 → table RD LdB p.112 (même table que FOR+CON humanoïdes,
// input direct sans calcul d'attributs). Drone sain (haute intégrité) → rd négatif → plus vulnérable.
// Drone endommagé (faible intégrité) → rd positif → noyau durci.
function calcDroneRD(integrite) {
  const rdInput = (integrite ?? 0) * 2
  return lookupTable(RD_TABLE, rdInput, 'rd') ?? 0
}

// Décrémente l'intégrité du drone après un hit, met à jour damages JSONB, broadcast.
// tokenId requis : drone_sheet n'a pas de FK token_id (PD8).
async function resolveDroneIntegrityLoss(io, campaignId, characterId, tokenId, droneSheet, degatsNets) {
  const damages = { ...droneSheet.damages }  // PD4 — copier avant mutation

  let severity = null
  if      (degatsNets >= 30) severity = 'detruit'
  else if (degatsNets >= 25) severity = 'mortelle'
  else if (degatsNets >= 20) severity = 'critique'
  else if (degatsNets >= 15) severity = 'grave'
  else if (degatsNets >= 10) severity = 'moyenne'
  else if (degatsNets >=  5) severity = 'legere'

  if (severity && severity !== 'detruit' && Array.isArray(damages[severity])) {
    const idx = damages[severity].indexOf(false)
    if (idx !== -1) {
      damages[severity] = [...damages[severity]]
      damages[severity][idx] = true
    }
    // B4 : si idx === -1 (toutes cases pleines pour ce niveau), décrémentation quand même — sprint futur
  }

  // LdB p.82-88 : 1 hit = 1 case = integrite -= 1. 'detruit' → integrite = 0 immédiatement.
  const newIntegrite = severity === 'detruit' ? 0 : Math.max(0, droneSheet.integrite_actuelle - 1)
  const detruit = newIntegrite <= 0

  if (detruit) damages.detruit = true

  await db('drone_sheet').where({ character_id: characterId }).update({
    damages: JSON.stringify(damages),
    integrite_actuelle: newIntegrite,
  })

  if (detruit) {
    await db('combat_roster').where({ campaign_id: campaignId, token_id: tokenId }).delete()
  }

  io.to(campaignId).emit(WS.DRONE_INTEGRITY_UPDATED, {
    characterId,
    integrite_actuelle: newIntegrite,
    damages,
    detruit,
  })
}