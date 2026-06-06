import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useCharacterStore } from '../stores/characterStore'
import api from '../lib/api.js'
import DroneSheet from './DroneSheet.jsx'

const WIN_INIT_W = 680
const WIN_INIT_H = 560
const WIN_MIN_W  = 480
const WIN_MIN_H  = 380

const INITIAL_POS = {
  x: Math.max(0, Math.round((window.innerWidth  - WIN_INIT_W) / 2)),
  y: Math.max(0, Math.round((window.innerHeight - WIN_INIT_H) / 2)),
}

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
export default function DroneWindow({ character, isGm, onClose }) {
  const { t } = useTranslation()
  const { members, removeCharacter } = useCharacterStore()

  const isOwner = character.user_id != null && character.user_id === character._currentUserId

  // ─── État fenêtre ──────────────────────────────────────────────────────────
  const [pos,  setPos]  = useState(INITIAL_POS)
  const [size, setSize] = useState({ w: WIN_INIT_W, h: WIN_INIT_H })

  const posRef  = useRef(pos)
  const sizeRef = useRef(size)
  useEffect(() => { posRef.current  = pos  }, [pos])
  useEffect(() => { sizeRef.current = size }, [size])

  // ─── Drag header ──────────────────────────────────────────────────────────
  const dragState = useRef(null)

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
    if (e.target.closest('button,input,select,textarea')) return
    e.preventDefault()
    dragState.current = {
      startX: e.clientX, startY: e.clientY,
      originX: posRef.current.x, originY: posRef.current.y,
    }
    document.addEventListener('pointermove', handleDragMove)
    document.addEventListener('pointerup',   handleDragEnd)
  }, [handleDragMove, handleDragEnd])

  // Cleanup si démonté pendant drag
  useEffect(() => {
    return () => {
      document.removeEventListener('pointermove', handleDragMove)
      document.removeEventListener('pointerup',   handleDragEnd)
    }
  }, [handleDragMove, handleDragEnd])

  // ─── Onglets ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('sheet')

  // ─── Données drone ─────────────────────────────────────────────────────────
  const [drone,    setDrone]    = useState(null)
  const [programs, setPrograms] = useState([])
  const [weapons,  setWeapons]  = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    let cancelled = false
    const charId = character.id
    setLoading(true)
    Promise.all([
      api.get(`/char-sheet/${charId}/drone`),
      api.get(`/char-sheet/${charId}/drone/weapons`),
    ])
      .then(([droneRes, weaponsRes]) => {
        if (cancelled) return
        setDrone(droneRes.data.drone)
        setPrograms(droneRes.data.programs || [])
        setWeapons(weaponsRes.data.weapons || [])
      })
      .catch(err => console.error('DroneWindow fetch:', err))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [character.id])

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

  useEffect(() => {
    return () => {
      document.removeEventListener('pointermove', handleResizeMove)
      document.removeEventListener('pointerup',   handleResizeEnd)
    }
  }, [handleResizeMove, handleResizeEnd])

  // ─── Rendu ─────────────────────────────────────────────────────────────────
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
          <span style={{ fontSize: '10px', color: '#4a4a60', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Drone</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isGm && (
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px', color: character.visible ? '#4caf77' : '#4a4a60' }}
              onClick={async () => {
                try {
                  await api.put(`/characters/${character.id}`, { visible: !character.visible })
                } catch (err) { console.error(err) }
              }}
              title={character.visible ? 'Masquer aux joueurs' : 'Rendre visible'}
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
        {['sheet', 'weapons', 'notes', 'settings'].map(tab => (
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
            {tab === 'sheet'    && t('drone.tabSheet')}
            {tab === 'weapons'  && t('drone.tabWeapons')}
            {tab === 'notes'    && t('drone.tabNotes')}
            {tab === 'settings' && t('drone.tabSettings')}
          </button>
        ))}
      </div>

      {/* ── Contenu ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {loading && (
          <p style={{ color: '#4a4a60', fontSize: '12px', textAlign: 'center', padding: '24px 0' }}>…</p>
        )}

        {!loading && activeTab === 'sheet' && (
          <DroneSheet
            characterId={character.id}
            drone={drone}
            programs={programs}
            isGm={isGm}
            onDroneUpdate={setDrone}
            onProgramsUpdate={setPrograms}
          />
        )}

        {!loading && activeTab === 'weapons' && (
          <WeaponsTab
            characterId={character.id}
            weapons={weapons}
            isGm={isGm}
            isOwner={isOwner}
            onWeaponsUpdate={setWeapons}
          />
        )}

        {!loading && activeTab === 'notes' && (
          <NotesTab
            characterId={character.id}
            drone={drone}
            isGm={isGm}
            onDroneUpdate={setDrone}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            character={character}
            isGm={isGm}
            members={members}
            removeCharacter={removeCharacter}
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

// ─── Onglet Paramètres ───────────────────────────────────────────────────────
function SettingsTab({ character, isGm, members, removeCharacter, onClose }) {
  const { t } = useTranslation()
  const [glbUploading, setGlbUploading] = useState(false)

  const handleOwnerChange = async (e) => {
    const user_id = e.target.value || null
    try {
      await api.put(`/characters/${character.id}`, { user_id })
    } catch (err) { console.error(err) }
  }

  const handleGlbUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setGlbUploading(true)
    try {
      const formData = new FormData()
      formData.append('glb', file)
      await api.post(`/characters/${character.id}/glb`, formData)
    } catch (err) { console.error(err) }
    finally {
      setGlbUploading(false)
      e.target.value = ''
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(t('character.deleteConfirm'))) return
    try {
      await api.delete(`/characters/${character.id}`)
      removeCharacter(character.id)
      onClose()
    } catch (err) { console.error(err) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Propriétaire */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('character.ownerLabel')}
        </label>
        {isGm ? (
          <select
            defaultValue={character.user_id || ''}
            onChange={handleOwnerChange}
            style={{ background: '#16162a', border: '1px solid #1e1e2e', borderRadius: '6px', padding: '6px 10px', color: '#c0c0d0', fontSize: '12px', outline: 'none', cursor: 'pointer' }}
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
          <span style={{ fontSize: '13px', color: '#c0c0d0' }}>
            {character.owner_username || t('character.noOwner')}
          </span>
        )}
      </div>

      {/* Upload GLB */}
      {isGm && (
        <label style={{
          display: 'inline-block',
          padding: '8px 14px',
          background: 'rgba(91,141,238,0.1)',
          border: '1px solid rgba(91,141,238,0.3)',
          borderRadius: '6px',
          color: '#5b8dee',
          fontSize: '12px',
          cursor: glbUploading ? 'default' : 'pointer',
          opacity: glbUploading ? 0.5 : 1,
          userSelect: 'none',
          alignSelf: 'flex-start',
        }}>
          {glbUploading ? t('character.glbUploading') : t('character.glbUpload')}
          <input
            type="file"
            accept=".glb"
            style={{ display: 'none' }}
            onChange={handleGlbUpload}
            disabled={glbUploading}
          />
        </label>
      )}

      {/* Suppression */}
      {isGm && (
        <button
          className="btn-danger"
          onClick={handleDelete}
          style={{ alignSelf: 'flex-start', marginTop: '8px' }}
        >
          {t('character.deleteCharacter')}
        </button>
      )}
    </div>
  )
}

// ─── Onglet Armes ─────────────────────────────────────────────────────────────
function WeaponsTab({ characterId, weapons, isGm, isOwner, onWeaponsUpdate }) {
  const { t } = useTranslation()
  const [allWeaponRefs, setAllWeaponRefs] = useState([])
  const [showPicker, setShowPicker]       = useState(false)
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    if (!isGm || !showPicker) return
    api.get('/equipment')
      .then(res => {
        const weapons = (res.data.items || [])
          .filter(i => i.family === 'Armes')
        setAllWeaponRefs(weapons)
      })
      .catch(err => console.error('DroneWindow equipment fetch:', err))
  }, [isGm, showPicker])

  const handleAdd = async (equipmentId) => {
    try {
      const res = await api.post(`/char-sheet/${characterId}/drone/weapons`, { equipment_id: equipmentId })
      onWeaponsUpdate(prev => [...prev, res.data.weapon])
      setShowPicker(false)
    } catch (err) { console.error(err) }
  }

  const handleDelete = async (weaponId) => {
    try {
      await api.delete(`/char-sheet/${characterId}/drone/weapons/${weaponId}`)
      onWeaponsUpdate(prev => prev.filter(w => w.id !== weaponId))
    } catch (err) { console.error(err) }
  }

  const handleUpdate = async (weaponId, field, value) => {
    setSaving(weaponId)
    try {
      const res = await api.put(`/char-sheet/${characterId}/drone/weapons/${weaponId}`, { [field]: value })
      onWeaponsUpdate(prev => prev.map(w => w.id === weaponId ? res.data.weapon : w))
    } catch (err) { console.error(err) }
    finally { setSaving(null) }
  }

  const canEdit = isGm || isOwner

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {weapons.length === 0 && (
        <p style={{ color: '#4a4a60', fontSize: '12px', fontStyle: 'italic', textAlign: 'center', padding: '16px 0' }}>
          {t('drone.noWeapons')}
        </p>
      )}

      {weapons.map(w => (
        <div key={w.id} style={{ background: '#16162a', border: '1px solid #2a2a3e', borderRadius: '6px', padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            {canEdit ? (
              <input
                defaultValue={w.label_override || ''}
                placeholder={w.ref_name}
                onBlur={e => {
                  const val = e.target.value.trim() || null
                  if (val !== (w.label_override || null)) handleUpdate(w.id, 'label_override', val)
                }}
                style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #2a2a3e', color: '#c0c0d0', fontSize: '13px', fontWeight: '500', outline: 'none', width: '60%' }}
              />
            ) : (
              <span style={{ fontSize: '13px', fontWeight: '500', color: '#c0c0d0' }}>
                {w.label_override || w.ref_name}
              </span>
            )}
            {isGm && (
              <button className="btn-ghost" style={{ fontSize: '11px', padding: '2px 8px' }} onClick={() => handleDelete(w.id)}>
                {t('drone.deleteWeapon')}
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '4px', fontSize: '11px', color: '#8888a8' }}>
            <span>{t('drone.weaponDamage')} : <strong style={{ color: '#c0c0d0' }}>{w.ref_damage_h || '—'}</strong></span>
            <span>{t('drone.weaponRange')} : <strong style={{ color: '#c0c0d0' }}>{w.ref_range || '—'}</strong></span>
            <span>{t('drone.weaponFireMode')} : <strong style={{ color: '#c0c0d0' }}>{w.ref_fire_mode || '—'}</strong></span>
            <span>{t('drone.weaponAmmo')} : <strong style={{ color: w.ammo_restant === 0 ? '#e05c5c' : '#c0c0d0' }}>
              {w.ammo_restant ?? '—'}
            </strong></span>
          </div>

          {canEdit && (
            <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '11px', color: '#8888a8' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {t('drone.weaponMag')} :
                <input
                  type="number"
                  defaultValue={w.contenance_chargeur}
                  min={0}
                  onBlur={e => {
                    const val = parseInt(e.target.value, 10)
                    if (!isNaN(val) && val !== w.contenance_chargeur) handleUpdate(w.id, 'contenance_chargeur', val)
                  }}
                  style={{ width: '52px', background: '#0e0e1a', border: '1px solid #2a2a3e', borderRadius: '4px', color: '#c0c0d0', fontSize: '11px', padding: '2px 6px', textAlign: 'center' }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {t('drone.weaponAmmo')} :
                <input
                  type="number"
                  defaultValue={w.ammo_restant ?? ''}
                  min={0}
                  onBlur={e => {
                    const val = e.target.value === '' ? null : parseInt(e.target.value, 10)
                    if (val !== w.ammo_restant) handleUpdate(w.id, 'ammo_restant', val)
                  }}
                  style={{ width: '52px', background: '#0e0e1a', border: '1px solid #2a2a3e', borderRadius: '4px', color: w.ammo_restant === 0 ? '#e05c5c' : '#c0c0d0', fontSize: '11px', padding: '2px 6px', textAlign: 'center' }}
                />
              </label>
              {saving === w.id && <span style={{ color: '#4a4a60' }}>{t('drone.saving')}</span>}
            </div>
          )}
        </div>
      ))}

      {isGm && !showPicker && (
        <button className="btn" onClick={() => setShowPicker(true)} style={{ marginTop: '4px' }}>
          {t('drone.addWeapon')}
        </button>
      )}

      {isGm && showPicker && (
        <div style={{ background: '#16162a', border: '1px solid #2a2a3e', borderRadius: '6px', padding: '10px' }}>
          <p style={{ fontSize: '11px', color: '#8888a8', marginBottom: '8px' }}>{t('drone.selectWeapon')}</p>
          {allWeaponRefs.length === 0 && (
            <p style={{ fontSize: '11px', color: '#4a4a60' }}>…</p>
          )}
          <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {allWeaponRefs.map(ref => (
              <button
                key={ref.id}
                onClick={() => handleAdd(ref.id)}
                style={{ background: 'none', border: '1px solid #2a2a3e', borderRadius: '4px', color: '#c0c0d0', fontSize: '12px', padding: '6px 10px', textAlign: 'left', cursor: 'pointer' }}
              >
                {ref.name}
                {ref.damage_h && <span style={{ color: '#8888a8', marginLeft: '8px' }}>{ref.damage_h}</span>}
              </button>
            ))}
          </div>
          <button className="btn-ghost" onClick={() => setShowPicker(false)} style={{ marginTop: '8px', fontSize: '11px' }}>
            {t('drone.cancel') || 'Annuler'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Onglet Notes ─────────────────────────────────────────────────────────────
function NotesTab({ characterId, drone, isGm, onDroneUpdate }) {
  const { t } = useTranslation()
  const [equipSpecial, setEquipSpecial] = useState(drone?.equip_special || '')
  const [notesMj,      setNotesMj]      = useState(drone?.notes_gm || '')

  const handleBlur = async (field, value) => {
    if (!isGm) return
    const current = field === 'equip_special' ? drone?.equip_special : drone?.notes_gm
    if (value === (current || '')) return
    try {
      const res = await api.put(`/char-sheet/${characterId}/drone`, { [field]: value || null })
      onDroneUpdate(res.data.drone)
    } catch (err) { console.error(err) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <label style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>
          {t('drone.fieldEquipSpecial')}
        </label>
        <textarea
          value={equipSpecial}
          onChange={e => setEquipSpecial(e.target.value)}
          onBlur={e => handleBlur('equip_special', e.target.value)}
          readOnly={!isGm}
          style={{ width: '100%', minHeight: '80px', background: '#16162a', border: '1px solid #1e1e2e', borderRadius: '6px', padding: '8px', color: '#c0c0d0', fontSize: '12px', resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
      </div>
      {isGm && (
        <div>
          <label style={{ fontSize: '11px', color: '#5b8dee', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>
            {t('drone.fieldNotesMj')}
          </label>
          <textarea
            value={notesMj}
            onChange={e => setNotesMj(e.target.value)}
            onBlur={e => handleBlur('notes_gm', e.target.value)}
            style={{ width: '100%', minHeight: '100px', background: '#16162a', border: '1px solid rgba(91,141,238,0.3)', borderRadius: '6px', padding: '8px', color: '#c0c0d0', fontSize: '12px', resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        </div>
      )}
    </div>
  )
}
