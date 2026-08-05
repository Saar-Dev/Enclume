import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api.js'
import { useCharacterStore } from '../stores/characterStore.js'
import { useInventoryData } from '../lib/useInventoryData.js'

const weightFmt = (n) => n % 1 === 0 ? n : n.toFixed(1)

// PLAN_INVENTORY_UX.md Étape 1 / §2.3 — bandeau toujours visible (poids + sols), extrait de
// InventoryPanel.jsx (header poids/sols) et de l'overlay ArmorWoundPanel.jsx (weightColor/weightRatio,
// logique de couleur inchangée — §10 point 1 du plan, indépendante de SEVERITY_COLORS/silhouette).
// Réutilise les clés i18n inventoryPanel.* existantes (même texte, précédent déjà établi dans ce
// domaine : containerPanel.equipPlaceholder est de même consommé depuis LocationPanel.jsx).
export default function InventoryBanner({ characterId, canEdit, isGm }) {
  const { t } = useTranslation('charSheet')
  const { totalWeight, threshold, iniPenalty, sols, loading } = useInventoryData(characterId)
  const setSolsStore = useCharacterStore(s => s.setSols)

  // solsInput ne sert que pendant une édition active (le <span> hors édition affiche `sols`
  // directement) : initialisé de façon synchrone à l'ouverture (onClick plus bas) et sur
  // annulation/sauvegarde — pas besoin d'un effet de resynchronisation permanent.
  const [editingSols, setEditingSols] = useState(false)
  const [solsInput,   setSolsInput]   = useState('0')

  const handleSolsSave = useCallback(async () => {
    setEditingSols(false)
    const value = parseInt(solsInput, 10)
    if (isNaN(value) || value < 0 || value === sols) { setSolsInput(String(sols)); return }
    // Asymétrie serveur (char-sheet.js : un non-GM ne peut que diminuer, 403 sinon) — bornée ici pour
    // ne pas laisser un 403 surprendre l'utilisateur (§2.3 du plan), pas de requête envoyée dans ce cas.
    if (!isGm && value > sols) { setSolsInput(String(sols)); return }
    try {
      const res = await api.put(`/char-sheet/${characterId}/sols`, { sols: value })
      setSolsStore(characterId, res.data.sols)
    } catch (err) {
      console.error('Erreur sauvegarde sols :', err)
      setSolsInput(String(sols))
    }
  }, [characterId, sols, solsInput, isGm, setSolsStore])

  if (loading) return null

  const weightRatio = threshold > 0 ? totalWeight / threshold : 0
  const weightColor = weightRatio >= 1 ? '#e05c5c' : weightRatio >= 0.75 ? '#FFA500' : '#5b8dee'
  const pct = Math.round(Math.min(weightRatio, 1) * 100)

  return (
    <div style={s.root}>
      <div style={s.gaugeRow}>
        <div style={s.gaugeTrack}>
          <div style={{ ...s.gaugeFill, width: `${pct}%`, background: weightColor }} />
        </div>
        <span style={{ ...s.gaugePct, color: weightColor }}>{pct}%</span>
      </div>

      <div style={s.statsRow}>
        <span style={s.statLabel}>
          {t('inventoryPanel.weightLabel')}&nbsp;
          <span style={{ color: weightColor }}>{weightFmt(totalWeight)} / {weightFmt(threshold)} kg</span>
        </span>
        {iniPenalty > 0 && (
          <span style={{ ...s.statLabel, color: '#FF6B6B' }}>{t('inventoryPanel.iniPenalty', { value: iniPenalty })}</span>
        )}
        <span style={{ ...s.statLabel, display: 'flex', alignItems: 'center', gap: 4 }}>
          {t('inventoryPanel.solLabel')}&nbsp;
          {editingSols && canEdit ? (
            <input
              style={s.solsInput}
              value={solsInput}
              onChange={e => setSolsInput(e.target.value)}
              onBlur={handleSolsSave}
              onKeyDown={e => {
                if (e.code === 'Enter')  { e.preventDefault(); handleSolsSave() }
                if (e.code === 'Escape') { setSolsInput(String(sols)); setEditingSols(false) }
              }}
              autoFocus
            />
          ) : (
            <span
              style={{ color: '#c0c0d0', cursor: canEdit ? 'pointer' : 'default', textDecoration: canEdit ? 'underline dotted' : 'none' }}
              onClick={() => { if (canEdit) { setSolsInput(String(sols)); setEditingSols(true) } }}
            >
              {sols}
            </span>
          )}
        </span>
      </div>
    </div>
  )
}

const s = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '8px 0',
    borderBottom: '1px solid #2a2a3e',
    marginBottom: 8,
  },
  gaugeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  gaugeTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    background: '#0e0e1a',
    border: '1px solid #2a2a3e',
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
    borderRadius: 4,
    transition: 'width 200ms ease',
  },
  gaugePct: {
    fontSize: 11,
    fontWeight: 700,
    width: 34,
    textAlign: 'right',
    flexShrink: 0,
  },
  statsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    fontSize: 12,
  },
  statLabel: {
    color: '#5a5a7a',
  },
  solsInput: {
    width: 60, background: '#0e0e1a', border: '1px solid #5b8dee',
    borderRadius: 4, padding: '1px 4px', color: '#c0c0d0', fontSize: 12, outline: 'none',
  },
}
