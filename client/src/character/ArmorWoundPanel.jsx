import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../lib/api.js'
import SilhouettePanel from './SilhouettePanel.jsx'
import LocationPanel   from './LocationPanel.jsx'
import ContainerPanel  from './ContainerPanel.jsx'

export default function ArmorWoundPanel({ characterId, canEdit, reloadKey }) {
  const [wounds,     setWounds]     = useState([])
  const [inventory,  setInventory]  = useState([])
  const [totalWeight, setTotalWeight] = useState(0)
  const [threshold,   setThreshold]   = useState(0)
  const [loading,    setLoading]    = useState(true)
  const hasLoadedRef = useRef(false)

  const load = useCallback(async () => {
    const showSpinner = !hasLoadedRef.current
    if (showSpinner) setLoading(true)
    try {
      const [wRes, invRes] = await Promise.all([
        api.get(`/char-sheet/${characterId}/wounds`),
        api.get(`/char-sheet/${characterId}/inventory`),
      ])
      setWounds(wRes.data.wounds || [])
      setInventory(invRes.data.items || [])
      setTotalWeight(invRes.data.total_weight ?? 0)
      setThreshold(invRes.data.threshold ?? 0)
    } catch (err) {
      console.error('Erreur chargement ArmorWoundPanel :', err)
    } finally {
      hasLoadedRef.current = true
      if (showSpinner) setLoading(false)
    }
  }, [characterId])

  useEffect(() => {
    let cancelled = false
    load().then(() => { if (cancelled) { setWounds([]); setInventory([]) } })
    return () => { cancelled = true }
  }, [load, reloadKey])

  const handleInventoryChange = useCallback((updatedItem) => {
    setInventory(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i))
  }, [])

  const handleWoundsReload = useCallback(async () => {
    try {
      const res = await api.get(`/char-sheet/${characterId}/wounds`)
      setWounds(res.data.wounds || [])
    } catch (err) {
      console.error('Erreur rechargement wounds :', err)
    }
  }, [characterId])

  if (loading) {
    return <div style={{ color: '#5a5a7a', fontSize: 12, padding: '16px 0' }}>Chargement…</div>
  }

  // ── Couleur poids ─────────────────────────────────────────────────────────
  const weightRatio  = threshold > 0 ? totalWeight / threshold : 0
  const weightColor  = weightRatio >= 1 ? '#e05c5c' : weightRatio >= 0.75 ? '#FFA500' : '#5a5a7a'
  const weightFmt    = (n) => n % 1 === 0 ? n : n.toFixed(1)

  // ── Disposition 3 colonnes ─────────────────────────────────────────────────
  // Gauche  : Tête, Bras G, Jambe G
  // Centre  : Sac + Ceinture (groupés), Silhouette
  // Droite  : Corps, Bras D, Jambe D
  const leftLocs  = ['tete', 'bras_gauche', 'jambe_gauche']
  const rightLocs = ['corps', 'bras_droit', 'jambe_droite']

  const sharedLocationProps = {
    items: inventory,
    wounds,
    characterId,
    canEdit,
    onInventoryChange: handleInventoryChange,
    onWoundsReload: handleWoundsReload,
  }

  const sharedContainerProps = {
    items: inventory,
    characterId,
    canEdit,
    onInventoryChange: handleInventoryChange,
  }

  return (
    <div style={s.root}>
      <div style={s.grid}>

        {/* ── Colonne gauche ───────────────────────────────────────── */}
        <div style={s.col}>
          {leftLocs.map(loc => (
            <LocationPanel key={loc} location={loc} {...sharedLocationProps} />
          ))}
        </div>

        {/* ── Colonne centre ───────────────────────────────────────── */}
        <div style={s.colCenter}>
          <div style={s.containerGroup}>
            <ContainerPanel type="D"  label="Sac à dos" {...sharedContainerProps} />
            <ContainerPanel type="Ce" label="Ceinture"  {...sharedContainerProps} />
          </div>
          <div style={{ position: 'relative' }}>
            <span style={{ ...s.weightLabel, color: weightColor }}>
              {weightFmt(totalWeight)} / {weightFmt(threshold)} kg
            </span>
            <SilhouettePanel wounds={wounds} />
          </div>
        </div>

        {/* ── Colonne droite ───────────────────────────────────────── */}
        <div style={s.col}>
          {rightLocs.map(loc => (
            <LocationPanel key={loc} location={loc} {...sharedLocationProps} />
          ))}
        </div>

      </div>
    </div>
  )
}

const s = {
  root: {
    paddingBottom: 12,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    gap: 8,
    alignItems: 'start',
  },
  col: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  colCenter: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minWidth: 0,
  },
  containerGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  weightLabel: {
    position: 'absolute',
    top: 6,
    left: 4,
    fontSize: 10,
    zIndex: 1,
    pointerEvents: 'none',
  },
}
