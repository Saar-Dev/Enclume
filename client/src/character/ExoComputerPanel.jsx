/**
 * ExoComputerPanel.jsx — Onglet Ordinateur de ExoSheetWindow
 *
 * Liste `exo_computers` (0, 1 ou 2 lignes — principal/secours, PLAN_EXOARMURE.md §13.4.1) + leurs
 * `exo_programs` respectifs, imbriqués sous chaque ordinateur — mirror exact de la fiche RAW réelle
 * (FDEA.webp, bloc "ORDINATEUR" : Type de matériel / Niv. max/Gestion systèmes/Potentiel / Génération/
 * Blindage IEM/Intégrité / "Programmes" en sous-liste du même bloc, jamais une section à part).
 *
 * Relation principal/secours (précision Saar 2026-08-21, computerStats.js) : le secours n'est actif
 * QUE si le principal est HS — `resolveActiveComputer` calcule lequel l'est réellement, affiché comme
 * badge Actif/En veille plutôt que deux entrées équivalentes.
 *
 * Programmes scopés par ordinateur (`exo_computer_id`, migration 258) : Potentiel/Niveau max sont des
 * propriétés du MATÉRIEL précis (RAW, REGLE_ORDINATEUR.md:11,16), pas de l'armure entière — chaque
 * carte ordinateur a donc sa propre liste et son propre budget, jamais une liste globale.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api.js'
import { computeOrdinateurStats, computeBlindageIemCost, resolveActiveComputer } from '../../../shared/computerStats.js'
import { EXO_COMPUTER_ROLE_VALUES } from '../../../shared/exoConstants.js'

function ProgramsList({ computer, programs, catalog, canEdit, onProgramsChange, characterId }) {
  const { t } = useTranslation()
  const [mode, setMode] = useState('catalog')
  const [selectedId, setSelectedId] = useState('')
  const [customLabel, setCustomLabel] = useState('')
  const [customCategory, setCustomCategory] = useState('specialise')
  const [level, setLevel] = useState('')
  const [adding, setAdding] = useState(false)

  const stats = computeOrdinateurStats({ gen: computer.gen, nt: computer.nt })
  const used = programs.reduce((sum, p) => sum + (p.level || 0), 0)

  const handleAdd = async (e) => {
    e.preventDefault()
    const lvl = parseInt(level, 10)
    if (isNaN(lvl) || lvl < 0 || lvl > 30) return
    if (mode === 'catalog' && !selectedId) return
    if (mode === 'custom' && !customLabel.trim()) return

    setAdding(true)
    try {
      const payload = {
        ...(mode === 'catalog' ? { equipment_id: selectedId } : { label_override: customLabel.trim(), category: customCategory }),
        level: lvl,
        exo_computer_id: computer.id,
      }
      const res = await api.post(`/char-sheet/${characterId}/exo/programs`, payload)
      onProgramsChange(prev => [...prev, res.data.program])
      setSelectedId(''); setCustomLabel(''); setLevel('')
    } catch (err) {
      console.error('ExoComputerPanel add program:', err)
      window.alert(err.response?.data?.error?.message || t('exo.saveError'))
    } finally { setAdding(false) }
  }

  const handleDelete = async (programId) => {
    try {
      await api.delete(`/char-sheet/${characterId}/exo/programs/${programId}`)
      onProgramsChange(prev => prev.filter(p => p.id !== programId))
    } catch (err) { console.error('ExoComputerPanel delete program:', err) }
  }

  return (
    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #2a2a3e' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontSize: '10px', color: '#5b8dee', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('exo.computerPrograms')}</span>
        {stats && (
          <span style={{ fontSize: '10px', color: used > stats.potentiel ? '#e05c5c' : '#8888a0' }}>
            {t('exo.computerPotentielUsage', { used, max: stats.potentiel })}
          </span>
        )}
      </div>

      {programs.length === 0 && (
        <p style={{ fontSize: '11px', color: '#4a4a60', fontStyle: 'italic' }}>{t('exo.computerNoPrograms')}</p>
      )}

      {programs.map(p => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 0', fontSize: '12px', color: '#c0c0d0' }}>
          <span style={{ flex: 1 }}>{p.program_name || p.label_override || '—'}</span>
          <span style={{ fontSize: '10px', color: '#5b8dee', background: '#1a1a2e', borderRadius: '3px', padding: '1px 5px', flexShrink: 0 }}>
            {t(`drone.category.${p.category}`, p.category)}
          </span>
          <span style={{ fontSize: '12px', color: '#8888a0', fontFamily: 'monospace' }}>{p.level}</span>
          {canEdit && (
            <button
              onClick={() => handleDelete(p.id)}
              style={{ background: 'none', border: 'none', color: '#4a4a60', cursor: 'pointer', fontSize: '13px', lineHeight: 1, padding: '0 2px' }}
            >×</button>
          )}
        </div>
      ))}

      {canEdit && (
        <div style={{ marginTop: '6px' }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
            <button type="button" className={`btn-toggle${mode === 'catalog' ? ' active' : ''}`} onClick={() => setMode('catalog')}>{t('exo.itemCatalog')}</button>
            <button type="button" className={`btn-toggle${mode === 'custom' ? ' active' : ''}`} onClick={() => setMode('custom')}>{t('exo.itemCustom')}</button>
          </div>
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            {mode === 'catalog' ? (
              <select
                value={selectedId} onChange={e => setSelectedId(e.target.value)}
                style={{ flex: 1, minWidth: '140px', background: '#16162a', border: '1px solid #1e1e2e', borderRadius: '4px', color: selectedId ? '#c0c0d0' : '#4a4a60', fontSize: '12px', padding: '4px 8px', outline: 'none' }}
              >
                <option value="">{t('drone.programCatalog')}…</option>
                {catalog.map(item => (
                  <option key={item.id} value={item.id} title={item.description || ''}>{item.name}</option>
                ))}
              </select>
            ) : (
              <>
                <input
                  value={customLabel} onChange={e => setCustomLabel(e.target.value)}
                  placeholder={t('drone.programCustomLabel')}
                  style={{ flex: 1, minWidth: '120px', background: '#16162a', border: '1px solid #1e1e2e', borderRadius: '4px', color: '#c0c0d0', fontSize: '12px', padding: '4px 8px', outline: 'none' }}
                />
                <select
                  value={customCategory} onChange={e => setCustomCategory(e.target.value)}
                  style={{ background: '#16162a', border: '1px solid #1e1e2e', borderRadius: '4px', color: '#c0c0d0', fontSize: '12px', padding: '4px 6px', outline: 'none' }}
                >
                  {['detection','ami_ennemi','armement_distance','armement_contact','esquive','securite','offensif','contre_attaque','rempart','pilotage','analyse','medical','communication','specialise'].map(cat => (
                    <option key={cat} value={cat}>{t(`drone.category.${cat}`, cat)}</option>
                  ))}
                </select>
              </>
            )}
            <input
              type="number" value={level} onChange={e => setLevel(e.target.value)}
              placeholder={t('exo.itemLevel')} min={0} max={30}
              style={{ width: '60px', background: '#16162a', border: '1px solid #1e1e2e', borderRadius: '4px', color: '#c0c0d0', fontSize: '12px', padding: '4px 6px', textAlign: 'center', outline: 'none' }}
            />
            <button type="submit" className="btn-icon" disabled={adding || !level || (mode === 'catalog' ? !selectedId : !customLabel.trim())} style={{ color: 'var(--color-primary)' }}>✓</button>
          </form>
        </div>
      )}
    </div>
  )
}

function ComputerCard({ computer, isActive, programs, catalog, canEdit, onFieldUpdate, onDelete, onProgramsChange, characterId }) {
  const { t } = useTranslation()
  const stats = computeOrdinateurStats({ gen: computer.gen, nt: computer.nt })

  const field = (label, value, key, width = '48px') => canEdit ? (
    <input
      type="number" defaultValue={value ?? ''}
      onBlur={e => {
        const val = e.target.value === '' ? null : parseInt(e.target.value, 10)
        if (val !== value) onFieldUpdate(computer.id, key, val)
      }}
      style={{ width, background: '#0e0e1a', border: '1px solid #2a2a3e', borderRadius: '4px', color: '#c0c0d0', fontSize: '12px', padding: '2px 4px', textAlign: 'center', outline: 'none' }}
    />
  ) : (
    <span>{value ?? '—'}</span>
  )

  return (
    <div style={{ border: '1px solid #1e1e2e', borderRadius: '6px', padding: '10px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: '600', color: '#c0c0d0', textTransform: 'uppercase' }}>
          {t(computer.role === 'principal' ? 'exo.computerRolePrincipal' : 'exo.computerRoleSecours')}
        </span>
        <span style={{
          fontSize: '10px', padding: '1px 6px', borderRadius: '3px',
          color: isActive ? '#4caf77' : '#8888a0',
          background: isActive ? 'rgba(76,175,119,0.12)' : 'rgba(136,136,160,0.12)',
        }}>
          {isActive ? t('exo.computerActive') : ((computer.integrite_current ?? 0) <= 0 ? t('exo.computerHs') : t('exo.computerStandby'))}
        </span>
        {canEdit && (
          <button onClick={() => onDelete(computer.id)} style={{ background: 'none', border: 'none', color: '#4a4a60', cursor: 'pointer', fontSize: '14px', lineHeight: 1 }} title={t('exo.deleteComputer')}>×</button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', fontSize: '12px', color: '#c0c0d0', marginBottom: '8px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '2px' }}>{t('exo.computerGen')}</div>
          {field(t('exo.computerGen'), computer.gen, 'gen', '40px')}
        </div>
        <div>
          <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '2px' }}>{t('exo.computerNt')}</div>
          {field(t('exo.computerNt'), computer.nt, 'nt', '40px')}
        </div>
        <div>
          <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '2px' }}>{t('exo.computerBlindageIem')}</div>
          {field(t('exo.computerBlindageIem'), computer.blindage_iem, 'blindage_iem', '40px')}
          {computer.blindage_iem != null && (
            <div style={{ fontSize: '10px', color: '#8888a0', marginTop: '2px' }}>
              {t('exo.computerBlindageIemCout', { cout: computeBlindageIemCost(computer.blindage_iem) })}
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '2px' }}>{t('exo.itemIntegrity')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            {field(t('exo.itemIntegrity'), computer.integrite_current, 'integrite_current')}
            <span>/</span>
            {field(t('exo.itemIntegrity'), computer.integrite_max, 'integrite_max')}
          </div>
        </div>
      </div>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', fontSize: '11px', color: '#8888a0', marginBottom: '4px' }}>
          <div>{t('exo.computerNiveauMaxProgrammes')} : <strong style={{ color: '#c0c0d0' }}>{stats.niveauMaxProgrammes}</strong></div>
          <div>{t('exo.computerGestionSystemes')} : <strong style={{ color: '#c0c0d0' }}>{stats.gestionSystemes}</strong></div>
          <div>{t('exo.computerPotentiel')} : <strong style={{ color: '#c0c0d0' }}>{stats.potentiel}</strong></div>
          <div>{t('exo.computerCout')} : <strong style={{ color: '#c0c0d0' }}>{stats.cout}</strong></div>
        </div>
      )}

      <ProgramsList
        computer={computer} programs={programs} catalog={catalog} canEdit={canEdit}
        onProgramsChange={onProgramsChange} characterId={characterId}
      />
    </div>
  )
}

export default function ExoComputerPanel({ characterId, canEdit }) {
  const { t } = useTranslation()
  const [computers, setComputers] = useState([])
  const [programs, setPrograms]   = useState([])
  const [catalog, setCatalog]     = useState([])
  const [loading, setLoading]     = useState(true)

  const [newRole, setNewRole] = useState('principal')
  const [newGen, setNewGen]   = useState('')
  const [newNt, setNewNt]     = useState('')
  const [adding, setAdding]   = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api.get(`/char-sheet/${characterId}/exo/computers`),
      api.get(`/char-sheet/${characterId}/exo/programs`),
      api.get('/equipment', { params: { family: 'Logiciels' } }),
    ]).then(([compRes, progRes, catRes]) => {
      if (cancelled) return
      setComputers(compRes.data.computers || [])
      setPrograms(progRes.data.programs || [])
      setCatalog(catRes.data.items || [])
    }).catch(err => console.error('ExoComputerPanel fetch:', err))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [characterId])

  const handleFieldUpdate = async (computerId, key, value) => {
    try {
      const res = await api.put(`/char-sheet/${characterId}/exo/computers/${computerId}`, { [key]: value })
      setComputers(prev => prev.map(c => c.id === computerId ? res.data.computer : c))
    } catch (err) {
      console.error('ExoComputerPanel update:', err)
      window.alert(err.response?.data?.error?.message || t('exo.saveError'))
    }
  }

  const handleDeleteComputer = async (computerId) => {
    try {
      await api.delete(`/char-sheet/${characterId}/exo/computers/${computerId}`)
      setComputers(prev => prev.filter(c => c.id !== computerId))
      // Migration 258 : SET NULL côté serveur — refléter localement sans re-fetch.
      setPrograms(prev => prev.map(p => p.exo_computer_id === computerId ? { ...p, exo_computer_id: null } : p))
    } catch (err) { console.error('ExoComputerPanel delete computer:', err) }
  }

  const handleAddComputer = async (e) => {
    e.preventDefault()
    const gen = parseInt(newGen, 10)
    const nt  = parseInt(newNt, 10)
    if (isNaN(gen) || isNaN(nt)) return
    setAdding(true)
    try {
      const res = await api.post(`/char-sheet/${characterId}/exo/computers`, { role: newRole, gen, nt })
      setComputers(prev => [...prev, res.data.computer])
      setNewGen(''); setNewNt('')
    } catch (err) {
      console.error('ExoComputerPanel add:', err)
      window.alert(err.response?.data?.error?.message || t('exo.saveError'))
    } finally { setAdding(false) }
  }

  if (loading) return <p style={{ color: '#4a4a60', fontSize: '12px', textAlign: 'center' }}>…</p>

  const activeComputer = resolveActiveComputer(computers)

  return (
    <div>
      {computers.length === 0 && (
        <p style={{ fontSize: '12px', color: '#4a4a60', fontStyle: 'italic' }}>{t('exo.noComputers')}</p>
      )}

      {computers.map(c => (
        <ComputerCard
          key={c.id}
          computer={c}
          isActive={activeComputer?.id === c.id}
          programs={programs.filter(p => p.exo_computer_id === c.id)}
          catalog={catalog}
          canEdit={canEdit}
          onFieldUpdate={handleFieldUpdate}
          onDelete={handleDeleteComputer}
          onProgramsChange={setPrograms}
          characterId={characterId}
        />
      ))}

      {canEdit && computers.length < 2 && (
        <form onSubmit={handleAddComputer} style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginTop: '4px' }}>
          <select
            value={newRole} onChange={e => setNewRole(e.target.value)}
            style={{ background: '#16162a', border: '1px solid #1e1e2e', borderRadius: '4px', color: '#c0c0d0', fontSize: '12px', padding: '4px 8px', outline: 'none' }}
          >
            {EXO_COMPUTER_ROLE_VALUES.map(role => (
              <option key={role} value={role}>{t(role === 'principal' ? 'exo.computerRolePrincipal' : 'exo.computerRoleSecours')}</option>
            ))}
          </select>
          <input
            type="number" value={newGen} onChange={e => setNewGen(e.target.value)}
            placeholder={t('exo.computerGen')}
            style={{ width: '70px', background: '#16162a', border: '1px solid #1e1e2e', borderRadius: '4px', color: '#c0c0d0', fontSize: '12px', padding: '4px 6px', textAlign: 'center', outline: 'none' }}
          />
          <input
            type="number" value={newNt} onChange={e => setNewNt(e.target.value)}
            placeholder={t('exo.computerNt')}
            style={{ width: '70px', background: '#16162a', border: '1px solid #1e1e2e', borderRadius: '4px', color: '#c0c0d0', fontSize: '12px', padding: '4px 6px', textAlign: 'center', outline: 'none' }}
          />
          <button type="submit" className="btn-icon" disabled={adding || newGen === '' || newNt === ''} style={{ color: 'var(--color-primary)' }}>✓ {t('exo.addComputer')}</button>
        </form>
      )}
    </div>
  )
}
