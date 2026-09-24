import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api.js'

// Section « Protection » de la fiche drone (docs/PLANS/PLAN_DRONE_INTERCEPTION.md §3.7) : quels
// personnages ce drone d'interception protège. Le serveur reste l'autorité (validation, liste des
// candidats) — le client ne fait qu'afficher et envoyer une intention.
//
// Deux avertissements permanents, car un drone mal configuré n'intercepte simplement RIEN, sans erreur :
// programme Interception absent, Vitesse non renseignée (le RAW du drone bouclier indique « - »).
export default function DroneProtectionSection({ characterId, drone, programs, canEdit }) {
  const { t } = useTranslation()
  const [links, setLinks] = useState({ protected: [], candidates: [] })
  const [selectedId, setSelectedId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/char-sheet/${characterId}/drone/interception-targets`)
      setLinks(res.data)
      setError(null)
    } catch (err) {
      console.error('[DroneProtectionSection] load:', err.message)
      setError('protectionLoadError')
    }
  }, [characterId])

  useEffect(() => { load() }, [load])

  const change = async request => {
    setBusy(true)
    try {
      await request()
      setSelectedId('')
      await load()
    } catch (err) {
      console.error('[DroneProtectionSection] write:', err.message)
      setError('protectionSaveError')
    } finally {
      setBusy(false)
    }
  }

  const add = e => {
    e.preventDefault()
    if (!selectedId) return
    change(() => api.post(`/char-sheet/${characterId}/drone/interception-targets`, { protected_character_id: selectedId }))
  }
  const remove = protectedId => change(() => api.delete(`/char-sheet/${characterId}/drone/interception-targets/${protectedId}`))

  const protectedIds = new Set(links.protected.map(p => p.id))
  const available = links.candidates.filter(c => !protectedIds.has(c.id))
  const hasProgram = (programs ?? []).some(p => p.category === 'interception')
  const hasSpeed = drone.vitesse != null && drone.vitesse !== ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <p style={{ fontSize: '11px', color: '#8888a8', margin: 0 }}>{t('drone.protectionHelp')}</p>
      {!hasProgram && <p style={{ fontSize: '11px', color: '#FFA500', margin: 0 }}>{t('drone.protectionNoProgram')}</p>}
      {!hasSpeed && <p style={{ fontSize: '11px', color: '#FFA500', margin: 0 }}>{t('drone.protectionNoSpeed')}</p>}
      {error && <p style={{ fontSize: '11px', color: '#FF6B6B', margin: 0 }}>{t(`drone.${error}`)}</p>}

      {links.protected.length === 0 && (
        <p style={{ fontSize: '12px', color: '#4a4a60', fontStyle: 'italic', margin: 0 }}>{t('drone.protectionNone')}</p>
      )}
      {links.protected.map(p => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', borderBottom: '1px solid #1e1e2e' }}>
          <span style={{ flex: 1, fontSize: '12px', color: '#c0c0d0' }}>{p.name}</span>
          <span style={{ fontSize: '10px', color: '#5b8dee', background: '#1a1a2e', borderRadius: '3px', padding: '1px 5px', flexShrink: 0 }}>
            {t(`drone.protectionType.${p.type}`, p.type)}
          </span>
          {canEdit && (
            <button
              type="button"
              disabled={busy}
              onClick={() => remove(p.id)}
              style={{ background: 'none', border: 'none', color: '#4a4a60', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}
              title={t('drone.protectionRemove')}
            >×</button>
          )}
        </div>
      ))}

      {canEdit && (
        <form onSubmit={add} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            style={{ flex: 1, background: '#16162a', border: '1px solid #1e1e2e', borderRadius: '4px', color: selectedId ? '#c0c0d0' : '#4a4a60', fontSize: '12px', padding: '4px 8px', outline: 'none' }}
          >
            <option value="" style={{ background: '#16162a', color: '#4a4a60' }}>{t('drone.protectionAdd')}</option>
            {available.map(c => (
              <option key={c.id} value={c.id} style={{ background: '#16162a', color: '#c0c0d0' }}>
                {c.name} — {t(`drone.protectionType.${c.type}`, c.type)}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-icon" disabled={busy || !selectedId} style={{ color: 'var(--color-primary)' }} title={t('drone.protectionAddButton')}>✓</button>
        </form>
      )}
    </div>
  )
}
