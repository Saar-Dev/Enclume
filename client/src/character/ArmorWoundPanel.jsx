import { useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api.js'
import { useCharacterStore } from '../stores/characterStore'
import { useInventoryData } from '../lib/useInventoryData.js'
import SilhouettePanel from './SilhouettePanel.jsx'
import LocationPanel   from './LocationPanel.jsx'

export default function ArmorWoundPanel({ characterId, canEdit, dragItem = null }) {
  const { t } = useTranslation('charSheet')

  const setStoreWounds = useCharacterStore(s => s.setWounds)
  const storeWounds    = useCharacterStore(s => s.woundsByCharId[characterId])
  const wounds         = storeWounds ?? []
  const woundsLoading  = storeWounds === undefined

  const loadWounds = useCallback(async () => {
    try {
      const res = await api.get(`/char-sheet/${characterId}/wounds`)
      setStoreWounds(characterId, res.data.wounds || [])
    } catch (err) {
      console.error('Erreur chargement blessures :', err)
    }
  }, [characterId, setStoreWounds])

  // BETA-38 — même patron qu'useInventoryData.js (store = seule source de vérité, pas de copie locale
  // divergente, react.md). Le store reste à jour même hors montage (WOUND_* WS, useCharacterSocket.js
  // monté une fois au niveau SessionPage) : un seul fetch initial le peuple si absent pour ce
  // characterId, plus de refetch à chaque montage/démontage de l'onglet Matériel.
  useEffect(() => {
    if (!characterId || storeWounds !== undefined) return
    loadWounds()
  }, [characterId, storeWounds, loadWounds])

  // PLAN_INVENTORY_UX.md §3 — source unique de vérité, plus de fetch local à ce panneau.
  const { items: inventory, loading: inventoryLoading } = useInventoryData(characterId)

  const handleWoundsReload = loadWounds

  if (woundsLoading || inventoryLoading) {
    return <div style={{ color: '#5a5a7a', fontSize: 12, padding: '16px 0' }}>{t('common.loading')}</div>
  }

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
    dragItem,
    onWoundsReload: handleWoundsReload,
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
          <SilhouettePanel wounds={wounds} />
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
    // Silhouette bornée à la hauteur des colonnes gauche/droite (demande Saar 2026-08-05, révisé
    // 2026-09-02) : `contain:'size'` dimensionne cette colonne sans regarder son contenu, donc la
    // hauteur de rangée grid vient des seules colonnes latérales ; `alignSelf:'stretch'` réinjecte
    // ensuite cette hauteur comme bloc conteneur défini pour SilhouettePanel (svg height:100%).
    // Sans `contain`, la hauteur du svg (indexée sur sa largeur = 80% d'un `1fr` large) repartait
    // dans le calcul de rangée et étirait toute la section.
    alignSelf: 'stretch',
    contain: 'size',
  },
}
