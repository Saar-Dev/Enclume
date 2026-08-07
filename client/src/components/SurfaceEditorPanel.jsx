import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useEntityStore } from '../stores/entityStore'
import { useWorldRuntimeStore } from '../stores/worldRuntimeStore.js'
import api from '../lib/api.js'
import GeometryIcon from './GeometryIcon.jsx'
import Object3DPreview from './Object3DPreview.jsx'
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
import { styles } from './Sidebar.styles.js'

const MODEL_SLOT_LABELS = {
  SLOT_01: 'Métal principal',
  SLOT_02: 'Panneaux secondaires',
  SLOT_03: 'Cadre / hardware',
  SLOT_04: 'Accent',
  SLOT_05: 'Verre',
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
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { blueprints, refreshBuiltinModels } = useEntityStore()
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

  // worldEffects vient du store partagé (PLAN_WORLD_RUNTIME_EFFECTS_STORE.md) — pas de fetch ni de
  // listener ici, ce panneau n'est visible que pendant que Editor3D.jsx est monté (mode === 'edit'),
  // qui synchronise déjà le store en continu.
  const worldEffects = useWorldRuntimeStore(s => s.worldEffects)
  const fetchWorldEffects = useWorldRuntimeStore(s => s.fetchWorldEffects)

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
    } catch (error) {
      console.error('[Sidebar] Suppression effet refusée :', error)
    }
  }

  return (
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
  )
}
