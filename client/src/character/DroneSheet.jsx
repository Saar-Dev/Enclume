import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { WOUND_MAX_COUNTS } from '../../../shared/woundConstants.js'
import api from '../lib/api.js'

const toRoman = n => (['I','II','III','IV','V','VI','VII','VIII'][n - 1] ?? '—')

// ─── Section stats descriptives ───────────────────────────────────────────────
function StatField({ label, value, display, field, isGm, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value ?? '')

  const handleBlur = () => {
    setEditing(false)
    const parsed = draft === '' ? null : (isNaN(Number(draft)) ? draft : Number(draft))
    if (parsed !== (value ?? null)) onSave(field, parsed)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      {isGm ? (
        <input
          value={editing ? draft : (value ?? '')}
          onFocus={() => { setDraft(value ?? ''); setEditing(true) }}
          onChange={e => setDraft(e.target.value)}
          onBlur={handleBlur}
          style={{ background: '#0e0e1a', border: '1px solid #1e1e2e', borderRadius: '4px', color: '#c0c0d0', fontSize: '12px', padding: '4px 8px', outline: 'none', width: '100%', boxSizing: 'border-box' }}
        />
      ) : (
        <span style={{ fontSize: '12px', color: '#c0c0d0', padding: '4px 0' }}>{display ?? value ?? '—'}</span>
      )}
    </div>
  )
}

// ─── Section intégrité ────────────────────────────────────────────────────────
function IntegritySection({ characterId, drone, isGm, onDroneUpdate }) {
  const { t } = useTranslation()
  const [draftInt,   setDraftInt]   = useState('')
  const [editingInt, setEditingInt] = useState(false)

  if (!drone) return null

  const locRef  = drone.localisation_ref || 'corps'
  const counts  = WOUND_MAX_COUNTS[locRef] || WOUND_MAX_COUNTS['corps']
  const damages = drone.damages && typeof drone.damages === 'object' && !Array.isArray(drone.damages)
    ? drone.damages
    : {}

  const severities = ['legere', 'moyenne', 'grave', 'critique', 'mortelle']
  const severityColors = {
    legere: '#FFD700', moyenne: '#FFA500', grave: '#FF6B6B', critique: '#FF0000', mortelle: '#8B0000',
  }

  const handleToggle = async (severity, idx) => {
    if (!isGm) return
    const current = damages[severity] || Array(counts[severity]).fill(false)
    const next    = [...current]
    next[idx]     = !next[idx]
    const newDamages = { ...damages, [severity]: next }
    try {
      const res = await api.put(`/char-sheet/${characterId}/drone/integrity`, { damages: newDamages })
      onDroneUpdate(res.data.drone)
    } catch (err) { console.error(err) }
  }

  const handleIntegriteBlur = async () => {
    setEditingInt(false)
    const val = parseInt(draftInt, 10)
    if (isNaN(val) || val === drone.integrite_actuelle) return
    try {
      const res = await api.put(`/char-sheet/${characterId}/drone/integrity`, { integrite_actuelle: val })
      onDroneUpdate(res.data.drone)
    } catch (err) { console.error(err) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <span style={{ fontSize: '12px', color: '#c0c0d0' }}>
          {t('drone.fieldIntegriteActuelle')} :&nbsp;
          {isGm ? (
            <input
              type="number"
              value={editingInt ? draftInt : (drone.integrite_actuelle ?? '')}
              onFocus={() => { setDraftInt(String(drone.integrite_actuelle ?? '')); setEditingInt(true) }}
              onChange={e => setDraftInt(e.target.value)}
              onBlur={handleIntegriteBlur}
              min={0}
              style={{ width: '40px', background: '#0e0e1a', border: '1px solid #2a2a3e', borderRadius: '4px', color: '#c0c0d0', fontSize: '12px', padding: '2px 4px', textAlign: 'center', outline: 'none' }}
            />
          ) : (
            <strong>{drone.integrite_actuelle ?? '—'}</strong>
          )}
          &nbsp;/ {drone.integrite_max ?? '—'}
        </span>
      </div>
      {severities.map(sev => {
        const total   = counts[sev] || 0
        const checked = damages[sev] || Array(total).fill(false)
        return (
          <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: severityColors[sev], width: '54px', flexShrink: 0, textTransform: 'capitalize' }}>{sev}</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {Array.from({ length: total }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => handleToggle(sev, i)}
                  disabled={!isGm}
                  style={{
                    width: '16px', height: '16px',
                    borderRadius: '3px',
                    border: `1px solid ${severityColors[sev]}66`,
                    background: checked[i] ? severityColors[sev] : 'transparent',
                    cursor: isGm ? 'pointer' : 'default',
                    padding: 0,
                  }}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Section programmes ───────────────────────────────────────────────────────
const PROGRAM_CATEGORIES = [
  'detection', 'ami_ennemi', 'armement_distance', 'armement_contact', 'esquive',
  'securite', 'offensif', 'contre_attaque', 'rempart',
  'pilotage', 'analyse', 'medical', 'communication', 'specialise',
]

// Groupes d'affichage pour le select catalogue uniquement.
// Les catégories DB restent inchangées — regroupement visuel seulement.
const DISPLAY_GROUPS = [
  { key: 'detection',        categories: ['detection'] },
  { key: 'ami_ennemi',       categories: ['ami_ennemi'] },
  { key: 'armement', categories: ['armement_distance', 'armement_contact'] },
  { key: 'esquive',          categories: ['esquive'] },
  { key: 'duel_ordinateurs', categories: ['securite', 'offensif', 'contre_attaque', 'rempart'] },
  { key: 'pilotage',         categories: ['pilotage'] },
  { key: 'analyse',          categories: ['analyse'] },
  { key: 'medical',          categories: ['medical'] },
  { key: 'communication',    categories: ['communication'] },
  { key: 'specialise',       categories: ['specialise'] },
]

function ProgramsSection({ characterId, programs, isGm, onProgramsUpdate }) {
  const { t } = useTranslation()
  const [catalog,          setCatalog]          = useState([])
  const [mode,             setMode]             = useState('catalog')
  const [selectedId,       setSelectedId]       = useState('')
  const [newCustomLabel,   setNewCustomLabel]   = useState('')
  const [newCustomCategory,setNewCustomCategory] = useState('specialise')
  const [newLevel,         setNewLevel]         = useState('')
  const [adding,           setAdding]           = useState(false)
  const [tooltip,          setTooltip]          = useState(null)

  useEffect(() => {
    api.get('/equipment', { params: { family: 'Logiciels' } })
      .then(res => setCatalog(res.data.items || []))
      .catch(console.error)
  }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    const level = parseInt(newLevel, 10)
    if (isNaN(level) || level < 0 || level > 30) return
    if (mode === 'catalog' && !selectedId) return
    if (mode === 'custom' && !newCustomLabel.trim()) return

    setAdding(true)
    try {
      const payload = mode === 'catalog'
        ? { equipment_id: selectedId, level }
        : { label_override: newCustomLabel.trim(), category: newCustomCategory, level }

      const res = await api.post(`/char-sheet/${characterId}/drone/programs`, payload)
      onProgramsUpdate(prev => [...prev, res.data.program])
      setSelectedId('')
      setNewCustomLabel('')
      setNewLevel('')
    } catch (err) { console.error(err) }
    finally { setAdding(false) }
  }

  const handleLevelUpdate = async (programId, value) => {
    try {
      const res = await api.put(`/char-sheet/${characterId}/drone/programs/${programId}`, { level: value })
      onProgramsUpdate(prev => prev.map(p => p.id === programId ? res.data.program : p))
    } catch (err) { console.error(err) }
  }

  const handleDelete = async (programId) => {
    try {
      await api.delete(`/char-sheet/${characterId}/drone/programs/${programId}`)
      onProgramsUpdate(prev => prev.filter(p => p.id !== programId))
    } catch (err) { console.error(err) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {programs.length === 0 && (
        <p style={{ fontSize: '12px', color: '#4a4a60', fontStyle: 'italic' }}>{t('drone.noPrograms')}</p>
      )}

      {programs.map(p => {
        const displayName = p.program_name || p.label_override || '—'
        const displayDesc = p.program_description || null
        return (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', borderBottom: '1px solid #1e1e2e' }}>
            <span
              style={{ flex: 1, fontSize: '12px', color: '#c0c0d0', cursor: displayDesc ? 'help' : 'default' }}
              onMouseEnter={displayDesc ? (e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                setTooltip({ text: displayDesc, top: rect.top, left: rect.left + rect.width / 2 })
              } : undefined}
              onMouseLeave={displayDesc ? () => setTooltip(null) : undefined}
            >
              {displayName}
            </span>
            <span style={{ fontSize: '10px', color: '#5b8dee', background: '#1a1a2e', borderRadius: '3px', padding: '1px 5px', flexShrink: 0 }}>
              {t(`drone.category.${p.category}`, p.category)}
            </span>
            {isGm ? (
              <input
                type="number"
                defaultValue={p.level}
                min={0} max={30}
                onBlur={e => {
                  const val = parseInt(e.target.value, 10)
                  if (!isNaN(val) && val !== p.level) handleLevelUpdate(p.id, val)
                }}
                style={{ width: '44px', background: '#0e0e1a', border: '1px solid #2a2a3e', borderRadius: '4px', color: '#c0c0d0', fontSize: '12px', padding: '2px 6px', textAlign: 'center' }}
              />
            ) : (
              <span style={{ fontSize: '12px', color: '#5b8dee', fontFamily: 'monospace' }}>{p.level}</span>
            )}
            {isGm && (
              <button
                onClick={() => handleDelete(p.id)}
                style={{ background: 'none', border: 'none', color: '#4a4a60', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}
                title={t('drone.deleteProgram')}
              >×</button>
            )}
          </div>
        )
      })}

      {tooltip && (
        <div style={{
          position: 'fixed',
          backgroundColor: '#0a0a14',
          border: '1px solid #2a2a4e',
          borderRadius: '6px',
          padding: '8px 10px',
          fontSize: '11px',
          color: '#a0a0c0',
          maxWidth: '280px',
          zIndex: 9999,
          top: tooltip.top,
          left: tooltip.left,
          transform: 'translate(-50%, calc(-100% - 8px))',
          pointerEvents: 'none',
          lineHeight: '1.5',
        }}>
          {tooltip.text}
        </div>
      )}

      {isGm && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
            <button
              type="button"
              className={`btn-toggle${mode === 'catalog' ? ' active' : ''}`}
              onClick={() => setMode('catalog')}
            >{t('drone.programCatalog')}</button>
            <button
              type="button"
              className={`btn-toggle${mode === 'custom' ? ' active' : ''}`}
              onClick={() => setMode('custom')}
            >{t('drone.programCustom')}</button>
          </div>

          <form onSubmit={handleAdd} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {mode === 'catalog' ? (
              <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                style={{ flex: 1, background: '#16162a', border: '1px solid #1e1e2e', borderRadius: '4px', color: selectedId ? '#c0c0d0' : '#4a4a60', fontSize: '12px', padding: '4px 8px', outline: 'none' }}
              >
                <option value="" style={{ background: '#16162a', color: '#4a4a60' }}>{t('drone.programCatalog')}…</option>
                {DISPLAY_GROUPS
                  .filter(group => group.categories.some(cat => catalog.some(item => item.category === cat)))
                  .map(group => (
                    <optgroup key={group.key} label={t(`drone.category.${group.key}`, group.key)} style={{ background: '#1a1a2e', color: '#5b8dee' }}>
                      {group.categories.flatMap(cat => catalog.filter(item => item.category === cat)).map(item => (
                        <option key={item.id} value={item.id} title={item.description || ''} style={{ background: '#16162a', color: '#c0c0d0' }}>{item.name}</option>
                      ))}
                    </optgroup>
                  ))
                }
              </select>
            ) : (
              <>
                <input
                  value={newCustomLabel}
                  onChange={e => setNewCustomLabel(e.target.value)}
                  placeholder={t('drone.programCustomLabel')}
                  style={{ flex: 1, background: '#16162a', border: '1px solid #1e1e2e', borderRadius: '4px', color: '#c0c0d0', fontSize: '12px', padding: '4px 8px', outline: 'none' }}
                />
                <select
                  value={newCustomCategory}
                  onChange={e => setNewCustomCategory(e.target.value)}
                  style={{ background: '#16162a', border: '1px solid #1e1e2e', borderRadius: '4px', color: '#c0c0d0', fontSize: '12px', padding: '4px 6px', outline: 'none' }}
                >
                  {PROGRAM_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{t(`drone.category.${cat}`, cat)}</option>
                  ))}
                </select>
              </>
            )}
            <input
              type="number"
              value={newLevel}
              onChange={e => setNewLevel(e.target.value)}
              placeholder={t('drone.programLevel')}
              min={0} max={30}
              style={{ width: '52px', background: '#16162a', border: '1px solid #1e1e2e', borderRadius: '4px', color: '#c0c0d0', fontSize: '12px', padding: '4px 6px', textAlign: 'center', outline: 'none' }}
            />
            <button
              type="submit"
              className="btn-icon"
              disabled={adding || !newLevel || (mode === 'catalog' ? !selectedId : !newCustomLabel.trim())}
              style={{ color: 'var(--color-primary)' }}
            >✓</button>
          </form>
        </div>
      )}
    </div>
  )
}

// ─── Composant principal DroneSheet ──────────────────────────────────────────
export default function DroneSheet({ characterId, drone, programs, isGm, onDroneUpdate, onProgramsUpdate }) {
  const { t } = useTranslation()

  const handleSave = async (field, value) => {
    try {
      const res = await api.put(`/char-sheet/${characterId}/drone`, { [field]: value })
      onDroneUpdate(res.data.drone)
    } catch (err) { console.error(err) }
  }

  if (!drone) {
    return (
      <p style={{ color: '#4a4a60', fontSize: '12px', fontStyle: 'italic', textAlign: 'center', padding: '24px 0' }}>
        Aucune fiche drone trouvée.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Stats descriptives */}
      <section>
        <h4 style={{ fontSize: '10px', color: '#5b8dee', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px', fontWeight: '600' }}>
          {t('drone.sectionStats')}
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          <StatField label={t('drone.fieldTaille')}        value={drone.taille}           field="taille"           isGm={isGm} onSave={handleSave} />
          <StatField label={t('drone.fieldPoids')}         value={drone.poids}            field="poids"            isGm={isGm} onSave={handleSave} />
          <StatField label={t('drone.fieldVitesse')}       value={drone.vitesse}          field="vitesse"          isGm={isGm} onSave={handleSave} />
          <StatField label={t('drone.fieldNt')}            value={drone.nt}               display={toRoman(drone.nt)} field="nt" isGm={isGm} onSave={handleSave} />
          <StatField label={t('drone.fieldSourceEnergie')} value={drone.source_energie}   field="source_energie"   isGm={isGm} onSave={handleSave} />
          <StatField label={t('drone.fieldAutonomie')}     value={drone.autonomie}        field="autonomie"        isGm={isGm} onSave={handleSave} />
          <StatField label={t('drone.fieldModeDepl')}      value={drone.mode_deplacement} field="mode_deplacement" isGm={isGm} onSave={handleSave} />
          <StatField label={t('drone.fieldProfondeur')}    value={drone.profondeur_max}   field="profondeur_max"   isGm={isGm} onSave={handleSave} />
          <StatField label={t('drone.fieldDisponibilite')} value={drone.disponibilite}    field="disponibilite"    isGm={isGm} onSave={handleSave} />
          <StatField label={t('drone.fieldBlindag')}       value={drone.blindage}         field="blindage"         isGm={isGm} onSave={handleSave} />
          <StatField label={t('drone.fieldBlindageIem')}   value={drone.blindage_iem}     field="blindage_iem"     isGm={isGm} onSave={handleSave} />
          <StatField label={t('drone.fieldArmure')}        value={drone.armure_materiau}  field="armure_materiau"  isGm={isGm} onSave={handleSave} />
          <StatField label={t('drone.fieldOrdGen')}        value={drone.ordinateur_gen}   field="ordinateur_gen"   isGm={isGm} onSave={handleSave} />
          <StatField label={t('drone.fieldOrdNt')}         value={drone.ordinateur_nt}    field="ordinateur_nt"    isGm={isGm} onSave={handleSave} />
          <StatField label={t('drone.fieldEchelle')}       value={drone.echelle}          field="echelle"          isGm={isGm} onSave={handleSave} />
        </div>
      </section>

      {/* Intégrité */}
      <section>
        <h4 style={{ fontSize: '10px', color: '#5b8dee', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px', fontWeight: '600' }}>
          {t('drone.sectionIntegrity')}
        </h4>
        <IntegritySection
          characterId={characterId}
          drone={drone}
          isGm={isGm}
          onDroneUpdate={onDroneUpdate}
        />
      </section>

      {/* Programmes */}
      <section>
        <h4 style={{ fontSize: '10px', color: '#5b8dee', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px', fontWeight: '600' }}>
          {t('drone.sectionPrograms')}
        </h4>
        <ProgramsSection
          characterId={characterId}
          programs={programs}
          isGm={isGm}
          onProgramsUpdate={onProgramsUpdate}
        />
      </section>

    </div>
  )
}
