import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api.js'
import { useEntityStore } from '../stores/entityStore'

// ─── EntityInstancePanel ───────────────────────────────────────────────────────
// Panneau flottant GM — configuration d'une instance d'entité posée sur la carte.
// Modifie uniquement l'INSTANCE (pas le blueprint).
//
// Champs éditables :
//   label_override          — surcharge du nom affiché (vide = nom du blueprint)
//   gm_only                 — visible uniquement du GM
//   disabled_interactions   — interactions désactivées sur cette instance
//   notes_gm                — notes privées du GM
//
// Le panneau est déplaçable par drag sur son header.
// Fermeture : clic extérieur ou Échap.

const PANEL_W = 300
const PANEL_H_EST = 420

export default function EntityInstancePanel({ entity, x, y, onClose }) {
  const { t } = useTranslation()
  const { updateEntity } = useEntityStore()
  const panelRef = useRef(null)
  const blueprint = entity.blueprint

  // ─── Positionnement initial ───────────────────────────────────────────────
  const initLeft = Math.max(8, Math.min(window.innerWidth  - PANEL_W - 8, x))
  const initTop  = Math.max(8, Math.min(window.innerHeight - PANEL_H_EST - 8, y))
  const [pos, setPos] = useState({ left: initLeft, top: initTop })

  // ─── Drag header ─────────────────────────────────────────────────────────
  const dragRef = useRef(null)

  const handleHeaderMouseDown = (e) => {
    if (e.button !== 0) return
    dragRef.current = { startX: e.clientX, startY: e.clientY, left: pos.left, top: pos.top }
    e.preventDefault()
  }

  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current) return
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      setPos({
        left: Math.max(8, Math.min(window.innerWidth  - PANEL_W - 8, dragRef.current.left + dx)),
        top:  Math.max(8, Math.min(window.innerHeight - 60,           dragRef.current.top  + dy)),
      })
    }
    const onUp = () => { dragRef.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [])

  // ─── Fermeture sur clic extérieur et Échap ────────────────────────────────
  useEffect(() => {
    const onMouseDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose()
    }
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown',   onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown',   onKey)
    }
  }, [onClose])

  // ─── État local formulaire ────────────────────────────────────────────────
  const [labelOverride,        setLabelOverride]        = useState(entity.label_override || '')
  const [gmOnly,               setGmOnly]               = useState(entity.gm_only || false)
  const [currentStateId,       setCurrentStateId]       = useState(entity.current_state_id ?? 0)
  const [disabledInteractions, setDisabledInteractions] = useState(entity.disabled_interactions || [])
  const [notesGm,              setNotesGm]              = useState(entity.notes_gm || '')
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  const toggleInteraction = (id) => {
    setDisabledInteractions(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const res = await api.put(`/entities/${entity.id}`, {
        label_override:        labelOverride.trim() || null,
        gm_only:               gmOnly,
        current_state_id:      currentStateId,
        disabled_interactions: disabledInteractions,
        notes_gm:              notesGm.trim() || null,
      })
      updateEntity({
        id:                    entity.id,
        label_override:        res.data.entity.label_override,
        gm_only:               res.data.entity.gm_only,
        current_state_id:      res.data.entity.current_state_id,
        disabled_interactions: res.data.entity.disabled_interactions,
        notes_gm:              res.data.entity.notes_gm,
        updated_at:            res.data.entity.updated_at,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (err) {
      console.error('[EntityInstancePanel] Erreur sauvegarde :', err)
    } finally {
      setSaving(false)
    }
  }, [entity.id, labelOverride, gmOnly, currentStateId, disabledInteractions, notesGm, updateEntity])

  const interactions = blueprint?.interactions || []

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left:     pos.left,
        top:      pos.top,
        width:    PANEL_W,
        zIndex:   10001,
        background:   '#0e0e1a',
        border:       '1px solid #2a2a3e',
        borderRadius: '10px',
        boxShadow:    '0 8px 32px rgba(0,0,0,0.7)',
        overflow: 'hidden',
        animation: 'panelOpen 0.15s ease-out forwards',
      }}
    >
      <style>{`
        @keyframes panelOpen {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Header draggable ── */}
      <div
        onMouseDown={handleHeaderMouseDown}
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '10px 14px',
          borderBottom:   '1px solid #1e1e2e',
          background:     '#0a0a14',
          cursor:         'grab',
          userSelect:     'none',
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: '12px', color: '#5b8dee', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Configuration
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#4a4a60' }}>
            {blueprint?.label || '?'}
          </p>
        </div>
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#4a4a60', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '4px' }}
        >
          ✕
        </button>
      </div>

      {/* ── Corps ── */}
      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Nom affiché */}
        <div style={S.field}>
          <label style={S.label}>Nom affiché</label>
          <input
            style={S.input}
            value={labelOverride}
            onChange={e => setLabelOverride(e.target.value)}
            placeholder={blueprint?.label || t('entityPanel.placeholderName')}
            maxLength={64}
          />
          <p style={S.hint}>Vide = nom du blueprint</p>
        </div>

        {/* GM only */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            onClick={() => setGmOnly(v => !v)}
            style={{
              width: '34px', height: '18px', borderRadius: '9px',
              background: gmOnly ? '#5b8dee' : '#1e1e2e',
              border: `1px solid ${gmOnly ? '#5b8dee' : '#2a2a3e'}`,
              cursor: 'pointer', position: 'relative',
              transition: 'background 0.15s', flexShrink: 0,
            }}
          >
            <div style={{
              position: 'absolute', top: '2px',
              left: gmOnly ? '17px' : '2px',
              width: '12px', height: '12px',
              borderRadius: '50%', background: '#fff',
              transition: 'left 0.15s',
            }} />
          </div>
          <span style={{ fontSize: '12px', color: '#c0c0d0' }}>Visible GM uniquement</span>
        </div>

        {/* État actuel — sélecteur si blueprint a plusieurs états */}
        {(blueprint?.states || []).length > 1 && (
          <div style={S.field}>
            <label style={S.label}>État actuel</label>
            <select
              style={{ ...S.input, cursor: 'pointer' }}
              value={currentStateId}
              onChange={e => setCurrentStateId(Number(e.target.value))}
            >
              {blueprint.states.map(state => (
                <option key={state.id} value={state.id}>
                  {state.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Interactions actives/désactivées */}
        {interactions.length > 0 && (
          <div style={S.field}>
            <label style={S.label}>Interactions actives</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
              {interactions.map(interaction => {
                const isDisabled = disabledInteractions.includes(interaction.id)
                return (
                  <div
                    key={interaction.id}
                    onClick={() => toggleInteraction(interaction.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '5px 8px', borderRadius: '5px', cursor: 'pointer',
                      background: isDisabled ? 'rgba(224,92,92,0.06)' : 'rgba(76,175,119,0.06)',
                      border: `1px solid ${isDisabled ? 'rgba(224,92,92,0.2)' : 'rgba(76,175,119,0.2)'}`,
                    }}
                  >
                    <span style={{ fontSize: '11px', color: isDisabled ? '#e05c5c' : '#4caf77' }}>
                      {isDisabled ? '✕' : '✓'}
                    </span>
                    <span style={{ fontSize: '12px', color: '#c0c0d0', flex: 1 }}>
                      {interaction.action_label}
                    </span>
                    <span style={{ fontSize: '10px', color: '#4a4a60' }}>
                      DC{interaction.difficulty_dc}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Notes GM */}
        <div style={S.field}>
          <label style={S.label}>Notes GM</label>
          <textarea
            style={{ ...S.input, minHeight: '60px', resize: 'vertical' }}
            value={notesGm}
            onChange={e => setNotesGm(e.target.value)}
            placeholder={t('entityPanel.placeholderNotes')}
          />
        </div>

        {/* Sauvegarde */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '8px 0', borderRadius: '6px', border: 'none',
            background: saved ? 'rgba(76,175,119,0.2)' : 'rgba(91,141,238,0.15)',
            color:      saved ? '#4caf77' : '#5b8dee',
            fontSize: '12px', fontWeight: '500',
            cursor: saving ? 'default' : 'pointer',
            transition: 'background 0.2s, color 0.2s',
          }}
        >
          {saving ? t('entityPanel.saving') : saved ? t('entityPanel.saved') : t('common.save')}
        </button>
      </div>
    </div>
  )
}

const S = {
  field: { display: 'flex', flexDirection: 'column', gap: '4px' },
  label: { fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
  hint:  { margin: 0, fontSize: '10px', color: '#3a3a52' },
  input: {
    background: '#0a0a14', border: '1px solid #1e1e2e', borderRadius: '5px',
    padding: '7px 10px', color: '#c0c0d0', fontSize: '12px',
    outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
  },
}
