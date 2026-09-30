import { useEffect, useState } from 'react'
import { foldAccents } from '../../../shared/textSearch.js'
import { useTranslation } from 'react-i18next'
import { useEntityStore } from '../stores/entityStore'
import { useWorldRuntimeStore } from '../stores/worldRuntimeStore.js'
import api from '../lib/api.js'
import GeometryIcon from './GeometryIcon.jsx'
import SurfaceEffectPanel from './SurfaceEffectPanel.jsx'
import EntityPalettePanelSection from './surfaceTools/EntityPalettePanelSection.jsx'
import PaintWallPanelSection from './surfaceTools/PaintWallPanelSection.jsx'
import ConnectorPanelSection from './surfaceTools/ConnectorPanelSection.jsx'
import EffectZonePanelSection from './surfaceTools/EffectZonePanelSection.jsx'
import RoomPanelSection from './surfaceTools/RoomPanelSection.jsx'
import WallPanelSection from './surfaceTools/WallPanelSection.jsx'
import { CHIP_BTN_STYLE, PAINT_WALL_SCOPE_LABEL_KEYS } from './surfaceTools/panelSharedConstants.js'
import {
  clearMaterialSlotOverride,
  normalizeModelMaterialSlots,
  setMaterialSlotOverride,
} from '../lib/modelMaterialSlots.js'
import { DEFAULT_SURFACE_MATERIAL_PRESET } from '../lib/proceduralMaterials.js'
import { styles } from './Sidebar.styles.js'

// ─── Icônes placeholder (SVG simples, à remplacer — Saar fournit les icônes définitives) ───
const ICON_PROPS = { width: 16, height: 16, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6 }
const ICON_STRUCTURE = (
  <svg {...ICON_PROPS}><rect x="3" y="8" width="14" height="9" rx="1" /><path d="M5 8V5l5-3 5 3v3" strokeLinejoin="round" /></svg>
)
const ICON_OBJECTS3D = (
  <svg {...ICON_PROPS}><path d="M10 2l7 4v8l-7 4-7-4V6l7-4z" strokeLinejoin="round" /><path d="M3 6l7 4 7-4M10 10v8" /></svg>
)
const ICON_HAZARD = (
  <svg {...ICON_PROPS}><path d="M10 3l8 14H2L10 3z" strokeLinejoin="round" /><line x1="10" y1="8.5" x2="10" y2="12" /><circle cx="10" cy="14.5" r="0.9" fill="currentColor" stroke="none" /></svg>
)
const ICON_SELECT = (
  <svg {...ICON_PROPS}><path d="M4 3l4.5 13 2-5.5L16 8.5 4 3z" strokeLinejoin="round" strokeLinecap="round" /></svg>
)
const ICON_ROOM = <svg {...ICON_PROPS}><rect x="3" y="3" width="14" height="14" rx="1.5" /></svg>
const ICON_WALL = <svg {...ICON_PROPS}><rect x="2" y="8.5" width="16" height="3" rx="1" /></svg>
const ICON_STAIRS = (
  <svg {...ICON_PROPS}><polyline points="3,17 3,13 8,13 8,9 13,9 13,5 17,5" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const ICON_BRIDGE = (
  <svg {...ICON_PROPS}><path d="M2 13c3-3 13-3 16 0" strokeLinecap="round" /><line x1="3" y1="15" x2="3" y2="10" /><line x1="17" y1="15" x2="17" y2="10" /></svg>
)
const ICON_DOOR = (
  <svg {...ICON_PROPS}><rect x="5" y="2" width="9" height="16" rx="0.8" /><path d="M14 3.5A9 9 0 0117 10" strokeLinecap="round" /></svg>
)
const ICON_ELEVATOR = (
  <svg {...ICON_PROPS}><rect x="4" y="2" width="12" height="16" rx="1.2" /><polyline points="8,8 10,5.5 12,8" strokeLinecap="round" strokeLinejoin="round" /><polyline points="8,12 10,14.5 12,12" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const ICON_LADDER = (
  <svg {...ICON_PROPS}><line x1="6" y1="2" x2="6" y2="18" /><line x1="14" y1="2" x2="14" y2="18" /><line x1="6" y1="5" x2="14" y2="5" /><line x1="6" y1="10" x2="14" y2="10" /><line x1="6" y1="15" x2="14" y2="15" /></svg>
)
const ICON_ERASE = (
  <svg {...ICON_PROPS}><path d="M4 5.5h12M7.5 5.5V4a1 1 0 011-1h3a1 1 0 011 1v1.5M6 5.5l.6 10.2a1 1 0 001 .8h4.8a1 1 0 001-.8L14 5.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const ICON_PAINT_WALL = (
  <svg {...ICON_PROPS}>
    <path d="M13 3l4 4-7.5 7.5c-.6.6-1.6.9-2.5.7l-2.3-.5.6-2.4c.2-.8.6-1.6 1.2-2.2L13 3z" strokeLinejoin="round" />
    <path d="M4 17c1.2 0 1.8-1 1.2-2-.4-.7 0-1.6.9-1.8" strokeLinecap="round" />
  </svg>
)
const TAB_ICON_BTN_STYLE = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '7px 0',
}

// ─── Palette surface/entités (mode édition) ───────────────────────────────────
// Extrait de Sidebar.jsx (PLAN_REFACTOR_SIDEBAR.md Lot 5) — comportement inchangé.
// objectSearch/refreshingObjects/customEffectOpen/customEffectDraft restent des états contrôlés
// depuis Sidebar.jsx (pas des useState locaux) : ce panneau se démonte/remonte à chaque bascule
// Édition ↔ Jeu (contrairement à Sidebar.jsx, toujours monté tant que la sidebar est visible) — un
// useState local perdrait la recherche en cours ou le brouillon d'effet MJ à chaque aller-retour.
export default function SurfaceEditorPanel({
  activeEditorTab, onEditorTabChange,
  activeMaterial, onMaterialChange, availableBlocks = [],
  activeBlueprint, onBlueprintSelect,
  surfaceTool, onSurfaceToolChange,
  canSurfaceUndo,
  canSurfaceRedo,
  onSurfaceUndo,
  onSurfaceRedo,
  battlemapId,
  objectSearch, setObjectSearch,
  refreshingObjects, setRefreshingObjects,
  customEffectOpen, setCustomEffectOpen,
  customEffectDraft, setCustomEffectDraft,
  sidebarWidth = 0,
}) {
  const { t } = useTranslation()
  const { blueprints } = useEntityStore()
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
  // Structure et Connecteurs forment un seul écran (la catégorie "Structure" du haut) ; Zones
  // dangereuses est un écran à part (sa propre icône de haut niveau) — jamais les deux ensemble.
  const isZonesToolMode = surfaceToolState.mode === 'effect'
  const showStructureScreen = !isZonesToolMode
  // Grille de textures pré-faites : seules Salle et Mur portent une texture de surface — inutile en
  // Escalier/Passerelle/Zones dangereuses/Sélection/Effacer, où elle ne s'appliquait jamais à rien.
  const showTexturePalette = ['room', 'wall'].includes(surfaceToolState.mode)
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
  const normalizedBlueprintText = (blueprint) => foldAccents([
    blueprint?.label,
    blueprint?.name,
    blueprint?.category,
    blueprint?.builtin_key,
    blueprint?.glb_url,
  ].filter(Boolean).join(' '))
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

  // worldEffects vient du store partagé (PLAN_WORLD_RUNTIME_EFFECTS_STORE.md) — pas de fetch ni de
  // listener ici, ce panneau n'est visible que pendant que Editor3D.jsx est monté (mode === 'edit'),
  // qui synchronise déjà le store en continu.
  const worldEffects = useWorldRuntimeStore(s => s.worldEffects)
  const fetchWorldEffects = useWorldRuntimeStore(s => s.fetchWorldEffects)
  // Inspecteur flottant d'une zone existante (§6.2 points 4/5) — { instanceId, x, y }, x/y = position
  // du clic qui l'a ouvert (même patron que surfaceRoomPanel/surfaceWallPanel dans Editor3D.jsx, ici
  // géré localement puisque worldEffects n'est pas routé via ses callbacks).
  const [effectInspector, setEffectInspector] = useState(null)

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
      await fetchWorldEffects(battlemapId)
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
      await fetchWorldEffects(battlemapId)
      if (effectInspector?.instanceId === instanceId) setEffectInspector(null)
    } catch (error) {
      console.error('[Sidebar] Suppression effet refusée :', error)
    }
  }

  // updateRuntimeEffect — PLAN_ZONES_DANGER.md §6.2 point 5 : corrige intensité/puissance d'une zone
  // déjà posée sans la supprimer/redessiner. La route PATCH (updateWorldEffectInstance) existe côté
  // serveur depuis Z2, jamais appelée côté client jusqu'ici.
  const updateRuntimeEffect = async (instanceId, patch) => {
    if (!battlemapId) return
    try {
      await api.patch(`/battlemaps/${battlemapId}/world-effects/instances/${instanceId}`, patch)
      await fetchWorldEffects(battlemapId)
    } catch (error) {
      console.error('[Sidebar] Mise à jour effet refusée :', error)
    }
  }

  return (
    <div style={styles.palette}>
      {/* ── Trois catégories de haut niveau : Structure / Objets 3D / Zones dangereuses ──
          Toujours 2 onglets sous le capot (activeEditorTab: 'world'|'entity', lu par Editor3D.jsx) —
          Structure et Zones dangereuses partagent l'onglet 'world', distingués par surfaceToolState.mode
          (mode === 'effect' -> Zones dangereuses). Aucun nouvel état, zéro risque pour le parent. */}
      <div className="sidebar-editor-tabs">
        <button
          className="sidebar-editor-tab"
          data-active={activeEditorTab === 'world' && surfaceToolState.mode !== 'effect'}
          onClick={() => {
            onEditorTabChange?.('world')
            if (surfaceToolState.mode === 'effect') updateSurfaceTool({ mode: 'select' })
          }}
          style={TAB_ICON_BTN_STYLE}
        >
          {ICON_STRUCTURE}
          <span>{t('surfaceEditor.structureSection')}</span>
        </button>
        <button
          className="sidebar-editor-tab"
          data-active={activeEditorTab === 'entity'}
          onClick={() => onEditorTabChange?.('entity')}
          style={TAB_ICON_BTN_STYLE}
        >
          {ICON_OBJECTS3D}
          <span>{t('sidebar.editorTabEntities')}</span>
        </button>
        <button
          className="sidebar-editor-tab"
          data-active={activeEditorTab === 'world' && surfaceToolState.mode === 'effect'}
          onClick={() => {
            onEditorTabChange?.('world')
            updateSurfaceTool({ mode: 'effect' })
          }}
          style={TAB_ICON_BTN_STYLE}
        >
          {ICON_HAZARD}
          <span>{t('surfaceEditor.effectsSection')}</span>
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

      {/* ── Palette monde (salles, murs, connecteurs, zones) — visible en onglet Monde ── */}
      {activeEditorTab === 'world' && (
        <>
          {showTexturePalette && (
            <div style={{ ...styles.paletteTitle, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
              <span>{t('sidebar.paletteTextures')}</span>
              {activeMaterial?.geo && (
                <span style={{ color: '#5b8dee', lineHeight: 0 }}>
                  <GeometryIcon geometry={activeMaterial.geo} size={12} />
                </span>
              )}
            </div>
          )}
          <div className="sidebar-glass" style={styles.roomTool}>
            {showStructureScreen && (
            <>
            <div style={styles.roomToolModes}>
              <button
                type="button"
                onClick={() => updateSurfaceTool({ mode: 'select' })}
                className="sidebar-tool-mode-btn"
                data-active={surfaceToolState.mode === 'select'}
                style={{ ...styles.roomToolModeBtn, ...CHIP_BTN_STYLE }}
              >
                {ICON_SELECT}
                <span>{t('surfaceEditor.select')}</span>
              </button>
            </div>

            <div className="sidebar-tool-section-title" style={styles.roomToolSectionTitle}>{t('surfaceEditor.buildSection')}</div>
            <div style={styles.roomToolModes}>
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
                style={{ ...styles.roomToolModeBtn, ...CHIP_BTN_STYLE }}
              >
                {ICON_ROOM}
                <span>{t('surfaceEditor.addRoom')}</span>
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
                style={{ ...styles.roomToolModeBtn, ...CHIP_BTN_STYLE }}
              >
                {ICON_WALL}
                <span>{t('surfaceEditor.straightWall')}</span>
              </button>
              <button
                type="button"
                onClick={() => updateSurfaceTool({ mode: 'stair' })}
                className="sidebar-tool-mode-btn"
                data-active={surfaceToolState.mode === 'stair'}
                style={{ ...styles.roomToolModeBtn, ...CHIP_BTN_STYLE }}
              >
                {ICON_STAIRS}
                <span>{t('surfaceEditor.stairs')}</span>
              </button>
              <button
                type="button"
                onClick={() => updateSurfaceTool({ mode: 'bridge' })}
                className="sidebar-tool-mode-btn"
                data-active={surfaceToolState.mode === 'bridge'}
                style={{ ...styles.roomToolModeBtn, ...CHIP_BTN_STYLE }}
              >
                {ICON_BRIDGE}
                <span>{t('surfaceEditor.bridge')}</span>
              </button>
            </div>

            <div className="sidebar-tool-section-title" style={styles.roomToolSectionTitle}>{t('surfaceEditor.connectors')}</div>
            <div style={styles.roomToolModes}>
              <button
                type="button"
                onClick={() => updateSurfaceTool({
                  mode: 'connector',
                  connectorType: 'door',
                  ...connectorModelPatch(surfaceToolState.connectorType === 'door' ? selectedConnectorChoice : (doorConnectorBlueprints[0] || null)),
                })}
                className="sidebar-tool-mode-btn"
                data-active={surfaceToolState.mode === 'connector' && surfaceToolState.connectorType === 'door'}
                style={{ ...styles.roomToolModeBtn, ...CHIP_BTN_STYLE }}
              >
                {ICON_DOOR}
                <span>{t('surfaceEditor.addDoor')}</span>
              </button>
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
                style={{ ...styles.roomToolModeBtn, ...CHIP_BTN_STYLE }}
              >
                {ICON_ELEVATOR}
                <span>{t('surfaceEditor.addElevator')}</span>
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
                style={{ ...styles.roomToolModeBtn, ...CHIP_BTN_STYLE }}
              >
                {ICON_LADDER}
                <span>{t('surfaceEditor.addLadder')}</span>
              </button>
            </div>

            <div className="sidebar-tool-section-title" style={styles.roomToolSectionTitle}>{t('surfaceEditor.finishSection')}</div>
            <div style={styles.roomToolModes}>
              <button
                type="button"
                disabled={!surfaceToolState.selectedRoomId}
                onClick={() => updateSurfaceTool({
                  mode: 'paint-wall',
                  materialFace: 'wallInterior',
                  wallPaintScope: surfaceToolState.wallPaintScope || 'case',
                  wallPaintClearOverrides: false,
                })}
                className="sidebar-tool-mode-btn"
                data-active={surfaceToolState.mode === 'paint-wall'}
                style={{ ...styles.roomToolModeBtn, ...CHIP_BTN_STYLE }}
              >
                {ICON_PAINT_WALL}
                <span>{t('surfaceEditor.paintWall')}</span>
              </button>
              <button
                type="button"
                onClick={() => updateSurfaceTool({ mode: 'erase' })}
                className="sidebar-tool-mode-btn"
                data-active={surfaceToolState.mode === 'erase'}
                style={{ ...styles.roomToolModeBtn, ...CHIP_BTN_STYLE }}
              >
                {ICON_ERASE}
                <span>{t('surfaceEditor.erase')}</span>
              </button>
            </div>
            {surfaceToolState.mode === 'paint-wall' && (
              <PaintWallPanelSection
                surfaceToolState={surfaceToolState}
                updateSurfaceTool={updateSurfaceTool}
                surfaceMaterialState={surfaceMaterialState}
                updateSurfaceMaterial={updateSurfaceMaterial}
              />
            )}
            </>
            )}
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
              <EffectZonePanelSection
                surfaceToolState={surfaceToolState}
                updateSurfaceTool={updateSurfaceTool}
                worldEffects={worldEffects}
                customEffectOpen={customEffectOpen}
                setCustomEffectOpen={setCustomEffectOpen}
                customEffectDraft={customEffectDraft}
                setCustomEffectDraft={setCustomEffectDraft}
                createCustomEffect={createCustomEffect}
                deleteRuntimeEffect={deleteRuntimeEffect}
                setEffectInspector={setEffectInspector}
              />
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
              <ConnectorPanelSection
                surfaceToolState={surfaceToolState}
                updateSurfaceTool={updateSurfaceTool}
                connectorChoices={connectorChoices}
                selectedConnectorChoice={selectedConnectorChoice}
                connectorMaterialSlots={connectorMaterialSlots}
                connectorMaterialOverrides={connectorMaterialOverrides}
                updateConnectorMaterialSlot={updateConnectorMaterialSlot}
                clearConnectorMaterialSlot={clearConnectorMaterialSlot}
                selectConnectorModel={selectConnectorModel}
              />
            )}
            {surfaceToolState.mode === 'room' && (
              <RoomPanelSection
                surfaceToolState={surfaceToolState}
                updateSurfaceTool={updateSurfaceTool}
                surfaceMaterialFace={surfaceMaterialFace}
                surfaceMaterialState={surfaceMaterialState}
                surfacePaintValue={surfacePaintValue}
                updateSurfaceMaterial={updateSurfaceMaterial}
              />
            )}
            {surfaceToolState.mode === 'wall' && (
              <WallPanelSection surfaceToolState={surfaceToolState} updateSurfaceTool={updateSurfaceTool} />
            )}
            <div className="sidebar-tool-hint" style={styles.roomToolHint}>
              {(() => {
                const mode = surfaceToolState.mode
                // Tous les outils de pose/dessin restent actifs après un geste réussi (§12.9,
                // PLAN_WORLD_BUILDER_REWORK.md) — seul « Sélection » n'a pas besoin d'Échap pour en sortir.
                const escapeSuffix = mode === 'select' ? '' : ` ${t('surfaceEditor.hintEscapeSuffix')}`
                if (mode === 'connector') {
                  const base = surfaceToolState.connectorType === 'door'
                    ? t('surfaceEditor.hintDoorConnector')
                    : surfaceToolState.connectorType === 'ladder'
                      ? t('surfaceEditor.hintLadder')
                      : t('surfaceEditor.hintElevatorConnector')
                  return base + escapeSuffix
                }
                if (mode === 'select') return t('surfaceEditor.hintSelect')
                if (mode === 'wall') return t('surfaceEditor.hintWall') + escapeSuffix
                if (mode === 'room') return t('surfaceEditor.hintRoom') + escapeSuffix
                if (mode === 'stair') return t('surfaceEditor.hintStairs') + escapeSuffix
                if (mode === 'bridge') return t('surfaceEditor.hintBridge') + escapeSuffix
                if (mode === 'effect') return t('surfaceEditor.hintEffect') + escapeSuffix
                if (mode === 'erase') return t('surfaceEditor.hintErase') + escapeSuffix
                if (mode === 'paint-wall') {
                  return t('surfaceEditor.paintWallRoomHint', {
                    name: surfaceToolState.roomName || '',
                    scope: t(PAINT_WALL_SCOPE_LABEL_KEYS[surfaceToolState.wallPaintScope || 'case']),
                  }) + escapeSuffix
                }
                if (mode === 'reshape-room') return t('surfaceEditor.reshapeRoomHint') + escapeSuffix
                return t('surfaceEditor.hintSlab') + escapeSuffix
              })()}
            </div>
          </div>
          {showTexturePalette && (
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
      {activeEditorTab === 'entity' && (
        <EntityPalettePanelSection
          activeBlueprint={activeBlueprint}
          onBlueprintSelect={onBlueprintSelect}
          objectSearch={objectSearch}
          setObjectSearch={setObjectSearch}
          refreshingObjects={refreshingObjects}
          setRefreshingObjects={setRefreshingObjects}
        />
      )}
      {effectInspector && (() => {
        const instance = (worldEffects.instances || []).find(item => item.id === effectInspector.instanceId)
        if (!instance) return null
        const definition = (worldEffects.definitions || []).find(item => item.key === instance.definitionKey)
        return (
          <SurfaceEffectPanel
            instance={instance}
            definition={definition}
            x={effectInspector.x}
            y={effectInspector.y}
            onPatch={patch => updateRuntimeEffect(instance.id, patch)}
            onDelete={() => deleteRuntimeEffect(instance.id)}
            onClose={() => setEffectInspector(null)}
            dockRight={sidebarWidth + 16}
          />
        )
      })()}
    </div>
  )
}
