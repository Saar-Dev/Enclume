/**
 * ExoSystemsPanel.jsx — Onglet Systèmes de ExoSheetWindow
 *
 * Liste `exo_systems` (PLAN_EXOARMURE.md §13.4.3) — 3 sources exclusives (exclusive arc, migration 260,
 * §13.4.4 suite) : catalogue armure (`ref_exo_equipment`, family='systeme', `GET /api/exo-equipment`),
 * catalogue général (`ref_equipment`, family='Equipement Général' — sonscans/radars/senseurs déjà
 * catalogués ailleurs dans le jeu, pas de doublon à inventer), ou custom (label_override). Patron CRUD
 * repris de DroneSheet.jsx#ProgramsSection (catalogue/custom, ajout, suppression) + paire max/courant
 * reprise de ExoIntegrityPanel.jsx. Miroir structurel d'ExoWeaponsPanel.jsx (fiche RAW réelle,
 * FDEA.webp : deux blocs "SYSTÈMES AUXILIAIRES"/"ARMEMENT" distincts, colonnes différentes — jamais
 * fusionnés).
 *
 * `level` optionnel (contrairement à drone_programs) : seuls les systèmes facturés "X/niv." ont un
 * niveau (RAW, PLAN_EXOARMURE.md §12.1bis point 5) — un système à niveau fixe le porte déjà dans son
 * nom/description catalogue.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api.js'

export default function ExoSystemsPanel({ characterId, canEdit }) {
  const { t } = useTranslation()
  const [systems, setSystems] = useState([])
  const [catalog, setCatalog] = useState([])
  const [generalCatalog, setGeneralCatalog] = useState([])
  const [loading, setLoading] = useState(true)

  const [mode, setMode]           = useState('catalog')
  const [selectedId, setSelectedId] = useState('')
  const [customLabel, setCustomLabel] = useState('')
  const [level, setLevel]         = useState('')
  const [integriteMax, setIntegriteMax] = useState('')
  const [adding, setAdding]       = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api.get(`/char-sheet/${characterId}/exo/systems`),
      api.get('/exo-equipment', { params: { family: 'systeme' } }),
      api.get('/equipment', { params: { family: 'Equipement Général' } }),
    ]).then(([sysRes, catRes, genRes]) => {
      if (cancelled) return
      setSystems(sysRes.data.systems || [])
      setCatalog(catRes.data.items || [])
      setGeneralCatalog(genRes.data.items || [])
    }).catch(err => console.error('ExoSystemsPanel fetch:', err))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [characterId])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (mode !== 'custom' && !selectedId) return
    if (mode === 'custom' && !customLabel.trim()) return

    setAdding(true)
    try {
      const source = mode === 'catalog' ? { equipment_id: selectedId }
        : mode === 'catalogGeneral' ? { ref_equipment_id: selectedId }
        : { label_override: customLabel.trim() }
      const payload = {
        ...source,
        ...(level !== '' ? { level: parseInt(level, 10) } : {}),
        ...(integriteMax !== '' ? { integrite_max: parseInt(integriteMax, 10) } : {}),
      }
      const res = await api.post(`/char-sheet/${characterId}/exo/systems`, payload)
      setSystems(prev => [...prev, res.data.system])
      setSelectedId(''); setCustomLabel(''); setLevel(''); setIntegriteMax('')
    } catch (err) {
      console.error('ExoSystemsPanel add:', err)
      window.alert(err.response?.data?.error?.message || t('exo.saveError'))
    } finally { setAdding(false) }
  }

  const handleIntegriteUpdate = async (systemId, field, value) => {
    try {
      const res = await api.put(`/char-sheet/${characterId}/exo/systems/${systemId}`, { [field]: value })
      setSystems(prev => prev.map(s => s.id === systemId ? res.data.system : s))
    } catch (err) { console.error('ExoSystemsPanel update:', err) }
  }

  const handleDelete = async (systemId) => {
    try {
      await api.delete(`/char-sheet/${characterId}/exo/systems/${systemId}`)
      setSystems(prev => prev.filter(s => s.id !== systemId))
    } catch (err) { console.error('ExoSystemsPanel delete:', err) }
  }

  if (loading) return <p style={{ color: '#4a4a60', fontSize: '12px', textAlign: 'center' }}>…</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {systems.length === 0 && (
        <p style={{ fontSize: '12px', color: '#4a4a60', fontStyle: 'italic' }}>{t('exo.noSystems')}</p>
      )}

      {systems.map(s => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', borderBottom: '1px solid #1e1e2e' }}>
          <span style={{ flex: 1, fontSize: '12px', color: '#c0c0d0' }} title={s.ref_description || ''}>
            {s.display_name || '—'}
          </span>
          {s.level != null && (
            <span style={{ fontSize: '10px', color: '#5b8dee', background: '#1a1a2e', borderRadius: '3px', padding: '1px 5px', flexShrink: 0 }}>
              {t('exo.itemLevel')} {s.level}
            </span>
          )}
          {canEdit ? (
            <>
              <input
                type="number" min={0} defaultValue={s.integrite_current ?? ''}
                onBlur={e => {
                  const val = e.target.value === '' ? null : parseInt(e.target.value, 10)
                  if (val !== s.integrite_current) handleIntegriteUpdate(s.id, 'integrite_current', val)
                }}
                style={{ width: '40px', background: '#0e0e1a', border: '1px solid #2a2a3e', borderRadius: '4px', color: '#c0c0d0', fontSize: '11px', padding: '2px 4px', textAlign: 'center' }}
              />
              <span style={{ color: '#5b5b7a', fontSize: '11px' }}>/</span>
              <input
                type="number" min={0} defaultValue={s.integrite_max ?? ''}
                onBlur={e => {
                  const val = e.target.value === '' ? null : parseInt(e.target.value, 10)
                  if (val !== s.integrite_max) handleIntegriteUpdate(s.id, 'integrite_max', val)
                }}
                style={{ width: '40px', background: '#0e0e1a', border: '1px solid #2a2a3e', borderRadius: '4px', color: '#c0c0d0', fontSize: '11px', padding: '2px 4px', textAlign: 'center' }}
              />
            </>
          ) : (
            <span style={{ fontSize: '11px', color: '#8888a0' }}>{s.integrite_current ?? '—'} / {s.integrite_max ?? '—'}</span>
          )}
          {canEdit && (
            <button
              onClick={() => handleDelete(s.id)}
              style={{ background: 'none', border: 'none', color: '#4a4a60', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}
              title={t('exo.deleteSystem')}
            >×</button>
          )}
        </div>
      ))}

      {canEdit && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
            <button type="button" className={`btn-toggle${mode === 'catalog' ? ' active' : ''}`} onClick={() => { setMode('catalog'); setSelectedId('') }}>{t('exo.itemCatalog')}</button>
            <button type="button" className={`btn-toggle${mode === 'catalogGeneral' ? ' active' : ''}`} onClick={() => { setMode('catalogGeneral'); setSelectedId('') }}>{t('exo.itemCatalogGeneral')}</button>
            <button type="button" className={`btn-toggle${mode === 'custom' ? ' active' : ''}`} onClick={() => { setMode('custom'); setSelectedId('') }}>{t('exo.itemCustom')}</button>
          </div>
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            {mode === 'custom' ? (
              <input
                value={customLabel} onChange={e => setCustomLabel(e.target.value)}
                placeholder={t('exo.itemCustomLabel')}
                style={{ flex: 1, minWidth: '160px', background: '#16162a', border: '1px solid #1e1e2e', borderRadius: '4px', color: '#c0c0d0', fontSize: '12px', padding: '4px 8px', outline: 'none' }}
              />
            ) : (
              <select
                value={selectedId} onChange={e => setSelectedId(e.target.value)}
                style={{ flex: 1, minWidth: '160px', background: '#16162a', border: '1px solid #1e1e2e', borderRadius: '4px', color: selectedId ? '#c0c0d0' : '#4a4a60', fontSize: '12px', padding: '4px 8px', outline: 'none' }}
              >
                <option value="">{t('exo.selectSystem')}</option>
                {(mode === 'catalog' ? catalog : generalCatalog).map(item => (
                  <option key={item.id} value={item.id} title={item.description || ''}>{item.name}</option>
                ))}
              </select>
            )}
            <input
              type="number" value={level} onChange={e => setLevel(e.target.value)}
              placeholder={t('exo.itemLevelOptional')}
              style={{ width: '90px', background: '#16162a', border: '1px solid #1e1e2e', borderRadius: '4px', color: '#c0c0d0', fontSize: '12px', padding: '4px 6px', textAlign: 'center', outline: 'none' }}
            />
            <input
              type="number" value={integriteMax} onChange={e => setIntegriteMax(e.target.value)}
              placeholder={t('exo.itemIntegrity')}
              style={{ width: '90px', background: '#16162a', border: '1px solid #1e1e2e', borderRadius: '4px', color: '#c0c0d0', fontSize: '12px', padding: '4px 6px', textAlign: 'center', outline: 'none' }}
            />
            <button type="submit" className="btn-icon" disabled={adding || (mode === 'custom' ? !customLabel.trim() : !selectedId)} style={{ color: 'var(--color-primary)' }}>✓</button>
          </form>
        </div>
      )}
    </div>
  )
}
