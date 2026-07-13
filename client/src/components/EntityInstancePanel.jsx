import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api.js'
import { useEntityStore } from '../stores/entityStore'
import { WS } from '../../../shared/events.js'
import {
  clearMaterialSlotOverride,
  materialSlotDisplayValue,
  normalizeModelMaterialSlots,
  setMaterialSlotOverride,
} from '../lib/modelMaterialSlots.js'

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

const MODEL_SLOT_LABELS = {
  SLOT_01: 'Métal principal',
  SLOT_02: 'Panneaux secondaires',
  SLOT_03: 'Cadre / hardware',
  SLOT_04: 'Accent',
  SLOT_05: 'Verre',
}

function normalizeEntityState(state) {
  return state && typeof state === 'object' && !Array.isArray(state) ? state : {}
}

export default function EntityInstancePanel({ entity, x, y, onClose, socket = null, editorMode = false }) {
  const { t } = useTranslation()
  const { updateEntity } = useEntityStore()
  const panelRef = useRef(null)
  const blueprint = entity.blueprint
  const placementMode = blueprint?.geometry?.placementMode || blueprint?.geometry?.placement_mode || 'free'
  const isWallPlaced = placementMode === 'wall'

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
      if (!editorMode && panelRef.current && !panelRef.current.contains(e.target)) onClose()
    }
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown',   onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown',   onKey)
    }
  }, [editorMode, onClose])

  // ─── État local formulaire ────────────────────────────────────────────────
  const [labelOverride,        setLabelOverride]        = useState(entity.label_override || '')
  const [gmOnly,               setGmOnly]               = useState(entity.gm_only || false)
  const [currentStateId,       setCurrentStateId]       = useState(entity.current_state_id ?? 0)
  const [disabledInteractions, setDisabledInteractions] = useState(entity.disabled_interactions || [])
  const [notesGm,              setNotesGm]              = useState(entity.notes_gm || '')
  const [posX,                 setPosX]                 = useState(String(entity.pos_x ?? 0))
  const [posY,                 setPosY]                 = useState(String(entity.pos_y ?? 0))
  const [posZ,                 setPosZ]                 = useState(String(entity.pos_z ?? 0))
  const [rotation,             setRotation]             = useState(Number(entity.r) || 0)
  const baseEntityState = normalizeEntityState(entity.state)
  const [materialOverrides, setMaterialOverrides] = useState(
    baseEntityState.materialOverrides || baseEntityState.material_overrides || {},
  )
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const materialSlots = normalizeModelMaterialSlots(blueprint?.geometry)

  useEffect(() => {
    setPosX(String(entity.pos_x ?? 0))
    setPosY(String(entity.pos_y ?? 0))
    setPosZ(String(entity.pos_z ?? 0))
    setRotation(Number(entity.r) || 0)
  }, [entity.id, entity.pos_x, entity.pos_y, entity.pos_z, entity.r])

  const toggleInteraction = (id) => {
    setDisabledInteractions(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const updateMaterialSlot = (slot, patch) => {
    setMaterialOverrides(prev => setMaterialSlotOverride(prev, slot, patch))
  }

  const clearMaterialSlot = (slot) => {
    setMaterialOverrides(prev => clearMaterialSlotOverride(prev, slot))
  }

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const nextPosX = Number.isFinite(Number(posX)) ? Number(posX) : Number(entity.pos_x) || 0
      const nextPosY = Number.isFinite(Number(posY)) ? Number(posY) : Number(entity.pos_y) || 0
      const nextPosZ = Number.isFinite(Number(posZ)) ? Number(posZ) : Number(entity.pos_z) || 0
      const nextRotation = Math.max(0, Math.min(3, Number.parseInt(rotation, 10) || 0))
      const transformChanged = nextPosX !== Number(entity.pos_x)
        || nextPosY !== Number(entity.pos_y)
        || nextPosZ !== Number(entity.pos_z)
        || nextRotation !== Number(entity.r)
      const res = await api.put(`/entities/${entity.id}`, {
        pos_x:                  nextPosX,
        pos_y:                  nextPosY,
        pos_z:                  nextPosZ,
        r:                      nextRotation,
        label_override:        labelOverride.trim() || null,
        gm_only:               gmOnly,
        current_state_id:      currentStateId,
        disabled_interactions: disabledInteractions,
        state:                 { ...normalizeEntityState(entity.state), materialOverrides },
        notes_gm:              notesGm.trim() || null,
      })
      updateEntity(res.data.entity)
      if (transformChanged) {
        socket?.emit(WS.ENTITY_MOVED, {
          entityId: entity.id,
          pos_x: res.data.entity.pos_x,
          pos_y: res.data.entity.pos_y,
          pos_z: res.data.entity.pos_z,
          r: res.data.entity.r,
          updated_at: res.data.entity.updated_at,
        })
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (err) {
      console.error('[EntityInstancePanel] Erreur sauvegarde :', err)
    } finally {
      setSaving(false)
    }
  }, [entity, posX, posY, posZ, rotation, labelOverride, gmOnly, currentStateId, disabledInteractions, materialOverrides, notesGm, updateEntity, socket])

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
        maxHeight: 'calc(100vh - 16px)',
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
      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: 'calc(100vh - 92px)' }}>

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

        <div style={S.field}>
          <label style={S.label}>Position et rotation</label>
          <div style={S.transformGrid}>
            <label style={S.compactField}>
              <span>X</span>
              <input type="number" step="0.25" value={posX} onChange={e => setPosX(e.target.value)} style={S.input} disabled={isWallPlaced} />
            </label>
            <label style={S.compactField}>
              <span>Z</span>
              <input type="number" step="0.25" value={posY} onChange={e => setPosY(e.target.value)} style={S.input} disabled={isWallPlaced} />
            </label>
            <label style={S.compactField}>
              <span>Altitude</span>
              <input type="number" step="0.125" value={posZ} onChange={e => setPosZ(e.target.value)} style={S.input} disabled={isWallPlaced} />
            </label>
          </div>
          <select
            style={{ ...S.input, cursor: 'pointer' }}
            value={rotation}
            onChange={e => setRotation(Number(e.target.value))}
            disabled={isWallPlaced}
          >
            <option value={0}>0 deg</option>
            <option value={1}>90 deg</option>
            <option value={2}>180 deg</option>
            <option value={3}>270 deg</option>
          </select>
          {editorMode && isWallPlaced && (
            <p style={S.hint}>Objet mural : position et orientation suivent le mur. Fais-le glisser vers un autre emplacement mural.</p>
          )}
          {editorMode && !isWallPlaced && <p style={S.hint}>Tu peux aussi faire glisser l'objet directement sur la carte.</p>}
        </div>

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

        {/* Couleurs du modèle 3D */}
        {materialSlots.length > 0 && (
          <div style={S.field}>
            <label style={S.label}>Couleurs du modèle 3D</label>
            <div style={S.slotList}>
              {materialSlots.map(slot => {
                const slotValue = materialSlotDisplayValue(materialOverrides, slot)
                return (
                  <label key={slot.code} style={S.slotRow}>
                    <span style={S.slotLabel}>
                      {MODEL_SLOT_LABELS[slot.code] || slot.label}
                      <small>{slot.code}</small>
                    </span>
                    <input
                      type="color"
                      value={slotValue.color}
                      onChange={e => updateMaterialSlot(slot, { color: e.target.value })}
                      style={S.colorInput}
                    />
                    <button type="button" onClick={() => clearMaterialSlot(slot)} style={S.resetBtn}>
                      Reset
                    </button>
                  </label>
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
  slotList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '7px 8px',
    borderRadius: '6px',
    border: '1px solid rgba(91, 141, 238, 0.25)',
    background: 'rgba(15, 23, 42, 0.55)',
  },
  transformGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '6px',
  },
  compactField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    color: '#7f8eaa',
    fontSize: '10px',
  },
  slotRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 34px 44px',
    gap: '6px',
    alignItems: 'center',
  },
  slotLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    color: '#cbd5e1',
    fontSize: '11px',
    minWidth: 0,
  },
  colorInput: {
    width: '34px',
    height: '29px',
    padding: '2px',
    background: '#0f0f1a',
    border: '1px solid #1e1e2e',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  resetBtn: {
    height: '28px',
    border: '1px solid #1e1e2e',
    borderRadius: '4px',
    background: '#0f0f1a',
    color: '#7f8eaa',
    fontSize: '10px',
    cursor: 'pointer',
  },
}
