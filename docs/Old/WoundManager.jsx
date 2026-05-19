import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  WOUND_LOCATIONS, WOUND_SEVERITIES, WOUND_MAX_COUNTS, WOUND_PENALTIES,
} from '../../../shared/woundConstants.js'
import api from '../lib/api.js'

const SEVERITY_LABELS = {
  legere: 'Légère', moyenne: 'Moyenne', grave: 'Grave', critique: 'Critique', mortelle: 'Mortelle',
}

const LOCATION_LABELS = {
  tete: 'Tête', corps: 'Corps', bras_droit: 'Bras D', bras_gauche: 'Bras G',
  jambe_droite: 'Jambe D', jambe_gauche: 'Jambe G',
}

const SEVERITY_COLORS = {
  legere: '#FFD700', moyenne: '#FFA500', grave: '#FF6B6B', critique: '#FF0000', mortelle: '#8B0000',
}

export default function WoundManager({ characterId, canEdit }) {
  const [wounds,          setWounds]          = useState([])
  const [lastAddedWoundId, setLastAddedWoundId] = useState(null)
  const [loading,         setLoading]         = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.get(`/char-sheet/${characterId}/wounds`)
      .then(res => { if (!cancelled) { setWounds(res.data.wounds || []); setLoading(false) } })
      .catch(err => { console.error('Erreur chargement wounds :', err); if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [characterId])

  const woundPenalty = useMemo(() => {
    let worst = 0
    for (const w of wounds) {
      const p = WOUND_PENALTIES[w.severity] ?? 0
      if (p < worst) worst = p
    }
    return worst
  }, [wounds])

  const handleBoxClick = useCallback(async (location, severity, index) => {
    if (!canEdit) return

    const woundsHere = wounds.filter(w => w.location === location && w.severity === severity)
    const wound = woundsHere[index]

    try {
      if (!wound) {
        // Case vide → POST
        const res = await api.post(`/char-sheet/${characterId}/wounds`, { location, severity })
        setLastAddedWoundId(res.data.shock_test_required ? res.data.wound.id : null)
        if (res.data.promoted) {
          // P47 — promotion : rechargement complet (des blessures ont été supprimées côté serveur)
          const freshRes = await api.get(`/char-sheet/${characterId}/wounds`)
          setWounds(freshRes.data.wounds || [])
        } else {
          setWounds(prev => [...prev, res.data.wound])
        }
      } else if (!wound.is_stabilized) {
        // Blessure normale → PUT stabilize
        const res = await api.put(`/char-sheet/${characterId}/wounds/${wound.id}/stabilize`)
        setWounds(prev => prev.map(w => w.id === wound.id ? res.data.wound : w))
      } else {
        // Blessure stabilisée → DELETE (guérison)
        await api.delete(`/char-sheet/${characterId}/wounds/${wound.id}`)
        setWounds(prev => prev.filter(w => w.id !== wound.id))
      }
    } catch (err) {
      console.error('Erreur WoundManager :', err)
    }
  }, [canEdit, wounds, characterId])

  if (loading) return <div style={{ color: '#5a5a7a', fontSize: 12, padding: 16 }}>Chargement…</div>

  return (
    <div>
      {woundPenalty < 0 && (
        <div style={{ color: '#FF6B6B', marginBottom: 12, fontSize: 13 }}>
          Malus blessures : {woundPenalty}
        </div>
      )}

      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '4px 8px', color: '#888', fontSize: 12, fontWeight: 'normal' }}>
              Localisation
            </th>
            {WOUND_SEVERITIES.map(sev => (
              <th key={sev} style={{ padding: '4px', color: SEVERITY_COLORS[sev], fontSize: 11, fontWeight: 'normal', textAlign: 'center' }}>
                {SEVERITY_LABELS[sev]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {WOUND_LOCATIONS.map(loc => (
            <tr key={loc}>
              <td style={{ padding: '4px 8px', color: '#ccc', fontSize: 12 }}>
                {LOCATION_LABELS[loc]}
              </td>
              {WOUND_SEVERITIES.map(sev => {
                const maxCount = WOUND_MAX_COUNTS[loc][sev]
                const woundsHere = wounds.filter(w => w.location === loc && w.severity === sev)
                return (
                  <td key={sev} style={{ padding: '2px 4px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 2, justifyContent: 'center', alignItems: 'center' }}>
                      {Array.from({ length: maxCount }).map((_, i) => {
                        const w = woundsHere[i]
                        const isShock = w && w.id === lastAddedWoundId
                        return (
                          <div
                            key={i}
                            onClick={() => handleBoxClick(loc, sev, i)}
                            title={
                              w
                                ? (w.is_stabilized ? 'Stabilisée — cliquer pour guérir' : 'Blessure — cliquer pour stabiliser')
                                : 'Vide — cliquer pour ajouter'
                            }
                            style={{
                              width: 14,
                              height: 14,
                              border: `1px solid ${w ? '#fff' : '#2a2a3e'}`,
                              background: w ? SEVERITY_COLORS[sev] : 'transparent',
                              cursor: canEdit ? 'pointer' : 'default',
                              borderRadius: 2,
                              position: 'relative',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 9,
                              boxShadow: w?.is_stabilized ? '0 0 4px #00ff00' : 'none',
                            }}
                          >
                            {w?.is_stabilized && (
                              <span style={{ color: '#00ff00', lineHeight: 1 }}>✓</span>
                            )}
                            {isShock && !w?.is_stabilized && (
                              <span style={{
                                color: '#FFA500',
                                position: 'absolute',
                                top: -7,
                                right: -5,
                                fontSize: 10,
                                fontWeight: 'bold',
                              }}>!</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
