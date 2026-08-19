/**
 * ExoSheetWindow.jsx — Fenêtre flottante fiche exo-armure
 *
 * Patron repris de DroneWindow.jsx (fiche PK=character_id, pas de pipeline char_sheet) et de la
 * découpe en onglets/panneaux de CharacterWindow.jsx — un onglet par bloc de la fiche RAW officielle
 * (docs/PLANS/PLAN_EXOARMURE.md §8/§10, image de référence Saar 2026-08-19). Tous les onglets sont
 * posés dès maintenant ; ceux dont le service serveur n'existe pas encore (Avaries/Incidents Lot 5,
 * Systèmes Lot 5e, Ordinateur — aucune colonne en base) affichent un stub explicite plutôt qu'une
 * fonctionnalité muette.
 *
 * Drag/resize : identique à DroneWindow/CharacterWindow (pointerdown header/handle → document).
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useCharacterStore } from '../stores/characterStore'
import api from '../lib/api.js'
import ExoIdentityPanel from './ExoIdentityPanel.jsx'
import ExoIntegrityPanel from './ExoIntegrityPanel.jsx'
import ExoSettingsPanel from './ExoSettingsPanel.jsx'

const WIN_INIT_W = 680
const WIN_INIT_H = 560
const WIN_MIN_W  = 480
const WIN_MIN_H  = 380

const INITIAL_POS = {
  x: Math.max(0, Math.round((window.innerWidth  - WIN_INIT_W) / 2)),
  y: Math.max(0, Math.round((window.innerHeight - WIN_INIT_H) / 2)),
}

const TABS = ['identity', 'integrity', 'avaries', 'systems', 'computer', 'settings']

// ─── Icônes ───────────────────────────────────────────────────────────────────
const IconX = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
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

// ─── Composant principal ──────────────────────────────────────────────────────
export default function ExoSheetWindow({ character, isGm, onClose }) {
  const { t } = useTranslation()
  const { characters } = useCharacterStore()

  const isOwner = character.user_id != null && character.user_id === character._currentUserId
  const canEdit = isGm || isOwner

  // ─── État fenêtre ──────────────────────────────────────────────────────────
  const [pos,  setPos]  = useState(INITIAL_POS)
  const [size, setSize] = useState({ w: WIN_INIT_W, h: WIN_INIT_H })

  const posRef  = useRef(pos)
  const sizeRef = useRef(size)
  useEffect(() => { posRef.current  = pos  }, [pos])
  useEffect(() => { sizeRef.current = size }, [size])

  // ─── Drag header ──────────────────────────────────────────────────────────
  const dragState    = useRef(null)
  const dragAbortRef  = useRef(null)

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
    dragAbortRef.current?.abort()
    dragAbortRef.current = null
  }, [])

  const handleDragStart = useCallback((e) => {
    if (e.target.closest('button,input,select,textarea')) return
    e.preventDefault()
    dragState.current = {
      startX: e.clientX, startY: e.clientY,
      originX: posRef.current.x, originY: posRef.current.y,
    }
    const controller = new AbortController()
    dragAbortRef.current = controller
    document.addEventListener('pointermove', handleDragMove, { signal: controller.signal })
    document.addEventListener('pointerup',   handleDragEnd,  { signal: controller.signal })
  }, [handleDragMove, handleDragEnd])

  useEffect(() => {
    return () => dragAbortRef.current?.abort()
  }, [])

  // ─── Onglets ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('identity')

  // ─── Données exo ───────────────────────────────────────────────────────────
  const [exo,       setExo]       = useState(null)
  const [templates, setTemplates] = useState([])
  const [loading,    setLoading]  = useState(true)

  useEffect(() => {
    let cancelled = false
    const charId = character.id
    setLoading(true)
    Promise.all([
      api.get(`/char-sheet/${charId}/exo`),
      api.get('/exo-templates'),
    ])
      .then(([exoRes, templatesRes]) => {
        if (cancelled) return
        setExo(exoRes.data.exo)
        setTemplates(templatesRes.data.templates || [])
      })
      .catch(err => console.error('ExoSheetWindow fetch:', err))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [character.id])

  // ─── Resize handle bas-droite ──────────────────────────────────────────────
  const resizeState    = useRef(null)
  const resizeAbortRef  = useRef(null)

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
    resizeAbortRef.current?.abort()
    resizeAbortRef.current = null
  }, [])

  const handleResizeStart = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    resizeState.current = {
      startX: e.clientX, startY: e.clientY,
      originW: sizeRef.current.w, originH: sizeRef.current.h,
    }
    const controller = new AbortController()
    resizeAbortRef.current = controller
    document.addEventListener('pointermove', handleResizeMove, { signal: controller.signal })
    document.addEventListener('pointerup',   handleResizeEnd,  { signal: controller.signal })
  }, [handleResizeMove, handleResizeEnd])

  useEffect(() => {
    return () => resizeAbortRef.current?.abort()
  }, [])

  // ─── Handler visibilité ─────────────────────────────────────────────────────
  const handleToggleVisible = useCallback(async () => {
    try {
      await api.put(`/characters/${character.id}`, { visible: !character.visible })
    } catch (err) { console.error(err) }
  }, [character.id, character.visible])

  const pilotCandidates = characters.filter(c => ['pj', 'pnj'].includes(c.type))

  return (
    <div style={{
      position: 'fixed',
      left: pos.x,
      top:  pos.y,
      width:  size.w,
      height: size.h,
      zIndex: 500,
      display: 'flex',
      flexDirection: 'column',
      background: '#0f0f1a',
      border: '1px solid #2a2a3e',
      borderRadius: '10px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      overflow: 'hidden',
    }}>

      {/* ── Header drag ── */}
      <div
        onPointerDown={handleDragStart}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px 8px',
          borderBottom: '1px solid #1e1e2e',
          cursor: 'grab',
          flexShrink: 0,
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: character.color, flexShrink: 0 }} />
          <span style={{ fontSize: '14px', fontWeight: '500', color: '#c0c0d0' }}>{character.name}</span>
          <span style={{ fontSize: '10px', color: '#4a4a60', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {t('drone.typeArmor')}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isGm && (
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px', color: character.visible ? '#4caf77' : '#4a4a60' }}
              onClick={handleToggleVisible}
              title={character.visible ? t('character.toggleHidden') : t('character.toggleVisible')}
            >
              {character.visible ? <IconEye /> : <IconEyeOff />}
            </button>
          )}
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px', color: '#4a4a60' }}
            onClick={onClose}
          >
            <IconX />
          </button>
        </div>
      </div>

      {/* ── Onglets ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1e1e2e', flexShrink: 0 }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '8px 0',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${activeTab === tab ? '#5b8dee' : 'transparent'}`,
              color: activeTab === tab ? '#9090a8' : '#4a4a60',
              cursor: 'pointer',
              fontSize: '10px',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            {t(`exo.tab${tab.charAt(0).toUpperCase()}${tab.slice(1)}`)}
          </button>
        ))}
      </div>

      {/* ── Contenu ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {loading && (
          <p style={{ color: '#4a4a60', fontSize: '12px', textAlign: 'center', padding: '24px 0' }}>…</p>
        )}

        {!loading && !exo && (
          <p style={{ color: '#e05c5c', fontSize: '12px', textAlign: 'center', padding: '24px 0' }}>
            {t('exo.sheetMissing')}
          </p>
        )}

        {!loading && exo && activeTab === 'identity' && (
          <ExoIdentityPanel
            characterId={character.id}
            exo={exo}
            templates={templates}
            pilotCandidates={pilotCandidates}
            canEdit={canEdit}
            onExoUpdate={setExo}
          />
        )}

        {!loading && exo && activeTab === 'integrity' && (
          <ExoIntegrityPanel
            characterId={character.id}
            exo={exo}
            canEdit={canEdit}
            onExoUpdate={setExo}
          />
        )}

        {!loading && exo && ['avaries', 'systems', 'computer'].includes(activeTab) && (
          <p style={{ color: '#4a4a60', fontSize: '12px', fontStyle: 'italic', textAlign: 'center', padding: '24px 0' }}>
            {t('exo.comingSoon')}
          </p>
        )}

        {!loading && exo && activeTab === 'settings' && (
          <ExoSettingsPanel
            character={character}
            isGm={isGm}
            isOwner={isOwner}
            onClose={onClose}
          />
        )}
      </div>

      {/* ── Resize handle ── */}
      <div
        onPointerDown={handleResizeStart}
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: '16px',
          height: '16px',
          cursor: 'se-resize',
          zIndex: 10,
        }}
      />
    </div>
  )
}
