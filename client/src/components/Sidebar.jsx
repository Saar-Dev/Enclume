import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../stores/authStore'
import { useCharacterStore } from '../stores/characterStore'
import { useSessionStore } from '../stores/sessionStore'
import { useEntityStore } from '../stores/entityStore'
import { useCombatStore } from '../stores/combatStore'
import api from '../lib/api.js'
import { isDoorConnectorBlueprint, isElevatorConnectorBlueprint, normalizedBlueprintText } from '../lib/connectorBlueprintCatalog.js'
import { WS } from '../../../shared/events.js'
import GeometryIcon from './GeometryIcon.jsx'
import LibraryPanel from './LibraryPanel.jsx'
import { DeclareLogContent } from './CombatDeclareLog.jsx'
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

const PARAMETRIC_STRUCTURAL_OBJECTS = Object.freeze([
  {
    id: '__parametric_stair_straight__',
    label: 'Escalier droit paramétrique',
    category: 'Escaliers',
    builtin_key: 'surface_stair_straight',
    geometry: { placementMode: 'connector', connectorType: 'stairs', stairKind: 'straight' },
  },
  {
    id: '__parametric_stair_spiral__',
    label: 'Escalier en colimaçon paramétrique',
    category: 'Escaliers',
    builtin_key: 'surface_stair_spiral',
    geometry: { placementMode: 'connector', connectorType: 'stairs', stairKind: 'spiral' },
  },
  {
    id: '__generic_ladder__',
    labelKey: 'surfaceEditor.verticalAccess',
    categoryKey: 'surfaceEditor.verticalAccesses',
    builtin_key: 'surface_ladder_straight',
    geometry: { placementMode: 'connector', connectorType: 'ladder' },
  },
])

// ─── Icônes ───────────────────────────────────────────────────────────────────
const IconEdit = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)
const IconPlay = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
)
const IconEye = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)
const IconEyeOff = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)
const IconRuler = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21.3 8.7L8.7 21.3a2.121 2.121 0 0 1-3 0L2.7 18.3a2.121 2.121 0 0 1 0-3L15.3 2.7a2.121 2.121 0 0 1 3 0l3 3a2.121 2.121 0 0 1 0 3z"/>
    <line x1="7.5" y1="10.5" x2="10" y2="13"/>
    <line x1="10.5" y1="7.5" x2="13" y2="10"/>
    <line x1="13.5" y1="4.5" x2="16" y2="7"/>
  </svg>
)
const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const IconDice = () => {
  const s = 14, cx = 7, cy = 7, r = s * 0.46
  const r85 = r * 0.85
  const pts = `${cx},${(cy - r).toFixed(2)} ${(cx + r85).toFixed(2)},${(cy - r * 0.5).toFixed(2)} ${(cx + r85).toFixed(2)},${(cy + r * 0.5).toFixed(2)} ${cx},${(cy + r).toFixed(2)} ${(cx - r85).toFixed(2)},${(cy + r * 0.5).toFixed(2)} ${(cx - r85).toFixed(2)},${(cy - r * 0.5).toFixed(2)}`
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ display: 'block' }}>
      <polygon points={pts} fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <line x1={(cx - r85).toFixed(2)} y1={(cy - r * 0.5).toFixed(2)} x2={cx} y2={(cy + r * 0.34).toFixed(2)} stroke="currentColor" strokeWidth="1" opacity="0.5"/>
      <line x1={(cx + r85).toFixed(2)} y1={(cy - r * 0.5).toFixed(2)} x2={cx} y2={(cy + r * 0.34).toFixed(2)} stroke="currentColor" strokeWidth="1" opacity="0.5"/>
      <line x1={cx} y1={(cy - r).toFixed(2)} x2={cx} y2={(cy + r * 0.34).toFixed(2)} stroke="currentColor" strokeWidth="1" opacity="0.5"/>
      <text x={cx} y={(cy + s * 0.07).toFixed(2)} textAnchor="middle" fontFamily="'Share Tech Mono', monospace" fontSize={(s * 0.26).toFixed(2)} fill="currentColor">20</text>
    </svg>
  )
}
const IconPen = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 20h9"/>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
  </svg>
)

// ─── Modale fiche personnage ──────────────────────────────────────────────────
// Accessible à tous les membres. visible=false → le joueur ne voit pas le character
// dans la liste → ne peut pas ouvrir la modale. Le filtrage est fait côté liste.
// gm_notes : reçu uniquement si isGm (filtré côté serveur).
// Lit useCharacterStore directement — pas de onCharactersChange en prop.
function CharacterModal({ character, isGm, isOwner, onClose, onCharacterUpdate }) {
  const { t } = useTranslation()
  const { members, updateCharacter, removeCharacter } = useCharacterStore()
  const [activeTab, setActiveTab] = useState('sheet')
  const [description, setDescription] = useState(character.description || '')
  const [gmNotes, setGmNotes] = useState(character.gm_notes || '')
  const [saving, setSaving] = useState(false)

  const canEditDescription = isGm || isOwner
  const canUploadPortrait = isGm || isOwner
  const canEditName = isGm || isOwner

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(character.name)

  const handleNameSave = useCallback(async () => {
    const trimmed = nameInput.trim()
    setEditingName(false)
    if (!trimmed || trimmed === character.name) {
      setNameInput(character.name)
      return
    }
    setSaving(true)
    try {
      const res = await api.put(`/characters/${character.id}`, { name: trimmed })
      const updated = res.data.character
      updateCharacter(updated)
      onCharacterUpdate(updated)
    } catch (err) {
      console.error('Erreur renommage character :', err)
      setNameInput(character.name)
    } finally {
      setSaving(false)
    }
  }, [nameInput, character.id, character.name, updateCharacter, onCharacterUpdate])

  const handleNameKeyDown = useCallback((e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleNameSave() }
    if (e.key === 'Escape') { setEditingName(false); setNameInput(character.name) }
  }, [handleNameSave, character.name])
  const [portraitUploading, setPortraitUploading] = useState(false)
  const [glbUploading, setGlbUploading] = useState(false)

  const handlePortraitUpload = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPortraitUploading(true)
    try {
      const formData = new FormData()
      formData.append('portrait', file)
      const res = await api.post(`/characters/${character.id}/portrait`, formData)
      const updated = res.data.character
      updateCharacter(updated)
      onCharacterUpdate(updated)
    } catch (err) {
      console.error('Erreur upload portrait :', err)
    } finally {
      setPortraitUploading(false)
      // Réinitialiser l'input pour permettre de re-sélectionner le même fichier
      e.target.value = ''
    }
  }, [character.id, updateCharacter, onCharacterUpdate])

  const handleGlbUpload = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setGlbUploading(true)
    try {
      const formData = new FormData()
      formData.append('glb', file)
      const res = await api.post(`/characters/${character.id}/glb`, formData)
      const updated = res.data.character
      updateCharacter(updated)
      onCharacterUpdate(updated)
    } catch (err) {
      console.error('Erreur upload GLB :', err)
    } finally {
      setGlbUploading(false)
      e.target.value = ''
    }
  }, [character.id, updateCharacter, onCharacterUpdate])

  // Sauvegarde au blur — évite une sauvegarde à chaque frappe
  const handleDescriptionBlur = useCallback(async () => {
    if (description === (character.description || '')) return
    setSaving(true)
    try {
      const res = await api.put(`/characters/${character.id}`, { description })
      updateCharacter({ id: character.id, description: res.data.character.description })
    } catch (err) {
      console.error('Erreur sauvegarde description :', err)
    } finally {
      setSaving(false)
    }
  }, [description, character.id, character.description, updateCharacter])

  const handleGmNotesBlur = useCallback(async () => {
    if (gmNotes === (character.gm_notes || '')) return
    setSaving(true)
    try {
      const res = await api.put(`/characters/${character.id}`, { gm_notes: gmNotes })
      updateCharacter({ id: character.id, gm_notes: res.data.character.gm_notes })
    } catch (err) {
      console.error('Erreur sauvegarde notes MJ :', err)
    } finally {
      setSaving(false)
    }
  }, [gmNotes, character.id, character.gm_notes, updateCharacter])

  // Toggle visibilité — GM uniquement
  // onCharacterUpdate met à jour selectedCharacter dans Sidebar (état UI local).
  // Le serveur broadcastera CHARACTER_UPDATED à toute la room — pas d'emit client.
  const handleToggleVisible = useCallback(async () => {
    try {
      const res = await api.put(`/characters/${character.id}`, { visible: !character.visible })
      const updated = res.data.character
      updateCharacter({ id: updated.id, visible: updated.visible })
      onCharacterUpdate(updated)
    } catch (err) {
      console.error('Erreur toggle visible :', err)
    }
  }, [character.id, character.visible, updateCharacter, onCharacterUpdate])

  // Suppression — GM uniquement
  const handleDelete = useCallback(async () => {
    if (!window.confirm(t('character.deleteConfirm'))) return
    try {
      await api.delete(`/characters/${character.id}`)
      removeCharacter(character.id)
      onClose()
    } catch (err) {
      console.error('Erreur suppression character :', err)
    }
  }, [character.id, removeCharacter, onClose, t])

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalPanel} onClick={e => e.stopPropagation()}>

        {/* ── Header modale ── */}
        <div style={styles.modalHeader}>
          <div style={styles.modalTitleRow}>
            <div style={{ ...styles.charColor, background: character.color, width: '14px', height: '14px' }} />
            {editingName ? (
              <input
                style={styles.nameInput}
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={handleNameKeyDown}
                autoFocus
                maxLength={64}
              />
            ) : (
              <>
                <span style={styles.modalTitle}>{character.name}</span>
                {canEditName && (
                  <button
                    style={styles.namePenBtn}
                    onClick={() => { setNameInput(character.name); setEditingName(true) }}
                    title={t('character.rename')}
                  >
                    <IconPen />
                  </button>
                )}
              </>
            )}
            {saving && <span style={styles.savingIndicator}>…</span>}
          </div>
          <div style={styles.modalHeaderActions}>
            {/* Toggle visible — GM uniquement, tous onglets */}
            {isGm && (
              <button
                style={{ ...styles.modalActionBtn, color: character.visible ? '#4caf77' : '#4a4a60' }}
                onClick={handleToggleVisible}
                title={character.visible ? t('character.toggleHidden') : t('character.toggleVisible')}
              >
                {character.visible ? <IconEye /> : <IconEyeOff />}
              </button>
            )}
            <button style={styles.modalCloseBtn} onClick={onClose} title={t('common.close')}>
              <IconX />
            </button>
          </div>
        </div>

        {/* ── Illustration ── */}
        <div style={styles.illustrationPlaceholder}>
          {character.portrait_url ? (
            <img
              src={`${import.meta.env.VITE_API_URL}/api/assets/${character.portrait_url}`}
              alt={t('character.portraitAlt')}
              style={styles.portraitImg}
            />
          ) : (
            <span style={styles.illustrationText}>{t('character.illustrationPlaceholder')}</span>
          )}
          {canUploadPortrait && (
            <label style={{
              ...styles.uploadBtn,
              opacity: portraitUploading ? 0.5 : 1,
              pointerEvents: portraitUploading ? 'none' : 'auto',
            }}>
              {portraitUploading ? t('character.portraitUploading') : t('character.portraitUpload')}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={handlePortraitUpload}
              />
            </label>
          )}
        </div>

        {/* ── Onglets ── */}
        <div style={styles.modalTabs}>
          {['sheet', 'notes', 'settings'].map(tab => (
            <button
              key={tab}
              style={{ ...styles.modalTab, ...(activeTab === tab ? styles.modalTabActive : {}) }}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'sheet' && t('character.tabSheet')}
              {tab === 'notes' && t('character.tabNotes')}
              {tab === 'settings' && t('character.tabSettings')}
            </button>
          ))}
        </div>

        {/* ── Contenu onglets ── */}
        <div style={styles.modalContent}>

          {/* Onglet Fiche */}
          {activeTab === 'sheet' && (
            <p style={styles.modalPlaceholder}>{t('character.sheetPlaceholder')}</p>
          )}

          {/* Onglet Notes */}
          {activeTab === 'notes' && (
            <div style={styles.notesContent}>
              <label style={styles.fieldLabel}>{t('character.descriptionLabel')}</label>
              <textarea
                style={styles.textarea}
                value={description}
                onChange={e => setDescription(e.target.value)}
                onBlur={handleDescriptionBlur}
                placeholder={t('character.descriptionPlaceholder')}
                readOnly={!canEditDescription}
              />
              {/* gm_notes — GM uniquement, jamais affiché aux joueurs */}
              {isGm && (
                <>
                  <label style={{ ...styles.fieldLabel, marginTop: '12px', color: '#5b8dee' }}>
                    {t('character.gmNotesLabel')}
                  </label>
                  <textarea
                    style={{ ...styles.textarea, borderColor: 'rgba(91,141,238,0.3)' }}
                    value={gmNotes}
                    onChange={e => setGmNotes(e.target.value)}
                    onBlur={handleGmNotesBlur}
                    placeholder={t('character.gmNotesPlaceholder')}
                  />
                </>
              )}
            </div>
          )}

          {/* Onglet Paramètres */}
          {activeTab === 'settings' && (
            <div style={styles.settingsContent}>
              <div style={styles.settingsRow}>
                <span style={styles.fieldLabel}>{t('character.ownerLabel')}</span>
                {isGm ? (
                  <select
                    style={styles.select}
                    value={character.user_id || ''}
                    onChange={async (e) => {
                      const user_id = e.target.value || null
                      try {
                        const res = await api.put(`/characters/${character.id}`, { user_id })
                        const updated = res.data.character
                        updateCharacter(updated)
                        onCharacterUpdate(updated)
                        // Le serveur broadcastera CHARACTER_UPDATED à toute la room — pas d'emit client.
                      } catch (err) {
                        console.error('Erreur assignation propriétaire :', err)
                      }
                    }}
                  >
                    <option value="">{t('character.noOwner')}</option>
                    {members
                      .filter(m => m.role === 'player')
                      .map(m => (
                        <option key={m.id} value={m.id}>{m.username}</option>
                      ))
                    }
                  </select>
                ) : (
                  <span style={styles.settingsValue}>
                    {character.owner_username || t('character.noOwner')}
                  </span>
                )}
              </div>
              {isGm && (
                <button style={styles.deleteCharBtn} onClick={handleDelete}>
                  {t('character.deleteCharacter')}
                </button>
              )}
              {isGm && (
                <label style={{
                  ...styles.uploadBtn,
                  opacity: glbUploading ? 0.5 : 1,
                  pointerEvents: glbUploading ? 'none' : 'auto',
                }}>
                  {glbUploading ? t('character.glbUploading') : t('character.glbUpload')}
                  <input
                    type="file"
                    accept=".glb"
                    style={{ display: 'none' }}
                    onChange={handleGlbUpload}
                  />
                </label>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ─── Breakdown popover — détail des modificateurs d'un jet ──────────────────
const TYPE_COLOR = { base: '#5b8dee', bonus: '#4CAF77', malus: '#E05C5C', neutral: '#909099', total: '#c8a030' }

function DiceBreakdownPopover({ popover, popoverRef }) {
  if (!popover) return null
  const { rect, breakdown } = popover
  const spaceBelow = window.innerHeight - rect.bottom
  const top    = spaceBelow >= 260 ? rect.bottom + 6 : rect.top - 6
  const xform  = spaceBelow >= 260 ? 'none' : 'translateY(-100%)'
  const left   = Math.min(rect.left, window.innerWidth - 240)
  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Détail du jet"
      style={{
        position: 'fixed', top, left, transform: xform,
        width: 230, background: '#0e1520',
        border: '1px solid rgba(91,141,238,0.3)',
        borderRadius: 6, padding: '8px 10px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
        zIndex: 9999, fontSize: 12, color: '#c0c0d0', userSelect: 'none',
      }}
    >
      {breakdown.map((entry, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: entry.type === 'total' ? '5px 0 2px' : '2px 0',
          borderTop: entry.type === 'total' ? '1px solid rgba(200,160,48,0.25)' : 'none',
          marginTop: entry.type === 'total' ? 4 : 0,
        }}>
          <span style={{ color: entry.type === 'total' ? '#c8a030' : '#a0a8b8' }}>{entry.label}</span>
          <span style={{
            fontFamily: "'Share Tech Mono', monospace", fontWeight: 700,
            color: TYPE_COLOR[entry.type] ?? '#c0c0d0',
          }}>
            {entry.type !== 'total' && entry.type !== 'base' && entry.value > 0 ? `+${entry.value}` : entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Sidebar principale ───────────────────────────────────────────────────────
export default function Sidebar({
  mode, onModeChange,
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
  const { user, setUser } = useAuthStore()
  const { characters, members, isGm, addCharacter } = useCharacterStore()
  const { messagesByCampaign, activeCampaignId, onlineUsers } = useSessionStore()
  const messages = useMemo(
    () => messagesByCampaign[activeCampaignId] || [],
    [activeCampaignId, messagesByCampaign],
  )
  const { blueprints, refreshBuiltinModels } = useEntityStore()
  const { phase, currentTurn } = useCombatStore()
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
    verticalAccessEditLadderId: null,
    roomHeightLevels: 1,
    wallHeightLevels: 1,
    floorThickness: 0.25,
    ceilingThickness: 0.25,
    ceilingHeight: 2.5,
    wallThickness: 1,
    wallHeight: 2.5,
    wallShape: 'straight',
    wallCurveOffset: 1.5,
    stairQuarterTurns: 0,
    stairKind: 'straight',
    stairWidthM: 1.5,
    stairTreadDepthM: 0.3,
    stairOuterDiameterM: 3.75,
    stairColumnDiameterM: 0.66,
    stairTotalTurns: 1.25,
    stairTreadThicknessM: 0.08,
    stairClockwise: false,
    stairMaxRiserHeightM: 0.18,
    stairHeadClearanceM: 2.05,
    stairOpeningMarginM: 0.06,
    stairRailingLeft: true,
    stairRailingRight: true,
    stairRailingOuter: true,
    stairRailingHeightM: 1.05,
    stairRailingThicknessM: 0.05,
    movementMultiplier: 1,
    ladderAxis: 'x',
    ladderSide: -1,
    ladderRotationQuarterTurns: 0,
    ladderWidth: 0.7,
    ladderDepth: 0.12,
    ladderAnchorSpacing: 0.5,
    ladderHatch: false,
    hatchHingeSide: 1,
    hatchRotationQuarterTurns: 0,
    hatchBlueprintId: null,
    hatchModelLabel: null,
    hatchModelCategory: null,
    hatchModelGlbUrl: null,
    hatchModelBuiltinKey: null,
    hatchModelGeometry: null,
    hatchMaterialOverrides: {},
    elevatorDoorAxis: 'z',
    elevatorDoorSide: 1,
    elevatorDraftStops: [],
    elevatorEditConnectorId: null,
    elevatorTravelSecondsPerLevel: 2,
    elevatorTravelSecondsPerUnit: 1,
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
  const updateSurfaceMaterial = (patch) => {
    const nextMaterial = { ...surfaceMaterialState, ...patch }
    const changesPhysicalPreset = patch.pattern !== undefined && surfaceToolState.mode !== 'room'
    const nextBlocking = patch.pattern === 'industrial_grate'
      ? 'grate'
      : surfaceMaterialState.pattern === 'industrial_grate'
        && (surfaceToolState.surfaceBlocking || 'solid') === 'grate'
        ? 'solid'
        : surfaceToolState.surfaceBlocking
    updateSurfaceTool({
      surfaceMaterialMode: 'procedural',
      materialFace: surfaceMaterialFace,
      materialPreset: nextMaterial,
      materialProfiles: {
        ...surfaceMaterialProfiles,
        [surfaceMaterialFace]: nextMaterial,
      },
      ...(changesPhysicalPreset ? { surfaceBlocking: nextBlocking } : {}),
    })
  }
  const blueprintPlacementMode = (blueprint) => blueprint?.geometry?.placementMode || blueprint?.geometry?.placement_mode || 'free'
  const structuralObjectConnectorType = (blueprint) => {
    const type = blueprint?.geometry?.connectorType
    return ['window', 'screen-window', 'skylight', 'stairs', 'ladder', 'elevator'].includes(type) ? type : null
  }
  const connectorBlueprints = Object.values(blueprints || {}).filter(blueprint => !blueprint.deprecated)
  const doorConnectorBlueprints = connectorBlueprints
    .filter(isDoorConnectorBlueprint)
    .sort((a, b) => String(a.label).localeCompare(String(b.label)))
  const windowConnectorBlueprints = connectorBlueprints
    .filter(blueprint => blueprint?.geometry?.connectorType === 'window')
    .sort((a, b) => String(a.label).localeCompare(String(b.label)))
  const screenWindowConnectorBlueprints = connectorBlueprints
    .filter(blueprint => blueprint?.geometry?.connectorType === 'screen-window')
    .sort((a, b) => String(a.label).localeCompare(String(b.label)))
  const skylightConnectorBlueprints = connectorBlueprints
    .filter(blueprint => blueprint?.geometry?.connectorType === 'skylight')
    .sort((a, b) => String(a.label).localeCompare(String(b.label)))
  const elevatorConnectorBlueprints = connectorBlueprints
    .filter(isElevatorConnectorBlueprint)
    .sort((a, b) => String(a.label).localeCompare(String(b.label)))
  const ladderConnectorBlueprints = connectorBlueprints
    .filter(blueprint => {
      const text = normalizedBlueprintText(blueprint)
      return text.includes('echelle')
        || text.includes('ladder')
    })
    .sort((a, b) => String(a.label).localeCompare(String(b.label)))
  const hatchConnectorBlueprints = connectorBlueprints
    .filter(blueprint => blueprint?.geometry?.connectorType === 'hatch')
    .sort((a, b) => String(a.label).localeCompare(String(b.label)))
  const genericElevatorChoice = {
    id: '__generic_elevator__',
    label: t('surfaceEditor.genericElevator'),
    category: 'surface_connectors',
  }
  const genericLadderChoice = {
    id: '__generic_ladder__',
    label: t('surfaceEditor.verticalAccess'),
    category: 'surface_connectors',
  }
  const connectorChoices = surfaceToolState.connectorType === 'door'
    ? doorConnectorBlueprints
    : surfaceToolState.connectorType === 'window'
      ? windowConnectorBlueprints
      : surfaceToolState.connectorType === 'screen-window'
        ? screenWindowConnectorBlueprints
        : surfaceToolState.connectorType === 'skylight'
          ? skylightConnectorBlueprints
    : surfaceToolState.connectorType === 'ladder'
      ? [...ladderConnectorBlueprints, genericLadderChoice]
      : elevatorConnectorBlueprints.length > 0 ? elevatorConnectorBlueprints : [genericElevatorChoice]
  const selectedConnectorChoice = connectorChoices.find(choice => String(choice.id) === String(surfaceToolState.connectorBlueprintId))
    || connectorChoices[0]
    || null
  const hatchChoices = hatchConnectorBlueprints
  const selectedHatchChoice = surfaceToolState.ladderHatch === false
    ? null
    : hatchChoices.find(choice => String(choice.id) === String(surfaceToolState.hatchBlueprintId))
      || hatchChoices[0]
      || null
  const editingVerticalAccess = Boolean(
    surfaceToolState.verticalAccessEditLadderId
      && String(surfaceToolState.selectedConnectorId) === String(surfaceToolState.verticalAccessEditLadderId),
  )
  const verticalAccessCatalogActive = Boolean(
    (structuralObjectConnectorType(activeBlueprint) === 'ladder'
      && surfaceToolState.mode === 'connector'
      && surfaceToolState.connectorType === 'ladder')
      || editingVerticalAccess,
  )
  const hatchCatalogOnly = verticalAccessCatalogActive && surfaceToolState.ladderHatch !== false
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
  const hatchModelPatch = (blueprint) => ({
    hatchBlueprintId: blueprint?.id || null,
    hatchModelLabel: blueprint?.label || null,
    hatchModelCategory: blueprint?.category || null,
    hatchModelGlbUrl: blueprint?.glb_url || null,
    hatchModelBuiltinKey: blueprint?.builtin_key || null,
    hatchModelGeometry: blueprint?.geometry || null,
    hatchMaterialOverrides: {},
  })
  const selectObjectBlueprint = (blueprint) => {
    const isActive = String(activeBlueprint?.id || '') === String(blueprint?.id || '')
    const connectorType = structuralObjectConnectorType(blueprint)
    onBlueprintSelect?.(isActive ? null : blueprint)

    if (connectorType && !isActive) {
      if (connectorType === 'stairs') {
        onSurfaceToolChange?.({
          ...surfaceToolState,
          mode: 'stair',
          stairPlacementSource: 'object-palette',
          stairKind: blueprint?.geometry?.stairKind || 'straight',
          stairQuarterTurns: 0,
          selectedRoomId: null,
          selectedRoomIds: [],
          selectedRoomWallKeys: [],
          selectedRoomWallCount: 0,
          selectedConnectorId: null,
          verticalAccessEditLadderId: null,
          roomArcError: null,
        })
        return
      }
      onSurfaceToolChange?.({
        ...surfaceToolState,
        mode: 'connector',
        connectorType,
        connectorPlacementSource: 'object-palette',
        connectorWallEdgeKeys: [],
        selectedRoomId: null,
        selectedRoomIds: [],
        selectedRoomWallKeys: [],
        selectedRoomWallCount: 0,
        selectedConnectorId: null,
        verticalAccessEditLadderId: null,
        connectorMaterialOverrides: {},
        ...(connectorType === 'elevator' ? { elevatorDraftStops: [], elevatorEditConnectorId: null } : {}),
        roomArcError: null,
        ...connectorModelPatch(blueprint),
      })
      return
    }

    if ((['window', 'screen-window', 'skylight', 'ladder', 'elevator'].includes(surfaceToolState.connectorType)
      && surfaceToolState.connectorPlacementSource === 'object-palette')
      || (surfaceToolState.mode === 'stair' && surfaceToolState.stairPlacementSource === 'object-palette')) {
      onSurfaceToolChange?.({
        ...surfaceToolState,
        mode: 'select',
        connectorPlacementSource: null,
        connectorWallEdgeKeys: [],
        roomArcError: null,
      })
    }
  }
  const selectConnectorModel = (blueprint) => {
    if (surfaceToolState.connectorType === 'elevator' && (surfaceToolState.elevatorDraftStops?.length || 0) > 0) return
    updateSurfaceTool({
      mode: 'connector',
      connectorType: surfaceToolState.connectorType || 'door',
      ...connectorModelPatch(blueprint),
    })
  }
  const selectHatchModel = (blueprint) => updateSurfaceTool({
    ladderHatch: true,
    ...hatchModelPatch(blueprint),
  })
  const selectVerticalAccessComposition = (withHatch) => {
    if (!withHatch) {
      updateSurfaceTool({ ladderHatch: false, ...hatchModelPatch(null) })
      return
    }
    selectHatchModel(selectedHatchChoice || hatchChoices[0] || null)
  }
  const rotateVerticalAccess = (delta) => {
    const quarterTurns = ((
      (Number(surfaceToolState.ladderRotationQuarterTurns ?? surfaceToolState.hatchRotationQuarterTurns) || 0) + delta
    ) % 4 + 4) % 4
    updateSurfaceTool({
      ladderRotationQuarterTurns: quarterTurns,
      ladderAxis: quarterTurns % 2 === 0 ? 'x' : 'z',
      ladderSide: quarterTurns < 2 ? -1 : 1,
      hatchRotationQuarterTurns: quarterTurns,
    })
  }

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

  // Formulaire de création de personnage
  const [showNewChar, setShowNewChar] = useState(false)
  const [newCharName, setNewCharName] = useState('')
  const [newCharType, setNewCharType] = useState('pnj')
  const [creating, setCreating] = useState(false)

  // Modale character — déléguée à SessionPage via onOpenCharacter

  // Onglet Config — profil utilisateur
  const [configUsername, setConfigUsername] = useState('')
  const [configColor, setConfigColor] = useState('')
  const [configSaving, setConfigSaving] = useState(false)
  const [configSuccess, setConfigSuccess] = useState(false)

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

  // Initialiser les champs config quand on ouvre l'onglet
  useEffect(() => {
    if (activeTab === 'profil' && user) {
      setConfigUsername(user.username || '')
      setConfigColor(user.color || '#4A90D9')
      setConfigSuccess(false)
    }
  }, [activeTab, user])

  // ─── CONFIG — Sauvegarde profil ──────────────────────────────────────────
  const handleConfigSave = useCallback(async (e) => {
    e.preventDefault()
    setConfigSaving(true)
    setConfigSuccess(false)
    const body = {}
    if (configUsername.trim() && configUsername.trim() !== user?.username) body.username = configUsername.trim()
    if (configColor && configColor !== user?.color) body.color = configColor
    if (Object.keys(body).length === 0) {
      setConfigSaving(false)
      return
    }
    try {
      const res = await api.put('/users/me', body)
      setUser(res.data.user)
      setConfigSuccess(true)
      // Si le username a changé, forcer reconnexion socket via SessionPage
      // pour que le nouveau JWT soit lu (socket.user.username mis à jour)
      if (body.username) {
        onReconnectSocket?.()
      }
    } catch (err) {
      console.error('Erreur sauvegarde config :', err)
    } finally {
      setConfigSaving(false)
    }
  }, [configUsername, configColor, user, setUser, onReconnectSocket])

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

    socket?.emit(WS.CHAT_MESSAGE, { text })
    setChatInput('')
  }

  const handleOpenBreakdown = useCallback((e, msg) => {
    e.stopPropagation()
    if (breakdownPopover?.msgId === msg.id) { setBreakdownPopover(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    setBreakdownPopover({ msgId: msg.id, breakdown: msg.breakdown, rect })
  }, [breakdownPopover])

  // ─── CRÉER UN PERSONNAGE ─────────────────────────────────────────────────
  const handleCreateCharacter = async (e) => {
    e.preventDefault()
    if (!newCharName.trim()) return
    setCreating(true)
    try {
      const res = await api.post(`/campaigns/${campaignId}/characters`, {
        name: newCharName.trim(),
        type: newCharType,
      })
      addCharacter(res.data.character)
      setNewCharName('')
      setNewCharType('pnj')
      setShowNewChar(false)
    } catch (err) {
      console.error('Erreur création personnage :', err)
    } finally {
      setCreating(false)
    }
  }

  // ─── DRAG CHARACTER ──────────────────────────────────────────────────────
  const handleDragStart = (e, character) => {
    e.dataTransfer.setData('characterId', character.id)
    e.dataTransfer.effectAllowed = 'copy'
  }

  // ─── OUVRIR MODALE CHARACTER ─────────────────────────────────────────────
  // La charCard est draggable. On distingue clic (modale) de drag (canvas).
  // dragStartPos stocke la position au mousedown pour détecter si c'est un vrai clic.
  const dragStartPos = useRef(null)

  const handleCardMouseDown = (e) => {
    dragStartPos.current = { x: e.clientX, y: e.clientY }
  }

  const handleCardClick = (e, character) => {
    if (!dragStartPos.current) return
    const dx = Math.abs(e.clientX - dragStartPos.current.x)
    const dy = Math.abs(e.clientY - dragStartPos.current.y)
    // Si la souris a bougé de plus de 4px, c'est un drag — pas un clic
    if (dx > 4 || dy > 4) return
    onOpenCharacter?.(character)
  }

  return (
    <div style={{ ...styles.sidebar, width }}>

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
        className="btn-icon"
        onClick={() => setShowHelp(v => !v)}
        title={t('sidebar.helpTitle')}
        style={{ position:'absolute', top:'8px', right:'34px', zIndex:10, border:'1px solid #2a2a3e', borderRadius:'50%', width:'20px', height:'20px', fontSize:'11px', fontWeight:'700', display:'flex', alignItems:'center', justifyContent:'center' }}
      >?</button>

      {/* ─── OUTILS ─────────────────────────────────────────────────────── */}
      <div style={styles.toolsRow}>
        {isGm && (
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
            <div style={styles.toolsDropdown}>
              <button style={styles.toolsDropdownItem} disabled>
                {t('session.toolRuler')}
              </button>
              <button style={styles.toolsDropdownItemEnabled} onClick={() => { setToolsOpen(false); onOpenTrade?.() }}>
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
          <div style={styles.editorTabs}>
            <button
              style={{ ...styles.editorTab, ...(activeEditorTab === 'world' ? styles.editorTabActive : {}) }}
              onClick={() => onEditorTabChange?.('world')}
            >
              Monde
            </button>
            <button
              style={{ ...styles.editorTab, ...(activeEditorTab === 'entity' ? styles.editorTabActive : {}) }}
              onClick={() => onEditorTabChange?.('entity')}
            >
              {t('sidebar.editorTabEntities')}
            </button>
          </div>
          <div style={styles.undoRow}>
            <button
              type="button"
              onClick={() => canSurfaceUndo && onSurfaceUndo?.()}
              disabled={!canSurfaceUndo}
              title="Annuler la derniere action (Ctrl+Z)"
              style={{
                ...styles.undoBtn,
                ...(!canSurfaceUndo ? styles.undoBtnDisabled : {}),
              }}
            >
              ↶ Annuler
            </button>
            <button
              type="button"
              onClick={() => canSurfaceRedo && onSurfaceRedo?.()}
              disabled={!canSurfaceRedo}
              title="Refaire la derniere action annulee (Ctrl+Y / Ctrl+Shift+Z)"
              style={{
                ...styles.undoBtn,
                ...(!canSurfaceRedo ? styles.undoBtnDisabled : {}),
              }}
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
              <div style={styles.roomTool}>
                <div style={styles.roomToolModes}>
                  <button
                    type="button"
                    onClick={() => updateSurfaceTool({ mode: 'select' })}
                    style={{
                      ...styles.roomToolModeBtn,
                      ...(surfaceToolState.mode === 'select' ? styles.roomToolModeBtnActive : {}),
                    }}
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
                    style={{
                      ...styles.roomToolModeBtn,
                      ...(surfaceToolState.mode === 'room' ? styles.roomToolModeBtnActive : {}),
                    }}
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
                    style={{
                      ...styles.roomToolModeBtn,
                      ...(surfaceToolState.mode === 'wall' ? styles.roomToolModeBtnActive : {}),
                    }}
                  >
                    Mur droit
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSurfaceTool({ mode: 'bridge' })}
                    style={{
                      ...styles.roomToolModeBtn,
                      ...(surfaceToolState.mode === 'bridge' ? styles.roomToolModeBtnActive : {}),
                    }}
                  >
                    Passerelle
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSurfaceTool({ mode: 'effect' })}
                    style={{
                      ...styles.roomToolModeBtn,
                      ...(surfaceToolState.mode === 'effect' ? styles.roomToolModeBtnActive : {}),
                    }}
                  >
                    Zone / effet
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSurfaceTool({ mode: 'erase' })}
                    style={{
                      ...styles.roomToolModeBtn,
                      ...(surfaceToolState.mode === 'erase' ? styles.roomToolModeBtnActive : {}),
                    }}
                  >
                    {t('surfaceEditor.erase')}
                  </button>
                </div>
                {surfaceToolState.mode === 'effect' && (
                  <div style={styles.connectorPicker}>
                    <div style={styles.connectorPickerTitle}>Région environnementale</div>
                    <div style={styles.roomToolGrid}>
                      <label style={styles.roomToolLabel}>
                        <span>Effet</span>
                        <select
                          value={surfaceToolState.effectDefinitionKey || 'fire'}
                          onChange={e => updateSurfaceTool({ effectDefinitionKey: e.target.value })}
                          style={styles.roomToolSelect}
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
                          style={styles.roomToolInput}
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
                          style={styles.roomToolInput}
                        />
                      </label>
                    </div>
                    <button type="button" onClick={() => setCustomEffectOpen(open => !open)} style={styles.roomToolSmallBtn}>
                      {customEffectOpen ? 'Fermer' : 'Nouvel effet MJ'}
                    </button>
                    {customEffectOpen && (
                      <div style={styles.connectorColorList}>
                        <label style={styles.roomToolLabel}>
                          <span>Clé technique</span>
                          <input
                            value={customEffectDraft.key}
                            onChange={e => setCustomEffectDraft(draft => ({ ...draft, key: e.target.value }))}
                            placeholder="debris-lourds"
                            style={styles.roomToolInput}
                          />
                        </label>
                        <label style={styles.roomToolLabel}>
                          <span>Nom</span>
                          <input
                            value={customEffectDraft.label}
                            onChange={e => setCustomEffectDraft(draft => ({ ...draft, label: e.target.value }))}
                            placeholder="Débris lourds"
                            style={styles.roomToolInput}
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
                            style={styles.roomToolInput}
                          />
                        </label>
                        <label style={styles.roomToolLabel}>
                          <span>Note / règle MJ</span>
                          <textarea
                            value={customEffectDraft.note}
                            onChange={e => setCustomEffectDraft(draft => ({ ...draft, note: e.target.value }))}
                            rows={3}
                            style={styles.roomToolInput}
                          />
                        </label>
                        <button type="button" onClick={createCustomEffect} style={styles.roomToolSmallBtn}>
                          Créer et sélectionner
                        </button>
                      </div>
                    )}
                    {(worldEffects.instances || []).length > 0 && (
                      <div style={styles.connectorColorList}>
                        <div style={styles.connectorPickerTitle}>Effets actifs</div>
                        {worldEffects.instances.map(instance => {
                          const definition = worldEffects.definitions.find(item => item.key === instance.definitionKey)
                          return (
                            <div key={instance.id} style={styles.roomToolSelection}>
                              <span>{definition?.label || instance.definitionKey} ×{instance.intensity}</span>
                              <button type="button" onClick={() => deleteRuntimeEffect(instance.id)} style={styles.roomToolSmallBtn}>
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
                      style={styles.roomToolInput}
                    />
                  </label>
                )}
                {surfaceToolState.mode === 'connector' && (
                  <>
                    <div style={styles.roomToolSectionTitle}>{t('surfaceEditor.connectors')}</div>
                    <div style={styles.roomToolModes}>
                      <button
                        type="button"
                        onClick={() => updateSurfaceTool({
                          mode: 'connector',
                          connectorType: 'elevator',
                          elevatorDraftStops: surfaceToolState.connectorType === 'elevator' ? surfaceToolState.elevatorDraftStops || [] : [],
                          elevatorEditConnectorId: surfaceToolState.connectorType === 'elevator' ? surfaceToolState.elevatorEditConnectorId || null : null,
                          ...connectorModelPatch(surfaceToolState.connectorType === 'elevator' ? selectedConnectorChoice : (elevatorConnectorBlueprints[0] || genericElevatorChoice)),
                        })}
                        style={{
                          ...styles.roomToolModeBtn,
                          ...(surfaceToolState.mode === 'connector' && surfaceToolState.connectorType === 'elevator' ? styles.roomToolModeBtnActive : {}),
                        }}
                      >
                        {t('surfaceEditor.addElevator')}
                      </button>
                    </div>
                    {surfaceToolState.mode === 'connector' && surfaceToolState.connectorType === 'elevator' && (
                      <div style={styles.connectorPicker}>
                      <div style={styles.connectorPickerTitle}>Tracé par arrêts</div>
                      <small>
                        Place chaque arrêt dans une salle fermée. Change d’étage pour monter ou descendre ; chaque nouveau tronçon doit rester droit.
                      </small>
                      <div>Arrêts posés : <strong>{surfaceToolState.elevatorDraftStops?.length || 0}</strong></div>
                      <label style={styles.roomToolLabel}>
                        <span>Porte du prochain arrêt</span>
                        <select
                          value={`${surfaceToolState.elevatorDoorAxis || 'z'}:${Number(surfaceToolState.elevatorDoorSide) < 0 ? -1 : 1}`}
                          onChange={e => {
                            const [axis, side] = e.target.value.split(':')
                            updateSurfaceTool({ elevatorDoorAxis: axis, elevatorDoorSide: Number(side) })
                          }}
                          style={styles.roomToolSelect}
                        >
                          <option value="z:-1">Nord</option>
                          <option value="x:1">Est</option>
                          <option value="z:1">Sud</option>
                          <option value="x:-1">Ouest</option>
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
                          style={styles.roomToolInput}
                        />
                      </label>
                      <label style={styles.roomToolLabel}>
                        <span>Trajet horizontal par case (s)</span>
                        <input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={surfaceToolState.elevatorTravelSecondsPerUnit || 1}
                          onChange={e => updateSurfaceTool({ elevatorTravelSecondsPerUnit: Math.max(0.1, Number(e.target.value) || 1) })}
                          style={styles.roomToolInput}
                        />
                      </label>
                      {(surfaceToolState.elevatorDraftStops?.length || 0) >= 2 && (
                        <button
                          type="button"
                          onClick={() => {
                            const connectorId = surfaceToolState.elevatorEditConnectorId
                            updateSurfaceTool({
                              mode: 'select',
                              selectedConnectorId: connectorId,
                              elevatorDraftStops: [],
                              elevatorEditConnectorId: null,
                              roomArcError: null,
                            })
                            if (surfaceToolState.connectorPlacementSource === 'object-palette') onBlueprintSelect?.(null)
                          }}
                          style={styles.roomToolModeBtn}
                        >
                          Terminer l’ascenseur
                        </button>
                      )}
                      {(surfaceToolState.elevatorDraftStops?.length || 0) === 1 && !surfaceToolState.elevatorEditConnectorId && (
                        <button
                          type="button"
                          onClick={() => updateSurfaceTool({ elevatorDraftStops: [], roomArcError: null })}
                          style={styles.roomToolSmallBtn}
                        >
                          Annuler le premier arrêt
                        </button>
                      )}
                      </div>
                    )}
                    {surfaceToolState.mode === 'connector' && surfaceToolState.connectorType === 'skylight' && (
                      <button
                        type="button"
                        onClick={() => updateSurfaceTool({
                          connectorRotationQuarterTurns: ((Number(surfaceToolState.connectorRotationQuarterTurns) || 0) + 1) % 2,
                        })}
                        style={styles.roomToolModeBtn}
                      >
                        Rotation 90°
                      </button>
                    )}
                    {((surfaceToolState.mode === 'connector' && surfaceToolState.connectorType === 'ladder')
                      || editingVerticalAccess) && (
                      <div style={styles.connectorPicker}>
                        <div style={styles.connectorPickerTitle}>{t('surfaceEditor.verticalAccessComposition')}</div>
                        <select
                          value={surfaceToolState.ladderHatch === false ? 'ladder-only' : 'ladder-hatch'}
                          onChange={event => selectVerticalAccessComposition(event.target.value === 'ladder-hatch')}
                          style={styles.roomToolSelect}
                        >
                          <option value="ladder-only">{t('surfaceEditor.ladderOnly')}</option>
                          <option value="ladder-hatch" disabled={hatchChoices.length === 0}>
                            {t('surfaceEditor.ladderAndHatch')}
                          </option>
                        </select>
                        {surfaceToolState.ladderHatch !== false && (
                          <>
                            <div style={styles.connectorPickerTitle}>{t('surfaceEditor.hatchModel')}</div>
                            <div style={styles.rotationRow}>
                              <button
                                type="button"
                                onClick={() => rotateVerticalAccess(-1)}
                                style={styles.roomToolSmallBtn}
                              >
                                ↶ Rotation gauche
                              </button>
                              <button
                                type="button"
                                onClick={() => rotateVerticalAccess(1)}
                                style={styles.roomToolSmallBtn}
                              >
                                Rotation droite ↷
                              </button>
                            </div>
                            {selectedHatchChoice?.glb_url && (
                              <Object3DPreview blueprint={selectedHatchChoice} />
                            )}
                          </>
                        )}
                        {hatchChoices.map(choice => {
                          const selected = String(selectedHatchChoice?.id) === String(choice.id)
                          const shape = choice.geometry?.openingShape === 'circle'
                            ? t('surfaceEditor.roundShape')
                            : t('surfaceEditor.squareShape')
                          const mechanism = choice.geometry?.openingMechanism
                            ? t(`surfaceEditor.hatchMechanisms.${choice.geometry.openingMechanism}`, { defaultValue: choice.geometry.openingMechanism })
                            : t('surfaceEditor.connectorModel')
                          return (
                            <button
                              key={choice.id}
                              type="button"
                              onClick={() => selectHatchModel(choice)}
                              style={{
                                ...styles.connectorModelBtn,
                                ...(selected ? styles.connectorModelBtnActive : {}),
                              }}
                            >
                              <span>{selected ? '✓ ' : ''}{choice.label}</span>
                              <small>{shape} · {mechanism}</small>
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {surfaceToolState.mode === 'connector' && (
                      <div style={styles.connectorPicker}>
                        <div style={styles.connectorPickerTitle}>
                          {surfaceToolState.connectorType === 'door'
                            ? t('surfaceEditor.doorModel')
                            : surfaceToolState.connectorType === 'window'
                              ? 'Modèle de fenêtre'
                              : surfaceToolState.connectorType === 'screen-window'
                                ? 'Modèle de fenêtre écran'
                                : surfaceToolState.connectorType === 'skylight'
                                  ? 'Modèle de dalle en verre'
                            : surfaceToolState.connectorType === 'ladder'
                              ? 'Modèle d’échelle'
                              : t('surfaceEditor.elevatorModel')}
                        </div>
                        {connectorChoices.length === 0 ? (
                          <div style={styles.connectorPickerEmpty}>{t('surfaceEditor.noConnectorModels')}</div>
                        ) : (
                          <>
                            {selectedConnectorChoice && (
                              <div style={styles.connectorSelectedModel}>
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
                              <div style={styles.connectorColorPanel}>
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
                                        style={styles.roomToolColorInput}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => clearConnectorMaterialSlot(slot)}
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
                              const modelLocked = surfaceToolState.connectorType === 'elevator'
                                && (surfaceToolState.elevatorDraftStops?.length || 0) > 0
                              return (
                                <button
                                  key={choice.id}
                                  type="button"
                                  disabled={modelLocked}
                                  onClick={() => selectConnectorModel(choice)}
                                  style={{
                                    ...styles.connectorModelBtn,
                                    ...(isSelected ? styles.connectorModelBtnActive : {}),
                                  }}
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
                        style={styles.roomToolSelect}
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
                        style={styles.roomToolInput}
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
                        style={styles.roomToolInput}
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
                        style={styles.roomToolInput}
                      />
                    </label>
                    <label style={styles.roomToolLabel}>
                      <span>{t('surfaceEditor.wallHeight')}</span>
                      <select
                        value={surfaceToolState.wallHeightLevels}
                        onChange={e => updateSurfaceTool({ wallHeightLevels: Number(e.target.value) })}
                        style={styles.roomToolSelect}
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
                    <div style={styles.roomToolSectionTitle}>{t('surfaceEditor.appliedMaterial')}</div>
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
                          style={{
                            ...styles.roomToolModeBtn,
                            ...(surfaceMaterialFace === face ? styles.roomToolModeBtnActive : {}),
                          }}
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
                          style={styles.roomToolSelect}
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
                          style={styles.roomToolSelect}
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
                          style={styles.roomToolColorInput}
                        />
                        <input
                          type="text"
                          value={surfaceMaterialState.paint || surfacePaintValue}
                          onChange={e => updateSurfaceMaterial({ paint: e.target.value })}
                          style={styles.roomToolInput}
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
                      style={{
                        ...styles.roomToolToggle,
                        ...(surfaceMaterialState.realRelief !== false ? styles.roomToolToggleActive : {}),
                      }}
                    >
                      <span>Relief reel</span>
                      <span style={styles.roomToolToggleState}>
                        {surfaceMaterialState.realRelief !== false ? 'Actif' : 'Normal map'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSurfaceTool({ autoVariants: !surfaceToolState.autoVariants })}
                      style={{
                        ...styles.roomToolToggle,
                        ...(surfaceToolState.autoVariants ? styles.roomToolToggleActive : {}),
                      }}
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
                          style={styles.roomToolSelect}
                        >
                          <option value="solid">Plein</option>
                          <option value="glass">Verre</option>
                          <option value="grate">Grille</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => updateSurfaceMaterial({ seed: `mat-${Date.now().toString(36)}` })}
                        style={styles.roomToolSmallBtn}
                      >
                        Nouvelle variation
                      </button>
                    </div>
                  </>
                )}
                <div style={styles.roomToolHint}>
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
                    <p style={{ color: '#5a5a7a', fontSize: '12px', padding: '8px' }}>{t('common.loading')}</p>
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
                                onClick={() => onMaterialChange({ texId: block.id, geo: 'cube', r: 0 })}
                                title={block.label}
                                style={{
                                  ...styles.matBtn,
                                  backgroundImage: texUrl ? `url(${texUrl})` : 'none',
                                  backgroundColor: texUrl ? 'transparent' : '#1e1e2e',
                                  borderWidth: '2px',
                                  borderStyle: 'solid',
                                  borderColor: isActive ? '#5b8dee' : 'transparent',
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
            const parametricObjects = PARAMETRIC_STRUCTURAL_OBJECTS.map(blueprint => ({
              ...blueprint,
              label: blueprint.labelKey ? t(blueprint.labelKey) : blueprint.label,
              category: blueprint.categoryKey ? t(blueprint.categoryKey) : blueprint.category,
            }))
            const bpList = [...Object.values(blueprints), ...parametricObjects]
              .filter(bp => !bp.deprecated)
              .filter(bp => blueprintPlacementMode(bp) !== 'connector' || structuralObjectConnectorType(bp))
              .filter(bp => !query || bp.label.toLocaleLowerCase().includes(query) || (bp.category || '').toLocaleLowerCase().includes(query))
            const grouped = bpList.reduce((groups, bp) => {
              const connectorType = structuralObjectConnectorType(bp)
              const category = connectorType === 'skylight'
                ? 'Dalles en verre'
                : connectorType === 'stairs'
                  ? 'Escaliers'
                  : connectorType === 'ladder'
                    ? t('surfaceEditor.verticalAccesses')
                    : connectorType ? 'Fenêtres' : (bp.category || t('sidebar.customObjects'))
              if (!groups[category]) groups[category] = []
              groups[category].push(bp)
              return groups
            }, {})
            return (
              <div style={{ marginTop: '6px' }}>
                <div style={{ ...styles.paletteTitle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span>{hatchCatalogOnly ? t('surfaceEditor.hatchModel') : t('sidebar.paletteEntities')}</span>
                  {!hatchCatalogOnly && (
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
                  )}
                </div>
                {verticalAccessCatalogActive && (
                  <div style={{ ...styles.connectorPicker, marginBottom: '10px' }}>
                    <div style={styles.connectorPickerTitle}>{t('surfaceEditor.verticalAccessComposition')}</div>
                    <select
                      value={surfaceToolState.ladderHatch === false ? 'ladder-only' : 'ladder-hatch'}
                      onChange={event => selectVerticalAccessComposition(event.target.value === 'ladder-hatch')}
                      style={styles.roomToolSelect}
                    >
                      <option value="ladder-only">{t('surfaceEditor.ladderOnly')}</option>
                      <option value="ladder-hatch" disabled={hatchChoices.length === 0}>
                        {t('surfaceEditor.ladderAndHatch')}
                      </option>
                    </select>
                  </div>
                )}
                {!hatchCatalogOnly && (
                  <input
                    value={objectSearch}
                    onChange={event => setObjectSearch(event.target.value)}
                    placeholder={t('sidebar.searchObjects')}
                    style={{ width: '100%', boxSizing: 'border-box', margin: '7px 0 9px', padding: '7px 9px', border: '1px solid #292944', borderRadius: '4px', background: '#11111d', color: '#d7d7e5' }}
                  />
                )}
                {!hatchCatalogOnly && activeBlueprint?.glb_url && <Object3DPreview blueprint={activeBlueprint} />}
                {hatchCatalogOnly && (
                  <div style={{ ...styles.connectorPicker, marginBottom: '10px' }}>
                    <div style={styles.rotationRow}>
                      <button
                        type="button"
                        onClick={() => rotateVerticalAccess(-1)}
                        style={styles.roomToolSmallBtn}
                      >
                        {t('surfaceEditor.rotateLeft')}
                      </button>
                      <button
                        type="button"
                        onClick={() => rotateVerticalAccess(1)}
                        style={styles.roomToolSmallBtn}
                      >
                        {t('surfaceEditor.rotateRight')}
                      </button>
                    </div>
                    {selectedHatchChoice?.glb_url && <Object3DPreview blueprint={selectedHatchChoice} />}
                    {hatchChoices.map(choice => {
                      const selected = String(selectedHatchChoice?.id) === String(choice.id)
                      const shape = choice.geometry?.openingShape === 'circle'
                        ? t('surfaceEditor.roundShape')
                        : t('surfaceEditor.squareShape')
                      const mechanism = choice.geometry?.openingMechanism
                        ? t(`surfaceEditor.hatchMechanisms.${choice.geometry.openingMechanism}`, { defaultValue: choice.geometry.openingMechanism })
                        : t('surfaceEditor.connectorModel')
                      return (
                        <button
                          key={choice.id}
                          type="button"
                          onClick={() => selectHatchModel(choice)}
                          style={{
                            ...styles.connectorModelBtn,
                            ...(selected ? styles.connectorModelBtnActive : {}),
                          }}
                        >
                          <span>{selected ? '✓ ' : ''}{choice.label}</span>
                          <small>{shape} · {mechanism}</small>
                        </button>
                      )
                    })}
                  </div>
                )}
                {!hatchCatalogOnly && bpList.length === 0 && (
                  <p style={{ color: '#5a5a7a', fontSize: '12px', padding: '8px' }}>
                    {t('sidebar.noBlueprints')}
                  </p>
                )}
                {!hatchCatalogOnly && Object.entries(grouped).map(([category, items]) => (
                  <div key={category} style={{ marginBottom: '10px' }}>
                    <div style={{ color: '#7f8eaa', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '6px 8px 3px' }}>
                      {category} <span style={{ opacity: 0.55 }}>({items.length})</span>
                    </div>
                    {items.sort((a, b) => a.label.localeCompare(b.label)).map(bp => {
                      const isActive = activeBlueprint?.id === bp.id
                      return (
                        <button
                          key={bp.id}
                          onClick={() => selectObjectBlueprint(bp)}
                          title={t('sidebar.clickThenPlace')}
                          style={{ display: 'block', width: '100%', padding: '7px 10px', background: isActive ? 'rgba(91,141,238,0.18)' : 'none', border: 'none', borderBottom: '1px solid #1a1a2e', borderLeft: isActive ? '2px solid #5b8dee' : '2px solid transparent', color: isActive ? '#5b8dee' : '#c0c0d0', fontSize: '12px', textAlign: 'left', cursor: 'pointer', transition: 'background 0.1s' }}
                        >
                          {blueprintPlacementMode(bp) === 'wall' ? '▥ ' : ''}{bp.label}
                        </button>
                      )
                    })}
                  </div>
                ))}
                {!hatchCatalogOnly && (
                  <button className="btn" style={{ width: '100%', marginTop: '4px' }} onClick={() => navigate('/workshop')}>
                    {t('sidebar.importCustomObject')}
                  </button>
                )}
              </div>
            )
          })()}
        </div>
      )}

      <div style={styles.separator} />

      {/* ─── ONGLETS — masqués en mode édition ───────────────────────────── */}
      {mode !== 'edit' && (
      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(activeTab === 'chat' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('chat')}
        >
          {t('sidebar.chat')}
          {isGm && pendingActionCount > 0 && (
            <span style={styles.pendingBadge}>{pendingActionCount}</span>
          )}
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'persos' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('persos')}
        >
          {t('sidebar.characters')}
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'biblio' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('biblio')}
        >
          {t('sidebar.library')}
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'profil' ? styles.tabActive : {}) }}
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
              <div className="cdl-chat">
                <div className="cdl-chat-header" onClick={() => setCdlOpen(v => !v)}>
                  <span>Déclarations · Tour {currentTurn}</span>
                  <span>{cdlOpen ? '▼' : '▶'}</span>
                </div>
                {cdlOpen && (
                  <div className="cdl-chat-body">
                    <DeclareLogContent />
                  </div>
                )}
              </div>
            )}
            <div style={styles.messages}>
              {messages.length === 0 && (
                <p style={styles.emptyMsg}>{t('chat.placeholder')}</p>
              )}
              {messages.map(msg => {
                if (msg.system) {
                  return (
                    <div key={msg.id} style={styles.messageSystem}>
                      <span style={msg.error ? styles.msgSystemErrorText : styles.msgSystemText}>{msg.text}</span>
                      <span style={styles.msgTime}>{msg.time}</span>
                    </div>
                  )
                }
                if (msg.type === 'entity_action') {
                  // Visible uniquement par le GM
                  if (!isGm) return null
                  return (
                    <div key={msg.id} style={styles.messageAction}>
                      <div style={styles.actionHeader}>
                        <span style={styles.actionIcon}>⚔</span>
                        <span style={styles.actionTitle}>
                          {t('sidebar.actionPending', { playerName: msg.playerName, interactionLabel: msg.interactionLabel })}
                        </span>
                        <span style={styles.msgTime}>{msg.time}</span>
                      </div>
                      <span style={styles.actionSub}>{t('sidebar.actionOn', { entityLabel: msg.entityLabel })}</span>
                      {msg.skillId && (
                        <div style={styles.actionMeta}>
                          <span>{t('sidebar.actionSkill')} : <strong>{msg.skillId}</strong></span>
                          <span>{t('sidebar.actionDC')} : <strong>{msg.defaultDifficulty}</strong></span>
                        </div>
                      )}
                      <div style={styles.actionBtns}>
                        <button style={styles.btnAccept} onClick={() => { setPendingActionCount(p => Math.max(0, p - 1)); onEntityActionResolve?.(msg.requestId, true, false, 0) }}>
                          {t('sidebar.actionAccept')}
                        </button>
                        <button style={styles.btnAuto} onClick={() => { setPendingActionCount(p => Math.max(0, p - 1)); onEntityActionResolve?.(msg.requestId, true, true, 0) }}>
                          {t('sidebar.actionAuto')}
                        </button>
                        <button style={styles.btnRefuse} onClick={() => { setPendingActionCount(p => Math.max(0, p - 1)); onEntityActionResolve?.(msg.requestId, false, false, 0) }}>
                          {t('sidebar.actionRefuse')}
                        </button>
                      </div>
                    </div>
                  )
                }
                if (msg.type === 'sell_request') {
                  if (!isGm) return null
                  return (
                    <div key={msg.id} style={styles.messageAction}>
                      <div style={styles.actionHeader}>
                        <span style={styles.actionIcon}>🏪</span>
                        <span style={styles.actionTitle}>
                          {t('sidebar.sellRequest', {
                            charName: msg.fromCharName,
                            merchant: msg.merchantName || 'GM',
                          })}
                        </span>
                        <span style={styles.msgTime}>{msg.time}</span>
                      </div>
                      <div style={styles.actionSub}>
                        {msg.itemCount} objet{msg.itemCount !== 1 ? 's' : ''} — {msg.solsProposed} S
                      </div>
                      <div style={styles.actionBtns}>
                        <button
                          style={styles.btnAccept}
                          onClick={() => {
                            setPendingActionCount(p => Math.max(0, p - 1))
                            onOpenTrade?.({ mode: 'reventes' })
                          }}
                        >
                          {t('sidebar.sellRequestView')}
                        </button>
                      </div>
                    </div>
                  )
                }
                if (msg.type === 'exchange_offer') {
                  return (
                    <div key={msg.id} style={styles.messageAction}>
                      <div style={styles.actionHeader}>
                        <span style={styles.actionIcon}>🔄</span>
                        <span style={styles.actionTitle}>
                          {t('sidebar.exchangeOffer', { charName: msg.fromCharName })}
                        </span>
                        <span style={styles.msgTime}>{msg.time}</span>
                      </div>
                      <div style={styles.actionSub}>
                        {msg.itemCount} objet{msg.itemCount !== 1 ? 's' : ''}{msg.solsOffer > 0 ? ` — ${msg.solsOffer} S` : ''}
                      </div>
                      <div style={styles.actionBtns}>
                        <button
                          style={styles.btnAccept}
                          onClick={() => {
                            setPendingActionCount(p => Math.max(0, p - 1))
                            onOpenExchange?.({ incomingOffer: { offerId: msg.offerId, fromCharName: msg.fromCharName, items: msg.items, solsOffer: msg.solsOffer, expiresAt: msg.expiresAt, toCharId: msg.toCharId } })
                          }}
                        >
                          {t('sidebar.exchangeOfferView')}
                        </button>
                      </div>
                    </div>
                  )
                }
                if (msg.type === 'declare_error') {
                  return (
                    <div key={msg.id} style={{ ...styles.messageDice, background: 'rgba(224,92,92,0.07)', border: '1px solid rgba(224,92,92,0.2)' }}>
                      <div style={styles.diceHeader}>
                        <span style={{ ...styles.diceIcon, color: '#c05050' }}>⊗</span>
                        {msg.username && <span style={{ ...styles.msgUser, color: '#c05050' }}>{msg.username}</span>}
                        <span style={styles.msgTime}>{msg.username ? ` · ${msg.time}` : msg.time}</span>
                      </div>
                      <div style={{ paddingLeft: '2px', fontSize: 12, color: '#c0c0d0' }}>{msg.text}</div>
                      <div style={{ paddingLeft: '2px' }}>
                        <span className="badge badge-fail">ÉCHEC</span>
                      </div>
                    </div>
                  )
                }
                if (msg.type === 'resolve_move_blocked') {
                  return (
                    <div key={msg.id} style={{ ...styles.messageDice, background: 'rgba(224,92,92,0.07)', border: '1px solid rgba(224,92,92,0.2)' }}>
                      <div style={styles.diceHeader}>
                        <span style={{ ...styles.diceIcon, color: '#c05050' }}>⊗</span>
                        {msg.username && <span style={{ ...styles.msgUser, color: '#c05050' }}>{msg.username}</span>}
                        <span style={styles.msgTime}>{msg.username ? ` · ${msg.time}` : msg.time}</span>
                      </div>
                      <div style={{ paddingLeft: '2px', fontSize: 12, color: '#c0c0d0' }}>{msg.text}</div>
                      <div style={{ paddingLeft: '2px' }}>
                        <span className="badge badge-fail">{msg.partial ? 'PARTIEL' : 'BLOQUÉ'}</span>
                      </div>
                    </div>
                  )
                }
                if (msg.type === 'dice') {
                  const isAnimating = animatingDiceId === msg.id

                  // ── Macro favori (PLAN 13) ─────────────────────────────────
                  if (msg.interactionType === 'macro_result') {
                    const successStyle = msg.isSuccess
                      ? { background: 'rgba(76,175,119,0.07)', border: '1px solid rgba(76,175,119,0.2)' }
                      : { background: 'rgba(224,92,92,0.07)', border: '1px solid rgba(224,92,92,0.2)' }
                    return (
                      <div key={msg.id} style={{ ...styles.messageDice, ...successStyle }}>
                        <div style={styles.diceHeader}>
                          <span style={{ ...styles.diceIcon, color: msg.color || '#aa8a30' }}>★</span>
                          <span style={{ ...styles.msgUser, color: msg.color || '#aa8a30' }}>{msg.characterName}</span>
                          <span style={styles.msgTime}> · {msg.time}</span>
                          {msg.secret && <span style={{ fontSize: 9, marginLeft: 4 }}>🔒</span>}
                        </div>
                        <div style={{ paddingLeft: '2px', fontSize: '12px', color: '#c0c0d0', lineHeight: 1.4 }}>
                          {msg.formattedMessage}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: '2px', marginTop: 3 }}>
                          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 14, fontWeight: 700, color: '#dde7ee' }}>
                            {msg.rollResult}
                          </span>
                          <span style={{ fontSize: 10, color: '#456575' }}>/ {msg.threshold}</span>
                          <span className={msg.isSuccess ? 'badge badge-success' : 'badge badge-fail'}>
                            {msg.isSuccess ? t('sidebar.macroSuccess') : t('sidebar.macroFail')}
                            {msg.isCriticalSuccess ? ` ${t('sidebar.macroCritical')}` : msg.isCriticalFail ? ` ${t('sidebar.macroFumble')}` : ''}
                          </span>
                        </div>
                      </div>
                    )
                  }

                  // ── Jet d'interaction entité — affichage structuré ──────────
                  if (msg.skillLabel !== undefined) {
                    const successStyle = msg.isSuccess
                      ? { background: 'rgba(76,175,119,0.07)', border: '1px solid rgba(76,175,119,0.2)' }
                      : { background: 'rgba(224,92,92,0.07)', border: '1px solid rgba(224,92,92,0.2)' }

                    // ── Dégâts combat (PJ confirme) ─────────────────────────
                    if (msg.interactionType === 'combat_damage') {
                      return (
                        <div key={msg.id} style={{
                          ...styles.messageDice,
                          background: (msg.severityColor ?? '#FF6B6B') + '18',
                          border: `1px solid ${(msg.severityColor ?? '#FF6B6B')}44`,
                        }}>
                          <div style={styles.diceHeader}>
                            <span style={{ ...styles.diceIcon, color: msg.severityColor ?? msg.color }}>⚔</span>
                            <span style={{ ...styles.msgUser, color: msg.severityColor ?? msg.color }}>{msg.user}</span>
                            <span style={styles.msgTime}> · {msg.time}</span>
                          </div>
                          <div style={{ paddingLeft: '2px', fontSize: '13px', color: '#c0c0d0' }}>
                            <strong style={{ color: msg.severityColor ?? '#c0c0d0' }}>{msg.total}</strong> dégâts
                            {' '}à <strong>{msg.localisation}</strong>
                            {' '}de <strong>{msg.targetName}</strong>
                          </div>
                          {msg.severity && (
                            <span className="badge" style={{ color: msg.severityColor, background: msg.severityColor + '22', boxShadow: `inset 0 0 0 1px ${msg.severityColor}66` }}>
                              {msg.severity}
                            </span>
                          )}
                        </div>
                      )
                    }

                  // ── Déplacement d'entité ────────────────────────────────
                    if (msg.interactionType === 'displacement') {
                      return (
                        <div key={msg.id} style={{ ...styles.messageDice, ...successStyle }}>
                          {/* En-tête : icône + nom + heure */}
                          <div style={styles.diceHeader}>
                            <span style={{ ...styles.diceIcon, color: msg.color || '#5b8dee' }}>
                              <IconDice />
                            </span>
                            <span style={{ ...styles.msgUser, color: msg.color || '#5b8dee' }}>{msg.user}</span>
                            <span style={styles.msgTime}> · {msg.time}</span>
                            {msg.breakdown && (
                              <button onClick={(e) => handleOpenBreakdown(e, msg)} title="Détail du calcul" style={{ marginLeft: 'auto', background: breakdownPopover?.msgId === msg.id ? 'rgba(91,141,238,0.2)' : 'none', border: '1px solid rgba(91,141,238,0.25)', borderRadius: 3, padding: '1px 5px', cursor: 'pointer', color: '#5b8dee', fontSize: 10, lineHeight: 1 }}>⊞</button>
                            )}
                          </div>
                          {/* Corps : "Jet de Force" + résultat du dé en grand */}
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', paddingLeft: '2px' }}>
                            <span style={styles.diceFormula}>{t('sidebar.displacementJet', { attr: msg.skillLabel })}</span>
                            <span style={styles.diceTotal}>{msg.total}</span>
                          </div>
                          {/* Détail : difficulté · seuil */}
                          <div style={{ paddingLeft: '2px', fontSize: '11px', color: '#64748b' }}>
                            {t('sidebar.displacementDetail', {
                              dif: msg.diffLabel,
                              seuil: msg.chancesDeReussite,
                            })}
                          </div>
                          {/* Badge résultat avec marge de réussite */}
                          <div style={{ paddingLeft: '2px' }}>
                            <span className={msg.isSuccess ? 'badge badge-success' : 'badge badge-fail'}>
                              {msg.isSuccess
                                ? t('sidebar.displacementSuccess', { mr: msg.mr })
                                : t('sidebar.displacementFail', { mr: msg.mr })
                              }
                            </span>
                          </div>
                        </div>
                      )
                    }

                    // ── Skillcheck ──────────────────────────────────────────
                    return (
                      <div key={msg.id} style={{ ...styles.messageDice, ...successStyle }}>
                        {/* En-tête : icône + nom + heure */}
                        <div style={styles.diceHeader}>
                          <span style={{ ...styles.diceIcon, color: msg.color || '#5b8dee' }}>
                            <IconDice />
                          </span>
                          <span style={{ ...styles.msgUser, color: msg.color || '#5b8dee' }}>{msg.user}</span>
                          <span style={styles.msgTime}> · {msg.time}</span>
                          {msg.breakdown && (
                            <button onClick={(e) => handleOpenBreakdown(e, msg)} title="Détail du calcul" style={{ marginLeft: 'auto', background: breakdownPopover?.msgId === msg.id ? 'rgba(91,141,238,0.2)' : 'none', border: '1px solid rgba(91,141,238,0.25)', borderRadius: 3, padding: '1px 5px', cursor: 'pointer', color: '#5b8dee', fontSize: 10, lineHeight: 1 }}>⊞</button>
                          )}
                        </div>
                        {/* Corps : nom compétence + résultat du dé en grand */}
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', paddingLeft: '2px' }}>
                          <span style={styles.diceFormula}>{msg.skillLabel}</span>
                          <span style={styles.diceTotal}>{msg.total}</span>
                        </div>
                        {/* Détail : compétence · difficulté · seuil */}
                        <div style={{ paddingLeft: '2px', fontSize: '11px', color: '#64748b' }}>
                          {t(msg.cardType === 'drone_damage'
                            ? 'sidebar.droneActionDetail'
                            : msg.cardType === 'shock_test'
                            ? 'sidebar.shockTestDetail'
                            : 'sidebar.entityActionDetail',
                          {
                            skill: msg.mechanicalTotal,
                            dif: msg.diffLabel,
                            seuil: msg.chancesDeReussite,
                          })}
                        </div>
                        {/* Badge résultat */}
                        <div style={{ paddingLeft: '2px' }}>
                          <span className={msg.isSuccess ? 'badge badge-success' : 'badge badge-fail'}>
                            {msg.isSuccess ? t('sidebar.entityActionSuccess') : t('sidebar.entityActionFail')}
                          </span>
                        </div>
                      </div>
                    )
                  }

                  // ── Jet normal (/r formule) ─────────────────────────────────
                  const critStyle = msg.isCriticalSuccess
                    ? styles.diceCritSuccess
                    : msg.isCriticalFail
                      ? styles.diceCritFail
                      : null
                  return (
                    <div key={msg.id} style={{ ...styles.messageDice, ...(critStyle || {}) }}>
                      {/* En-tête : icône animée + nom + heure */}
                      <div style={styles.diceHeader}>
                        <span
                          className={isAnimating ? 'dice-icon-animating' : undefined}
                          style={{
                            ...styles.diceIcon,
                            color: msg.color || '#5b8dee',
                          }}
                        >
                          <IconDice />
                        </span>
                        <span style={{ ...styles.msgUser, color: msg.color || '#5b8dee' }}>{msg.user}</span>
                        <span style={styles.msgTime}> · {msg.time}</span>
                        {/* Jet secret — visible uniquement par lanceur + GM */}
                        {msg.secret && (
                          <span style={{ fontSize: 11, opacity: 0.8 }} title="Jet au MJ — invisible aux autres joueurs">🔒</span>
                        )}
                        {/* Badge critique — affiché uniquement si configuré */}
                        {msg.isCriticalSuccess && (
                          <span className="badge badge-success">{t('dice.criticalSuccess')}</span>
                        )}
                        {msg.isCriticalFail && (
                          <span className="badge badge-fail">{t('dice.criticalFail')}</span>
                        )}
                      </div>
                      {/* Corps : formule + rolls individuels + total */}
                      <div style={styles.diceBody}>
                        <span style={styles.diceFormula}>{msg.formula}</span>
                        <span style={styles.diceRolls}>
                          {'['}{msg.rolls.join(', ')}{']'}
                        </span>
                        <span style={styles.diceEquals}>=</span>
                        <span style={styles.diceTotal}>{msg.total}</span>
                      </div>
                    </div>
                  )
                }
                // Message chat standard
                return (
                  <div key={msg.id} style={styles.message}>
                    <span style={{ ...styles.msgUser, color: msg.color || '#5b8dee' }}>{msg.user}</span>
                    <span style={styles.msgTime}> · {msg.time}</span>
                    <p style={styles.msgText}>{msg.text}</p>
                  </div>
                )
              })}
              {/* Ancre auto-scroll — div vide en fin de liste */}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} style={styles.chatForm}>
              <input
                style={styles.chatInput}
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
          <div style={styles.persosList}>

            {/* Bouton créer — GM uniquement */}
            {isGm && (
              <button
                className="btn"
                style={{ width: '100%', marginBottom: '8px' }}
                onClick={() => setShowNewChar(v => !v)}
              >
                {t('sidebar.newCharacter')}
              </button>
            )}

            {/* Formulaire création */}
            {isGm && showNewChar && (
              <form onSubmit={handleCreateCharacter} style={{ ...styles.newCharForm, flexDirection: 'column', gap: '6px' }}>
                <select
                  style={styles.select}
                  value={newCharType}
                  onChange={e => setNewCharType(e.target.value)}
                >
                  <option value="pnj">{t('drone.typeHumanoid')}</option>
                  <option value="drone">{t('drone.typeDrone')}</option>
                  <option value="armure" disabled>{t('drone.typeArmor')}</option>
                </select>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    style={styles.chatInput}
                    placeholder={t('sidebar.characterNamePlaceholder')}
                    value={newCharName}
                    onChange={e => setNewCharName(e.target.value)}
                    autoFocus
                  />
                  <button
                    className="btn-icon"
                    type="submit"
                    disabled={creating || !newCharName.trim()}
                    style={{ color: 'var(--color-primary)' }}
                  >
                    {creating ? '…' : '✓'}
                  </button>
                </div>
              </form>
            )}

            {/* Liste des personnages */}
            {characters.length === 0 && (
              <p style={styles.emptyMsg}>{t('sidebar.noCharacters')}</p>
            )}

            {characters.map(char => (
              <div
                key={char.id}
                draggable
                onMouseDown={handleCardMouseDown}
                onDragStart={e => handleDragStart(e, char)}
                onClick={e => handleCardClick(e, char)}
                style={styles.charCard}
                title={t('sidebar.dragToMap')}
              >
                {/* Pastille couleur */}
                <div style={{ ...styles.charColor, background: char.color }} />
                <div style={styles.charInfo}>
                  <span style={styles.charName}>{char.name}</span>
                  {char.owner_username && (
                    <span style={styles.charOwner}>{char.owner_username}</span>
                  )}
                </div>
                {/* Indicateur visibilité — GM uniquement */}
                {isGm && !char.visible && (
                  <span style={styles.charHidden} title={t('sidebar.hiddenFromPlayers')}>
                    <IconEyeOff />
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Biblio ── */}
        {activeTab === 'biblio' && (
          <LibraryPanel />
        )}

        {/* ── Profil — réglages compte + séparateur + liste connectés ── */}
        {activeTab === 'profil' && (
          <>
            {/* Réglages compte */}
            <div style={styles.configContent}>
              {configSuccess && (
                <p style={styles.configSuccess}>{t('sidebar.configSaved')}</p>
              )}
              <form onSubmit={handleConfigSave}>
                <div style={styles.configField}>
                  <label style={styles.configLabel}>{t('sidebar.configUsername')}</label>
                  <input
                    style={styles.configInput}
                    value={configUsername}
                    onChange={e => setConfigUsername(e.target.value)}
                  />
                </div>
                <div style={styles.configField}>
                  <label style={styles.configLabel}>{t('sidebar.configColor')}</label>
                  <div style={styles.configColorRow}>
                    <input
                      type="color"
                      value={configColor}
                      onChange={e => setConfigColor(e.target.value)}
                      style={styles.configColorPicker}
                    />
                    <span style={{ ...styles.configLabel, color: configColor }}>{configColor}</span>
                  </div>
                </div>
                <button className="btn" style={{ width:'100%', marginTop:'8px' }} type="submit" disabled={configSaving}>
                  {configSaving ? '…' : t('common.save')}
                </button>
              </form>
            </div>

            {/* Séparateur */}
            <div style={styles.profilSeparator} />

            {/* Liste des connectés */}
            <div style={styles.playersList}>
              {members.length === 0 && (
                <p style={styles.emptyMsg}>{t('sidebar.noPlayers')}</p>
              )}
              {members.map(member => {
                const isOnline = onlineUsers.has(member.id)
                const character = characters.find(c => c.user_id === member.id)
                return (
                  <div key={member.id} style={styles.playerCard}>
                    <div style={{
                      ...styles.onlineDot,
                      background: isOnline ? '#4caf77' : '#2a2a3e',
                    }} />
                    <div style={styles.playerInfo}>
                      <div style={styles.playerNameRow}>
                        <span style={styles.playerName}>{member.username}</span>
                        <span className={member.role === 'gm' ? 'badge badge-gm' : 'badge badge-player'}>
                          {member.role === 'gm' ? t('sidebar.roleGM') : t('sidebar.rolePlayer')}
                        </span>
                      </div>
                      {character && (
                        <span style={styles.playerCharacter}>↳ {character.name}</span>
                      )}
                    </div>
                    <span style={{ ...styles.onlineLabel, color: isOnline ? '#4caf77' : '#2a2a3e' }}>
                      {isOnline ? t('sidebar.online') : t('sidebar.offline')}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Quitter la session */}
            <div style={{ padding: '8px 12px 12px' }}>
              <button className="btn btn-ghost" style={{ width:'100%', padding:'8px 0' }} onClick={() => navigate('/dashboard')}>
                {t('sidebar.quit')}
              </button>
            </div>
          </>
        )}

      </div>
      )}

      {/* ─── Modale aide raccourcis ───────────────────────────────────────── */}
      {showHelp && (
        <div style={styles.helpOverlay} onClick={() => setShowHelp(false)}>
          <div style={styles.helpModal} onClick={e => e.stopPropagation()}>
            <div style={styles.helpHeader}>
              <span style={styles.helpTitle}>{t('sidebar.helpTitle')}</span>
              <button style={styles.helpCloseBtn} onClick={() => setShowHelp(false)}>×</button>
            </div>

            {mode !== 'edit' && (
              <>
                <div style={styles.helpSection}>{t('sidebar.helpSectionPlay')}</div>
                <div style={styles.helpRow}><kbd style={styles.kbd}>Alt</kbd><span>{t('sidebar.helpAlt')}</span></div>
                <div style={styles.helpRow}><kbd style={styles.kbd}>/r formule</kbd><span>{t('sidebar.helpDiceRoll')}</span></div>
                <div style={styles.helpRow}><kbd style={styles.kbd}>Drag</kbd><span>{t('sidebar.helpDrag')}</span></div>
              </>
            )}

            {mode === 'edit' && (
              <>
                <div style={styles.helpSection}>{t('sidebar.helpSectionEdit')}</div>
                <div style={styles.helpRow}><kbd style={styles.kbd}>Clic gauche</kbd><span>{t('sidebar.helpVoxelPlace')}</span></div>
                <div style={styles.helpRow}><kbd style={styles.kbd}>Clic droit</kbd><span>{t('sidebar.helpVoxelErase')}</span></div>
                <div style={styles.helpRow}><kbd style={styles.kbd}>R</kbd><span>{t('sidebar.helpVoxelRotate')}</span></div>
                <div style={styles.helpRow}><kbd style={styles.kbd}>1</kbd><span>{t('sidebar.helpGeoCube')}</span></div>
                <div style={styles.helpRow}><kbd style={styles.kbd}>2</kbd><span>{t('sidebar.helpGeoDalleB')}</span></div>
                <div style={styles.helpRow}><kbd style={styles.kbd}>3</kbd><span>{t('sidebar.helpGeoDalleH')}</span></div>
                <div style={styles.helpRow}><kbd style={styles.kbd}>4</kbd><span>{t('sidebar.helpGeoSlope')}</span></div>
                <div style={styles.helpRow}><kbd style={styles.kbd}>5</kbd><span>{t('sidebar.helpGeoWedge')}</span></div>
                <div style={styles.helpRow}><kbd style={styles.kbd}>Ctrl+Z</kbd><span>{t('sidebar.helpUndo')}</span></div>
                <div style={styles.helpRow}><kbd style={styles.kbd}>Ctrl+Y</kbd><span>{t('sidebar.helpRedo')}</span></div>
                <div style={styles.helpRow}><kbd style={styles.kbd}>Suppr</kbd><span>{t('sidebar.helpDelete')}</span></div>
                <div style={styles.helpRow}><kbd style={styles.kbd}>Alt</kbd><span>{t('sidebar.helpEntitiesHighlight')}</span></div>
              </>
            )}
          </div>
        </div>
      )}
      <DiceBreakdownPopover popover={breakdownPopover} popoverRef={popoverRef} />
    </div>
  )
}
const styles = {
  sidebar: {
    position: 'relative',
    height: '100%',
    minHeight: 0,
    background: '#0f0f1a',
    borderLeft: '1px solid #1e1e2e',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    overflow: 'hidden',
    userSelect: 'none',
  },
  resizeHandle: {
    position: 'absolute',
    left: '-3px',
    top: 0,
    width: '6px',
    height: '100%',
    cursor: 'col-resize',
    zIndex: 20,
  },
  toolsRow: {
    display: 'flex',
    gap: '6px',
    padding: '12px 12px 8px 16px',
    flexWrap: 'wrap',
    flexShrink: 0,
  },
  toolsDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    background: '#16162a',
    border: '1px solid #1e1e2e',
    borderRadius: '6px',
    zIndex: 100,
    minWidth: '140px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  },
  toolsDropdownItem: {
    display: 'block',
    width: '100%',
    padding: '8px 12px',
    background: 'none',
    border: 'none',
    color: '#4a4a60',
    fontSize: '12px',
    textAlign: 'left',
    cursor: 'default',
  },
  toolsDropdownItemEnabled: {
    display: 'block',
    width: '100%',
    padding: '8px 12px',
    background: 'none',
    border: 'none',
    color: '#c0c0d0',
    fontSize: '12px',
    textAlign: 'left',
    cursor: 'pointer',
  },
  palette: {
    padding: '4px 12px 8px',
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    scrollbarGutter: 'stable',
  },
  paletteTitle: {
    fontSize: '10px',
    color: '#4a4a60',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '6px',
  },
  paletteGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
  },
  paletteGroup: {
    marginBottom: '8px',
  },
  paletteGroupLabel: {
    fontSize: '10px',
    color: '#4a4a60',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '4px',
  },
  matBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '4px',
    cursor: 'pointer',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  },
  roomTool: {
    background: '#111827',
    border: '1px solid #1e293b',
    borderRadius: '6px',
    padding: '8px',
    marginBottom: '10px',
  },
  roomToolToggle: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '7px 8px',
    background: '#16162a',
    border: '1px solid #1e1e2e',
    borderRadius: '5px',
    color: '#9090a8',
    fontSize: '12px',
    cursor: 'pointer',
  },
  roomToolToggleActive: {
    color: '#dbeafe',
    border: '1px solid #5b8dee',
    background: 'rgba(91,141,238,0.16)',
  },
  roomToolToggleState: {
    color: '#5b8dee',
    fontSize: '10px',
    textTransform: 'uppercase',
  },
  roomToolModes: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginBottom: '8px',
  },
  roomToolModeBtn: {
    flex: '1 1 72px',
    padding: '6px 0',
    background: '#0f0f1a',
    border: '1px solid #1e1e2e',
    borderRadius: '4px',
    color: '#6f7893',
    fontSize: '11px',
    cursor: 'pointer',
  },
  roomToolModeBtnActive: {
    color: '#dbeafe',
    border: '1px solid #5b8dee',
    background: 'rgba(91,141,238,0.14)',
  },
  roomToolGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '6px',
  },
  roomToolLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    color: '#6f7893',
    fontSize: '10px',
    textTransform: 'uppercase',
    marginTop: '8px',
  },
  roomToolInput: {
    width: '100%',
    boxSizing: 'border-box',
    background: '#0f0f1a',
    border: '1px solid #1e1e2e',
    borderRadius: '4px',
    color: '#d0d5e8',
    fontSize: '12px',
    padding: '5px 6px',
  },
  roomToolSelect: {
    width: '100%',
    background: '#0f0f1a',
    border: '1px solid #1e1e2e',
    borderRadius: '4px',
    color: '#d0d5e8',
    fontSize: '12px',
    padding: '5px 6px',
  },
  roomToolSectionTitle: {
    marginTop: '10px',
    paddingTop: '8px',
    borderTop: '1px solid #1e293b',
    color: '#c8d4ee',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  roomToolSelection: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '7px 8px',
    borderRadius: '8px',
    border: '1px solid rgba(251, 191, 36, 0.35)',
    background: 'rgba(251, 191, 36, 0.08)',
    color: '#fbbf24',
    fontSize: '11px',
    fontWeight: 600,
  },
  connectorPicker: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginTop: '8px',
    padding: '8px',
    borderRadius: '6px',
    border: '1px solid #1e293b',
    background: 'rgba(15, 23, 42, 0.65)',
  },
  connectorPickerTitle: {
    color: '#c8d4ee',
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  connectorPickerEmpty: {
    color: '#6f7893',
    fontSize: '11px',
    lineHeight: 1.35,
  },
  connectorSelectedModel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '7px 8px',
    borderRadius: '5px',
    border: '1px solid rgba(249, 115, 22, 0.45)',
    background: 'rgba(249, 115, 22, 0.12)',
    color: '#fdba74',
    fontSize: '11px',
  },
  connectorModelBtn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    width: '100%',
    padding: '7px 8px',
    borderRadius: '5px',
    border: '1px solid #1e1e2e',
    background: '#0f0f1a',
    color: '#c0c8df',
    fontSize: '12px',
    textAlign: 'left',
    cursor: 'pointer',
  },
  connectorModelBtnActive: {
    color: '#dbeafe',
    borderColor: '#f97316',
    background: 'rgba(249, 115, 22, 0.14)',
  },
  connectorColorPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '7px 8px',
    borderRadius: '5px',
    border: '1px solid rgba(91, 141, 238, 0.28)',
    background: 'rgba(15, 23, 42, 0.72)',
  },
  connectorColorRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 34px 44px',
    gap: '6px',
    alignItems: 'center',
  },
  connectorColorLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    color: '#cbd5e1',
    fontSize: '11px',
    minWidth: 0,
  },
  connectorColorReset: {
    height: '28px',
    border: '1px solid #1e1e2e',
    borderRadius: '4px',
    background: '#0f0f1a',
    color: '#7f8eaa',
    fontSize: '10px',
    cursor: 'pointer',
  },
  roomToolColorRow: {
    display: 'grid',
    gridTemplateColumns: '34px minmax(0, 1fr)',
    gap: '6px',
    alignItems: 'center',
  },
  roomToolColorInput: {
    width: '34px',
    height: '29px',
    padding: '2px',
    background: '#0f0f1a',
    border: '1px solid #1e1e2e',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  roomToolRangeRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 32px',
    gap: '7px',
    alignItems: 'center',
  },
  roomToolRange: {
    width: '100%',
    accentColor: '#5b8dee',
  },
  roomToolRangeValue: {
    color: '#d0d5e8',
    fontSize: '11px',
    fontFamily: "'Share Tech Mono', monospace",
    textAlign: 'right',
  },
  roomToolSmallBtn: {
    marginTop: '8px',
    alignSelf: 'end',
    background: '#0f0f1a',
    border: '1px solid #1e1e2e',
    borderRadius: '4px',
    color: '#c8d4ee',
    fontSize: '11px',
    padding: '6px 8px',
    cursor: 'pointer',
  },
  roomToolHint: {
    marginTop: '8px',
    color: '#6f7893',
    fontSize: '11px',
    lineHeight: 1.35,
  },
  separator: {
    height: '1px',
    background: '#1e1e2e',
    margin: '0',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #1e1e2e',
    flexShrink: 0,
  },
  tab: {
    flex: 1,
    padding: '8px 0',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#4a4a60',
    cursor: 'pointer',
    fontSize: '10px',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  },
  tabActive: {
    color: '#9090a8',
    borderBottom: '2px solid #5b8dee',
  },
  tabContent: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  emptyMsg: {
    color: '#4a4a60',
    fontSize: '12px',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: '24px 12px',
    margin: 0,
  },
  message: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: '2px',
  },
  messageSystem: {
    display: 'flex',
    justifyContent: 'center',
    gap: '6px',
    alignItems: 'center',
  },
  msgSystemText: {
    fontSize: '11px',
    color: '#4a4a60',
    fontStyle: 'italic',
  },
  msgSystemErrorText: {
    fontSize: '11px',
    color: '#e05252',
    fontStyle: 'italic',
    fontWeight: 600,
  },
  msgUser: {
    fontSize: '12px',
    fontWeight: '500',
  },
  msgTime: {
    fontSize: '10px',
    color: '#4a4a60',
  },
  msgText: {
    width: '100%',
    margin: '2px 0 0',
    fontSize: '13px',
    color: '#c0c0d0',
    lineHeight: '1.4',
    wordBreak: 'break-word',
  },
  chatForm: {
    display: 'flex',
    gap: '6px',
    padding: '8px 12px',
    borderTop: '1px solid #1e1e2e',
    flexShrink: 0,
  },
  chatInput: {
    flex: 1,
    background: '#16162a',
    border: '1px solid #1e1e2e',
    borderRadius: '6px',
    padding: '6px 10px',
    color: '#c0c0d0',
    fontSize: '12px',
    outline: 'none',
  },
  persosList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '8px 12px',
  },
  persosHeader: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: '4px',
  },
  newCharForm: {
    display: 'flex',
    gap: '6px',
    marginBottom: '4px',
  },
  charCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    background: '#16162a',
    border: '1px solid #1e1e2e',
    borderRadius: '6px',
    cursor: 'grab',
  },
  charColor: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  charInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  charName: {
    fontSize: '13px',
    color: '#c0c0d0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  charOwner: {
    fontSize: '10px',
    color: '#4a4a60',
  },
  charHidden: {
    color: '#4a4a60',
    flexShrink: 0,
  },
  playersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '8px 12px',
  },
  playerCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    background: '#16162a',
    border: '1px solid #1e1e2e',
    borderRadius: '6px',
  },
  onlineDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  playerInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  playerNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  playerName: {
    fontSize: '13px',
    color: '#c0c0d0',
  },
  playerCharacter: {
    fontSize: '11px',
    color: '#4a4a60',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  onlineLabel: {
    fontSize: '10px',
    flexShrink: 0,
  },
  // ── Modale character ──
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPanel: {
    background: '#0f0f1a',
    border: '1px solid #1e1e2e',
    borderRadius: '12px',
    width: '480px',
    maxWidth: '95vw',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 16px 12px',
    borderBottom: '1px solid #1e1e2e',
  },
  modalTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  modalTitle: {
    fontSize: '15px',
    fontWeight: '500',
    color: '#c0c0d0',
  },
  savingIndicator: {
    fontSize: '12px',
    color: '#4a4a60',
  },
  nameInput: {
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid #5b8dee',
    color: '#c0c0d0',
    fontSize: '15px',
    fontWeight: '500',
    outline: 'none',
    padding: '1px 4px',
    minWidth: 0,
    width: '160px',
    fontFamily: 'inherit',
  },
  namePenBtn: {
    background: 'none',
    border: 'none',
    color: '#4a4a60',
    cursor: 'pointer',
    padding: '2px',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  modalHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  modalActionBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    color: '#4a4a60',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
  },
  illustrationPlaceholder: {
    minHeight: '100px',
    background: '#16162a',
    borderBottom: '1px solid #1e1e2e',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '8px',
  },
  illustrationText: {
    fontSize: '11px',
    color: '#4a4a60',
    fontStyle: 'italic',
  },
  portraitImg: {
    maxHeight: '180px',
    maxWidth: '100%',
    borderRadius: '6px',
    objectFit: 'contain',
  },
  uploadBtn: {
    display: 'inline-block',
    padding: '5px 12px',
    background: 'rgba(91,141,238,0.1)',
    border: '1px solid rgba(91,141,238,0.3)',
    borderRadius: '6px',
    color: '#5b8dee',
    fontSize: '11px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  // ─── Onglets éditeur (Voxels / Entités) ──
  editorTabs: {
    display: 'flex',
    gap: '4px',
    marginBottom: '2px',
  },
  editorTab: {
    flex: 1,
    padding: '5px 0',
    background: 'none',
    border: '1px solid #1e1e2e',
    borderRadius: '4px',
    color: '#4a4a60',
    cursor: 'pointer',
    fontSize: '10px',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  },
  editorTabActive: {
    color: '#9090a8',
    border: '1px solid #5b8dee',
    background: 'rgba(91,141,238,0.08)',
  },
  undoRow: {
    display: 'flex',
    gap: '6px',
    margin: '4px 0 8px',
  },
  undoBtn: {
    flex: 1,
    padding: '6px 8px',
    background: 'rgba(91,141,238,0.12)',
    border: '1px solid #5b8dee',
    borderRadius: '4px',
    color: '#dbeafe',
    cursor: 'pointer',
    fontSize: '11px',
    letterSpacing: '0.4px',
    textTransform: 'uppercase',
  },
  undoBtnDisabled: {
    background: '#0f0f1a',
    border: '1px solid #1e1e2e',
    color: '#3f4658',
    cursor: 'not-allowed',
  },
  // ─── Badge onglet Actions ──
  actionsBadge: {
    position: 'absolute',
    top: '3px',
    right: '3px',
    background: '#e05c5c',
    color: 'white',
    borderRadius: '8px',
    fontSize: '9px',
    fontWeight: '700',
    padding: '0 4px',
    minWidth: '14px',
    textAlign: 'center',
    lineHeight: '14px',
  },
  // ─── Onglet Actions — contenu ──
  actionsContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  actionsNav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  actionsNavBtn: {
    background: 'none',
    border: '1px solid #1e1e2e',
    borderRadius: '4px',
    color: '#9090a8',
    cursor: 'pointer',
    padding: '2px 8px',
    fontSize: '14px',
  },
  actionsNavCount: {
    fontSize: '11px',
    color: '#4a4a60',
  },
  arbitrageCard: {
    background: '#16162a',
    border: '1px solid #2a2a3e',
    borderRadius: '8px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  arbitrageTitle: {
    fontSize: '12px',
    color: '#c0c0d0',
    margin: 0,
  },
  arbitrageEntity: {
    fontSize: '11px',
    color: '#5b8dee',
    margin: '0 0 4px',
  },
  arbitrageRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  arbitrageLabel: {
    fontSize: '11px',
    color: '#64748b',
  },
  arbitrageValue: {
    fontSize: '12px',
    color: '#c0c0d0',
    fontFamily: 'monospace',
  },
  arbitrageInput: {
    background: '#0e0e1a',
    border: '1px solid #2a2a3e',
    borderRadius: '4px',
    color: '#c0c0d0',
    fontSize: '12px',
    padding: '3px 8px',
    width: '64px',
    textAlign: 'center',
  },
  arbitrageActions: {
    display: 'flex',
    gap: '6px',
    marginTop: '4px',
  },
  btnAccept: {
    flex: 1,
    padding: '7px 0',
    background: 'rgba(76,175,119,0.12)',
    border: '1px solid rgba(76,175,119,0.4)',
    borderRadius: '6px',
    color: '#4caf77',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: '500',
  },
  btnAuto: {
    flex: 1,
    padding: '7px 0',
    background: 'rgba(91,141,238,0.12)',
    border: '1px solid rgba(91,141,238,0.4)',
    borderRadius: '6px',
    color: '#5b8dee',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: '500',
  },
  btnRefuse: {
    flex: 1,
    padding: '7px 0',
    background: 'rgba(224,92,92,0.12)',
    border: '1px solid rgba(224,92,92,0.4)',
    borderRadius: '6px',
    color: '#e05c5c',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: '500',
  },
  modalTabs: {
    display: 'flex',
    borderBottom: '1px solid #1e1e2e',
  },
  modalTab: {
    flex: 1,
    padding: '10px 0',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#4a4a60',
    cursor: 'pointer',
    fontSize: '11px',
    letterSpacing: '1px',
    textTransform: 'uppercase',
  },
  modalTabActive: {
    color: '#9090a8',
    borderBottom: '2px solid #5b8dee',
  },
  modalContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
  },
  modalPlaceholder: {
    color: '#4a4a60',
    fontSize: '12px',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: '24px 0',
    margin: 0,
  },
  notesContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  fieldLabel: {
    fontSize: '11px',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  textarea: {
    width: '100%',
    minHeight: '100px',
    background: '#16162a',
    border: '1px solid #1e1e2e',
    borderRadius: '6px',
    padding: '10px',
    color: '#c0c0d0',
    fontSize: '12px',
    lineHeight: '1.5',
    resize: 'vertical',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  settingsContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  settingsRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  settingsValue: {
    fontSize: '13px',
    color: '#c0c0d0',
  },
  deleteCharBtn: {
    marginTop: '8px',
    padding: '10px 16px',
    background: 'rgba(224,92,92,0.12)',
    border: '1px solid rgba(224,92,92,0.4)',
    borderRadius: '6px',
    color: '#e05c5c',
    cursor: 'pointer',
    fontSize: '13px',
    width: '100%',
  },
  select: {
    background: '#16162a',
    border: '1px solid #1e1e2e',
    borderRadius: '6px',
    padding: '6px 10px',
    color: '#c0c0d0',
    fontSize: '12px',
    outline: 'none',
    cursor: 'pointer',
    width: '100%',
  },
  // ── Séparateur Profil ──
  profilSeparator: {
    height: '1px',
    background: '#1e1e2e',
    margin: '8px 0',
    flexShrink: 0,
  },
  // ── Config ──
  configContent: {
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  configTitle: {
    fontSize: '11px',
    color: '#5b8dee',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: '500',
    margin: 0,
  },
  configSuccess: {
    fontSize: '12px',
    color: '#4caf77',
    backgroundColor: 'rgba(76,175,119,0.1)',
    border: '1px solid rgba(76,175,119,0.3)',
    borderRadius: '6px',
    padding: '8px 10px',
    margin: 0,
  },
  configField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  configLabel: {
    fontSize: '11px',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  configInput: {
    background: '#16162a',
    border: '1px solid #1e1e2e',
    borderRadius: '6px',
    padding: '8px 10px',
    color: '#c0c0d0',
    fontSize: '12px',
    outline: 'none',
  },
  configColorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  configColorPicker: {
    width: '36px',
    height: '32px',
    border: '1px solid #1e1e2e',
    borderRadius: '6px',
    padding: '2px',
    backgroundColor: '#16162a',
    cursor: 'pointer',
  },
  // ── Messages dés ──
  messageDice: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    padding: '6px 8px',
    clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
    background: 'rgba(91,141,238,0.07)',
    border: '1px solid rgba(91,141,238,0.15)',
  },
  diceCritSuccess: {
    background: 'rgba(76,175,119,0.1)',
    border: '1px solid rgba(76,175,119,0.3)',
  },
  diceCritFail: {
    background: 'rgba(224,92,92,0.1)',
    border: '1px solid rgba(224,92,92,0.3)',
  },
  diceHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexWrap: 'wrap',
  },
  diceIcon: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  // diceIconAnimating est appliqué inline via style spread — animation CSS via keyframes
  // injectés dans un tag <style> dans le composant Sidebar (une seule fois, hors du map)
  diceIconAnimating: {
    animation: 'diceRoll 0.8s ease-out',
  },
  diceBody: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '5px',
    paddingLeft: '2px',
  },
  diceFormula: {
    fontSize: '12px',
    color: '#8888a8',
    fontFamily: 'monospace',
  },
  diceRolls: {
    fontSize: '11px',
    color: '#64748b',
    fontFamily: 'monospace',
  },
  diceEquals: {
    fontSize: '11px',
    color: '#4a4a60',
  },
  diceTotal: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#c0c0d0',
    fontFamily: 'monospace',
    marginLeft: 'auto',
  },
  // ── Bouton aide ──
  helpBtn: {
    position: 'absolute',
    top: '8px',
    right: '34px',
    background: 'none',
    border: '1px solid #2a2a3e',
    borderRadius: '50%',
    color: '#4a4a60',
    cursor: 'pointer',
    width: '20px',
    height: '20px',
    fontSize: '11px',
    fontWeight: '700',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  // ── Modale aide ──
  helpOverlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 200,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '40px',
    background: 'rgba(0,0,0,0.5)',
  },
  helpModal: {
    background: '#16162a',
    border: '1px solid #2a2a3e',
    borderRadius: '10px',
    padding: '16px',
    width: 'calc(100% - 32px)',
    maxHeight: 'calc(100% - 80px)',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
  },
  helpHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  helpTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#5b8dee',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  helpCloseBtn: {
    background: 'none',
    border: 'none',
    color: '#4a4a60',
    cursor: 'pointer',
    fontSize: '18px',
    lineHeight: 1,
    padding: '0 2px',
  },
  helpSection: {
    fontSize: '10px',
    color: '#4a4a60',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginTop: '8px',
    marginBottom: '4px',
  },
  helpRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '11px',
    color: '#9090a8',
    padding: '3px 0',
  },
  kbd: {
    background: '#1e1e2e',
    border: '1px solid #2a2a3e',
    borderRadius: '4px',
    padding: '2px 6px',
    fontSize: '10px',
    color: '#c0c0d0',
    fontFamily: 'monospace',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  // ── Message action entité (GM) ──
  messageAction: {
    padding: '8px 10px',
    borderRadius: '6px',
    background: 'rgba(168,85,247,0.07)',
    border: '1px solid rgba(168,85,247,0.25)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  actionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
  },
  actionIcon: {
    fontSize: '11px',
    flexShrink: 0,
  },
  actionTitle: {
    fontSize: '12px',
    color: '#c0c0d0',
    flex: 1,
  },
  actionSub: {
    fontSize: '11px',
    color: '#64748b',
    paddingLeft: '2px',
  },
  actionMeta: {
    display: 'flex',
    gap: '10px',
    fontSize: '11px',
    color: '#8888a8',
    flexWrap: 'wrap',
    paddingLeft: '2px',
  },
  actionBtns: {
    display: 'flex',
    gap: '6px',
    marginTop: '2px',
  },
  pendingBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#e05c5c',
    color: '#fff',
    borderRadius: '50%',
    width: '14px',
    height: '14px',
    fontSize: '9px',
    fontWeight: '700',
    marginLeft: '4px',
    verticalAlign: 'middle',
    lineHeight: 1,
  },
}
