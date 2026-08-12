import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGaugesData } from '../lib/useGaugesData.js'
import { adjustGauge } from '../lib/gaugesMutations.js'

// PLAN_WIZARD_MATERIEL_GAUGES.md §6 — fiche permanente, onglet Matériel (CharacterWindow.jsx), à
// côté d'InventoryPanel. Rester compact — grille 2 colonnes déjà tentée et rejetée sur ce même onglet
// (§0bis point 8, "bloc trop massif, silhouette écrasée", 2026-08-05).
//
// Labels de catégorie : mêmes clés que Step4/StepMaterielEtBiens (namespace `creation`,
// step4.pro_adv_rules.<key>.title) — une seule source pour ces ~29 libellés, jamais dupliquée dans
// charSheet.json (Règle 2 du projet, une information = un seul endroit).
export default function GaugesPanel({ characterId, isGm }) {
  const { t } = useTranslation(['charSheet', 'creation'])
  const { gauges } = useGaugesData(characterId)
  const entries = Object.entries(gauges).map(([key, value]) => ({
    key, value, label: t(`step4.pro_adv_rules.${key}.title`, { ns: 'creation', defaultValue: key }),
  }))

  const [adjustingKey, setAdjustingKey] = useState(null)
  const handleAdjust = useCallback(async (categoryKey, delta) => {
    setAdjustingKey(categoryKey)
    try {
      await adjustGauge(characterId, categoryKey, delta)
    } catch (err) {
      console.error('Erreur ajustement jauge :', err)
    } finally {
      setAdjustingKey(null)
    }
  }, [characterId])

  if (entries.length === 0) return null

  return (
    <div style={s.root}>
      <div style={s.separator} />
      <div style={s.label}>{t('gaugesPanel.title')}</div>
      <div style={s.grid}>
        {entries.map(g => (
          <div key={g.key} style={s.row}>
            <span style={s.name}>{g.label}</span>
            {isGm && (
              <button className="btn-icon" onClick={() => handleAdjust(g.key, -1)} disabled={adjustingKey === g.key}>−</button>
            )}
            <span style={s.value}>{g.value}</span>
            {isGm && (
              <button className="btn-icon" onClick={() => handleAdjust(g.key, 1)} disabled={adjustingKey === g.key}>+</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const s = {
  root: { marginTop: 8 },
  separator: { height: 1, backgroundColor: '#2a2a3e', margin: '12px 0' },
  label: {
    fontSize: 10, color: '#4a4a60', textTransform: 'uppercase',
    letterSpacing: '0.07em', marginBottom: 4,
  },
  grid: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  row: {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '2px 8px', border: '1px solid #2a2a3e', borderRadius: 4,
    backgroundColor: '#0e0e1a', fontSize: 11,
  },
  name: { color: '#c0c0d0' },
  value: { color: '#e0a85c', fontWeight: 700, minWidth: 14, textAlign: 'center' },
}
