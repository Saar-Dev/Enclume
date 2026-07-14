import { useRef, useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../stores/authStore'
import { useCharacterStore } from '../stores/characterStore'
import { useSessionStore } from '../stores/sessionStore'
import { useEntityStore } from '../stores/entityStore'
import { useCombatStore } from '../stores/combatStore'
import api from '../lib/api.js'
import { WS } from '../../../shared/events.js'
import GeometryIcon from './GeometryIcon.jsx'
import LibraryPanel from './LibraryPanel.jsx'
import { DeclareLogContent } from './CombatDeclareLog.jsx'
import {
  DEFAULT_SURFACE_MATERIAL_PRESET,
  PROCEDURAL_MATERIAL_PRESETS,
  PROCEDURAL_PATTERN_PRESETS,
} from '../lib/proceduralMaterials.js'

const SIDEBAR_MIN = 220
const SIDEBAR_MAX = 500
const SIDEBAR_CLOSE_THRESHOLD = 160

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
  const canEditGmNotes = isGm
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
  canSurfaceUndo, canSurfaceRedo, onSurfaceUndo, onSurfaceRedo,
  campaignId,
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
  const messages = messagesByCampaign[activeCampaignId] || []
  const { blueprints } = useEntityStore()
  const { phase, currentTurn } = useCombatStore()

  const surfaceToolState = {
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
    ...surfaceTool,
  }
  const updateSurfaceTool = (patch) => onSurfaceToolChange?.({ ...surfaceToolState, ...patch })
  const surfaceMaterialState = {
    ...DEFAULT_SURFACE_MATERIAL_PRESET,
    ...(surfaceToolState.materialPreset || {}),
  }
  const surfacePaintValue = /^#[0-9a-f]{6}$/i.test(String(surfaceMaterialState.paint || ''))
    ? surfaceMaterialState.paint
    : DEFAULT_SURFACE_MATERIAL_PRESET.paint
  const updateSurfaceMaterial = (patch) => updateSurfaceTool({
    surfaceMaterialMode: 'procedural',
    materialPreset: { ...surfaceMaterialState, ...patch },
  })

  const [activeTab, setActiveTab] = useState('chat')
  const [toolsOpen, setToolsOpen] = useState(false)
  const [pendingActionCount, setPendingActionCount] = useState(0)
  const prevEntityActionCountRef = useRef(0)
  const prevSellRequestCountRef    = useRef(0)
  const prevExchangeOfferCountRef  = useRef(0)
  const [chatInput, setChatInput] = useState('')
  const [showHelp, setShowHelp] = useState(false)

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
            {mode === 'edit' ? <IconEdit /> : <IconPlay />}
            <span style={{ fontSize:'9px', letterSpacing:'0.5px', textTransform:'uppercase' }}>{mode === 'edit' ? t('session.modeEdit') : t('session.modePlay')}</span>
          </button>
        )}

        {isGm && (
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

        <div style={{ position: 'relative' }}>
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
        </div>
      </div>

      {/* ─── PALETTE TEXTURES (mode édition) ─────────────────────────────── */}
      {mode === 'edit' && (
        <div style={styles.palette}>
          {/* ── Onglets éditeur : Voxels / Entités ── */}
          <div style={styles.editorTabs}>
            <button
              style={{ ...styles.editorTab, ...(activeEditorTab === 'voxel' ? styles.editorTabActive : {}) }}
              onClick={() => onEditorTabChange?.('voxel')}
            >
              {t('sidebar.editorTabVoxels')}
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
              title={t('sidebar.surfaceTool.undoTitle')}
              style={{
                ...styles.undoBtn,
                ...(!canSurfaceUndo ? styles.undoBtnDisabled : {}),
              }}
            >
              ↶ {t('sidebar.surfaceTool.undo')}
            </button>
            <button
              type="button"
              onClick={() => canSurfaceRedo && onSurfaceRedo?.()}
              disabled={!canSurfaceRedo}
              title={t('sidebar.surfaceTool.redoTitle')}
              style={{
                ...styles.undoBtn,
                ...(!canSurfaceRedo ? styles.undoBtnDisabled : {}),
              }}
            >
              ↷ {t('sidebar.surfaceTool.redo')}
            </button>
          </div>

          {/* ── Palette voxels — visible uniquement en onglet Voxels ── */}
          {activeEditorTab === 'voxel' && (
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
                    onClick={() => updateSurfaceTool({ mode: 'floor' })}
                    style={{
                      ...styles.roomToolModeBtn,
                      ...(surfaceToolState.mode === 'floor' ? styles.roomToolModeBtnActive : {}),
                    }}
                  >
                    {t('sidebar.surfaceTool.modeFloor')}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSurfaceTool({ mode: 'wall' })}
                    style={{
                      ...styles.roomToolModeBtn,
                      ...(surfaceToolState.mode === 'wall' ? styles.roomToolModeBtnActive : {}),
                    }}
                  >
                    {t('sidebar.surfaceTool.modeWall')}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSurfaceTool({ mode: 'stair' })}
                    style={{
                      ...styles.roomToolModeBtn,
                      ...(surfaceToolState.mode === 'stair' ? styles.roomToolModeBtnActive : {}),
                    }}
                  >
                    {t('sidebar.surfaceTool.modeStair')}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSurfaceTool({ mode: 'ceiling' })}
                    style={{
                      ...styles.roomToolModeBtn,
                      ...(surfaceToolState.mode === 'ceiling' ? styles.roomToolModeBtnActive : {}),
                    }}
                  >
                    {t('sidebar.surfaceTool.modeCeiling')}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSurfaceTool({ mode: 'erase' })}
                    style={{
                      ...styles.roomToolModeBtn,
                      ...(surfaceToolState.mode === 'erase' ? styles.roomToolModeBtnActive : {}),
                    }}
                  >
                    {t('sidebar.surfaceTool.modeErase')}
                  </button>
                </div>
                <div style={styles.roomToolGrid}>
                  <label style={styles.roomToolLabel}>
                    <span>{t('sidebar.surfaceTool.elevation')}</span>
                    <input
                      type="number"
                      min="-8"
                      max="16"
                      step="0.5"
                      value={surfaceToolState.elevation}
                      onChange={e => updateSurfaceTool({ elevation: Number(e.target.value) })}
                      style={styles.roomToolInput}
                    />
                  </label>
                  {surfaceToolState.mode === 'floor' && (
                    <label style={styles.roomToolLabel}>
                      <span>{t('sidebar.surfaceTool.floorThickness')}</span>
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
                  {surfaceToolState.mode === 'ceiling' && (
                    <>
                      <label style={styles.roomToolLabel}>
                        <span>{t('sidebar.surfaceTool.ceilingHeight')}</span>
                        <input
                          type="number"
                          min="0.25"
                          max="16"
                          step="0.25"
                          value={surfaceToolState.ceilingHeight ?? surfaceToolState.wallHeight}
                          onChange={e => updateSurfaceTool({ ceilingHeight: Number(e.target.value) })}
                          style={styles.roomToolInput}
                        />
                      </label>
                      <label style={styles.roomToolLabel}>
                        <span>{t('sidebar.surfaceTool.ceilingThickness')}</span>
                        <input
                          type="number"
                          min="0.05"
                          max="4"
                          step="0.05"
                          value={surfaceToolState.ceilingThickness ?? surfaceToolState.floorThickness}
                          onChange={e => updateSurfaceTool({ ceilingThickness: Number(e.target.value) })}
                          style={styles.roomToolInput}
                        />
                      </label>
                    </>
                  )}
                  {surfaceToolState.mode === 'stair' && (
                    <label style={styles.roomToolLabel}>
                      <span>{t('sidebar.surfaceTool.stairRise')}</span>
                      <input
                        type="number"
                        min="0.25"
                        max="12"
                        step="0.25"
                        value={surfaceToolState.stairRise}
                        onChange={e => updateSurfaceTool({ stairRise: Number(e.target.value) })}
                        style={styles.roomToolInput}
                      />
                    </label>
                  )}
                </div>
                {surfaceToolState.mode === 'wall' && (
                  <div style={styles.roomToolGrid}>
                    <label style={styles.roomToolLabel}>
                      <span>{t('sidebar.surfaceTool.wallThickness')}</span>
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
                      <span>{t('sidebar.surfaceTool.wallHeight')}</span>
                      <input
                        type="number"
                        min="0.5"
                        max="8"
                        step="0.5"
                        value={surfaceToolState.wallHeight}
                        onChange={e => updateSurfaceTool({ wallHeight: Number(e.target.value) })}
                        style={styles.roomToolInput}
                      />
                    </label>
                  </div>
                )}
                {surfaceToolState.mode !== 'erase' && (
                  <>
                    <div style={styles.roomToolSectionTitle}>{t('sidebar.surfaceTool.materialSectionTitle')}</div>
                    <div style={styles.roomToolGrid}>
                      <label style={styles.roomToolLabel}>
                        <span>{t('sidebar.surfaceTool.material')}</span>
                        <select
                          value={surfaceMaterialState.material}
                          onChange={e => updateSurfaceMaterial({ material: e.target.value })}
                          style={styles.roomToolSelect}
                        >
                          {PROCEDURAL_MATERIAL_PRESETS.map(preset => (
                            <option key={preset.id} value={preset.id}>{t(`sidebar.surfaceTool.materials.${preset.id}`)}</option>
                          ))}
                        </select>
                      </label>
                      <label style={styles.roomToolLabel}>
                        <span>{t('sidebar.surfaceTool.pattern')}</span>
                        <select
                          value={surfaceMaterialState.pattern}
                          onChange={e => updateSurfaceMaterial({ pattern: e.target.value })}
                          style={styles.roomToolSelect}
                        >
                          {PROCEDURAL_PATTERN_PRESETS.map(pattern => (
                            <option key={pattern.id} value={pattern.id}>{t(`sidebar.surfaceTool.patterns.${pattern.id}`)}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label style={styles.roomToolLabel}>
                      <span>{t('sidebar.surfaceTool.paint')}</span>
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
                      ['wear', t('sidebar.surfaceTool.wear')],
                      ['dirt', t('sidebar.surfaceTool.dirt')],
                      ['relief', t('sidebar.surfaceTool.relief')],
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
                      <span>{t('sidebar.surfaceTool.realRelief')}</span>
                      <span style={styles.roomToolToggleState}>
                        {surfaceMaterialState.realRelief !== false ? t('sidebar.surfaceTool.realReliefOn') : t('sidebar.surfaceTool.realReliefOff')}
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
                      <span>{t('sidebar.surfaceTool.autoVariants')}</span>
                      <span style={styles.roomToolToggleState}>
                        {surfaceToolState.autoVariants ? t('sidebar.surfaceTool.autoVariantsOn') : t('sidebar.surfaceTool.autoVariantsOff')}
                      </span>
                    </button>
                    <div style={styles.roomToolGrid}>
                      <label style={styles.roomToolLabel}>
                        <span>{t('sidebar.surfaceTool.blocking')}</span>
                        <select
                          value={surfaceToolState.surfaceBlocking || surfaceToolState.wallBlocking || 'solid'}
                          onChange={e => updateSurfaceTool({ surfaceBlocking: e.target.value })}
                          style={styles.roomToolSelect}
                        >
                          <option value="solid">{t('sidebar.surfaceTool.blockingSolid')}</option>
                          <option value="glass">{t('sidebar.surfaceTool.blockingGlass')}</option>
                          <option value="grate">{t('sidebar.surfaceTool.blockingGrate')}</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => updateSurfaceMaterial({ seed: `mat-${Date.now().toString(36)}` })}
                        style={styles.roomToolSmallBtn}
                      >
                        {t('sidebar.surfaceTool.newVariation')}
                      </button>
                    </div>
                  </>
                )}
                <div style={styles.roomToolHint}>
                  {surfaceToolState.mode === 'wall'
                    ? t('sidebar.surfaceTool.hintWall')
                    : surfaceToolState.mode === 'ceiling'
                      ? t('sidebar.surfaceTool.hintCeiling')
                    : surfaceToolState.mode === 'stair'
                      ? t('sidebar.surfaceTool.hintStair')
                    : surfaceToolState.mode === 'erase'
                      ? t('sidebar.surfaceTool.hintErase')
                      : t('sidebar.surfaceTool.hintFloor')}
                </div>
              </div>
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

          {/* ── Onglet Entités — palette blueprints ── */}
          {activeEditorTab === 'entity' && (() => {
            const bpList = Object.values(blueprints).filter(bp => !bp.deprecated)
            return (
              <div style={{ marginTop: '6px' }}>
                <div style={styles.paletteTitle}>{t('sidebar.paletteEntities')}</div>
                {bpList.length === 0 && (
                  <p style={{ color: '#5a5a7a', fontSize: '12px', padding: '8px' }}>
                    {t('sidebar.noBlueprints')}
                  </p>
                )}
                {bpList.map(bp => {
                  const isActive = activeBlueprint?.id === bp.id
                  return (
                    <button
                      key={bp.id}
                      onClick={() => onBlueprintSelect?.(isActive ? null : bp)}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '7px 10px',
                        background: isActive ? 'rgba(91,141,238,0.18)' : 'none',
                        border: 'none',
                        borderBottom: '1px solid #1a1a2e',
                        borderLeft: isActive ? '2px solid #5b8dee' : '2px solid transparent',
                        color: isActive ? '#5b8dee' : '#c0c0d0',
                        fontSize: '12px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                    >
                      {bp.label}
                    </button>
                  )
                })}
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
    background: '#0f0f1a',
    borderLeft: '1px solid #1e1e2e',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
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
    borderColor: '#5b8dee',
    backgroundColor: 'rgba(91,141,238,0.08)',
  },
  // ─── Undo/redo surfaces ──
  undoRow: {
    display: 'flex',
    gap: '4px',
    marginBottom: '6px',
  },
  undoBtn: {
    flex: 1,
    padding: '5px 0',
    background: 'none',
    border: '1px solid #1e1e2e',
    borderRadius: '4px',
    color: '#9090a8',
    cursor: 'pointer',
    fontSize: '11px',
  },
  undoBtnDisabled: {
    color: '#4a4a60',
    cursor: 'default',
  },
  // ─── Barre d'outils sculptage de surfaces (sol/mur/plafond/escalier) ──
  roomTool: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '8px',
    marginBottom: '10px',
    background: '#16162a',
    border: '1px solid #1e1e2e',
    borderRadius: '6px',
  },
  roomToolModes: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
  },
  roomToolModeBtn: {
    flex: '1 0 auto',
    padding: '5px 8px',
    background: 'none',
    border: '1px solid #1e1e2e',
    borderRadius: '4px',
    color: '#9090a8',
    cursor: 'pointer',
    fontSize: '11px',
  },
  roomToolModeBtnActive: {
    color: '#c0c0d0',
    borderColor: '#5b8dee',
    backgroundColor: 'rgba(91,141,238,0.12)',
  },
  roomToolGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '6px',
  },
  roomToolLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    fontSize: '10px',
    color: '#64748b',
  },
  roomToolInput: {
    background: '#0e0e1a',
    border: '1px solid #1e1e2e',
    borderRadius: '4px',
    padding: '4px 6px',
    color: '#c0c0d0',
    fontSize: '11px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  roomToolSelect: {
    background: '#0e0e1a',
    border: '1px solid #1e1e2e',
    borderRadius: '4px',
    padding: '4px 6px',
    color: '#c0c0d0',
    fontSize: '11px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  roomToolSectionTitle: {
    fontSize: '10px',
    color: '#4a4a60',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginTop: '2px',
  },
  roomToolColorRow: {
    display: 'flex',
    gap: '6px',
  },
  roomToolColorInput: {
    width: '28px',
    height: '24px',
    padding: '1px',
    border: '1px solid #1e1e2e',
    borderRadius: '4px',
    background: '#0e0e1a',
    cursor: 'pointer',
  },
  roomToolRangeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  roomToolRange: {
    flex: 1,
    accentColor: '#5b8dee',
  },
  roomToolRangeValue: {
    fontSize: '10px',
    color: '#64748b',
    fontFamily: 'monospace',
    minWidth: '26px',
    textAlign: 'right',
  },
  roomToolToggle: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '5px 8px',
    background: 'none',
    border: '1px solid #1e1e2e',
    borderRadius: '4px',
    color: '#9090a8',
    cursor: 'pointer',
    fontSize: '11px',
  },
  roomToolToggleActive: {
    color: '#c0c0d0',
    borderColor: '#5b8dee',
    backgroundColor: 'rgba(91,141,238,0.08)',
  },
  roomToolToggleState: {
    fontSize: '10px',
    color: '#64748b',
  },
  roomToolSmallBtn: {
    padding: '5px 8px',
    background: 'none',
    border: '1px solid #1e1e2e',
    borderRadius: '4px',
    color: '#9090a8',
    cursor: 'pointer',
    fontSize: '10px',
  },
  roomToolHint: {
    fontSize: '10px',
    color: '#4a4a60',
    lineHeight: 1.4,
    fontStyle: 'italic',
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
