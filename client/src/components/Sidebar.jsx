import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCharacterStore } from '../stores/characterStore'
import { useSessionStore } from '../stores/sessionStore'
import { useEntityStore } from '../stores/entityStore'
import { useCombatStore } from '../stores/combatStore'
import api from '../lib/api.js'
import { WS } from '../../../shared/events.js'
import GeometryIcon from './GeometryIcon.jsx'
import LibraryPanel from './LibraryPanel.jsx'
import { CombatDeclareLogChatPanel } from './CombatDeclareLog.jsx'
import Object3DPreview from './Object3DPreview.jsx'
import GameTimeWidget from './GameTimeWidget.jsx'
import BlessuresReviewPanel from './BlessuresReviewPanel.jsx'
import PendingRollsPanel from './PendingRollsPanel.jsx'
import {
  clearMaterialSlotOverride,
  materialSlotDisplayValue,
  normalizeModelMaterialSlots,
  setMaterialSlotOverride,
} from '../lib/modelMaterialSlots.js'
import {
  DEFAULT_SURFACE_MATERIAL_PRESET,
  PROCEDURAL_MATERIAL_PRESETS,
  PROCEDURAL_PATTERN_PRESETS,
} from '../lib/proceduralMaterials.js'
import {
  IconEdit, IconPlay, IconEye, IconEyeOff, IconRuler, IconPlus,
} from './SidebarIcons.jsx'
import { styles } from './Sidebar.styles.js'
import DiceBreakdownPopover from './DiceBreakdownPopover.jsx'
import SidebarHelpModal from './SidebarHelpModal.jsx'
import SidebarCharactersTab from './SidebarCharactersTab.jsx'
import SidebarProfileTab from './SidebarProfileTab.jsx'
import { renderMessage } from './MessageRendererRegistry.jsx'
import { useChatSocket } from '../lib/useChatSocket.js'

const SIDEBAR_MIN = 220
const SIDEBAR_MAX = 500
const SIDEBAR_CLOSE_THRESHOLD = 160

const MODEL_SLOT_LABELS = {
  SLOT_01: 'Métal principal',
  SLOT_02: 'Panneaux secondaires',
  SLOT_03: 'Cadre / hardware',
  SLOT_04: 'Accent',
  SLOT_05: 'Verre',
}

// ─── Sidebar principale ───────────────────────────────────────────────────────
export default function Sidebar({
  mode, onModeChange, renderMode2D,
  activeEditorTab, onEditorTabChange,
  layer, onLayerChange,
  width, onWidthChange,
  onClose,
  activeMaterial, onMaterialChange, availableBlocks = [],
  activeBlueprint, onBlueprintSelect,
  surfaceTool, onSurfaceToolChange,
  canSurfaceUndo,
  canSurfaceRedo,
  onSurfaceUndo,
  onSurfaceRedo,
  campaignId,
  battlemapId,
  socket,
  onReconnectSocket,
  onOpenCharacter,
  onEntityActionResolve,
  onOpenTrade,
  onOpenExchange,
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { t: tCombat } = useTranslation('combat')
  const { isGm } = useCharacterStore()
  const { messagesByCampaign, activeCampaignId } = useSessionStore()
  const messages = useMemo(
    () => messagesByCampaign[activeCampaignId] || [],
    [activeCampaignId, messagesByCampaign],
  )
  // PLAN_CHAT.md Phase 3e — historique persisté + temps réel (chat:message_created/_deleted).
  // Scroll infini (loadOlderMessages/hasMore) pas encore câblé à un IntersectionObserver ici —
  // suivi séparé, ne bloque pas ce qui corrige réellement CH1 (survie au F5).
  useChatSocket(campaignId)
  const { blueprints, refreshBuiltinModels } = useEntityStore()
  const { phase } = useCombatStore()
  const surfaceToolState = {
    mode: 'select',
    level: 0,
    elevation: 0,
    selectedRoomId: null,
    selectedRoomIds: [],
    roomWallEdit: false,
    selectedRoomWallKeys: [],
    selectedRoomWallCount: 0,
    roomArcAngle: 90,
    roomArcSide: 1,
    roomArcError: null,
    roomArcActionId: null,
    roomArcAction: null,
    connectorType: null,
    connectorToLevel: 1,
    connectorBlueprintId: null,
    connectorModelLabel: null,
    connectorModelCategory: null,
    connectorModelGlbUrl: null,
    connectorModelBuiltinKey: null,
    connectorModelGeometry: null,
    connectorMaterialOverrides: {},
    roomHeightLevels: 1,
    wallHeightLevels: 1,
    floorThickness: 0.25,
    ceilingThickness: 0.25,
    ceilingHeight: 2.5,
    wallThickness: 1,
    wallHeight: 2.5,
    wallShape: 'straight',
    wallCurveOffset: 1.5,
    stairRise: 2.5,
    movementMultiplier: 1,
    ladderAxis: 'x',
    ladderWidth: 0.7,
    ladderDepth: 0.12,
    ladderAnchorSpacing: 0.5,
    elevatorDoorAxis: 'z',
    elevatorDoorSide: 1,
    elevatorTravelSecondsPerLevel: 2,
    elevatorDoorSeconds: 0.75,
    elevatorDwellSeconds: 0.75,
    effectDefinitionKey: 'fire',
    effectIntensity: 1,
    effectHeight: 2.5,
    surfaceBlocking: 'solid',
    floorPackId: null,
    ceilingPackId: null,
    stairPackId: null,
    wallInteriorPackId: null,
    floorTexId: null,
    ceilingTexId: null,
    stairTexId: null,
    wallInteriorTexId: null,
    autoVariants: true,
    surfaceMaterialMode: 'procedural',
    materialFace: 'floor',
    materialProfiles: {
      floor: { ...DEFAULT_SURFACE_MATERIAL_PRESET },
      ceiling: { ...DEFAULT_SURFACE_MATERIAL_PRESET, paint: '#6b7280' },
      wallInterior: { ...DEFAULT_SURFACE_MATERIAL_PRESET },
    },
    materialPreset: DEFAULT_SURFACE_MATERIAL_PRESET,
    ...surfaceTool,
  }
  const updateSurfaceTool = (patch) => onSurfaceToolChange?.({ ...surfaceToolState, ...patch })
  const surfaceMaterialFace = surfaceToolState.materialFace || 'floor'
  const rawSurfaceMaterialProfiles = surfaceToolState.materialProfiles || {}
  const surfaceMaterialProfiles = {
    ...rawSurfaceMaterialProfiles,
    floor: {
      ...DEFAULT_SURFACE_MATERIAL_PRESET,
      ...(rawSurfaceMaterialProfiles.floor || {}),
    },
    ceiling: {
      ...DEFAULT_SURFACE_MATERIAL_PRESET,
      paint: '#6b7280',
      ...(rawSurfaceMaterialProfiles.ceiling || {}),
    },
    wallInterior: {
      ...DEFAULT_SURFACE_MATERIAL_PRESET,
      ...(rawSurfaceMaterialProfiles.wallInterior || {}),
    },
  }
  const surfaceMaterialState = surfaceMaterialProfiles[surfaceMaterialFace] || surfaceMaterialProfiles.floor
  const surfacePaintValue = /^#[0-9a-f]{6}$/i.test(String(surfaceMaterialState.paint || ''))
    ? surfaceMaterialState.paint
    : DEFAULT_SURFACE_MATERIAL_PRESET.paint
  const updateSurfaceMaterial = (patch) => updateSurfaceTool({
    surfaceMaterialMode: 'procedural',
    materialFace: surfaceMaterialFace,
    materialProfiles: {
      ...surfaceMaterialProfiles,
      [surfaceMaterialFace]: { ...surfaceMaterialState, ...patch },
    },
  })
  const normalizedBlueprintText = (blueprint) => [
    blueprint?.label,
    blueprint?.name,
    blueprint?.category,
    blueprint?.builtin_key,
    blueprint?.glb_url,
  ].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
  const blueprintPlacementMode = (blueprint) => blueprint?.geometry?.placementMode || blueprint?.geometry?.placement_mode || 'free'
  const connectorBlueprints = Object.values(blueprints || {}).filter(blueprint => !blueprint.deprecated)
  const doorConnectorBlueprints = connectorBlueprints
    .filter(blueprint => {
      const text = normalizedBlueprintText(blueprint)
      return text.includes('futuristic_doors')
        || text.includes('porte')
        || text.includes('door')
        || text.includes('hatch')
        || text.includes('sas')
    })
    .sort((a, b) => String(a.label).localeCompare(String(b.label)))
  const elevatorConnectorBlueprints = connectorBlueprints
    .filter(blueprint => {
      const text = normalizedBlueprintText(blueprint)
      return text.includes('ascenseur')
        || text.includes('elevator')
        || text.includes('lift')
    })
    .sort((a, b) => String(a.label).localeCompare(String(b.label)))
  const ladderConnectorBlueprints = connectorBlueprints
    .filter(blueprint => {
      const text = normalizedBlueprintText(blueprint)
      return text.includes('echelle')
        || text.includes('ladder')
    })
    .sort((a, b) => String(a.label).localeCompare(String(b.label)))
  const genericElevatorChoice = {
    id: '__generic_elevator__',
    label: t('surfaceEditor.genericElevator'),
    category: 'surface_connectors',
  }
  const genericLadderChoice = {
    id: '__generic_ladder__',
    label: 'Échelle structurelle',
    category: 'surface_connectors',
  }
  const connectorChoices = surfaceToolState.connectorType === 'door'
    ? doorConnectorBlueprints
    : surfaceToolState.connectorType === 'ladder'
      ? [...ladderConnectorBlueprints, genericLadderChoice]
      : [...elevatorConnectorBlueprints, genericElevatorChoice]
  const selectedConnectorChoice = connectorChoices.find(choice => String(choice.id) === String(surfaceToolState.connectorBlueprintId))
    || connectorChoices[0]
    || null
  const connectorMaterialSlots = normalizeModelMaterialSlots(selectedConnectorChoice?.geometry)
  const connectorMaterialOverrides = surfaceToolState.connectorMaterialOverrides || {}
  const updateConnectorMaterialSlot = (slot, patch) => updateSurfaceTool({
    connectorMaterialOverrides: setMaterialSlotOverride(connectorMaterialOverrides, slot, patch),
  })
  const clearConnectorMaterialSlot = (slot) => updateSurfaceTool({
    connectorMaterialOverrides: clearMaterialSlotOverride(connectorMaterialOverrides, slot),
  })
  const connectorModelPatch = (blueprint) => ({
    connectorBlueprintId: blueprint?.id || null,
    connectorModelLabel: blueprint?.label || null,
    connectorModelCategory: blueprint?.category || null,
    connectorModelGlbUrl: blueprint?.glb_url || null,
    connectorModelBuiltinKey: blueprint?.builtin_key || null,
    connectorModelGeometry: blueprint?.geometry || null,
  })
  const selectConnectorModel = (blueprint) => updateSurfaceTool({
    mode: 'connector',
    connectorType: surfaceToolState.connectorType || 'door',
    ...connectorModelPatch(blueprint),
  })

  useEffect(() => {
    if (surfaceToolState.mode !== 'connector' || !selectedConnectorChoice) return
    const selectedId = selectedConnectorChoice.id || null
    const selectedLabel = selectedConnectorChoice.label || null
    if (String(surfaceToolState.connectorBlueprintId || '') === String(selectedId || '')
      && surfaceToolState.connectorModelLabel === selectedLabel) return
    onSurfaceToolChange?.(current => {
      if (current?.mode !== 'connector' || current?.connectorType !== surfaceToolState.connectorType) return current
      return {
        ...current,
        connectorBlueprintId: selectedId,
        connectorModelLabel: selectedLabel,
        connectorModelCategory: selectedConnectorChoice.category || null,
        connectorModelGlbUrl: selectedConnectorChoice.glb_url || null,
        connectorModelBuiltinKey: selectedConnectorChoice.builtin_key || null,
        connectorModelGeometry: selectedConnectorChoice.geometry || null,
      }
    })
  }, [
    onSurfaceToolChange,
    selectedConnectorChoice,
    surfaceToolState.connectorBlueprintId,
    surfaceToolState.connectorModelLabel,
    surfaceToolState.connectorType,
    surfaceToolState.mode,
  ])

  const [worldEffects, setWorldEffects] = useState({ definitions: [], instances: [] })
  const [customEffectOpen, setCustomEffectOpen] = useState(false)
  const [customEffectDraft, setCustomEffectDraft] = useState({ key: '', label: '', movementMultiplier: 1, note: '' })

  const refreshWorldEffects = useCallback(async () => {
    if (!battlemapId) return setWorldEffects({ definitions: [], instances: [] })
    try {
      const { data } = await api.get(`/battlemaps/${battlemapId}/world-effects`)
      setWorldEffects(data.worldEffects || { definitions: [], instances: [] })
    } catch (error) {
      console.error('[Sidebar] Erreur chargement effets monde :', error)
    }
  }, [battlemapId])

  useEffect(() => { refreshWorldEffects() }, [refreshWorldEffects])

  useEffect(() => {
    if (!socket || !battlemapId) return undefined
    const onRuntimeUpdate = event => {
      if (String(event?.battlemapId) === String(battlemapId)) refreshWorldEffects()
    }
    socket.on(WS.WORLD_RUNTIME_UPDATED, onRuntimeUpdate)
    return () => socket.off(WS.WORLD_RUNTIME_UPDATED, onRuntimeUpdate)
  }, [socket, battlemapId, refreshWorldEffects])

  const createCustomEffect = async () => {
    if (!battlemapId || !customEffectDraft.key.trim() || !customEffectDraft.label.trim()) return
    try {
      const { data } = await api.post(`/battlemaps/${battlemapId}/world-effects/definitions`, {
        key: customEffectDraft.key.trim().toLowerCase(),
        label: customEffectDraft.label.trim(),
        note: customEffectDraft.note,
        modifiers: { movementMultiplier: Number(customEffectDraft.movementMultiplier) || 1 },
        hooks: customEffectDraft.note
          ? [{ event: 'traverse', type: 'note', label: customEffectDraft.label.trim(), note: customEffectDraft.note }]
          : [],
      })
      await refreshWorldEffects()
      updateSurfaceTool({ effectDefinitionKey: data.definition.key, mode: 'effect' })
      setCustomEffectDraft({ key: '', label: '', movementMultiplier: 1, note: '' })
      setCustomEffectOpen(false)
    } catch (error) {
      console.error('[Sidebar] Création effet personnalisé refusée :', error)
    }
  }

  const deleteRuntimeEffect = async instanceId => {
    if (!battlemapId) return
    try {
      await api.delete(`/battlemaps/${battlemapId}/world-effects/instances/${instanceId}`)
      await refreshWorldEffects()
    } catch (error) {
      console.error('[Sidebar] Suppression effet refusée :', error)
    }
  }

  const [activeTab, setActiveTab] = useState('chat')
  const [toolsOpen, setToolsOpen] = useState(false)
  const [pendingActionCount, setPendingActionCount] = useState(0)
  const prevEntityActionCountRef = useRef(0)
  const prevSellRequestCountRef    = useRef(0)
  const prevExchangeOfferCountRef  = useRef(0)
  const [chatInput, setChatInput] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const [objectSearch, setObjectSearch] = useState('')
  const [refreshingObjects, setRefreshingObjects] = useState(false)

  // Modale character — déléguée à SessionPage via onOpenCharacter

  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  // Réf pour l'auto-scroll — pointe sur un div vide en fin de liste de messages
  const messagesEndRef = useRef(null)

  // Animation dé — id du dernier message dé reçu, nettoyé après 800ms
  // Utilise useState (pas useRef) car doit déclencher un re-render pour l'animation CSS
  const [animatingDiceId, setAnimatingDiceId] = useState(null)
  const [cdlOpen, setCdlOpen] = useState(true)

  // Popover breakdown — null ou { msgId, breakdown, rect }
  const [breakdownPopover, setBreakdownPopover] = useState(null)
  const popoverRef = useRef(null)

  // ─── RESIZE ─────────────────────────────────────────────────────────────
  const onMouseDown = (e) => {
    isDragging.current = true
    startX.current = e.clientX
    startWidth.current = width
    e.preventDefault()
  }

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isDragging.current) return
      const delta = startX.current - e.clientX
      const newWidth = startWidth.current + delta
      if (newWidth < SIDEBAR_CLOSE_THRESHOLD) {
        isDragging.current = false
        onClose()
      } else {
        onWidthChange(Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, newWidth)))
      }
    }
    const onMouseUp = () => { isDragging.current = false }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onClose, onWidthChange])

  // ─── AUTO-SCROLL messages ────────────────────────────────────────────────
  // Se déclenche à chaque nouveau message — scroll vers le bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ─── Badge GM — actions entités en attente ───────────────────────────────
  useEffect(() => {
    if (!isGm) return
    const entityCount = messages.filter(m => m.type === 'entity_action').length
    const sellCount     = messages.filter(m => m.type === 'sell_request').length
    const exchangeCount = messages.filter(m => m.type === 'exchange_offer').length
    let delta = 0
    if (entityCount   > prevEntityActionCountRef.current)  delta += entityCount   - prevEntityActionCountRef.current
    if (sellCount     > prevSellRequestCountRef.current)   delta += sellCount     - prevSellRequestCountRef.current
    if (exchangeCount > prevExchangeOfferCountRef.current) delta += exchangeCount - prevExchangeOfferCountRef.current
    if (delta > 0) setPendingActionCount(prev => prev + delta)
    prevEntityActionCountRef.current   = entityCount
    prevSellRequestCountRef.current    = sellCount
    prevExchangeOfferCountRef.current  = exchangeCount
  }, [messages, isGm])

  // ─── ANIMATION dé — Option B ─────────────────────────────────────────────
  // Détecte le dernier message de type 'dice', stocke son id pendant 800ms,
  // puis le remet à null pour retirer l'animation CSS.
  // useRef lastDiceId évite de relancer le timer si un non-dé arrive entre temps.
  const lastDiceIdRef = useRef(null)
  useEffect(() => {
    const lastDice = [...messages].reverse().find(m => m.type === 'dice')
    if (!lastDice || lastDice.id === lastDiceIdRef.current) return
    lastDiceIdRef.current = lastDice.id
    setAnimatingDiceId(lastDice.id)
    const timer = setTimeout(() => setAnimatingDiceId(null), 800)
    return () => clearTimeout(timer)
  }, [messages])

  useEffect(() => {
    if (!breakdownPopover) return
    const onMouse = (e) => { if (popoverRef.current && !popoverRef.current.contains(e.target)) setBreakdownPopover(null) }
    const onKey   = (e) => { if (e.key === 'Escape') setBreakdownPopover(null) }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown', onKey)
    }
  }, [breakdownPopover])

  // ─── CHAT ────────────────────────────────────────────────────────────────
  const sendMessage = (e) => {
    e.preventDefault()
    const text = chatInput.trim()
    if (!text) return

    // Commandes dés : /r <formule> ou /roll <formule>
    // Le client émet DICE_ROLL — le serveur calcule et broadcaste DICE_RESULT.
    // Le message ne part PAS dans le chat.
    const diceMatch = text.match(/^\/r(?:oll)?\s+(.+)$/i)
    if (diceMatch) {
      const formula = diceMatch[1].trim()
      if (formula) socket?.emit(WS.DICE_ROLL, { formula })
      setChatInput('')
      return
    }

    // /help, /w, /gm sont interceptés côté serveur (socketChat.js, chatCommandRegistry) — le
    // client envoie le texte brut, pas de parsing dupliqué ici (vérifié dans le code déjà écrit
    // en Phase 1, la prose du plan §9 suggérait un parsing client qui n'existe pas réellement).
    socket?.emit(WS.CHAT_SEND, { channelId: 'general', type: 'TEXT', payload: { text } })
    setChatInput('')
  }

  const handleOpenBreakdown = useCallback((e, msg) => {
    e.stopPropagation()
    if (breakdownPopover?.msgId === msg.id) { setBreakdownPopover(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    setBreakdownPopover({ msgId: msg.id, breakdown: msg.breakdown, rect })
  }, [breakdownPopover])

  return (
    <div className="sidebar-panel" style={{ ...styles.sidebar, width }}>

      {/* Keyframes animation dé — toujours dans le DOM, indépendant de l'onglet actif */}
      <style>{`
        @keyframes diceRoll {
          0%   { transform: rotate(0deg) scale(1); }
          25%  { transform: rotate(120deg) scale(1.25); }
          60%  { transform: rotate(300deg) scale(0.9); }
          100% { transform: rotate(360deg) scale(1); }
        }
        .dice-icon-animating {
          animation: diceRoll 0.8s ease-out;
        }
      `}</style>

      {/* Poignée de redimensionnement */}
      <div style={styles.resizeHandle} onMouseDown={onMouseDown} />

      {/* Bouton fermeture */}
      <button className="btn-icon" onClick={onClose} title={t('common.close')} style={{ position:'absolute', top:'8px', right:'8px', zIndex:10, fontSize:'18px' }}>›</button>

      {/* Bouton aide raccourcis */}
      <button
        className="btn-icon sidebar-help-btn"
        onClick={() => setShowHelp(v => !v)}
        title={t('sidebar.helpTitle')}
      >?</button>

      {/* ─── HORLOGE DE CAMPAGNE (docs/PLAN_FATIGUE_DOMMAGES.md §7, Lot 1) ────────── */}
      {/* Masquée en mode Combat et Édition — décision Saar 2026-07-29, distraction non désirée */}
      {mode !== 'combat' && mode !== 'edit' && <GameTimeWidget campaignId={campaignId} />}

      {/* ─── BLESSURES : revue MJ + jets en attente (docs/PLAN_BLESSURES_GUERISON.md §6.1) ────── */}
      {/* Jamais masqués par le mode — une revue/un jet déjà ouvert avant un changement de mode reste
          actionnable ; contrairement à l'horloge, rien ici n'en déclenche de nouveaux depuis ces modes. */}
      <BlessuresReviewPanel campaignId={campaignId} />
      <PendingRollsPanel campaignId={campaignId} />

      {/* ─── OUTILS ─────────────────────────────────────────────────────── */}
      <div style={styles.toolsRow}>
        {isGm && !renderMode2D && (
          <button
            className="btn-tool"
            data-active={mode === 'edit'}
            onClick={() => onModeChange(mode === 'edit' ? 'play' : 'edit')}
            title={mode === 'edit' ? t('session.modePlay') : t('session.modeEdit')}
          >
            {mode === 'edit' ? <IconPlay /> : <IconEdit />}
            <span style={{ fontSize:'9px', letterSpacing:'0.5px', textTransform:'uppercase' }}>{mode === 'edit' ? 'Mode jeu' : 'Édition'}</span>
          </button>
        )}

        {isGm && mode !== 'edit' && (
          <button
            className="btn-tool"
            data-active={layer === 'gm'}
            onClick={() => onLayerChange(layer === 'gm' ? 'token' : 'gm')}
            title={layer === 'gm' ? t('session.layerToken') : t('session.layerGM')}
          >
            {layer === 'gm' ? <IconEyeOff /> : <IconEye />}
            <span style={{ fontSize:'9px', letterSpacing:'0.5px', textTransform:'uppercase' }}>{layer === 'gm' ? t('session.layerGM') : t('session.layerToken')}</span>
          </button>
        )}

        {mode !== 'edit' && <div style={{ position: 'relative' }}>
          <button
            className="btn-tool"
            onClick={() => setToolsOpen(v => !v)}
            title={t('session.tools')}
          >
            <IconRuler />
            <span style={{ fontSize:'9px', letterSpacing:'0.5px', textTransform:'uppercase' }}>{t('session.tools')}</span>
          </button>
          {toolsOpen && (
            <div className="sidebar-tools-dropdown">
              <button className="sidebar-tools-dropdown-item" disabled>
                {t('session.toolRuler')}
              </button>
              <button className="sidebar-tools-dropdown-item enabled" onClick={() => { setToolsOpen(false); onOpenTrade?.() }}>
                {t('session.commerce')}
              </button>
            </div>
          )}
        </div>}
      </div>

      {/* ─── PALETTE TEXTURES (mode édition) ─────────────────────────────── */}
      {mode === 'edit' && (
        <div style={styles.palette}>
          {/* ── Onglets éditeur : Voxels / Entités ── */}
          <div className="sidebar-editor-tabs">
            <button
              className="sidebar-editor-tab"
              data-active={activeEditorTab === 'world'}
              onClick={() => onEditorTabChange?.('world')}
            >
              Monde
            </button>
            <button
              className="sidebar-editor-tab"
              data-active={activeEditorTab === 'entity'}
              onClick={() => onEditorTabChange?.('entity')}
            >
              {t('sidebar.editorTabEntities')}
            </button>
          </div>
          <div style={styles.undoRow}>
            <button
              type="button"
              className="sidebar-undo-btn"
              onClick={() => canSurfaceUndo && onSurfaceUndo?.()}
              disabled={!canSurfaceUndo}
              title="Annuler la derniere action (Ctrl+Z)"
              style={styles.undoBtn}
            >
              ↶ Annuler
            </button>
            <button
              type="button"
              className="sidebar-undo-btn"
              onClick={() => canSurfaceRedo && onSurfaceRedo?.()}
              disabled={!canSurfaceRedo}
              title="Refaire la derniere action annulee (Ctrl+Y / Ctrl+Shift+Z)"
              style={styles.undoBtn}
            >
              ↷ Refaire
            </button>
          </div>

          {/* ── Palette voxels — visible uniquement en onglet Voxels ── */}
          {activeEditorTab === 'world' && (
            <>
              <div style={{ ...styles.paletteTitle, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                <span>{t('sidebar.paletteTextures')}</span>
                {activeMaterial?.geo && (
                  <span style={{ color: '#5b8dee', lineHeight: 0 }}>
                    <GeometryIcon geometry={activeMaterial.geo} size={12} />
                  </span>
                )}
              </div>
              <div className="sidebar-glass" style={styles.roomTool}>
                <div style={styles.roomToolModes}>
                  <button
                    type="button"
                    onClick={() => updateSurfaceTool({ mode: 'select' })}
                    className="sidebar-tool-mode-btn"
                    data-active={surfaceToolState.mode === 'select'}
                    style={styles.roomToolModeBtn}
                  >
                    {t('surfaceEditor.select')}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSurfaceTool({
                      mode: 'room',
                      selectedRoomId: null,
                      selectedRoomIds: [],
                      roomWallEdit: false,
                      selectedRoomWallKeys: [],
                      selectedRoomWallCount: 0,
                      roomArcError: null,
                    })}
                    className="sidebar-tool-mode-btn"
                    data-active={surfaceToolState.mode === 'room'}
                    style={styles.roomToolModeBtn}
                  >
                    {t('surfaceEditor.addRoom')}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSurfaceTool({
                      mode: 'wall',
                      wallShape: 'straight',
                      selectedRoomId: null,
                      selectedRoomIds: [],
                      roomWallEdit: false,
                      selectedRoomWallKeys: [],
                      selectedRoomWallCount: 0,
                    })}
                    className="sidebar-tool-mode-btn"
                    data-active={surfaceToolState.mode === 'wall'}
                    style={styles.roomToolModeBtn}
                  >
                    Mur droit
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSurfaceTool({ mode: 'stair' })}
                    className="sidebar-tool-mode-btn"
                    data-active={surfaceToolState.mode === 'stair'}
                    style={styles.roomToolModeBtn}
                  >
                    Escalier
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSurfaceTool({ mode: 'bridge' })}
                    className="sidebar-tool-mode-btn"
                    data-active={surfaceToolState.mode === 'bridge'}
                    style={styles.roomToolModeBtn}
                  >
                    Passerelle
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSurfaceTool({ mode: 'effect' })}
                    className="sidebar-tool-mode-btn"
                    data-active={surfaceToolState.mode === 'effect'}
                    style={styles.roomToolModeBtn}
                  >
                    Zone / effet
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSurfaceTool({
                      mode: 'connector',
                      connectorType: 'ladder',
                      connectorToLevel: Number(surfaceToolState.level || 0) + 1,
                      ...connectorModelPatch(surfaceToolState.connectorType === 'ladder' ? selectedConnectorChoice : (ladderConnectorBlueprints[0] || genericLadderChoice)),
                    })}
                    className="sidebar-tool-mode-btn"
                    data-active={surfaceToolState.mode === 'connector' && surfaceToolState.connectorType === 'ladder'}
                    style={styles.roomToolModeBtn}
                  >
                    Échelle
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSurfaceTool({ mode: 'erase' })}
                    className="sidebar-tool-mode-btn"
                    data-active={surfaceToolState.mode === 'erase'}
                    style={styles.roomToolModeBtn}
                  >
                    {t('surfaceEditor.erase')}
                  </button>
                </div>
                {surfaceToolState.mode === 'connector' && surfaceToolState.connectorType === 'ladder' && (
                  <div style={styles.roomToolGrid}>
                    <label style={styles.roomToolLabel}>
                      <span>Étage d’arrivée</span>
                      <select
                        value={surfaceToolState.connectorToLevel}
                        onChange={e => updateSurfaceTool({ connectorToLevel: Number(e.target.value) })}
                        className="sidebar-tool-field"
                      >
                        {[-2, -1, 0, 1, 2, 3, 4, 5, 6].map(level => (
                          <option key={level} value={level}>{level}</option>
                        ))}
                      </select>
                    </label>
                    <label style={styles.roomToolLabel}>
                      <span>Orientation</span>
                      <select
                        value={surfaceToolState.ladderAxis || 'x'}
                        onChange={e => updateSurfaceTool({ ladderAxis: e.target.value })}
                        className="sidebar-tool-field"
                      >
                        <option value="x">Est / Ouest</option>
                        <option value="z">Nord / Sud</option>
                      </select>
                    </label>
                  </div>
                )}
                {surfaceToolState.mode === 'effect' && (
                  <div className="sidebar-glass" style={styles.connectorPicker}>
                    <div style={styles.connectorPickerTitle}>Région environnementale</div>
                    <div style={styles.roomToolGrid}>
                      <label style={styles.roomToolLabel}>
                        <span>Effet</span>
                        <select
                          value={surfaceToolState.effectDefinitionKey || 'fire'}
                          onChange={e => updateSurfaceTool({ effectDefinitionKey: e.target.value })}
                          className="sidebar-tool-field"
                        >
                          {(worldEffects.definitions || []).map(definition => (
                            <option key={definition.key} value={definition.key}>
                              {definition.label}{definition.builtin ? '' : ' (MJ)'}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label style={styles.roomToolLabel}>
                        <span>Intensité</span>
                        <input
                          type="number"
                          min="0.01"
                          max="100"
                          step="0.25"
                          value={surfaceToolState.effectIntensity}
                          onChange={e => updateSurfaceTool({ effectIntensity: Math.max(0.01, Number(e.target.value) || 1) })}
                          className="sidebar-tool-field"
                        />
                      </label>
                      <label style={styles.roomToolLabel}>
                        <span>Hauteur du volume</span>
                        <input
                          type="number"
                          min="0.1"
                          max="100"
                          step="0.25"
                          value={surfaceToolState.effectHeight}
                          onChange={e => updateSurfaceTool({ effectHeight: Math.max(0.1, Number(e.target.value) || 2.5) })}
                          className="sidebar-tool-field"
                        />
                      </label>
                    </div>
                    <button type="button" onClick={() => setCustomEffectOpen(open => !open)} className="btn btn-ghost" style={styles.roomToolSmallBtn}>
                      {customEffectOpen ? 'Fermer' : 'Nouvel effet MJ'}
                    </button>
                    {customEffectOpen && (
                      <div className="sidebar-glass" style={styles.connectorColorList}>
                        <label style={styles.roomToolLabel}>
                          <span>Clé technique</span>
                          <input
                            value={customEffectDraft.key}
                            onChange={e => setCustomEffectDraft(draft => ({ ...draft, key: e.target.value }))}
                            placeholder="debris-lourds"
                            className="sidebar-tool-field"
                          />
                        </label>
                        <label style={styles.roomToolLabel}>
                          <span>Nom</span>
                          <input
                            value={customEffectDraft.label}
                            onChange={e => setCustomEffectDraft(draft => ({ ...draft, label: e.target.value }))}
                            placeholder="Débris lourds"
                            className="sidebar-tool-field"
                          />
                        </label>
                        <label style={styles.roomToolLabel}>
                          <span>Multiplicateur de déplacement</span>
                          <input
                            type="number"
                            min="0.05"
                            max="100"
                            step="0.25"
                            value={customEffectDraft.movementMultiplier}
                            onChange={e => setCustomEffectDraft(draft => ({ ...draft, movementMultiplier: Number(e.target.value) || 1 }))}
                            className="sidebar-tool-field"
                          />
                        </label>
                        <label style={styles.roomToolLabel}>
                          <span>Note / règle MJ</span>
                          <textarea
                            value={customEffectDraft.note}
                            onChange={e => setCustomEffectDraft(draft => ({ ...draft, note: e.target.value }))}
                            rows={3}
                            className="sidebar-tool-field"
                          />
                        </label>
                        <button type="button" onClick={createCustomEffect} className="btn btn-ghost" style={styles.roomToolSmallBtn}>
                          Créer et sélectionner
                        </button>
                      </div>
                    )}
                    {(worldEffects.instances || []).length > 0 && (
                      <div className="sidebar-glass" style={styles.connectorColorList}>
                        <div style={styles.connectorPickerTitle}>Effets actifs</div>
                        {worldEffects.instances.map(instance => {
                          const definition = worldEffects.definitions.find(item => item.key === instance.definitionKey)
                          return (
                            <div key={instance.id} className="sidebar-tool-selection" style={styles.roomToolSelection}>
                              <span>{definition?.label || instance.definitionKey} ×{instance.intensity}</span>
                              <button type="button" onClick={() => deleteRuntimeEffect(instance.id)} className="btn btn-ghost" style={styles.roomToolSmallBtn}>
                                Supprimer
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
                {['room', 'floor', 'wall', 'stair', 'bridge', 'connector'].includes(surfaceToolState.mode) && (
                  <label style={styles.roomToolLabel}>
                    <span>Coût de déplacement (multiplicateur)</span>
                    <input
                      type="number"
                      min="0.05"
                      max="100"
                      step="0.25"
                      value={surfaceToolState.movementMultiplier}
                      onChange={e => updateSurfaceTool({
                        movementMultiplier: Math.max(0.05, Math.min(100, Number(e.target.value) || 1)),
                      })}
                      className="sidebar-tool-field"
                    />
                  </label>
                )}
                {surfaceToolState.mode === 'connector' && (
                  <>
                    <div className="sidebar-tool-section-title" style={styles.roomToolSectionTitle}>{t('surfaceEditor.connectors')}</div>
                    <div style={styles.roomToolModes}>
                      <button
                        type="button"
                        onClick={() => updateSurfaceTool({
                          mode: 'connector',
                          connectorType: 'elevator',
                          connectorToLevel: Number(surfaceToolState.level || 0) + 1,
                          ...connectorModelPatch(surfaceToolState.connectorType === 'elevator' ? selectedConnectorChoice : (elevatorConnectorBlueprints[0] || genericElevatorChoice)),
                        })}
                        className="sidebar-tool-mode-btn"
                        data-active={surfaceToolState.mode === 'connector' && surfaceToolState.connectorType === 'elevator'}
                        style={styles.roomToolModeBtn}
                      >
                        {t('surfaceEditor.addElevator')}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSurfaceTool({
                          mode: 'connector',
                          connectorType: 'ladder',
                          connectorToLevel: Number(surfaceToolState.level || 0) + 1,
                          ...connectorModelPatch(surfaceToolState.connectorType === 'ladder' ? selectedConnectorChoice : (ladderConnectorBlueprints[0] || genericLadderChoice)),
                        })}
                        className="sidebar-tool-mode-btn"
                        data-active={surfaceToolState.mode === 'connector' && surfaceToolState.connectorType === 'ladder'}
                        style={styles.roomToolModeBtn}
                      >
                        Échelle
                      </button>
                    </div>
                    {surfaceToolState.mode === 'connector' && surfaceToolState.connectorType === 'elevator' && (
                      <div className="sidebar-glass" style={styles.connectorPicker}>
                      <label style={styles.roomToolLabel}>
                        <span>{t('surfaceEditor.elevatorToLevel')}</span>
                        <select
                          value={surfaceToolState.connectorToLevel}
                          onChange={e => updateSurfaceTool({ connectorToLevel: Number(e.target.value) })}
                          className="sidebar-tool-field"
                        >
                          {[-2, -1, 0, 1, 2, 3, 4, 5, 6].map(level => (
                            <option key={level} value={level}>{level}</option>
                          ))}
                        </select>
                      </label>
                      <label style={styles.roomToolLabel}>
                        <span>Axe de la porte</span>
                        <select
                          value={surfaceToolState.elevatorDoorAxis || 'z'}
                          onChange={e => updateSurfaceTool({ elevatorDoorAxis: e.target.value })}
                          className="sidebar-tool-field"
                        >
                          <option value="z">Nord / sud</option>
                          <option value="x">Est / ouest</option>
                        </select>
                      </label>
                      <label style={styles.roomToolLabel}>
                        <span>Côté de la porte</span>
                        <select
                          value={Number(surfaceToolState.elevatorDoorSide) < 0 ? -1 : 1}
                          onChange={e => updateSurfaceTool({ elevatorDoorSide: Number(e.target.value) })}
                          className="sidebar-tool-field"
                        >
                          <option value={1}>Positif</option>
                          <option value={-1}>Négatif</option>
                        </select>
                      </label>
                      <label style={styles.roomToolLabel}>
                        <span>Trajet par étage (s)</span>
                        <input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={surfaceToolState.elevatorTravelSecondsPerLevel || 2}
                          onChange={e => updateSurfaceTool({ elevatorTravelSecondsPerLevel: Math.max(0.1, Number(e.target.value) || 2) })}
                          className="sidebar-tool-field"
                        />
                      </label>
                      </div>
                    )}
                    {surfaceToolState.mode === 'connector' && (
                      <div className="sidebar-glass" style={styles.connectorPicker}>
                        <div style={styles.connectorPickerTitle}>
                          {surfaceToolState.connectorType === 'door'
                            ? t('surfaceEditor.doorModel')
                            : surfaceToolState.connectorType === 'ladder'
                              ? 'Modèle d’échelle'
                              : t('surfaceEditor.elevatorModel')}
                        </div>
                        {connectorChoices.length === 0 ? (
                          <div style={styles.connectorPickerEmpty}>{t('surfaceEditor.noConnectorModels')}</div>
                        ) : (
                          <>
                            {selectedConnectorChoice && (
                              <div className="sidebar-connector-selected" style={styles.connectorSelectedModel}>
                                <span>✓ {t('surfaceEditor.selectedConnectorModel')}</span>
                                <strong>{selectedConnectorChoice.label}</strong>
                              </div>
                            )}
                            {selectedConnectorChoice?.glb_url && (
                              <Object3DPreview
                                blueprint={selectedConnectorChoice}
                                materialOverrides={connectorMaterialOverrides}
                              />
                            )}
                            {connectorMaterialSlots.length > 0 && (
                              <div className="sidebar-glass" style={styles.connectorColorPanel}>
                                <div style={styles.connectorPickerTitle}>Couleurs du modèle</div>
                                {connectorMaterialSlots.map(slot => {
                                  const slotValue = materialSlotDisplayValue(connectorMaterialOverrides, slot)
                                  return (
                                    <label key={slot.code} style={styles.connectorColorRow}>
                                      <span style={styles.connectorColorLabel}>
                                        {MODEL_SLOT_LABELS[slot.code] || slot.label}
                                        <small>{slot.code}</small>
                                      </span>
                                      <input
                                        type="color"
                                        value={slotValue.color}
                                        onChange={e => updateConnectorMaterialSlot(slot, { color: e.target.value })}
                                        className="sidebar-tool-color-input" style={styles.roomToolColorInput}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => clearConnectorMaterialSlot(slot)}
                                        className="btn btn-ghost"
                                        style={styles.connectorColorReset}
                                      >
                                        Reset
                                      </button>
                                    </label>
                                  )
                                })}
                              </div>
                            )}
                            {connectorChoices.map(choice => {
                              const isSelected = String(surfaceToolState.connectorBlueprintId) === String(choice.id)
                                || (!surfaceToolState.connectorBlueprintId && selectedConnectorChoice?.id === choice.id)
                              return (
                                <button
                                  key={choice.id}
                                  type="button"
                                  onClick={() => selectConnectorModel(choice)}
                                  className="sidebar-connector-model-btn"
                                  data-active={isSelected}
                                  style={styles.connectorModelBtn}
                                >
                                  <span>{isSelected ? '✓ ' : ''}{choice.label}</span>
                                  <small>{choice.category || t('surfaceEditor.connectorModel')}</small>
                                </button>
                              )
                            })}
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
                <div style={styles.roomToolGrid}>
                  {surfaceToolState.mode === 'room' && (
                    <label style={styles.roomToolLabel}>
                      <span>{t('surfaceEditor.roomHeight')}</span>
                      <select
                        value={surfaceToolState.roomHeightLevels}
                        onChange={e => updateSurfaceTool({ roomHeightLevels: Number(e.target.value) })}
                        className="sidebar-tool-field"
                      >
                        {[1, 2, 3, 4, 5, 6].map(levels => (
                          <option key={levels} value={levels}>{t('surfaceEditor.levelCount', { count: levels })}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  {surfaceToolState.mode === 'room' && (
                    <label style={styles.roomToolLabel}>
                      <span>{t('surfaceEditor.slabThickness')}</span>
                      <input
                        type="number"
                        min="0.05"
                        max="4"
                        step="0.05"
                        value={surfaceToolState.floorThickness}
                        onChange={e => updateSurfaceTool({ floorThickness: Number(e.target.value) })}
                        className="sidebar-tool-field"
                      />
                    </label>
                  )}
                  {surfaceToolState.mode === 'room' && (
                    <label style={styles.roomToolLabel}>
                      <span>Epaisseur mur</span>
                      <input
                        type="number"
                        min="1"
                        max="8"
                        value={surfaceToolState.wallThickness}
                        onChange={e => updateSurfaceTool({ wallThickness: Number(e.target.value) })}
                        className="sidebar-tool-field"
                      />
                    </label>
                  )}
                </div>
                {surfaceToolState.mode === 'wall' && (
                  <div style={styles.roomToolGrid}>
                    <label style={styles.roomToolLabel}>
                      <span>Epaisseur</span>
                      <input
                        type="number"
                        min="1"
                        max="8"
                        value={surfaceToolState.wallThickness}
                        onChange={e => updateSurfaceTool({ wallThickness: Number(e.target.value) })}
                        className="sidebar-tool-field"
                      />
                    </label>
                    <label style={styles.roomToolLabel}>
                      <span>{t('surfaceEditor.wallHeight')}</span>
                      <select
                        value={surfaceToolState.wallHeightLevels}
                        onChange={e => updateSurfaceTool({ wallHeightLevels: Number(e.target.value) })}
                        className="sidebar-tool-field"
                      >
                        {[1, 2, 3, 4, 5, 6].map(levels => (
                          <option key={levels} value={levels}>{t('surfaceEditor.levelCount', { count: levels })}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
                {surfaceToolState.mode === 'room' && (
                  <>
                    <div className="sidebar-tool-section-title" style={styles.roomToolSectionTitle}>{t('surfaceEditor.appliedMaterial')}</div>
                    <div style={styles.roomToolModes}>
                      {[
                        ['floor', 'Sol'],
                        ['ceiling', 'Plafond'],
                        ['wallInterior', 'Murs côté salle'],
                      ].map(([face, label]) => (
                        <button
                          key={face}
                          type="button"
                          onClick={() => updateSurfaceTool({ materialFace: face })}
                          className="sidebar-tool-mode-btn"
                          data-active={surfaceMaterialFace === face}
                          style={styles.roomToolModeBtn}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div style={styles.roomToolGrid}>
                      <label style={styles.roomToolLabel}>
                        <span>Materiau</span>
                        <select
                          value={surfaceMaterialState.material}
                          onChange={e => updateSurfaceMaterial({ material: e.target.value })}
                          className="sidebar-tool-field"
                        >
                          {PROCEDURAL_MATERIAL_PRESETS.map(preset => (
                            <option key={preset.id} value={preset.id}>{preset.label}</option>
                          ))}
                        </select>
                      </label>
                      <label style={styles.roomToolLabel}>
                        <span>Motif</span>
                        <select
                          value={surfaceMaterialState.pattern}
                          onChange={e => updateSurfaceMaterial({ pattern: e.target.value })}
                          className="sidebar-tool-field"
                        >
                          {PROCEDURAL_PATTERN_PRESETS.map(pattern => (
                            <option key={pattern.id} value={pattern.id}>{pattern.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label style={styles.roomToolLabel}>
                      <span>Peinture</span>
                      <div style={styles.roomToolColorRow}>
                        <input
                          type="color"
                          value={surfacePaintValue}
                          onChange={e => updateSurfaceMaterial({ paint: e.target.value })}
                          className="sidebar-tool-color-input" style={styles.roomToolColorInput}
                        />
                        <input
                          type="text"
                          value={surfaceMaterialState.paint || surfacePaintValue}
                          onChange={e => updateSurfaceMaterial({ paint: e.target.value })}
                          className="sidebar-tool-field"
                        />
                      </div>
                    </label>
                    {[
                      ['wear', 'Usure'],
                      ['dirt', 'Salete'],
                      ['relief', 'Relief'],
                    ].map(([key, label]) => (
                      <label key={key} style={styles.roomToolLabel}>
                        <span>{label}</span>
                        <div style={styles.roomToolRangeRow}>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={Number(surfaceMaterialState[key]) || 0}
                            onChange={e => updateSurfaceMaterial({ [key]: Number(e.target.value) })}
                            style={styles.roomToolRange}
                          />
                          <span style={styles.roomToolRangeValue}>{Number(surfaceMaterialState[key]) || 0}</span>
                        </div>
                      </label>
                    ))}
                    <button
                      type="button"
                      onClick={() => updateSurfaceMaterial({ realRelief: surfaceMaterialState.realRelief === false })}
                      className="sidebar-tool-toggle"
                      data-active={surfaceMaterialState.realRelief !== false}
                      style={styles.roomToolToggle}
                    >
                      <span>Relief reel</span>
                      <span style={styles.roomToolToggleState}>
                        {surfaceMaterialState.realRelief !== false ? 'Actif' : 'Normal map'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSurfaceTool({ autoVariants: !surfaceToolState.autoVariants })}
                      className="sidebar-tool-toggle"
                      data-active={surfaceToolState.autoVariants}
                      style={styles.roomToolToggle}
                    >
                      <span>Variations par surface</span>
                      <span style={styles.roomToolToggleState}>
                        {surfaceToolState.autoVariants ? 'Actif' : 'Fixe'}
                      </span>
                    </button>
                    <div style={styles.roomToolGrid}>
                      <label style={styles.roomToolLabel}>
                        <span>Collision</span>
                        <select
                          value={surfaceToolState.surfaceBlocking || surfaceToolState.wallBlocking || 'solid'}
                          onChange={e => updateSurfaceTool({ surfaceBlocking: e.target.value })}
                          className="sidebar-tool-field"
                        >
                          <option value="solid">Plein</option>
                          <option value="glass">Verre</option>
                          <option value="grate">Grille</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => updateSurfaceMaterial({ seed: `mat-${Date.now().toString(36)}` })}
                        className="btn btn-ghost" style={styles.roomToolSmallBtn}
                      >
                        Nouvelle variation
                      </button>
                    </div>
                  </>
                )}
                <div className="sidebar-tool-hint" style={styles.roomToolHint}>
                  {surfaceToolState.mode === 'connector'
                    ? (surfaceToolState.connectorType === 'door'
                        ? t('surfaceEditor.hintDoorConnector')
                        : surfaceToolState.connectorType === 'ladder'
                          ? 'Cliquez une case pour relier verticalement les deux étages. Le token pourra finir son tour entre les barreaux.'
                          : t('surfaceEditor.hintElevatorConnector'))
                    : surfaceToolState.mode === 'select'
                      ? t('surfaceEditor.hintSelect')
                    : surfaceToolState.mode === 'wall'
                    ? t('surfaceEditor.hintWall')
                    : surfaceToolState.mode === 'room'
                      ? t('surfaceEditor.hintRoom')
                    : surfaceToolState.mode === 'stair'
                      ? t('surfaceEditor.hintStairs')
                    : surfaceToolState.mode === 'bridge'
                      ? 'Tracez une surface praticable suspendue. Elle peut être détruite ou recevoir des états dynamiques.'
                    : surfaceToolState.mode === 'effect'
                      ? 'Tracez le volume touché. L’effet reste un état de partie séparé de la surface éditée.'
                    : surfaceToolState.mode === 'erase'
                      ? t('surfaceEditor.hintErase')
                      : t('surfaceEditor.hintSlab')}
                </div>
              </div>
              {surfaceToolState.mode !== 'connector' && (
                <>
                  {availableBlocks.length === 0 && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '8px' }}>{t('common.loading')}</p>
                  )}
                  {(() => {
                    const groups = {}
                    for (const block of availableBlocks) {
                      if (block.deprecated) continue
                      const key = block.category_id || '__divers__'
                      if (!groups[key]) groups[key] = { label: block.category_label || t('sidebar.categoryFallback'), blocks: [] }
                      groups[key].blocks.push(block)
                    }
                    return Object.entries(groups).map(([catKey, group]) => (
                      <div key={catKey} style={styles.paletteGroup}>
                        <div style={styles.paletteGroupLabel}>{group.label}</div>
                        <div style={styles.paletteGrid}>
                          {group.blocks.map(block => {
                            const texPath = block.faces?.top || block.faces?.all || null
                            const texUrl = texPath
                              ? `${import.meta.env.VITE_API_URL}/api/textures/${block.pack_id}/${texPath}`
                              : null
                            const isActive = activeMaterial?.texId === block.id
                            return (
                              <button
                                key={block.id}
                                onClick={() => {
  onMaterialChange({ texId: block.id, geo: 'cube', r: 0 })
  // Applique la texture à la face active de l'outil surface
  const face = surfaceToolState.materialFace || 'floor'
  onSurfaceToolChange?.({
    ...surfaceToolState,
    surfaceMaterialMode: 'texture',
    [`${face === 'floor' ? 'floorTexId' : face === 'ceiling' ? 'ceilingTexId' : 'wallInteriorTexId'}`]: block.id,
  })
}}
                                style={{
                                  ...styles.matBtn,
                                  backgroundImage: texUrl ? `url(${texUrl})` : 'none',
                                  backgroundColor: texUrl ? 'transparent' : 'var(--wiz-bg-3)',
                                  borderWidth: '2px',
                                  borderStyle: 'solid',
                                  borderColor: isActive ? 'var(--color-primary)' : 'transparent',
                                }}
                              />
                            )
                          })}
                        </div>
                      </div>
                    ))
                  })()}
                </>
              )}
            </>
          )}

          {/* ── Onglet Entités — palette blueprints ── */}
          {activeEditorTab === 'entity' && (() => {
            const query = objectSearch.trim().toLocaleLowerCase()
            const bpList = Object.values(blueprints)
              .filter(bp => !bp.deprecated)
              .filter(bp => blueprintPlacementMode(bp) !== 'connector')
              .filter(bp => !query || bp.label.toLocaleLowerCase().includes(query) || (bp.category || '').toLocaleLowerCase().includes(query))
            const grouped = bpList.reduce((groups, bp) => {
              const category = bp.category || t('sidebar.customObjects')
              if (!groups[category]) groups[category] = []
              groups[category].push(bp)
              return groups
            }, {})
            return (
              <div style={{ marginTop: '6px' }}>
                <div style={{ ...styles.paletteTitle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span>{t('sidebar.paletteEntities')}</span>
                  <button
                    type="button"
                    className="btn"
                    disabled={refreshingObjects}
                    onClick={async () => {
                      setRefreshingObjects(true)
                      try {
                        await refreshBuiltinModels()
                      } catch (err) {
                        console.error('[Bibliothèque 3D] Échec du rafraîchissement :', err)
                      } finally {
                        setRefreshingObjects(false)
                      }
                    }}
                    title={t('sidebar.refreshObjectsHint')}
                    style={{ padding: '3px 7px', fontSize: '10px' }}
                  >
                    {refreshingObjects ? '…' : t('sidebar.refreshObjects')}
                  </button>
                </div>
                <input
                  value={objectSearch}
                  onChange={event => setObjectSearch(event.target.value)}
                  placeholder={t('sidebar.searchObjects')}
                  className="sidebar-tool-field"
                  style={{ margin: '7px 0 9px' }}
                />
                {activeBlueprint?.glb_url && <Object3DPreview blueprint={activeBlueprint} />}
                {bpList.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '8px' }}>
                    {t('sidebar.noBlueprints')}
                  </p>
                )}
                {Object.entries(grouped).map(([category, items]) => (
                  <div key={category} style={{ marginBottom: '10px' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '6px 8px 3px' }}>
                      {category} <span style={{ opacity: 0.55 }}>({items.length})</span>
                    </div>
                    {items.sort((a, b) => a.label.localeCompare(b.label)).map(bp => {
                      const isActive = activeBlueprint?.id === bp.id
                      return (
                        <button
                          key={bp.id}
                          onClick={() => onBlueprintSelect?.(isActive ? null : bp)}
                          title={t('sidebar.clickThenPlace')}
                          style={{ display: 'block', width: '100%', padding: '7px 10px', background: isActive ? 'var(--color-primary-muted)' : 'none', border: 'none', borderBottom: '1px solid var(--wiz-glass-border)', borderLeft: isActive ? '2px solid var(--color-primary)' : '2px solid transparent', color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)', fontSize: '12px', textAlign: 'left', cursor: 'pointer', transition: 'background 0.1s' }}
                        >
                          {blueprintPlacementMode(bp) === 'wall' ? '▥ ' : ''}{bp.label}
                        </button>
                      )
                    })}
                  </div>
                ))}
                <button className="btn" style={{ width: '100%', marginTop: '4px' }} onClick={() => navigate('/workshop')}>
                  {t('sidebar.importCustomObject')}
                </button>
              </div>
            )
          })()}
        </div>
      )}

      <div className="sidebar-separator" />

      {/* ─── ONGLETS — masqués en mode édition ───────────────────────────── */}
      {mode !== 'edit' && (
      <div className="sidebar-tabs">
        <button
          className="sidebar-tab"
          data-active={activeTab === 'chat'}
          onClick={() => setActiveTab('chat')}
        >
          {t('sidebar.chat')}
          {isGm && pendingActionCount > 0 && (
            <span className="sidebar-pending-badge">{pendingActionCount}</span>
          )}
        </button>
        <button
          className="sidebar-tab"
          data-active={activeTab === 'persos'}
          onClick={() => setActiveTab('persos')}
        >
          {t('sidebar.characters')}
        </button>
        <button
          className="sidebar-tab"
          data-active={activeTab === 'biblio'}
          onClick={() => setActiveTab('biblio')}
        >
          {t('sidebar.library')}
        </button>
        <button
          className="sidebar-tab"
          data-active={activeTab === 'profil'}
          onClick={() => setActiveTab('profil')}
        >
          {t('sidebar.profil')}
        </button>
      </div>
      )}

      {/* ─── CONTENU — masqué en mode édition ───────────────────────────── */}
      {mode !== 'edit' && (
      <div style={styles.tabContent}>

        {/* ── Chat ── */}
        {activeTab === 'chat' && (
          <>
            {(phase === 'ANNOUNCEMENT' || phase === 'RESOLUTION') && (
              <CombatDeclareLogChatPanel isOpen={cdlOpen} onToggle={() => setCdlOpen(v => !v)} />
            )}
            <div style={styles.messages}>
              {messages.length === 0 && (
                <p style={styles.emptyMsg}>{t('chat.placeholder')}</p>
              )}
              {messages.map(msg => renderMessage(msg, {
                t, tCombat, isGm,
                animatingDiceId,
                breakdownPopoverMsgId: breakdownPopover?.msgId,
                onOpenBreakdown: handleOpenBreakdown,
                setPendingActionCount,
                onEntityActionResolve,
                onOpenTrade,
                onOpenExchange,
              }))}
              {/* Ancre auto-scroll — div vide en fin de liste */}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} style={styles.chatForm}>
              <input
                className="sidebar-tool-field" style={styles.chatInput}
                placeholder={t('chat.placeholder')}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
              />
              <button className="btn-icon" type="submit" style={{ color: 'var(--color-primary)', fontSize: '14px' }}>➤</button>
            </form>
          </>
        )}

        {/* ── Persos ── */}
        {activeTab === 'persos' && (
          <SidebarCharactersTab campaignId={campaignId} onOpenCharacter={onOpenCharacter} />
        )}

        {/* ── Biblio ── */}
        {activeTab === 'biblio' && (
          <LibraryPanel />
        )}

        {/* ── Profil — réglages compte + séparateur + liste connectés ── */}
        {activeTab === 'profil' && (
          <SidebarProfileTab onReconnectSocket={onReconnectSocket} />
        )}

      </div>
      )}

      {/* ─── Modale aide raccourcis ───────────────────────────────────────── */}
      <SidebarHelpModal mode={mode} open={showHelp} onClose={() => setShowHelp(false)} />
      <DiceBreakdownPopover popover={breakdownPopover} popoverRef={popoverRef} />
    </div>
  )
}
