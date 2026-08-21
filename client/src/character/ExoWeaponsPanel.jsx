/**
 * ExoWeaponsPanel.jsx — Onglet Armement de ExoSheetWindow
 *
 * Liste `exo_weapons` (PLAN_EXOARMURE.md §13.4.3) — catalogue (`ref_exo_equipment`, family='arme',
 * `GET /api/exo-equipment`) ou custom (label_override). Miroir structurel d'ExoSystemsPanel.jsx, sans
 * `level` (absent du schéma exo_weapons — contrairement à exo_systems, aucune arme RAW ne se facture
 * "X/niv."). Affiche Dom./Portée/Mode de tir du catalogue quand disponibles (fiche RAW réelle,
 * FDEA.webp, bloc "ARMEMENT").
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api.js'

export default function ExoWeaponsPanel({ characterId, canEdit }) {
  const { t } = useTranslation()
  const [weapons, setWeapons] = useState([])
  const [catalog, setCatalog] = useState([])
  const [loading, setLoading] = useState(true)

  const [mode, setMode]           = useState('catalog')
  const [selectedId, setSelectedId] = useState('')
  const [customLabel, setCustomLabel] = useState('')
  const [integriteMax, setIntegriteMax] = useState('')
  const [adding, setAdding]       = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api.get(`/char-sheet/${characterId}/exo/weapons`),
      api.get('/exo-equipment', { params: { family: 'arme' } }),
    ]).then(([wRes, catRes]) => {
      if (cancelled) return
      setWeapons(wRes.data.weapons || [])
      setCatalog(catRes.data.items || [])
    }).catch(err => console.error('ExoWeaponsPanel fetch:', err))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [characterId])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (mode === 'catalog' && !selectedId) return
    if (mode === 'custom' && !customLabel.trim()) return

    setAdding(true)
    try {
      const payload = {
        ...(mode === 'catalog' ? { equipment_id: selectedId } : { label_override: customLabel.trim() }),
        ...(integriteMax !== '' ? { integrite_max: parseInt(integriteMax, 10) } : {}),
      }
      const res = await api.post(`/char-sheet/${characterId}/exo/weapons`, payload)
      setWeapons(prev => [...prev, res.data.weapon])
      setSelectedId(''); setCustomLabel(''); setIntegriteMax('')
    } catch (err) {
      console.error('ExoWeaponsPanel add:', err)
      window.alert(err.response?.data?.error?.message || t('exo.saveError'))
    } finally { setAdding(false) }
  }

  const handleIntegriteUpdate = async (weaponId, field, value) => {
    try {
      const res = await api.put(`/char-sheet/${characterId}/exo/weapons/${weaponId}`, { [field]: value })
      setWeapons(prev => prev.map(w => w.id === weaponId ? res.data.weapon : w))
    } catch (err) { console.error('ExoWeaponsPanel update:', err) }
  }

  const handleDelete = async (weaponId) => {
    try {
      await api.delete(`/char-sheet/${characterId}/exo/weapons/${weaponId}`)
      setWeapons(prev => prev.filter(w => w.id !== weaponId))
    } catch (err) { console.error('ExoWeaponsPanel delete:', err) }
  }

  if (loading) return <p style={{ color: '#4a4a60', fontSize: '12px', textAlign: 'center' }}>…</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {weapons.length === 0 && (
        <p style={{ fontSize: '12px', color: '#4a4a60', fontStyle: 'italic' }}>{t('exo.noWeapons')}</p>
      )}

      {weapons.map(w => (
        <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', borderBottom: '1px solid #1e1e2e' }}>
          <span style={{ flex: 1, fontSize: '12px', color: '#c0c0d0' }} title={w.ref_description || ''}>
            {w.display_name || '—'}
          </span>
          {(w.ref_damage || w.ref_fire_mode) && (
            <span style={{ fontSize: '10px', color: '#c05a5a', background: '#241a1a', borderRadius: '3px', padding: '1px 5px', flexShrink: 0 }}>
              {[w.ref_damage, w.ref_fire_mode].filter(Boolean).join(' · ')}
            </span>
          )}
          {canEdit ? (
            <>
              <input
                type="number" min={0} defaultValue={w.integrite_current ?? ''}
                onBlur={e => {
                  const val = e.target.value === '' ? null : parseInt(e.target.value, 10)
                  if (val !== w.integrite_current) handleIntegriteUpdate(w.id, 'integrite_current', val)
                }}
                style={{ width: '40px', background: '#0e0e1a', border: '1px solid #2a2a3e', borderRadius: '4px', color: '#c0c0d0', fontSize: '11px', padding: '2px 4px', textAlign: 'center' }}
              />
              <span style={{ color: '#5b5b7a', fontSize: '11px' }}>/</span>
              <input
                type="number" min={0} defaultValue={w.integrite_max ?? ''}
                onBlur={e => {
                  const val = e.target.value === '' ? null : parseInt(e.target.value, 10)
                  if (val !== w.integrite_max) handleIntegriteUpdate(w.id, 'integrite_max', val)
                }}
                style={{ width: '40px', background: '#0e0e1a', border: '1px solid #2a2a3e', borderRadius: '4px', color: '#c0c0d0', fontSize: '11px', padding: '2px 4px', textAlign: 'center' }}
              />
            </>
          ) : (
            <span style={{ fontSize: '11px', color: '#8888a0' }}>{w.integrite_current ?? '—'} / {w.integrite_max ?? '—'}</span>
          )}
          {canEdit && (
            <button
              onClick={() => handleDelete(w.id)}
              style={{ background: 'none', border: 'none', color: '#4a4a60', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}
              title={t('exo.deleteWeapon')}
            >×</button>
          )}
        </div>
      ))}

      {canEdit && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
            <button type="button" className={`btn-toggle${mode === 'catalog' ? ' active' : ''}`} onClick={() => setMode('catalog')}>{t('exo.itemCatalog')}</button>
            <button type="button" className={`btn-toggle${mode === 'custom' ? ' active' : ''}`} onClick={() => setMode('custom')}>{t('exo.itemCustom')}</button>
          </div>
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            {mode === 'catalog' ? (
              <select
                value={selectedId} onChange={e => setSelectedId(e.target.value)}
                style={{ flex: 1, minWidth: '160px', background: '#16162a', border: '1px solid #1e1e2e', borderRadius: '4px', color: selectedId ? '#c0c0d0' : '#4a4a60', fontSize: '12px', padding: '4px 8px', outline: 'none' }}
              >
                <option value="">{t('exo.selectWeapon')}</option>
                {catalog.map(item => (
                  <option key={item.id} value={item.id} title={item.description || ''}>{item.name}</option>
                ))}
              </select>
            ) : (
              <input
                value={customLabel} onChange={e => setCustomLabel(e.target.value)}
                placeholder={t('exo.itemCustomLabel')}
                style={{ flex: 1, minWidth: '160px', background: '#16162a', border: '1px solid #1e1e2e', borderRadius: '4px', color: '#c0c0d0', fontSize: '12px', padding: '4px 8px', outline: 'none' }}
              />
            )}
            <input
              type="number" value={integriteMax} onChange={e => setIntegriteMax(e.target.value)}
              placeholder={t('exo.itemIntegrity')}
              style={{ width: '90px', background: '#16162a', border: '1px solid #1e1e2e', borderRadius: '4px', color: '#c0c0d0', fontSize: '12px', padding: '4px 6px', textAlign: 'center', outline: 'none' }}
            />
            <button type="submit" className="btn-icon" disabled={adding || (mode === 'catalog' ? !selectedId : !customLabel.trim())} style={{ color: 'var(--color-primary)' }}>✓</button>
          </form>
        </div>
      )}
    </div>
  )
}
