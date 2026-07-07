/**
 * CharacterWindow.jsx — Fenêtre flottante fiche personnage
 *
 * Extraite de Sidebar.jsx (CharacterModal) et transformée en fenêtre
 * flottante indépendante, montée dans SessionPage comme DicePanel.
 *
 * Drag : pointerdown sur le header → pointermove/pointerup sur document.
 * Resize : pointerdown sur le handle bas-droite → pointermove/pointerup.
 * Clamp : la fenêtre ne sort pas de l'écran.
 *
 * Onglets :
 *   sheet    — Feuille de personnage (accueillera le composant React Polaris)
 *   bio      — Bio & Info : illustration + description + notes MJ
 *   settings — Paramètres : propriétaire, suppression, GLB
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useCharacterStore } from '../stores/characterStore'
import api from '../lib/api.js'
import CharacterSheet from './CharacterSheet.jsx'
import ArmorWoundPanel from './ArmorWoundPanel.jsx'
import WeaponPanel from './WeaponPanel.jsx'
import InventoryPanel from './InventoryPanel.jsx'

// ─── Constantes fenêtre ───────────────────────────────────────────────────────
const WIN_INIT_W = 720
const WIN_INIT_H = 600
const WIN_MIN_W  = 500
const WIN_MIN_H  = 400

const INITIAL_POS = {
  x: Math.max(0, Math.round((window.innerWidth  - WIN_INIT_W) / 2)),
  y: Math.max(0, Math.round((window.innerHeight - WIN_INIT_H) / 2)),
}

// ─── Icônes ───────────────────────────────────────────────────────────────────
const IconEye = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)
const IconEyeOff = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)
const IconPen = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 20h9"/>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
  </svg>
)
const IconX = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

// ─── Composant principal ──────────────────────────────────────────────────────
export default function CharacterWindow({ character, isGm, onClose, inventoryReloadKey = 0, forceReadOnly = false }) {
  const { t } = useTranslation()
  const { members, updateCharacter, removeCharacter } = useCharacterStore()

  const isOwner = character.user_id != null && character.user_id === character._currentUserId
  const effectiveIsOwner = isOwner && !forceReadOnly
  const effectiveIsGm = isGm && !forceReadOnly

  // ─── État fenêtre ──────────────────────────────────────────────────────────
  const [pos,  setPos]  = useState(INITIAL_POS)
  const [size, setSize] = useState({ w: WIN_INIT_W, h: WIN_INIT_H })

  // Refs miroirs de pos et size — lus dans les handlers sans créer de dépendances
  const posRef  = useRef(pos)
  const sizeRef = useRef(size)
  useEffect(() => { posRef.current  = pos  }, [pos])
  useEffect(() => { sizeRef.current = size }, [size])

  // ─── Drag header ──────────────────────────────────────────────────────────
  const dragState = useRef(null)

  // Handlers stables — dépendances vides, lisent pos/size via refs
  const handleDragMove = useCallback((e) => {
    if (!dragState.current) return
    const rawX = dragState.current.originX + (e.clientX - dragState.current.startX)
    const rawY = dragState.current.originY + (e.clientY - dragState.current.startY)
    setPos({
      x: Math.max(0, Math.min(rawX, window.innerWidth  - sizeRef.current.w)),
      y: Math.max(0, Math.min(rawY, window.innerHeight - sizeRef.current.h)),
    })
  }, [])

  const handleDragEnd = useCallback(() => {
    dragState.current = null
    document.removeEventListener('pointermove', handleDragMove)
    document.removeEventListener('pointerup',   handleDragEnd)
  }, [handleDragMove])

  const handleDragStart = useCallback((e) => {
    if (e.target.closest('button')) return
    e.preventDefault()
    dragState.current = {
      startX: e.clientX, startY: e.clientY,
      originX: posRef.current.x, originY: posRef.current.y,
    }
    document.addEventListener('pointermove', handleDragMove)
    document.addEventListener('pointerup',   handleDragEnd)
  }, [handleDragMove, handleDragEnd])

  // ─── Resize handle bas-droite ──────────────────────────────────────────────
  const resizeState = useRef(null)

  const handleResizeMove = useCallback((e) => {
    if (!resizeState.current) return
    const newW = Math.max(WIN_MIN_W, resizeState.current.originW + (e.clientX - resizeState.current.startX))
    const newH = Math.max(WIN_MIN_H, resizeState.current.originH + (e.clientY - resizeState.current.startY))
    setSize({
      w: Math.min(newW, window.innerWidth  - posRef.current.x),
      h: Math.min(newH, window.innerHeight - posRef.current.y),
    })
  }, [])

  const handleResizeEnd = useCallback(() => {
    resizeState.current = null
    document.removeEventListener('pointermove', handleResizeMove)
    document.removeEventListener('pointerup',   handleResizeEnd)
  }, [handleResizeMove])

  const handleResizeStart = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    resizeState.current = {
      startX: e.clientX, startY: e.clientY,
      originW: sizeRef.current.w, originH: sizeRef.current.h,
    }
    document.addEventListener('pointermove', handleResizeMove)
    document.addEventListener('pointerup',   handleResizeEnd)
  }, [handleResizeMove, handleResizeEnd])

  // Cleanup si démonté pendant drag ou resize
  useEffect(() => {
    return () => {
      document.removeEventListener('pointermove', handleDragMove)
      document.removeEventListener('pointerup',   handleDragEnd)
      document.removeEventListener('pointermove', handleResizeMove)
      document.removeEventListener('pointerup',   handleResizeEnd)
    }
  }, [handleDragMove, handleDragEnd, handleResizeMove, handleResizeEnd])

  // ─── Feedback save ────────────────────────────────────────────────────────
  const [saved,       setSaved]       = useState(false)
  const savedTimerRef = useRef(null)

  const handleSaved = useCallback(() => {
    setSaved(true)
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setSaved(false), 1000)
  }, [])

  // Cleanup timer si la fenêtre est démontée pendant le délai
  useEffect(() => {
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current) }
  }, [])

  // ─── État UI ───────────────────────────────────────────────────────────────
  const [inventoryVersion, setInventoryVersion] = useState(0)
  const bumpInventoryVersion = useCallback(() => setInventoryVersion(v => v + 1), [])

  // Reload ArmorWoundPanel/WeaponPanel/InventoryPanel quand INVENTORY_* arrive via SessionPage
  const prevInventoryKeyRef = useRef(0)
  useEffect(() => {
    if (inventoryReloadKey !== prevInventoryKeyRef.current) {
      prevInventoryKeyRef.current = inventoryReloadKey
      bumpInventoryVersion()
    }
  }, [inventoryReloadKey, bumpInventoryVersion])

  const [activeTab,   setActiveTab]   = useState('sheet')
  const [saving,      setSaving]      = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput,   setNameInput]   = useState(character.name)

  const [description, setDescription] = useState(character.description || '')
  const [gmNotes,     setGmNotes]     = useState(character.gm_notes    || '')

  const [portraitUploading, setPortraitUploading] = useState(false)
  const [glbUploading,      setGlbUploading]      = useState(false)

  // Sync si le character change depuis le store (WS CHARACTER_UPDATED)
  useEffect(() => { setNameInput(character.name) },                [character.name])
  useEffect(() => { setDescription(character.description || '') }, [character.description])
  useEffect(() => { setGmNotes(character.gm_notes     || '') },   [character.gm_notes])

  // ─── Handlers nom ─────────────────────────────────────────────────────────
  const handleNameSave = useCallback(async () => {
    const trimmed = nameInput.trim()
    setEditingName(false)
    if (!trimmed || trimmed === character.name) { setNameInput(character.name); return }
    setSaving(true)
    try {
      const res = await api.put(`/characters/${character.id}`, { name: trimmed })
      updateCharacter(res.data.character)
    } catch (err) {
      console.error('Erreur renommage character :', err)
      setNameInput(character.name)
    } finally { setSaving(false) }
  }, [nameInput, character.id, character.name, updateCharacter])

  const handleNameKeyDown = useCallback((e) => {
    if (e.code === 'Enter')  { e.preventDefault(); handleNameSave() }
    if (e.code === 'Escape') { setEditingName(false); setNameInput(character.name) }
  }, [handleNameSave, character.name])

  // ─── Handlers portrait ────────────────────────────────────────────────────
  const handlePortraitUpload = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPortraitUploading(true)
    try {
      const formData = new FormData()
      formData.append('portrait', file)
      const res = await api.post(`/characters/${character.id}/portrait`, formData)
      updateCharacter(res.data.character)
    } catch (err) {
      console.error('Erreur upload portrait :', err)
    } finally { setPortraitUploading(false); e.target.value = '' }
  }, [character.id, updateCharacter])

  // ─── Handlers description / notes MJ ─────────────────────────────────────
  const handleDescriptionBlur = useCallback(async () => {
    if (description === (character.description || '')) return
    setSaving(true)
    try {
      const res = await api.put(`/characters/${character.id}`, { description })
      updateCharacter({ id: character.id, description: res.data.character.description })
    } catch (err) { console.error('Erreur sauvegarde description :', err) }
    finally { setSaving(false) }
  }, [description, character.id, character.description, updateCharacter])

  const handleGmNotesBlur = useCallback(async () => {
    if (gmNotes === (character.gm_notes || '')) return
    setSaving(true)
    try {
      const res = await api.put(`/characters/${character.id}`, { gm_notes: gmNotes })
      updateCharacter({ id: character.id, gm_notes: res.data.character.gm_notes })
    } catch (err) { console.error('Erreur sauvegarde notes MJ :', err) }
    finally { setSaving(false) }
  }, [gmNotes, character.id, character.gm_notes, updateCharacter])

  // ─── Handler toggle visibilité ─────────────────────────────────────────────
  const handleToggleVisible = useCallback(async () => {
    try {
      const res = await api.put(`/characters/${character.id}`, { visible: !character.visible })
      updateCharacter({ id: res.data.character.id, visible: res.data.character.visible })
    } catch (err) { console.error('Erreur toggle visible :', err) }
  }, [character.id, character.visible, updateCharacter])

  // ─── Handler suppression ──────────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!window.confirm(t('character.deleteConfirm'))) return
    try {
      await api.delete(`/characters/${character.id}`)
      removeCharacter(character.id)
      onClose()
    } catch (err) { console.error('Erreur suppression character :', err) }
  }, [character.id, removeCharacter, onClose, t])

  // ─── Handler upload GLB ───────────────────────────────────────────────────
  const handleGlbUpload = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setGlbUploading(true)
    try {
      const formData = new FormData()
      formData.append('glb', file)
      const res = await api.post(`/characters/${character.id}/glb`, formData)
      updateCharacter(res.data.character)
    } catch (err) { console.error('Erreur upload GLB :', err) }
    finally { setGlbUploading(false); e.target.value = '' }
  }, [character.id, updateCharacter])

  const canEditDescription = effectiveIsGm || effectiveIsOwner
  const canUploadPortrait  = effectiveIsGm || effectiveIsOwner
  const canEditName        = effectiveIsGm || effectiveIsOwner

  // ─── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{ ...s.window, left: pos.x, top: pos.y, width: size.w, height: size.h }}
      onPointerDown={e => e.stopPropagation()}
    >

      {/* ── Header — drag zone ─────────────────────────────────────────── */}
      <div style={s.header} onPointerDown={handleDragStart}>
        <div style={s.headerLeft}>
          <div style={{ ...s.charDot, background: character.color }} />
          {editingName ? (
            <input
              style={s.nameInput}
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={handleNameKeyDown}
              autoFocus
              maxLength={64}
            />
          ) : (
            <>
              <span style={s.headerTitle}>{character.name}</span>
              {canEditName && (
                <button
                  style={s.iconBtn}
                  onClick={() => { setNameInput(character.name); setEditingName(true) }}
                  title={t('character.rename')}
                >
                  <IconPen />
                </button>
              )}
            </>
          )}
          {saving && <span style={s.savingDot}>…</span>}
          {saved  && <span style={s.savedDot}>✓</span>}
        </div>

        <div style={s.headerRight}>
          {effectiveIsGm && (
            <button
              style={{ ...s.iconBtn, color: character.visible ? '#4caf77' : '#4a4a60' }}
              onClick={handleToggleVisible}
              title={character.visible ? t('character.toggleHidden') : t('character.toggleVisible')}
            >
              {character.visible ? <IconEye /> : <IconEyeOff />}
            </button>
          )}
          <button style={s.iconBtn} onClick={onClose} title={t('common.close')}>
            <IconX />
          </button>
        </div>
      </div>

      {/* ── Onglets ────────────────────────────────────────────────────── */}
      <div style={s.tabs}>
        {['sheet', 'materiel', 'bio', 'settings'].map(tab => (
          <button
            key={tab}
            style={{ ...s.tab, ...(activeTab === tab ? s.tabActive : {}) }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'sheet'    && t('character.tabSheet')}
            {tab === 'materiel' && t('character.tabMateriel')}
            {tab === 'bio'      && t('character.tabBio')}
            {tab === 'settings' && t('character.tabSettings')}
          </button>
        ))}
      </div>

      {/* ── Contenu ────────────────────────────────────────────────────── */}
      <div style={s.content}>

        {/* Onglet Feuille */}
        {activeTab === 'sheet' && (
          <CharacterSheet
            characterId={character.id}
            isGm={effectiveIsGm}
            isOwner={effectiveIsOwner}
            onSaved={handleSaved}
          />
        )}

        {/* Onglet Matériel */}
        {activeTab === 'materiel' && (
          <>
            <ArmorWoundPanel
              characterId={character.id}
              canEdit={effectiveIsGm || effectiveIsOwner}
              reloadKey={inventoryVersion}
            />
            <WeaponPanel
              characterId={character.id}
              canEdit={effectiveIsGm || effectiveIsOwner}
              reloadKey={inventoryVersion}
              onInventoryMutated={bumpInventoryVersion}
            />
            <InventoryPanel
              characterId={character.id}
              canEdit={effectiveIsGm || effectiveIsOwner}
              isGm={effectiveIsGm}
              reloadKey={inventoryVersion}
              onInventoryMutated={bumpInventoryVersion}
            />
          </>
        )}

        {/* Onglet Bio & Info */}
        {activeTab === 'bio' && (
          <div style={s.bioLayout}>

            {/* Colonne gauche — illustration */}
            <div style={s.bioLeft}>
              <div style={s.portraitWrapper}>
                {character.portrait_url ? (
                  <img
                    src={`${import.meta.env.VITE_API_URL}/api/assets/${character.portrait_url}`}
                    alt={t('character.portraitAlt')}
                    style={s.portraitImg}
                  />
                ) : (
                  <div style={s.portraitPlaceholder}>
                    <span style={s.portraitPlaceholderText}>
                      {t('character.illustrationPlaceholder')}
                    </span>
                  </div>
                )}
              </div>
              {canUploadPortrait && (
                <label style={{
                  ...s.uploadBtn,
                  opacity: portraitUploading ? 0.5 : 1,
                  pointerEvents: portraitUploading ? 'none' : 'auto',
                }}>
                  {portraitUploading
                    ? t('character.portraitUploading')
                    : t('character.portraitUpload')}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    onChange={handlePortraitUpload}
                  />
                </label>
              )}
            </div>

            {/* Colonne droite — description + notes MJ */}
            <div style={s.bioRight}>
              <label style={s.fieldLabel}>{t('character.descriptionLabel')}</label>
              <textarea
                style={s.textarea}
                value={description}
                onChange={e => setDescription(e.target.value)}
                onBlur={handleDescriptionBlur}
                placeholder={t('character.descriptionPlaceholder')}
                readOnly={!canEditDescription}
              />

              {isGm && (
                <>
                  <div style={s.divider} />
                  <label style={{ ...s.fieldLabel, color: '#5b8dee' }}>
                    {t('character.gmNotesLabel')}
                  </label>
                  <textarea
                    style={{ ...s.textarea, borderColor: 'rgba(91,141,238,0.3)' }}
                    value={gmNotes}
                    onChange={e => setGmNotes(e.target.value)}
                    onBlur={handleGmNotesBlur}
                    placeholder={t('character.gmNotesPlaceholder')}
                    readOnly={!canEditDescription}
                  />
                </>
              )}
            </div>

          </div>
        )}

        {/* Onglet Paramètres */}
        {activeTab === 'settings' && (
          <div style={s.settingsContent}>
            <div style={s.settingsRow}>
              <span style={s.fieldLabel}>{t('character.ownerLabel')}</span>
              {effectiveIsGm ? (
                <select
                  style={s.select}
                  value={character.user_id || ''}
                  onChange={async (e) => {
                    const user_id = e.target.value || null
                    try {
                      const res = await api.put(`/characters/${character.id}`, { user_id })
                      updateCharacter(res.data.character)
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
                <span style={s.settingsValue}>
                  {character.owner_username || t('character.noOwner')}
                </span>
              )}
            </div>

            {(effectiveIsGm || effectiveIsOwner) && (
              <label style={{
                ...s.uploadBtn,
                opacity: glbUploading ? 0.5 : 1,
                pointerEvents: glbUploading ? 'none' : 'auto',
                marginTop: '8px',
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

            {effectiveIsGm && (
              <button style={s.deleteBtn} onClick={handleDelete}>
                {t('character.deleteCharacter')}
              </button>
            )}
          </div>
        )}

      </div>

      {/* ── Handle resize bas-droite ───────────────────────────────────── */}
      <div
        style={s.resizeHandle}
        onPointerDown={handleResizeStart}
        title={t('charSheet.resize')}
      />

    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  window: {
    position: 'fixed',
    zIndex: 9000,
    backgroundColor: '#16162a',
    border: '1px solid #2a2a3e',
    borderRadius: '10px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    userSelect: 'none',
    minWidth: `${WIN_MIN_W}px`,
    minHeight: `${WIN_MIN_H}px`,
  },

  // Header
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderBottom: '1px solid #2a2a3e',
    cursor: 'grab',
    flexShrink: 0,
    gap: '8px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: 0,
    flex: 1,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexShrink: 0,
  },
  charDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#c0c0d0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  nameInput: {
    background: '#0e0e1a',
    border: '1px solid #5b8dee',
    borderRadius: '4px',
    padding: '2px 8px',
    color: '#c0c0d0',
    fontSize: '13px',
    outline: 'none',
    flex: 1,
    minWidth: 0,
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    color: '#5a5a7a',
    cursor: 'pointer',
    padding: '3px',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '4px',
    flexShrink: 0,
  },
  savingDot: {
    fontSize: '11px',
    color: '#5a5a7a',
  },
  savedDot: {
    fontSize: '11px',
    color: '#4caf77',
  },

  // Onglets
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #1e1e2e',
    flexShrink: 0,
  },
  tab: {
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
  tabActive: {
    color: '#9090a8',
    borderBottom: '2px solid #5b8dee',
  },

  // Contenu
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    minHeight: 0,
  },
  placeholder: {
    color: '#4a4a60',
    fontSize: '12px',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: '24px 0',
    margin: 0,
  },

  // Onglet Bio
  bioLayout: {
    display: 'flex',
    gap: '16px',
    height: '100%',
    minHeight: 0,
  },
  bioLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flexShrink: 0,
    width: '200px',
  },
  portraitWrapper: {
    width: '200px',
    height: '260px',
    borderRadius: '6px',
    overflow: 'hidden',
    border: '1px solid #2a2a3e',
    flexShrink: 0,
  },
  portraitImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  portraitPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0e0e1a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitPlaceholderText: {
    fontSize: '11px',
    color: '#3a3a5a',
    textAlign: 'center',
    padding: '8px',
  },
  uploadBtn: {
    display: 'block',
    textAlign: 'center',
    padding: '6px 10px',
    background: 'rgba(91,141,238,0.1)',
    border: '1px solid rgba(91,141,238,0.3)',
    borderRadius: '6px',
    color: '#5b8dee',
    fontSize: '11px',
    cursor: 'pointer',
  },
  bioRight: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    minWidth: 0,
  },
  fieldLabel: {
    fontSize: '11px',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    flexShrink: 0,
  },
  textarea: {
    flex: 1,
    minHeight: '80px',
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
    width: '100%',
  },
  divider: {
    height: '1px',
    backgroundColor: '#2a2a3e',
    margin: '8px 0',
    flexShrink: 0,
  },

  // Onglet Paramètres
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
  deleteBtn: {
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

  // Handle resize
  resizeHandle: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: '16px',
    height: '16px',
    cursor: 'se-resize',
    background: 'linear-gradient(135deg, transparent 50%, #3a3a5e 50%)',
    borderRadius: '0 0 10px 0',
  },
}
