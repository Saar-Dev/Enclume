// StepMaterielEtBiens.jsx — Wizard Step6 "Matériel & Biens" (docs/PLAN_WIZARD_MATERIEL.md).
//
// Jamais bloquant (décision Saar §0) : "Suivant" est toujours disponible, avec ou sans action MJ.
// Aucune donnée d'étape (step6Data) — les deux actions possibles (ajouter un objet, ajouter une
// note) écrivent immédiatement en base via des endpoints déjà existants (InventoryPanel.jsx,
// PossessionNotes.jsx), jamais bufferisées dans le store puis reconciliées comme les steps 1-5.

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useCreationStore } from '../../stores/creationStore'
import InventoryPanel from '../../character/InventoryPanel.jsx'
import PossessionNotes from './PossessionNotes.jsx'
import { useWizardInventorySync } from '../../lib/useWizardInventorySync.js'
import { PRO_ADV_CATEGORY_RULE_KEYS } from './proAdvCategoryRuleKeys.js'

export default function StepMaterielEtBiens({ characterId, isGmView, onPrev, onNext, advancing }) {
  const { t } = useTranslation('creation')
  const step4Data = useCreationStore(s => s.step4Data)
  const reloadKey = useWizardInventorySync(characterId)

  // Récap des jauges (§1 du plan) — step4Data.careers[].proAdvantages déjà dans le store
  // (getStep4State le renvoie par carrière), aucune donnée serveur supplémentaire à charger.
  // Regroupé par clé de règle normalisée (proAdvCategoryRuleKeys.js, déjà utilisé par Step4 pour le
  // même problème) — pas par libellé brut, qui varie d'un lot de seed à l'autre pour la même
  // catégorie réelle ("Cache/Planque" vs "Planque/Cache").
  const gauges = useMemo(() => {
    const totals = {}
    const fallbackLabels = {}
    for (const career of step4Data?.careers ?? []) {
      for (const [rawCategory, points] of Object.entries(career.proAdvantages ?? {})) {
        const key = PRO_ADV_CATEGORY_RULE_KEYS[rawCategory] ?? rawCategory
        totals[key] = (totals[key] ?? 0) + points
        if (!fallbackLabels[key]) fallbackLabels[key] = rawCategory
      }
    }
    return Object.entries(totals).map(([key, points]) => ({
      key,
      points,
      label: t(`step4.pro_adv_rules.${key}.title`, { defaultValue: fallbackLabels[key] }),
    }))
  }, [step4Data, t])

  return (
    <div style={s.container}>
      <div style={s.scroll}>
        <div style={s.block}>
          <h3 style={s.blockTitle}>{t('materiel.gaugesTitle')}</h3>
          <p style={s.desc}>{t('materiel.gaugesDesc')}</p>
          {gauges.length === 0 ? (
            <p style={s.empty}>{t('materiel.gaugesEmpty')}</p>
          ) : (
            <div style={s.gaugeGrid}>
              {gauges.map(g => (
                <div key={g.key} style={s.gaugeRow}>
                  <span style={s.gaugeLabel}>{g.label}</span>
                  <span style={s.gaugeValue}>{g.points}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={s.block}>
          <h3 style={s.blockTitle}>{t('materiel.inventoryTitle')}</h3>
          {!isGmView && <p style={s.desc}>{t('materiel.inventoryPlayerHint')}</p>}
          <InventoryPanel
            characterId={characterId}
            canEdit={isGmView}
            isGm={isGmView}
            reloadKey={reloadKey}
          />
        </div>

        <div style={s.block}>
          <PossessionNotes characterId={characterId} canEdit />
        </div>
      </div>

      <div style={s.nav}>
        <button className="btn btn-ghost" onClick={onPrev}>← {t('materiel.prev')}</button>
        <button className="btn btn-gold" onClick={onNext} disabled={advancing}>
          {advancing ? '…' : t('materiel.next')} →
        </button>
      </div>
    </div>
  )
}

const s = {
  container: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  scroll: { flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 },
  block: { display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid #1e1e2e', borderRadius: 6, padding: 12, backgroundColor: 'rgba(6,6,14,0.6)' },
  blockTitle: { color: '#9090c8', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 },
  desc: { color: '#6a6a8a', fontSize: 11, margin: 0 },
  empty: { color: '#4a4a60', fontSize: 12, fontStyle: 'italic' },
  gaugeGrid: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  gaugeRow: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid #2a2a3e', borderRadius: 4, backgroundColor: '#0e0e1a' },
  gaugeLabel: { color: '#c0c0d0', fontSize: 12 },
  gaugeValue: { color: '#e0a85c', fontSize: 13, fontWeight: 700 },
  nav: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 20px', borderTop: '1px solid #1e1e2e', flexShrink: 0,
  },
}
