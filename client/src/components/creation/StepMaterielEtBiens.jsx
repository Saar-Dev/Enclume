// StepMaterielEtBiens.jsx — Wizard Step6 "Matériel & Biens" (docs/PLAN_WIZARD_MATERIEL.md).
//
// Jamais bloquant (décision Saar §0) : "Suivant" est toujours disponible, avec ou sans action MJ.
// Aucune donnée d'étape (step6Data) — les deux actions possibles (ajouter un objet, ajouter une
// note) écrivent immédiatement en base via des endpoints déjà existants (InventoryPanel.jsx,
// PossessionNotes.jsx), jamais bufferisées dans le store puis reconciliées comme les steps 1-5.

import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import InventoryPanel from '../../character/InventoryPanel.jsx'
import PossessionNotes from './PossessionNotes.jsx'
import { useWizardInventorySync } from '../../lib/useWizardInventorySync.js'
import { useInventoryData } from '../../lib/useInventoryData.js'
import { useGaugesData } from '../../lib/useGaugesData.js'
import { adjustGauge } from '../../lib/gaugesMutations.js'

export default function StepMaterielEtBiens({ characterId, isGmView, isOwner, hasCampaign = true, onPrev, onNext, advancing }) {
  const { t } = useTranslation('creation')
  useWizardInventorySync(characterId)
  const canEdit = isGmView || isOwner
  const isGm = isGmView

  // PLAN_WIZARD_MATERIEL_GAUGES.md §0 point 5/§5 — ressource persistée (char_gauges), plus un calcul
  // théorique en lecture seule depuis step4Data : la valeur de départ était le total théorique au
  // moment du seed serveur (creationService.js), mais devient ensuite indépendante (gérée par le MJ).
  const { gauges } = useGaugesData(characterId)
  const gaugeEntries = Object.entries(gauges).map(([key, value]) => ({
    key, value, label: t(`step4.pro_adv_rules.${key}.title`, { defaultValue: key }),
  }))
  const [adjustingKey, setAdjustingKey] = useState(null)
  const handleAdjustGauge = useCallback(async (categoryKey, delta) => {
    setAdjustingKey(categoryKey)
    try {
      await adjustGauge(characterId, categoryKey, delta)
    } catch (err) {
      console.error('Erreur ajustement jauge :', err)
    } finally {
      setAdjustingKey(null)
    }
  }, [characterId])

  // Blocage joueur (§0 point 4) : jamais bloquant si aucun item proposé, bloqué tant qu'il en reste
  // un non validé sinon. Même hook que InventoryPanel (useInventoryData.js, façade store dédupliquée)
  // — pas de callback remonté depuis InventoryPanel, la donnée est déjà partagée par le store.
  const { items: inventoryItems } = useInventoryData(characterId)
  const pendingCount = inventoryItems.filter(i => !i.validated_by_gm).length
  const playerBlocked = !isGm && pendingCount > 0

  return (
    <div style={s.container}>
      <div style={s.scroll}>
        <div style={s.block}>
          <h3 style={s.blockTitle}>{t('materiel.gaugesTitle')}</h3>
          <p style={s.desc}>{t('materiel.gaugesDesc')}</p>
          {gaugeEntries.length === 0 ? (
            <p style={s.empty}>{t('materiel.gaugesEmpty')}</p>
          ) : (
            <div style={s.gaugeGrid}>
              {gaugeEntries.map(g => (
                <div key={g.key} style={s.gaugeRow}>
                  <span style={s.gaugeLabel}>{g.label}</span>
                  {isGm && (
                    <button
                      className="btn-icon"
                      onClick={() => handleAdjustGauge(g.key, -1)}
                      disabled={adjustingKey === g.key}
                    >−</button>
                  )}
                  <span style={s.gaugeValue}>{g.value}</span>
                  {isGm && (
                    <button
                      className="btn-icon"
                      onClick={() => handleAdjustGauge(g.key, 1)}
                      disabled={adjustingKey === g.key}
                    >+</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={s.block}>
          <h3 style={s.blockTitle}>{t('materiel.inventoryTitle')}</h3>
          {!isGm && <p style={s.desc}>{t('materiel.inventoryPlayerHint')}</p>}
          <InventoryPanel
            characterId={characterId}
            canEdit={canEdit}
            isGm={isGm}
            hasCampaign={hasCampaign}
            inWizard
          />
        </div>

        <div style={s.block}>
          <PossessionNotes characterId={characterId} canEdit />
        </div>
      </div>

      <div style={s.nav}>
        <button className="btn btn-ghost" onClick={onPrev}>← {t('materiel.prev')}</button>
        {playerBlocked && <p style={s.blockedHint}>{t('materiel.pendingValidationHint')}</p>}
        <button className="btn btn-gold" onClick={onNext} disabled={advancing || playerBlocked}>
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
  blockedHint: { color: '#c07050', fontSize: 11, margin: 0 },
}
