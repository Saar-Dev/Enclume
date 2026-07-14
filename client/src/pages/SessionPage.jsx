import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SocketProvider, useSocket } from '../lib/SocketContext'
import { WS } from '../../../shared/events.js'
import { useAuthStore } from '../stores/authStore'
import { useTokenStore } from '../stores/tokenStore'
import { useCharacterStore } from '../stores/characterStore'
import { useMapStore } from '../stores/mapStore'
import { useSessionStore } from '../stores/sessionStore'
import { useEntityStore } from '../stores/entityStore'
import { useCombatStore } from '../stores/combatStore'
import { useLibraryStore } from '../stores/libraryStore'
import { useCampaignStore } from '../stores/campaignStore'
import api from '../lib/api'
import { useTokenSocket } from '../lib/useTokenSocket'
import { useEntitySocket } from '../lib/useEntitySocket'
import { useCombatSocket } from '../lib/useCombatSocket'
import { useSessionSocket } from '../lib/useSessionSocket'
import { useCharacterSocket } from '../lib/useCharacterSocket'
import { useBattlemapManager } from '../lib/useBattlemapManager'
import { useCombatUIState } from '../lib/useCombatUIState'
import Canvas3D from '../components/Canvas3D'
import Editor3D from '../components/Editor3D'
import Sidebar from '../components/Sidebar'
import DicePanel from '../components/DicePanel'
import CharacterWindow from '../character/CharacterWindow'
import DroneWindow from '../character/DroneWindow'
import RadialMenu from '../components/RadialMenu'
import TokenRadialMenu from '../components/TokenRadialMenu'
import TokenStatusPanel from '../components/TokenStatusPanel'
import EntityInstancePanel from '../components/EntityInstancePanel'
import CombatOverlay from '../components/CombatOverlay'
import TradeWindow from '../components/TradeWindow'
import ExchangeWindow from '../components/ExchangeWindow'
import { DEFAULT_SURFACE_MATERIAL_PRESET } from '../lib/proceduralMaterials.js'

export default function SessionPage() {
  const { campaignId } = useParams()
  return (
    <SocketProvider campaignId={campaignId}>
      <SessionContent campaignId={campaignId} />
    </SocketProvider>
  )
}

function SessionContent({ campaignId }) {
  const { user } = useAuthStore()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { tokens, setTokens, addToken, removeToken } = useTokenStore()
  const { characters, isGm, setCharacters, setMembers } = useCharacterStore()
  const { battlemap, battlemaps, setBattlemap, setBattlemaps } = useMapStore()
  const { setActiveCampaign, setPendingEntityId } = useSessionStore()
  const { setEntities, fetchBlueprints } = useEntityStore()
  const { phase: combatPhase } = useCombatStore()
  const { setDocuments } = useLibraryStore()
  const { campaign, setCampaign } = useCampaignStore()
  const myCharId = characters.find(c => c.user_id === user?.id)?.id ?? null
  const [loading, setLoading] = useState(true)
  const [statusPanel, setStatusPanel] = useState(null)

  useEffect(() => {
    document.title = campaign?.name ? `Enclume — ${campaign.name}` : 'Enclume — Session'
  }, [campaign])
  const [error, setError] = useState(null)

  const [mode, setMode] = useState('play')
  const [layer, setLayer] = useState('token')
  const [tradeWindowOpen,    setTradeWindowOpen]    = useState(false)
  const [tradeInitialContext, setTradeInitialContext] = useState(null)
  const [exchangeWindowOpen,  setExchangeWindowOpen]  = useState(false)
  const [exchangeContext,     setExchangeContext]     = useState(null)
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
  const [surfaceTool, setSurfaceTool] = useState({
    mode: 'floor',
    elevation: 0,
    floorThickness: 0.25,
    ceilingThickness: 0.25,
    ceilingHeight: 2.5,
    wallThickness: 1,
    wallHeight: 2.5,
    stairRise: 2.5,
    surfaceBlocking: 'solid',
    floorPackId: null,
    ceilingPackId: null,
    stairPackId: null,
    wallFrontPackId: null,
    wallBackPackId: null,
    floorTexId: null,
    ceilingTexId: null,
    stairTexId: null,
    wallFrontTexId: null,
    wallBackTexId: null,
    autoVariants: true,
    surfaceMaterialMode: 'procedural',
    materialPreset: DEFAULT_SURFACE_MATERIAL_PRESET,
  })
  const [surfaceUndoRequest, setSurfaceUndoRequest] = useState(0)
  const [surfaceRedoRequest, setSurfaceRedoRequest] = useState(0)
  const [canSurfaceUndo, setCanSurfaceUndo] = useState(false)
  const [canSurfaceRedo, setCanSurfaceRedo] = useState(false)

  // ─── Radial menu entité ───────────────────────────────────────────────────
  // Ouvert au clic sur l'icône ⚙ d'une entité dans Canvas3D.
  // null = fermé, sinon { entity, x, y }
  const [radialMenu, setRadialMenu] = useState(null)
  // ─── Panneau config instance GM ───────────────────────────────────────────
  const [instancePanel, setInstancePanel] = useState(null)

  // ─── Mode visée déplacement entité ───────────────────────────────────────
  // null = inactif, sinon { entity, interaction, tokenId }
  const [moveTarget, setMoveTarget] = useState(null)


  // Fenêtre character flottante — null = fermée, sinon id du character ouvert
  // Le character est dérivé du store pour se mettre à jour automatiquement via WS
  const [selectedCharacterId, setSelectedCharacterId] = useState(null)
  const selectedCharacter = selectedCharacterId
    ? characters.find(c => c.id === selectedCharacterId) ?? null
    : null

  // Fenêtre drone flottante — même pattern que selectedCharacterId
  const [selectedDroneId, setSelectedDroneId] = useState(null)
  const selectedDrone = selectedDroneId
    ? characters.find(c => c.id === selectedDroneId) ?? null
    : null

  // Dispatcher centralisé — route vers la bonne fenêtre selon character.type
  // Extensible : ajouter un case 'armure' quand ArmorWindow sera implémentée
  const openSheet = useCallback((character) => {
    if (!character) return
    switch (character.type) {
      case 'drone': setSelectedDroneId(character.id); break
      default:      setSelectedCharacterId(character.id)
    }
  }, [])

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

      // Chargement des documents de la bibliothèque
      const docsRes = await api.get(`/campaigns/${campaignId}/documents`)
      setDocuments(docsRes.data.documents || [])

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
  const socket = useSocket()

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

  // Fermer le panneau statuts si le token est supprimé pendant qu'il est ouvert
  useEffect(() => {
    if (!statusPanel) return
    const exists = tokens.some(t => t.id === statusPanel.tokenId)
    if (!exists) setStatusPanel(null)
  }, [statusPanel, tokens])

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

  // Hooks WS — déclarés ici, après TOUS les useState (évite TDZ sur setRadialMenu, setMoveTarget…)
  useTokenSocket()
  useEntitySocket({ setRadialMenu, setMoveTarget })
  // useCombatUIState AVANT useCombatSocket — handleModeReset passé comme onModeReset (P-R14-1)
  const {
    combatMoveMode, pendingMoveSelection, combatTargetMode, combatCameraCenter,
    handleModeReset, handleEnterMoveMode, handleValidateMove,
    handleCancelPendingMove, handleEnterTargetMode, handleValidateTarget,
  } = useCombatUIState()
  const combatSocket = useCombatSocket({ isGm, setMode, onModeReset: handleModeReset })
  const { lastDiceRoll, setLastDiceRoll, gmSocketError, setGmSocketError } = useSessionSocket()
  const { woundVersions } = useCharacterSocket()
  const {
    loadMap,
    mapContextMenu, setMapContextMenu, mapContextMenuRef,
    openRenameModal, openCreateModal,
    handleSetDefault, handleGroupMove, handleMapDuplicate, handleMapDelete,
    showRenameModal, setShowRenameModal, renameValue, setRenameValue, handleMapRename,
    showCreateModal, setShowCreateModal, createMapName, setCreateMapName, handleMapCreate,
  } = useBattlemapManager({ campaignId, isGm })
  const handleDiceDone = useCallback(() => setLastDiceRoll(null), [setLastDiceRoll])

  useEffect(() => {
    setActiveCampaign(campaignId)
  }, [campaignId])

  // ─── Menu radial token ───────────────────────────────────────────────────────
  // Ouvert au double-clic sur un token. Fermé par le composant lui-même.
  const [contextMenu, setContextMenu] = useState(null)

  // ─── Mode LOS (ligne de vue) ─────────────────────────────────────────────────
  const [losMode,   setLosMode]   = useState(null)
  const [losResult, setLosResult] = useState(null)  // { clear: boolean } | null

  const handleLosCancel = useCallback(() => setLosMode(null), [])
  const handleLosResult = useCallback(({ clear }) => setLosResult({ clear }), [])

  const handleViser = useCallback(() => {
    if (!contextMenu) return
    setLosResult(null)  // efface le résultat du check précédent
    setLosMode({ active: true, sourceTokenId: contextMenu.token.id })
    setContextMenu(null)
  }, [contextMenu])

  // Ouverture — vérifie que l'utilisateur est propriétaire du token OU GM
  const handleTokenDoubleClick = useCallback((token, x, y) => {
    const character = characters.find(c => c.id === token.character_id)
    const isOwner = character?.user_id === user?.id
    if (!isOwner && !isGm) return
    setContextMenu({ token, x, y })
  }, [characters, user?.id, isGm])

  // Orientation absolue depuis la boussole du menu radial (r = 0..7, PE21)
  const handleSetContextTokenRotation = useCallback((r) => {
    if (!contextMenu || !socket) return
    socket.emit(WS.TOKEN_SET_ROTATION, { tokenId: contextMenu.token.id, r })
  }, [contextMenu, socket])  // P3 : socket dans deps

  // Suppression depuis le menu radial — sans setContextMenu(null) : c'est doClose() du composant qui gère la fermeture
  const handleRemoveContextToken = useCallback(async () => {
    if (!contextMenu) return
    const tokenId = contextMenu.token.id
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
    setPendingEntityId(entity.id)
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
    if (!socket || !combatSocket.pendingSurpriseRoll) return
    socket.emit(WS.COMBAT_SURPRISE_RESULT, { tokenId: combatSocket.pendingSurpriseRoll.tokenId })
    combatSocket.setPendingSurpriseRoll(null)
  }, [socket, combatSocket.pendingSurpriseRoll, combatSocket.setPendingSurpriseRoll])

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
                className="btn btn-ghost"
                data-active={bm.id === battlemap?.id}
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
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
            className={mode === 'combat' ? 'btn btn-danger' : 'btn'}
            style={{ flexShrink: 0 }}
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
              surfaceTool={surfaceTool}
              surfaceUndoRequest={surfaceUndoRequest}
              surfaceRedoRequest={surfaceRedoRequest}
              onSurfaceUndoStateChange={setCanSurfaceUndo}
              onSurfaceRedoStateChange={setCanSurfaceRedo}
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
              pendingMoveSelection={pendingMoveSelection}
              combatTargetMode={combatTargetMode}
              announcementMarker={combatSocket.announcementMarker}
              losMode={losMode}
              onLosCancel={handleLosCancel}
              onLosResult={handleLosResult}
              defaultTokenGlbUrl={campaign?.default_token_glb_url
                ? `${import.meta.env.VITE_API_URL}/api/assets/${campaign.default_token_glb_url}`
                : null}
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
          surfaceTool={surfaceTool}
          onSurfaceToolChange={setSurfaceTool}
          canSurfaceUndo={canSurfaceUndo && activeEditorTab !== 'entity'}
          canSurfaceRedo={canSurfaceRedo && activeEditorTab !== 'entity'}
          onSurfaceUndo={() => setSurfaceUndoRequest(n => n + 1)}
          onSurfaceRedo={() => setSurfaceRedoRequest(n => n + 1)}
          campaignId={campaignId}
          socket={socket}
          onReconnectSocket={() => {}}
          onOpenCharacter={openSheet}
          onEntityActionResolve={handleEntityActionResolve}
          onOpenTrade={(ctx) => { setTradeInitialContext(ctx ?? null); setTradeWindowOpen(true) }}
          onOpenExchange={(ctx) => { setExchangeContext(ctx ?? null); setExchangeWindowOpen(true) }}
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

      {/* ─── Menu radial token ───────────────────────────────────────────────── */}
      {contextMenu && (() => {
        const character = characters.find(c => c.id === contextMenu.token.character_id)
        return (
          <TokenRadialMenu
            x={contextMenu.x}
            y={contextMenu.y}
            token={contextMenu.token}
            character={character}
            isGm={isGm}
            onOpenCharacterSheet={() => openSheet(character)}
            onRemoveToken={handleRemoveContextToken}
            onSetRotation={handleSetContextTokenRotation}
            onOpenStatusPanel={() => setStatusPanel({ tokenId: contextMenu.token.id, x: contextMenu.x, y: contextMenu.y })}
            onViser={handleViser}
            onOpenExchange={() => {
              setExchangeContext({ toCharId: contextMenu.token.character_id ?? null })
              setExchangeWindowOpen(true)
            }}
            onClose={() => setContextMenu(null)}
          />
        )
      })()}

      {/* ─── Mode LOS — banner "Sélectionnez une cible" ──────────────────── */}
      {losMode?.active && (
        <div style={{
          position: 'fixed', top: 64, left: '50%', transform: 'translateX(-50%)',
          zIndex: 200, background: 'rgba(15,23,42,0.88)',
          color: '#ffe066', padding: '6px 20px', borderRadius: 6,
          border: '1px solid #ffe066', fontSize: 14, pointerEvents: 'none',
          letterSpacing: '0.03em',
        }}>
          {t('los.selectTarget')}
        </div>
      )}

      {/* ─── Mode LOS — résultat (clic sur l'overlay pour fermer) ───────── */}
      {losResult !== null && (
        <div
          style={{
            position: 'fixed', top: 64, left: '50%', transform: 'translateX(-50%)',
            zIndex: 200, background: 'rgba(15,23,42,0.88)',
            color: losResult.clear ? '#70e07a' : '#e07070',
            padding: '6px 20px', borderRadius: 6, cursor: 'pointer',
            border: `1px solid ${losResult.clear ? '#70e07a' : '#e07070'}`,
            fontSize: 14, letterSpacing: '0.03em',
          }}
          onClick={() => setLosResult(null)}
        >
          {losResult.clear ? t('los.clear') : t('los.blocked')}
        </div>
      )}

      {/* ─── Panneau statuts token ───────────────────────────────────────── */}
      {statusPanel && (() => {
        const liveToken  = tokens.find(t => t.id === statusPanel.tokenId)
        if (!liveToken) return null
        const character  = characters.find(c => c.id === liveToken.character_id)
        return (
          <TokenStatusPanel
            x={statusPanel.x}
            y={statusPanel.y}
            token={liveToken}
            character={character}
            statuses={liveToken.statuses ?? []}
            isGm={isGm}
            userId={user?.id}
            socket={socket}
            onClose={() => setStatusPanel(null)}
          />
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
            <button style={styles.contextMenuItem} onClick={() => openRenameModal(mapContextMenu.bm)}>
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
            <button style={styles.contextMenuItem} onClick={() => openCreateModal()}>
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
              <button className="btn btn-ghost" onClick={() => setShowRenameModal(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn" onClick={handleMapRename}>
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
              <button className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn" onClick={handleMapCreate}>
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
          inventoryReloadKey={woundVersions[selectedCharacter?.id] ?? 0}
        />
      )}

      {/* ─── DroneWindow — flottante, déplaçable ────────────────────────────── */}
      {selectedDrone && (
        <DroneWindow
          character={{ ...selectedDrone, _currentUserId: user?.id }}
          isGm={isGm}
          onClose={() => setSelectedDroneId(null)}
          socket={socket}
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
          socket={socket}
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
          actionTimerSec={campaign?.settings?.action_timer_sec ?? 0}
          pendingSurpriseRoll={combatSocket.pendingSurpriseRoll}
          onSurpriseRolled={handleSurpriseRolled}
          onEnterMoveMode={handleEnterMoveMode}
          combatMoveMode={combatMoveMode}
          pendingMoveSelection={pendingMoveSelection}
          onValidateMove={handleValidateMove}
          onCancelPendingMove={handleCancelPendingMove}
          combatTargetMode={combatTargetMode}
          onEnterTargetMode={handleEnterTargetMode}
          onValidateTarget={handleValidateTarget}
          pjPreview={combatSocket.pjPreview}
          damagePayload={combatSocket.damagePayload}
          damageResults={combatSocket.damageResults}
          onDamageConfirmed={() => { combatSocket.setDamagePayload(null); combatSocket.setDamageResults(null); combatSocket.setAttackResult(null) }}
          attackResult={combatSocket.attackResult}
          onAttackConfirmed={() => combatSocket.setAttackResult(null)}
          gmAttackResult={combatSocket.gmAttackResult}
          onGmAttackResultClose={() => combatSocket.setGmAttackResult(null)}
          pnjAttackResult={combatSocket.pnjAttackResult}
          onPnjAttackResultClose={() => combatSocket.setPnjAttackResult(null)}
          reloadResult={combatSocket.reloadResult}
          onReloadResultClose={() => combatSocket.setReloadResult(null)}
          meleeDefensePrompt={combatSocket.meleeDefensePrompt}
          onMeleeDefenseConfirm={() => {
            if (!combatSocket.meleeDefensePrompt?.defenderTokenId || !socket) return
            socket.emit(WS.COMBAT_MELEE_DEFENSE_CONFIRM, { tokenId: combatSocket.meleeDefensePrompt.defenderTokenId })
            combatSocket.setMeleeDefensePrompt(null)
          }}
          meleeResult={combatSocket.meleeResult}
          onMeleeResultClose={() => combatSocket.setMeleeResult(null)}
          stunPayload={combatSocket.stunPayload}
          onStunConfirmed={() => combatSocket.setStunPayload(null)}
          gmSocketError={gmSocketError}
          onGmSocketErrorClose={() => setGmSocketError(null)}
          sidebarWidth={sidebarVisible ? sidebarWidth : 0}
        />
      )}

      {/* ─── ExchangeWindow — fenêtre d'échange PJ↔PJ (RadialMenu) ─────── */}
      {exchangeWindowOpen && (
        <ExchangeWindow
          campaignId={campaignId}
          socket={socket}
          onClose={() => setExchangeWindowOpen(false)}
          myCharId={myCharId}
          characters={characters}
          initialContext={exchangeContext}
        />
      )}

      {/* ─── TradeWindow — GM lite (étape 11 : déclenché via radial menu) ── */}
      {tradeWindowOpen && (
        <TradeWindow
          campaignId={campaignId}
          socket={socket}
          onClose={() => setTradeWindowOpen(false)}
          isGm={isGm}
          myCharId={myCharId}
          characters={characters}
          initialContext={tradeInitialContext}
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
}
