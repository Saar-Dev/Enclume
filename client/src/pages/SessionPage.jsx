import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { io } from 'socket.io-client'
import { WS } from '../../../shared/events.js'
import { useAuthStore } from '../stores/authStore'
import { useTokenStore } from '../stores/tokenStore'
import { useCharacterStore } from '../stores/characterStore'
import { useMapStore } from '../stores/mapStore'
import { useSessionStore } from '../stores/sessionStore'
import { useEntityStore } from '../stores/entityStore'
import { useCombatStore } from '../stores/combatStore'
import api from '../lib/api'
import Canvas3D from '../components/Canvas3D'
import Editor3D from '../components/Editor3D'
import Sidebar from '../components/Sidebar'
import DicePanel from '../components/DicePanel'
import CharacterWindow from '../character/CharacterWindow'
import RadialMenu from '../components/RadialMenu'
import EntityInstancePanel from '../components/EntityInstancePanel'
import CombatOverlay from '../components/CombatOverlay'

export default function SessionPage() {
  const { campaignId } = useParams()
  const { user } = useAuthStore()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { tokens, setTokens, addToken, removeToken, updateToken } = useTokenStore()
  const { characters, isGm, setCharacters, setMembers, upsertCharacter } = useCharacterStore()
  const {
    battlemap, battlemaps,
    setBattlemap, setBattlemaps,
    renameBattlemap, addBattlemap, removeBattlemap,
  } = useMapStore()
  const {
    setOnlineUsers, addOnlineUser, removeOnlineUser, addMessage,
  } = useSessionStore()
  const { setEntities, fetchBlueprints } = useEntityStore()
  const { setCombatState, resetCombat, setPhase, markTokenAnnounced, updateRoster, advanceSlot, setActions, phase: combatPhase } = useCombatStore()

  const [campaign, setCampaign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [mode, setMode] = useState('play')
  const [layer, setLayer] = useState('token')
  const [activeEditorTab, setActiveEditorTab] = useState('voxel') // 'voxel' | 'entity'
  // canvasVisible : false pendant la transition play↔edit — force le démontage
  // complet du Canvas actif avant que le suivant monte (évite le double contexte WebGL)
  const [canvasVisible, setCanvasVisible] = useState(true)

  const handleModeChange = useCallback((newMode) => {
    if (newMode === mode) return
    // PC15 — mode 'combat' : pas de démontage canvas (bypass setTimeout/setCanvasVisible)
    if (newMode === 'combat' || mode === 'combat') {
      setMode(newMode)
      return
    }
    setCanvasVisible(false)
    setTimeout(() => {
      setMode(newMode)
      setCanvasVisible(true)
    }, 300)
  }, [mode])
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(300)
  const [activeMaterial, setActiveMaterial] = useState(null)
  const [activeBlueprint, setActiveBlueprint] = useState(null)
  const [availableBlocks, setAvailableBlocks] = useState([])

  // ─── Radial menu entité ───────────────────────────────────────────────────
  // Ouvert au clic sur l'icône ⚙ d'une entité dans Canvas3D.
  // null = fermé, sinon { entity, x, y }
  const [radialMenu, setRadialMenu] = useState(null)
  // ─── Panneau config instance GM ───────────────────────────────────────────
  const [instancePanel, setInstancePanel] = useState(null)

  // ─── Mode visée déplacement entité ───────────────────────────────────────
  // null = inactif, sinon { entity, interaction, tokenId }
  const [moveTarget, setMoveTarget] = useState(null)

  // ─── Animation dés (Dice Rework) ────────────────────────────────────────────
  // null = pas d'animation, sinon payload DICE_RESULT du dernier jet normal.
  // Jets d'entité (skillLabel défini) → exclus, pas d'animation.
  const [lastDiceRoll, setLastDiceRoll] = useState(null)
  const handleDiceDone = useCallback(() => setLastDiceRoll(null), [])

  // ─── Reload blessures — déclenché par WOUND_ADDED (socket) ───────────────
  // Map { characterId → counter } — incrémenté à chaque blessure reçue.
  // Passé à CharacterWindow → bumpInventoryVersion() → ArmorWoundPanel reload.
  const [woundVersions, setWoundVersions] = useState({})

  // ─── Fenêtre "Gestion des dégâts" — PJ uniquement ────────────────────────
  // damagePayload : reçu via COMBAT_DAMAGE_PROMPT { tokenId, formula, targetName }
  // damageResults : reçu via COMBAT_DAMAGE_RESULT après que le PJ clique "Lancer les dés"
  const [damagePayload, setDamagePayload] = useState(null)
  const [damageResults, setDamageResults] = useState(null)
  // attackResult : reçu via COMBAT_ATTACK_PLAYER_RESULT { hit, roll, cdr, tireurTokenId, cibleTokenId }
  const [attackResult, setAttackResult] = useState(null)
  // gmAttackResult : reçu via COMBAT_ATTACK_RESULT { isPnj:true, ... } — panneau résultat PNJ GM
  const [gmAttackResult, setGmAttackResult] = useState(null)
  // pnjAttackResult : même payload, affiché au joueur ciblé
  const [pnjAttackResult,  setPnjAttackResult]  = useState(null)
  const [reloadResult,       setReloadResult]       = useState(null)
  const [meleeDefensePrompt, setMeleeDefensePrompt] = useState(null)  // { attackerName, attackerTokenId, defenderTokenId, rollAttaque, chancesAttaque }
  const [meleeResult,        setMeleeResult]        = useState(null)  // { attaquantId, defenseurId, rollAttaque, chancesAttaque, rollDefense, chanceDefense, hit }
  // gmSocketError : erreur serveur visible GM (PC22, etc.)
  const [gmSocketError, setGmSocketError] = useState(null)

  // Fenêtre character flottante — null = fermée, sinon id du character ouvert
  // Le character est dérivé du store pour se mettre à jour automatiquement via WS
  const [selectedCharacterId, setSelectedCharacterId] = useState(null)
  const selectedCharacter = selectedCharacterId
    ? characters.find(c => c.id === selectedCharacterId) ?? null
    : null

  // Menu contextuel barre GM — clic droit sur un bouton de carte
  const [mapContextMenu, setMapContextMenu] = useState(null) // { bm, x, y }
  const mapContextMenuRef = useRef(null)
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [renameTarget, setRenameTarget] = useState(null) // bm à renommer
  const [renameValue, setRenameValue] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createMapName, setCreateMapName] = useState('')

  // ─── Chargement session — useCallback pour réutilisation lors de la reconnexion ──
  // Déclaré AVANT le useEffect socket qui l'utilise — ordre React obligatoire.
  const loadSession = useCallback(async () => {
    try {
      // Chargement campagne + membres
      const res = await api.get(`/campaigns/${campaignId}`)
      const campaignData = res.data.campaign
      const members = res.data.members || []
      setCampaign(campaignData)
      // setMembers calcule isGm en interne à partir de userId
      setMembers(members, user?.id)

      // Chargement battlemap par défaut + ses tokens + ses entités
      const mapId = campaignData.default_battlemap_id
      if (mapId) {
        const mapRes = await api.get(`/battlemaps/${mapId}`)
        setBattlemap(mapRes.data.battlemap)
        setTokens(mapRes.data.tokens || [])
        // Chargement entités — route séparée (instances + blueprints embarqués)
        try {
          const entitiesRes = await api.get(`/battlemaps/${mapId}/entities`)
          setEntities(entitiesRes.data.entities || [])
        } catch (err) {
          console.error('Erreur chargement entités :', err)
          setEntities([])
        }
      }

      // Chargement des personnages de la campagne
      const charsRes = await api.get(`/campaigns/${campaignId}/characters`)
      setCharacters(charsRes.data.characters || [])

      // Chargement de la liste des battlemaps (pour la barre GM)
      const mapsRes = await api.get(`/campaigns/${campaignId}/battlemaps`)
      setBattlemaps(mapsRes.data.battlemaps || [])

    } catch (err) {
      setError(t('session.connectionError'))
    } finally {
      setLoading(false)
    }
  }, [campaignId, user?.id])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  // ─── Chargement initial des blueprints ────────────────────────────────────
  // Indépendant des entités posées sur la carte — charge tous les blueprints
  // non-deprecated au montage pour que la palette Entités soit immédiatement
  // utilisable, même si aucune entité n'est encore posée.
  useEffect(() => {
    fetchBlueprints()
  }, [])

  // ─── Socket.io ────────────────────────────────────────────────────────────────
  const [socket, setSocket] = useState(null)
  const [reconnectTrigger, setReconnectTrigger] = useState(0)

  // Bouton gmBar "⚔ Combat" — toggle mode combat (PC15) ou COMBAT_END si combat actif
  const handleCombatToggle = useCallback(() => {
    if (mode !== 'combat') {
      handleModeChange('combat')
    } else if (combatPhase !== null) {
      socket?.emit(WS.COMBAT_END)
    } else {
      handleModeChange('play')
    }
  }, [mode, combatPhase, socket, handleModeChange])

  // ─── Surprise initiative — joueur surpris en attente de jet ──────────────
  // null = inactif, sinon { tokenId } du token surpris appartenant au joueur
  const [pendingSurpriseRoll, setPendingSurpriseRoll] = useState(null)

  // ─── Centrage caméra combat (Sprint 2.5) ──────────────────────────────────
  // null = inactif, sinon { x, z } coords DB (PE14) du token à centrer.
  const [combatCameraCenter, setCombatCameraCenter] = useState(null)

  // ─── Mode sélection déplacement combat (Sprint 4) ─────────────────────────
  // null = inactif, sinon { tokenId, zones, onMoveSelected, onCancel, onPendingMove }
  const [combatMoveMode, setCombatMoveMode] = useState(null)
  // null = inactif, sinon sélection en attente de validation { action_key, ini_mod, targetPosX, targetPosY, targetPosZ }
  const [pendingMoveSelection, setPendingMoveSelection] = useState(null)

  // null = inactif, sinon { tokenId, pendingTargetId, onTargetSelected, onCancel, onPendingTarget }
  const [combatTargetMode, setCombatTargetMode] = useState(null)

  // Chargement local d'une carte — GM uniquement, sans déplacer les joueurs
  // Utilisé : clic barre GM, suppression carte active
  const loadMap = useCallback(async (battlemapId) => {
    if (!isGm) return
    try {
      const mapRes = await api.get(`/battlemaps/${battlemapId}`)
      setBattlemap(mapRes.data.battlemap)
      setTokens(mapRes.data.tokens || [])
      // Charger les entités de la nouvelle carte
      try {
        const entitiesRes = await api.get(`/battlemaps/${battlemapId}/entities`)
        setEntities(entitiesRes.data.entities || [])
      } catch (err) {
        console.error('Erreur chargement entités :', err)
        setEntities([])
      }
    } catch (err) {
      console.error('Erreur chargement carte :', err)
    }
  }, [isGm])

  // Déplacer tout le groupe vers une carte — charge localement + émet MAP_SWITCH
  // Utilisé : bouton "Déplacer le groupe ici" dans le menu contextuel barre GM
  const handleMapSwitch = useCallback(async (battlemapId) => {
    await loadMap(battlemapId)
    socket?.emit(WS.MAP_SWITCH, { battlemapId, userIds: [] })
  }, [loadMap, socket])

  // Fermeture menu contextuel barre GM sur clic ailleurs
  useEffect(() => {
    if (!mapContextMenu) return
    const handleMouseDown = (e) => {
      if (mapContextMenuRef.current && !mapContextMenuRef.current.contains(e.target)) {
        setMapContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [mapContextMenu])

  // Renommer une carte
  const handleMapRename = useCallback(async () => {
    if (!renameTarget || !renameValue.trim()) return
    try {
      await api.put(`/battlemaps/${renameTarget.id}`, { name: renameValue.trim() })
      renameBattlemap(renameTarget.id, renameValue.trim())
      setShowRenameModal(false)
      setRenameTarget(null)
    } catch (err) {
      console.error('Erreur renommage carte :', err)
    }
  }, [renameTarget, renameValue])

  // Définir comme page d'accueil
  const handleSetDefault = useCallback(async (bm) => {
    try {
      await api.put(`/campaigns/${campaignId}`, { default_battlemap_id: bm.id })
      setCampaign(prev => ({ ...prev, default_battlemap_id: bm.id }))
    } catch (err) {
      console.error('Erreur définition page d\'accueil :', err)
    }
    setMapContextMenu(null)
  }, [campaignId])

  // Déplacer le groupe (tous joueurs + GM)
  const handleGroupMove = useCallback(async (bm) => {
    setMapContextMenu(null)
    await handleMapSwitch(bm.id)
  }, [handleMapSwitch])

  // Dupliquer une carte
  const handleMapDuplicate = useCallback(async (bm) => {
    setMapContextMenu(null)
    try {
      const res = await api.post(`/battlemaps/${bm.id}/duplicate`)
      addBattlemap(res.data.battlemap)
    } catch (err) {
      console.error('Erreur duplication carte :', err)
    }
  }, [])

  // Supprimer une carte (avec confirmation)
  const handleMapDelete = useCallback(async (bm) => {
    setMapContextMenu(null)
    if (!window.confirm(t('session.deleteMapConfirm', { name: bm.name }))) return
    try {
      await api.delete(`/battlemaps/${bm.id}`)
      // Calculer remaining AVANT de muter le store — valeur actuelle avant suppression
      const remaining = battlemaps.filter(m => m.id !== bm.id)
      removeBattlemap(bm.id)
      // Si c'était la carte active, charger la première restante
      if (battlemap?.id === bm.id) {
        if (remaining.length > 0) {
          await loadMap(remaining[0].id)
        } else {
          setBattlemap(null)
          setTokens([])
        }
      }
    } catch (err) {
      console.error('Erreur suppression carte :', err)
    }
  }, [battlemap?.id, battlemaps, loadMap, t])

  // Créer une nouvelle carte
  const handleMapCreate = useCallback(async () => {
    if (!createMapName.trim()) return
    try {
      const res = await api.post(`/campaigns/${campaignId}/battlemaps`, { name: createMapName.trim() })
      addBattlemap(res.data.battlemap)
      setCreateMapName('')
      setShowCreateModal(false)
    } catch (err) {
      console.error('Erreur création carte :', err)
    }
  }, [createMapName, campaignId])

  // Drop depuis la Sidebar — crée un token au centre de la carte
  // Le serveur broadcastera TOKEN_CREATED à toute la room — pas d'emit client.
  const handleCharacterDrop = useCallback(async (characterId) => {
    if (!battlemap?.id) return

    const character = characters.find(c => c.id === characterId)
    if (!character) return

    try {
      const res = await api.post(`/battlemaps/${battlemap.id}/tokens`, {
        character_id: characterId,
        label: character.name,
        pos_x: 0,
        pos_y: 0,
        pos_z: 0,
        color: character.color,
        layer,
      })
      addToken(res.data.token)
    } catch (err) {
      console.error('Erreur création token :', err)
    }
  }, [battlemap?.id, characters, layer])

  useEffect(() => {
    const s = io(import.meta.env.VITE_API_URL, { withCredentials: true })
    s.emit(WS.SESSION_JOIN, { campaignId })

    s.on(WS.SESSION_JOINED, ({ userId, onlineUserIds = [] }) => {
      setOnlineUsers(new Set([userId, ...onlineUserIds]))
    })
    s.on(WS.SESSION_USER_JOINED, ({ userId, username }) => {
      addOnlineUser(userId)
      addMessage({
        id: `sys-join-${userId}-${Date.now()}`,
        system: true,
        text: t('session.userJoined', { username }),
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      })
    })
    s.on(WS.SESSION_USER_LEFT, ({ userId, username }) => {
      removeOnlineUser(userId)
      addMessage({
        id: `sys-left-${userId}-${Date.now()}`,
        system: true,
        text: t('session.userLeft', { username }),
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      })
    })
    s.on(WS.TOKEN_MOVED, ({ tokenId, pos_x, pos_y, pos_z, updated_at }) => {
      updateToken({ id: tokenId, pos_x, pos_y, pos_z, updated_at })
    })
    s.on(WS.TOKEN_CREATED, ({ token }) => {
      addToken(token)
    })
    s.on(WS.TOKEN_DELETED, ({ tokenId }) => {
      removeToken(tokenId)
    })
    s.on(WS.TOKEN_UPDATED, ({ token }) => {
      // Mise à jour partielle — token contient id + tous les champs modifiés (ex: r après TOKEN_ROTATE)
      // Guard updated_at géré dans le store — événements obsolètes ignorés silencieusement
      updateToken(token)
    })
    s.on(WS.CHAT_MESSAGE, ({ userId, username, color, text, timestamp }) => {
      addMessage({
        id: `${userId}-${timestamp}`,
        user: username,
        color,
        text,
        time: new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      })
    })
    s.on(WS.CHARACTER_UPDATED, (updatedCharacter) => {
      upsertCharacter(updatedCharacter)
    })
    s.on(WS.DICE_RESULT, ({ userId, username, color, formula, rolls, total, isCriticalSuccess, isCriticalFail, seed, timestamp, skillLabel, mechanicalTotal, chancesDeReussite, diffLabel, isSuccess, interactionType, mr, targetName, localisation, severity, severityColor, secret }) => {
      addMessage({
        id: `dice-${userId}-${timestamp}`,
        type: 'dice',
        user: username,
        color,
        formula,
        rolls,
        total,
        isCriticalSuccess,
        isCriticalFail,
        time: new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        // Champs structurés — jets entity_action uniquement (undefined pour jets normaux)
        skillLabel,
        mechanicalTotal,
        chancesDeReussite,
        diffLabel,
        isSuccess,
        interactionType,
        mr,
        // Champs combat_damage — undefined pour tous les autres jets
        targetName,
        localisation,
        severity,
        severityColor,
        // Jet secret — visible uniquement par le lanceur + GM
        secret: secret || false,
      })
      // Animation dés — jets normaux uniquement (skillLabel absent)
      // Jets d'entité (skillcheck, displacement) → pas d'animation en V1
      if (skillLabel === undefined) {
        setLastDiceRoll({ rolls, dieType: formula.replace(/^\d+/, '').split('+')[0].split('-')[0], seed, timestamp, color })
      }
    })
    s.on(WS.WOUND_ADDED, ({ characterId }) => {
      setWoundVersions(prev => ({ ...prev, [characterId]: (prev[characterId] ?? 0) + 1 }))
    })
    s.on(WS.INVENTORY_UPDATED, ({ characterId }) => {
      if (characterId) setWoundVersions(prev => ({ ...prev, [characterId]: (prev[characterId] ?? 0) + 1 }))
    })
    s.on(WS.INVENTORY_REMOVED, ({ characterId }) => {
      if (characterId) setWoundVersions(prev => ({ ...prev, [characterId]: (prev[characterId] ?? 0) + 1 }))
    })
    s.on(WS.COMBAT_RELOAD_RESULT, (data) => {
      setReloadResult(data)
    })
    s.on(WS.COMBAT_MELEE_DEFENSE_PROMPT, (data) => {
      setMeleeDefensePrompt(data)
    })
    s.on(WS.COMBAT_MELEE_RESULT, (data) => {
      setMeleeResult(data)
    })
    s.on(WS.COMBAT_DAMAGE_PROMPT, (data) => {
      setDamagePayload(data)
    })
    s.on(WS.COMBAT_DAMAGE_RESULT, (data) => {
      setDamageResults(data)
    })
    s.on(WS.COMBAT_ATTACK_PLAYER_RESULT, (data) => {
      setAttackResult(data)
    })
    s.on(WS.COMBAT_ATTACK_RESULT, (data) => {
      if (data.isPnj) {
        setGmAttackResult(data)
        setPnjAttackResult(data)
      }
    })
    s.on(WS.MACRO_ROLL_RESULT, ({ characterName, color, sourceLabel, rollResult, threshold, isSuccess, isCriticalSuccess, isCriticalFail, formattedMessage, secret, timestamp }) => {
      addMessage({
        id:               `macro-${timestamp}`,
        type:             'dice',
        interactionType:  'macro_result',
        characterName,
        color,
        sourceLabel,
        rollResult,
        threshold,
        isSuccess,
        isCriticalSuccess,
        isCriticalFail,
        formattedMessage,
        secret: secret || false,
        time: new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      })
    })

    s.on('error', (err) => {
      const msg = err?.message ?? String(err)
      console.error('[WS] Erreur serveur:', msg)
      setGmSocketError(msg)
    })
    s.on(WS.MAP_SWITCH, ({ battlemapId, userIds }) => {
      const concerned = userIds.length === 0 || userIds.includes(user?.id)
      if (!concerned) return
      api.get(`/battlemaps/${battlemapId}`)
        .then(res => {
          setBattlemap(res.data.battlemap)
          setTokens(res.data.tokens || [])
          // Charger les entités de la nouvelle carte
          return api.get(`/battlemaps/${battlemapId}/entities`)
        })
        .then(res => setEntities(res.data.entities || []))
        .catch(err => console.error('Erreur chargement carte MAP_SWITCH :', err))
    })

    // ─── Handlers entités ────────────────────────────────────────────────
    // ENTITY_ACTION_PENDING — demande d'un joueur, reçue par le GM uniquement
    // Ajoutée dans le fil chat avec type 'entity_action' — visible GM uniquement
    s.on(WS.ENTITY_ACTION_PENDING, (pending) => {
      addMessage({
        id: `entity-action-${pending.requestId}`,
        type: 'entity_action',
        gmOnly: true,
        requestId: pending.requestId,
        playerName: pending.playerName,
        interactionLabel: pending.interactionLabel,
        entityLabel: pending.entityLabel,
        skillId: pending.skillId,
        skillTotal: pending.skillTotal,
        defaultDifficulty: pending.defaultDifficulty,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      })
    })
    // ENTITY_ACTION_RESULT — résultat reçu par le joueur (refus, timeout, no_gm)
    s.on(WS.ENTITY_ACTION_RESULT, ({ requestId, isApproved, reason }) => {
      // Informer le joueur via un message système dans le chat
      if (!isApproved) {
        const reasonText = reason === 'timeout'
          ? t('session.actionExpired')
          : reason === 'no_gm'
            ? t('session.noGm')
            : t('session.actionRefused')
        addMessage({
          id: `entity-result-${requestId}`,
          system: true,
          text: reasonText,
          time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        })
      }
      // Fermer le radial menu si ouvert
      setRadialMenu(null)
    })

    // ENTITY_MOVE_RESULT — résultat jet + positions finales (9F-B2)
    // Reçu uniquement par le joueur émetteur (socket.id ciblé côté serveur)
    s.on(WS.ENTITY_MOVE_RESULT, ({ mr, dmax, success }) => {
      setMoveTarget(null)
      addMessage({
        id: `move-result-${Date.now()}`,
        system: true,
        text: success
          ? t('entity.moveSuccess', { mr, dmax })
          : t('entity.moveFail', { mr }),
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      })
    })

    // ─── Handlers combat ─────────────────────────────────────────────────────
    s.on(WS.COMBAT_STARTED, ({ roster, phase }) => {
      setCombatState({ phase, roster, actions: [], currentTurn: 1, activeSlotIdx: 0 })
      setMode('combat')
    })
    s.on(WS.COMBAT_ENDED, () => {
      resetCombat()
      setMode('play')
      setAttackResult(null)
      setReloadResult(null)
    })
    s.on(WS.COMBAT_STATE_SYNC, ({ combatState, roster, actions }) => {
      // Calculer activeTokenId depuis le roster (fallback si COMBAT_SLOT_ADVANCED non reçu)
      let activeTokenId = null
      if (combatState.phase === 'ANNOUNCEMENT') {
        activeTokenId = [...roster]
          .filter(r => !r.has_announced && r.status === 'active')
          .sort((a, b) => a.base_ini - b.base_ini || a.token_id.localeCompare(b.token_id))[0]?.token_id ?? null
      } else if (combatState.phase === 'RESOLUTION') {
        activeTokenId = [...roster]
          .sort((a, b) => b.initiative - a.initiative)[combatState.active_slot_idx]?.token_id ?? null
      }
      setCombatState({
        phase: combatState.phase,
        roster,
        actions,
        currentTurn: combatState.current_turn,
        activeSlotIdx: combatState.active_slot_idx,
        activeTokenId,
      })
      if (combatState.phase) setMode('combat')
    })

    // Phase changée — ANNOUNCEMENT ou RESOLUTION (avec roster et actions pour RESOLUTION)
    s.on(WS.COMBAT_PHASE_CHANGED, ({ phase, roster, actions }) => {
      setPhase(phase)
      if (roster) updateRoster(roster)
      if (actions) setActions(actions)
      if (phase === 'ANNOUNCEMENT') {
        setReloadResult(null)
        setMeleeDefensePrompt(null)
        setMeleeResult(null)
      }
    })
    // Roster mis à jour — après jet de surprise (COMBAT_SURPRISE_RESULT)
    s.on(WS.COMBAT_ROSTER_UPDATED, ({ roster }) => {
      updateRoster(roster)
    })
    // Joueur surpris — afficher l'UI de jet d'initiative
    s.on(WS.COMBAT_SURPRISE_ROLL, ({ tokenId }) => {
      setPendingSurpriseRoll({ tokenId })
    })
    // Participant a déclaré son action — initiative inclus si précipité (+3)
    s.on(WS.COMBAT_ACTION_DECLARED, ({ tokenId, initiative }) => {
      markTokenAnnounced(tokenId, initiative)
    })
    // Slot actif avancé (ANNOUNCEMENT et RESOLUTION)
    s.on(WS.COMBAT_SLOT_ADVANCED, ({ activeSlotIdx, tokenId }) => {
      advanceSlot(activeSlotIdx, tokenId)
    })
    // Participant passé par le GM ou timer auto-skip
    s.on(WS.COMBAT_TURN_SKIPPED, ({ tokenId, tokenLabel }) => {
      markTokenAnnounced(tokenId)
      addMessage({
        id: `combat-skip-${tokenId}-${Date.now()}`,
        system: true,
        text: t('session.tokenSkipped', { label: tokenLabel }),
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      })
    })

    // ─── Reconnexion robuste — Bug C ────────────────────────────────────────
    // socket.io.on('reconnect') se déclenche UNIQUEMENT lors d'une reconnexion
    // automatique (pas à la connexion initiale) — disponible depuis socket.io v3.
    // Incrémente reconnectTrigger → useEffect se ré-exécute → nouvelle instance
    // socket créée, SESSION_JOIN ré-émis, loadSession rechargé.
    s.io.on('reconnect', () => {
      setReconnectTrigger(n => n + 1)
    })

    setSocket(s)
    return () => s.disconnect()
  }, [campaignId, reconnectTrigger, loadSession])

  // ─── Menu contextuel clic droit token ────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState(null)
  const contextMenuRef = useRef(null)

  // Ouverture — vérifie que l'utilisateur est propriétaire du token OU GM
  const handleTokenDoubleClick = useCallback((token, x, y) => {
    const character = characters.find(c => c.id === token.character_id)
    const isOwner = character?.user_id === user?.id
    if (!isOwner && !isGm) return
    setContextMenu({ token, x, y })
  }, [characters, user?.id, isGm])

  // Fermeture sur clic ailleurs
  useEffect(() => {
    if (!contextMenu) return
    const handleMouseDown = (e) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [contextMenu])

  // Suppression depuis le menu contextuel
  const handleContextMenuDelete = useCallback(async () => {
    if (!contextMenu) return
    const tokenId = contextMenu.token.id
    setContextMenu(null)
    try {
      await api.delete(`/tokens/${tokenId}`)
      removeToken(tokenId)
    } catch (err) {
      console.error('Erreur suppression token (menu) :', err)
    }
  }, [contextMenu])

  // ─── Émission ENTITY_ACTION_REQUEST (joueur → serveur) ───────────────────
  // GM : action directe via ENTITY_ACTION_GM_DIRECT — sans arbitrage ni traçage.
  // Joueur : flux d'arbitrage normal via ENTITY_ACTION_REQUEST.
  const handleEntityAction = useCallback((entity, interaction) => {
    if (!socket) return

    // GM — action directe, pas de file d'arbitrage
    if (isGm) {
      socket.emit(WS.ENTITY_ACTION_GM_DIRECT, {
        entityId: entity.id,
        interactionId: interaction.id,
      })
      return
    }

    // TODO chantier /sc : résoudre le character actif du joueur
    // Priorité : character appartenant au joueur → premier character de la campagne en fallback
    const playerChar = characters.find(c => c.user_id === user?.id)
      ?? characters.find(c => c.visible !== false)
    if (!playerChar) {
      console.warn('[EntityAction] Aucun personnage disponible pour cette action')
      return
    }
    const requestId = `${entity.id}-${interaction.id}-${Date.now()}`
    socket.emit(WS.ENTITY_ACTION_REQUEST, {
      requestId,
      characterId: playerChar.id,
      entityId: entity.id,
      interactionId: interaction.id,
      skillId: interaction.skill_id || null,
      attributeId: interaction.attribute_id || null,
      // skillTotal supprimé — le serveur calcule via charStats.js (9F-0)
    })
  }, [socket, characters, user?.id, isGm])

  // ─── Émission ENTITY_MOVE_REQUEST (joueur/GM → serveur) — 9F-B2 ─────────
  // Active le mode visée dans Canvas3D — le joueur choisit la destination.
  // Déclaré AVANT handleEntityClick — P4/P48 (handleEntityClick l'appelle).
  const handleEntityMove = useCallback((entity, interaction) => {
    const actorToken = tokens.find(t =>
      characters.find(c => c.id === t.character_id && c.user_id === user?.id)
    )
    if (!actorToken) {
      console.warn('[EntityMove] Aucun token acteur trouvé pour cet utilisateur')
      return
    }
    setMoveTarget({ entity, interaction, tokenId: actorToken.id })
    setRadialMenu(null)
  }, [tokens, characters, user?.id])

  // ─── Clic entité — ouvre le radial menu ──────────────────────────────────
  // Si 1 seule interaction disponible → action directe sans radial.
  // Si 2-6 interactions (+ tranche GM) → radial menu.
  // Déclaré APRÈS handleEntityAction et handleEntityMove — P4/P48.
  const handleEntityClick = useCallback((entity, clientX, clientY) => {
    // Guard Q4 — mode visée actif : annuler silencieusement, ne pas ouvrir de radial
    if (moveTarget) {
      setMoveTarget(null)
      return
    }
    const blueprint = entity.blueprint
    const currentStateId = entity.current_state_id ?? 0
    const availableInteractions = (blueprint?.interactions || []).filter(i =>
      i.required_state_ids.includes(currentStateId) &&
      !(entity.disabled_interactions || []).includes(i.id)
    )
    // 1 seule interaction et pas GM → action directe (skillcheck) ou mode visée (displacement)
    if (availableInteractions.length === 1 && !isGm) {
      const i = availableInteractions[0]
      if (i.move_type === 'displacement') {
        handleEntityMove(entity, i)
      } else {
        handleEntityAction(entity, i)
      }
      return
    }
    setRadialMenu({ entity, x: clientX, y: clientY })
  }, [isGm, handleEntityAction, handleEntityMove, moveTarget])

  // ─── Résolution action entité (GM → serveur) ──────────────────────────────
  const handleEntityActionResolve = useCallback((requestId, isApproved, autoSuccess, gmModifier) => {
    socket?.emit(WS.ENTITY_ACTION_RESOLVE, { requestId, isApproved, autoSuccess, gmModifier })
  }, [socket])

  // ─── Rotation token (joueur/GM → serveur) ─────────────────────────────────
  // Appelé par Canvas3D au clic court sur un token propriétaire.
  // Le serveur incrémente r et broadcast TOKEN_UPDATED — PE21.
  const handleTokenRotate = useCallback((tokenId) => {
    socket?.emit(WS.TOKEN_ROTATE, { tokenId })
  }, [socket])

  // ─── Jet de surprise — joueur surpris lance son 1d20 ─────────────────────
  // P3 : socket dans les deps.
  const handleSurpriseRolled = useCallback(() => {
    if (!socket || !pendingSurpriseRoll) return
    socket.emit(WS.COMBAT_SURPRISE_RESULT, { tokenId: pendingSurpriseRoll.tokenId })
    setPendingSurpriseRoll(null)
  }, [socket, pendingSurpriseRoll])

  // ─── Mode déplacement combat : entrée, sélection, annulation ───────────────
  // allures : { lente, moyenne, rapide, max } en cases — depuis calcAllures (CombatActionWindow)
  // tokenPos : { x, z } coords DB (PE14) du token joueur (pour centrage caméra)
  // onMoveSelected/onCancel : closures CombatActionWindow qui mettent à jour son état
  const handleEnterMoveMode = useCallback((allures, tokenId, tokenPos, onMoveSelected, onCancel) => {
    const wrappedSelected = (sel) => {
      onMoveSelected(sel)
      setPendingMoveSelection(null)
      setCombatMoveMode(null)
    }
    const wrappedCancel = () => {
      onCancel()
      setPendingMoveSelection(null)
      setCombatMoveMode(null)
    }
    setCombatMoveMode({
      tokenId, allures,
      onMoveSelected: wrappedSelected,
      onCancel: wrappedCancel,
      onPendingMove: (sel) => setPendingMoveSelection(sel),
    })
    setCombatCameraCenter(tokenPos)
  }, [])

  const handleValidateMove = useCallback(() => {
    if (!combatMoveMode || !pendingMoveSelection) return
    combatMoveMode.onMoveSelected(pendingMoveSelection)
  }, [combatMoveMode, pendingMoveSelection])

  const handleCancelPendingMove = useCallback(() => {
    setPendingMoveSelection(null)
  }, [])

  // ─── Mode sélection cible combat (Sprint 7.1) ─────────────────────────────
  const handleEnterTargetMode = useCallback((tokenId, tokenPos, onTargetSelected, onCancel) => {
    const wrappedSelected = (targetTokenId) => {
      onTargetSelected(targetTokenId)
      setCombatTargetMode(null)
    }
    const wrappedCancel = () => {
      onCancel()
      setCombatTargetMode(null)
    }
    setCombatTargetMode({
      tokenId,
      pendingTargetId: null,
      onTargetSelected: wrappedSelected,
      onCancel: wrappedCancel,
      onPendingTarget: (id) => {
        if (id === tokenId) return  // prevent self-targeting
        setCombatTargetMode(prev => prev ? { ...prev, pendingTargetId: id } : null)
      },
    })
    setCombatCameraCenter(tokenPos)
  }, [])

  const handleValidateTarget = useCallback(() => {
    if (!combatTargetMode || !combatTargetMode.pendingTargetId) return
    combatTargetMode.onTargetSelected(combatTargetMode.pendingTargetId)
  }, [combatTargetMode])

  // ─── Annulation mode visée — stable (deps []) ─────────────────────────────
  // useCallback stable pour ne pas recréer les listeners useEffect dans Canvas3D.
  const handleMoveCancel = useCallback(() => {
    setMoveTarget(null)
  }, [])

  if (loading) return (
    <div style={styles.loading}>
      <p>{t('session.loading')}</p>
    </div>
  )

  if (error) return (
    <div style={styles.loading}>
      <p>{error}</p>
      <button onClick={() => navigate('/dashboard')}>{t('settings.back')}</button>
    </div>
  )

  return (
    <div style={styles.container}>

      {/* ─── Barre GM supérieure ─────────────────────────────────────────── */}
      {isGm && (
        <div style={styles.gmBar}>
          <span style={styles.gmBarLabel}>{t('session.battlemaps')}</span>
          <div style={styles.gmBarMaps}>
            {battlemaps.map(bm => (
              <button
                key={bm.id}
                style={{
                  ...styles.gmBarBtn,
                  ...(bm.id === battlemap?.id ? styles.gmBarBtnActive : {}),
                }}
                onClick={() => loadMap(bm.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setMapContextMenu({ bm, x: e.clientX, y: e.clientY })
                }}
                title={bm.name}
              >
                {bm.name}
              </button>
            ))}
          </div>
          <button
            onClick={handleCombatToggle}
            style={{
              ...styles.gmBarBtn,
              ...(mode === 'combat' ? styles.gmBarBtnActive : {}),
              borderColor: mode === 'combat' ? '#e05b5b' : '#2a2a3e',
              color: mode === 'combat' ? '#e05b5b' : '#8888a8',
              marginLeft: 'auto',
              flexShrink: 0,
            }}
            title={mode === 'combat' && combatPhase !== null ? t('session.combatEnd') : t('session.combatMode')}
          >
            {mode === 'combat' && combatPhase !== null ? `✕ ${t('session.combat')}` : `⚔ ${t('session.combat')}`}
          </button>
        </div>
      )}
      <div style={styles.mainArea}>
      <div
        style={styles.canvas}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault()
          const characterId = e.dataTransfer.getData('characterId')
          if (characterId) handleCharacterDrop(characterId)
        }}
      >
        {canvasVisible && (mode === 'edit'
          ? <Editor3D
              socket={socket}
              activeMaterial={activeMaterial}
              onActiveMaterialChange={setActiveMaterial}
              availableBlocks={availableBlocks}
              onBlocksLoaded={setAvailableBlocks}
              activeEditorTab={activeEditorTab}
              activeBlueprint={activeBlueprint}
            />
          : <Canvas3D
              onTokenDoubleClick={handleTokenDoubleClick}
              socket={socket}
              onEntityClick={handleEntityClick}
              onTokenRotate={handleTokenRotate}
              moveTarget={moveTarget}
              onMoveCancel={handleMoveCancel}
              dicePayload={lastDiceRoll}
              onDiceDone={handleDiceDone}
              combatCameraCenter={combatCameraCenter}
              combatMoveMode={combatMoveMode}
              combatTargetMode={combatTargetMode}
            />
        )}
        {!canvasVisible && (
          <div style={styles.canvasTransition}>
            <style>{`
              @keyframes enclumePulse {
                0%, 100% { opacity: 0.18; transform: scale(1); }
                50%       { opacity: 0.28; transform: scale(1.04); }
              }
              .canvas-transition-watermark {
                position: absolute;
                inset: 0;
                background: url('/logo.svg') no-repeat center center;
                background-size: 600px;
                opacity: 0.06;
                filter: invert(1);
                pointer-events: none;
              }
              .canvas-transition-logo {
                animation: enclumePulse 1s ease-in-out infinite;
              }
            `}</style>
            <div className="canvas-transition-watermark" />
            <img
              src="/logo.svg"
              alt="Enclume"
              className="canvas-transition-logo"
              style={styles.transitionLogo}
            />
          </div>
        )}
      </div>

      {sidebarVisible && (
        <Sidebar
          mode={mode}
          onModeChange={handleModeChange}
          activeEditorTab={activeEditorTab}
          onEditorTabChange={setActiveEditorTab}
          layer={layer}
          onLayerChange={setLayer}
          width={sidebarWidth}
          onWidthChange={setSidebarWidth}
          onClose={() => setSidebarVisible(false)}
          activeMaterial={activeMaterial}
          onMaterialChange={setActiveMaterial}
          availableBlocks={availableBlocks}
          activeBlueprint={activeBlueprint}
          onBlueprintSelect={setActiveBlueprint}
          campaignId={campaignId}
          socket={socket}
          onReconnectSocket={() => setReconnectTrigger(n => n + 1)}
          onOpenCharacter={(char) => setSelectedCharacterId(char.id)}
          onEntityActionResolve={handleEntityActionResolve}
        />
      )}

      {!sidebarVisible && (
        <button
          onClick={() => setSidebarVisible(true)}
          title={t('session.openSidebar')}
          style={styles.reopenBtn}
        >
          ‹
        </button>
      )}
      </div>

      {/* ─── Menu contextuel clic droit token ─────────────────────────────── */}
      {contextMenu && (() => {
        const MENU_W = 180
        const MENU_H = 136
        const x = contextMenu.x + MENU_W > window.innerWidth
          ? contextMenu.x - MENU_W
          : contextMenu.x
        const y = contextMenu.y + MENU_H > window.innerHeight
          ? contextMenu.y - MENU_H
          : contextMenu.y
        return (
          <div ref={contextMenuRef} style={{ ...styles.contextMenu, left: x, top: y }}>
            <button style={styles.contextMenuItem} onClick={handleContextMenuDelete}>
              {t('token.removeFromMap')}
            </button>
            <button style={{ ...styles.contextMenuItem, ...styles.contextMenuItemDisabled }} disabled>
              {t('token.measure')}
            </button>
            <button style={{ ...styles.contextMenuItem, ...styles.contextMenuItemDisabled }} disabled>
              {t('token.lineOfSight')}
            </button>
            <button style={{ ...styles.contextMenuItem, ...styles.contextMenuItemDisabled }} disabled>
              {t('token.range')}
            </button>
          </div>
        )
      })()}

      {/* ─── Menu contextuel barre GM ─────────────────────────────────────── */}
      {mapContextMenu && (() => {
        const MENU_W = 200
        const MENU_H = 200
        const x = mapContextMenu.x + MENU_W > window.innerWidth
          ? mapContextMenu.x - MENU_W
          : mapContextMenu.x
        const y = mapContextMenu.y + MENU_H > window.innerHeight
          ? mapContextMenu.y - MENU_H
          : mapContextMenu.y
        return (
          <div ref={mapContextMenuRef} style={{ ...styles.contextMenu, left: x, top: y }}>
            <button style={styles.contextMenuItem} onClick={() => {
              setRenameTarget(mapContextMenu.bm)
              setRenameValue(mapContextMenu.bm.name)
              setShowRenameModal(true)
              setMapContextMenu(null)
            }}>
              {t('session.mapRename')}
            </button>
            <button style={styles.contextMenuItem} onClick={() => handleSetDefault(mapContextMenu.bm)}>
              {t('session.mapSetDefault')}
            </button>
            <button style={styles.contextMenuItem} onClick={() => handleGroupMove(mapContextMenu.bm)}>
              {t('session.mapMoveGroup')}
            </button>
            <button style={styles.contextMenuItem} onClick={() => handleMapDuplicate(mapContextMenu.bm)}>
              {t('session.mapDuplicate')}
            </button>
            <button style={{ ...styles.contextMenuItem, color: 'var(--color-danger)' }}
              onClick={() => handleMapDelete(mapContextMenu.bm)}>
              {t('session.mapDelete')}
            </button>
            <div style={styles.contextMenuDivider} />
            <button style={styles.contextMenuItem} onClick={() => {
              setMapContextMenu(null)
              setCreateMapName('')
              setShowCreateModal(true)
            }}>
              {t('session.mapCreate')}
            </button>
          </div>
        )
      })()}

      {/* ─── Modale renommage carte ───────────────────────────────────────── */}
      {showRenameModal && (
        <div style={styles.modalOverlay} onMouseDown={() => setShowRenameModal(false)}>
          <div style={styles.modalBox} onMouseDown={e => e.stopPropagation()}>
            <p style={styles.modalTitle}>{t('session.mapRename')}</p>
            <input
              style={styles.modalInput}
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleMapRename() }}
              autoFocus
            />
            <div style={styles.modalActions}>
              <button style={styles.btnGhost} onClick={() => setShowRenameModal(false)}>
                {t('common.cancel')}
              </button>
              <button style={styles.btnPrimary} onClick={handleMapRename}>
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ─── Modale création carte ────────────────────────────────────────── */}
      {showCreateModal && (
        <div style={styles.modalOverlay} onMouseDown={() => setShowCreateModal(false)}>
          <div style={styles.modalBox} onMouseDown={e => e.stopPropagation()}>
            <p style={styles.modalTitle}>{t('session.mapCreate')}</p>
            <input
              style={styles.modalInput}
              value={createMapName}
              onChange={e => setCreateMapName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleMapCreate() }}
              placeholder={t('session.mapNamePlaceholder')}
              autoFocus
            />
            <div style={styles.modalActions}>
              <button style={styles.btnGhost} onClick={() => setShowCreateModal(false)}>
                {t('common.cancel')}
              </button>
              <button style={styles.btnPrimary} onClick={handleMapCreate}>
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CharacterWindow — flottante, déplaçable, redimensionnable ──────── */}
      {selectedCharacter && (
        <CharacterWindow
          character={{ ...selectedCharacter, _currentUserId: user?.id }}
          isGm={isGm}
          onClose={() => setSelectedCharacterId(null)}
          woundReloadKey={woundVersions[selectedCharacter?.id] ?? 0}
        />
      )}

      {/* ─── Radial menu entité ─────────────────────────────────────────────── */}
      {radialMenu && (() => {
        const entity = radialMenu.entity
        const blueprint = entity.blueprint
        const currentStateId = entity.current_state_id ?? 0
        const availableInteractions = (blueprint?.interactions || []).filter(i =>
          i.required_state_ids.includes(currentStateId) &&
          !(entity.disabled_interactions || []).includes(i.id)
        )
        // Calculé ici — tokens et characters disponibles dans SessionPage
        // null si le joueur n'a pas de token sur la carte (GM sans token)
        const actorToken = tokens.find(t =>
          characters.find(c => c.id === t.character_id && c.user_id === user?.id)
        ) ?? null
        return (
          <RadialMenu
            x={radialMenu.x}
            y={radialMenu.y}
            interactions={availableInteractions}
            isGm={isGm}
            onAction={(interaction) => {
              setRadialMenu(null)
              handleEntityAction(entity, interaction)
            }}
            onMove={(interaction) => {
              setRadialMenu(null)
              handleEntityMove(entity, interaction)
            }}
            onGmConfig={() => {
              setRadialMenu(null)
              setInstancePanel({ entity, x: radialMenu.x, y: radialMenu.y })
            }}
            onClose={() => setRadialMenu(null)}
            actorToken={actorToken}
            entity={entity}
          />
        )
      })()}

      {/* ─── Panneau config instance GM ──────────────────────────────────────── */}
      {instancePanel && (
        <EntityInstancePanel
          entity={instancePanel.entity}
          x={instancePanel.x}
          y={instancePanel.y}
          onClose={() => setInstancePanel(null)}
        />
      )}

      {/* ─── DicePanel — flottant, hors canvas, hors Sidebar ─────────────── */}
      <DicePanel socket={socket} mode={mode} sidebarVisible={sidebarVisible} sidebarWidth={sidebarWidth} />

      {/* ─── CombatOverlay — position:fixed, z-index 1000, visible en mode combat ── */}
      {mode === 'combat' && (
        <CombatOverlay
          socket={socket}
          battlemap={battlemap}
          isGm={isGm}
          user={user}
          characters={characters}
          tokens={tokens}
          pendingSurpriseRoll={pendingSurpriseRoll}
          onSurpriseRolled={handleSurpriseRolled}
          onEnterMoveMode={handleEnterMoveMode}
          combatMoveMode={combatMoveMode}
          pendingMoveSelection={pendingMoveSelection}
          onValidateMove={handleValidateMove}
          onCancelPendingMove={handleCancelPendingMove}
          combatTargetMode={combatTargetMode}
          onEnterTargetMode={handleEnterTargetMode}
          onValidateTarget={handleValidateTarget}
          damagePayload={damagePayload}
          damageResults={damageResults}
          onDamageConfirmed={() => { setDamagePayload(null); setDamageResults(null); setAttackResult(null) }}
          attackResult={attackResult}
          onAttackConfirmed={() => setAttackResult(null)}
          gmAttackResult={gmAttackResult}
          onGmAttackResultClose={() => setGmAttackResult(null)}
          pnjAttackResult={pnjAttackResult}
          onPnjAttackResultClose={() => setPnjAttackResult(null)}
          reloadResult={reloadResult}
          onReloadResultClose={() => setReloadResult(null)}
          meleeDefensePrompt={meleeDefensePrompt}
          onMeleeDefenseConfirm={() => {
            if (!meleeDefensePrompt?.defenderTokenId || !socket) return
            socket.emit(WS.COMBAT_MELEE_DEFENSE_CONFIRM, { tokenId: meleeDefensePrompt.defenderTokenId })
            setMeleeDefensePrompt(null)
          }}
          meleeResult={meleeResult}
          onMeleeResultClose={() => setMeleeResult(null)}
          gmSocketError={gmSocketError}
          onGmSocketErrorClose={() => setGmSocketError(null)}
        />
      )}

    </div>
  )
}

const styles = {
  container: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#0a0a0f',
    overflow: 'hidden',
  },
  gmBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '0 16px',
    height: '40px',
    backgroundColor: '#0e0e1a',
    borderBottom: '1px solid #2a2a3e',
    flexShrink: 0,
    zIndex: 100,
  },
  gmBarLabel: {
    fontSize: '11px',
    color: '#5b8dee',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
  },
  gmBarMaps: {
    display: 'flex',
    gap: '6px',
    overflowX: 'auto',
    flex: 1,
  },
  gmBarBtn: {
    background: 'none',
    border: '1px solid #2a2a3e',
    borderRadius: '4px',
    color: '#8888a8',
    fontSize: '12px',
    padding: '3px 10px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  gmBarBtnActive: {
    backgroundColor: 'rgba(91,141,238,0.15)',
    borderColor: '#5b8dee',
    color: '#5b8dee',
  },
  mainArea: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
  },
  canvasTransition: {
    flex: 1,
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'radial-gradient(circle at 20% 20%, #1a2340 0%, transparent 40%), radial-gradient(circle at 80% 80%, #0b0e14 0%, transparent 50%), #0f1115',
    position: 'relative',
    overflow: 'hidden',
  },
  transitionLogo: {
    width: '120px',
    opacity: 0.18,
    filter: 'invert(1)',
    animation: 'none',
  },
  canvas: {
    flex: 1,
    height: '100%',
    minWidth: 0,
  },
  loading: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a0a0f',
    color: '#9090a8',
    fontFamily: 'monospace',
    gap: '16px',
  },
  reopenBtn: {
    position: 'fixed',
    right: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 9999,
    background: '#16162a',
    border: '1px solid #5b8dee',
    borderRight: 'none',
    borderRadius: '8px 0 0 8px',
    color: '#5b8dee',
    cursor: 'pointer',
    padding: '14px 8px',
    fontSize: '18px',
    lineHeight: 1,
    boxShadow: '-4px 0 12px rgba(0,0,0,0.4)',
  },
  contextMenu: {
    position: 'fixed',
    zIndex: 9999,
    background: '#16162a',
    border: '1px solid #2a2a3e',
    borderRadius: '8px',
    overflow: 'hidden',
    minWidth: '180px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
  },
  contextMenuItem: {
    display: 'block',
    width: '100%',
    padding: '10px 14px',
    background: 'none',
    border: 'none',
    borderBottom: '1px solid #1e1e2e',
    color: '#c0c0d0',
    cursor: 'pointer',
    fontSize: '12px',
    textAlign: 'left',
  },
  contextMenuItemDisabled: {
    color: '#4a4a60',
    cursor: 'default',
  },
  contextMenuDivider: {
    height: '1px',
    backgroundColor: '#2a2a3e',
    margin: '4px 0',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  modalBox: {
    backgroundColor: '#16162a',
    border: '1px solid #2a2a3e',
    borderRadius: '10px',
    padding: '24px',
    width: '320px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  modalTitle: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#c0c0d0',
    margin: 0,
  },
  modalInput: {
    backgroundColor: '#0e0e1a',
    border: '1px solid #2a2a3e',
    borderRadius: '6px',
    padding: '9px 12px',
    color: '#c0c0d0',
    fontSize: '14px',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
  },
  btnPrimary: {
    backgroundColor: '#5b8dee',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '7px 16px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  btnGhost: {
    background: 'none',
    border: 'none',
    color: '#8888a8',
    fontSize: '13px',
    padding: '7px 8px',
    cursor: 'pointer',
  },
}
