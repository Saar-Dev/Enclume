// client/src/components/creation/Step2Genotype.jsx
// Corrections : case Déserteur + aperçu attributs après sélection

import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const ASSETS_BASE = `${import.meta.env.VITE_API_URL}/api/assets/assets`
const GENO_IMAGES = {
  HUMAIN:  `${ASSETS_BASE}/s1_human.webp`,
  HYB_NAT: `${ASSETS_BASE}/s1_hybrid.webp`,
  GEN_HYB: `${ASSETS_BASE}/s1_geno.webp`,
  TEC_HYB: `${ASSETS_BASE}/s1_techno.webp`,
}

const GENOTYPES = [
  {
    id: 'HUMAIN',
    cost: 0,
    attributes: [],
    conditions: null,
    traits: [
      { nameKey: 'step2.humain.traitPolyvalent', descKey: 'step2.humain.traitPolyvalentDesc' },
    ],
  },
  {
    id: 'HYB_NAT',
    cost: 5,
    attributes: [
      { label: 'Force', value: '+1' },
      { label: 'Constitution', value: '+2' },
      { label: 'Coordination', value: '+2' },
      { label: 'Adaptation', value: '+1' },
      { label: 'Intelligence', value: '-2' },
    ],
    conditions: null,
    traits: [
      { nameKey: 'step2.hybNat.traitCompetence', descKey: 'step2.hybNat.traitCompetenceDesc' },
      { nameKey: 'step2.hybNat.traitMutation', descKey: 'step2.hybNat.traitMutationDesc' },
      { nameKey: 'step2.hybNat.traitAdaptation', descKey: 'step2.hybNat.traitAdaptationDesc' },
      { nameKey: 'step2.hybNat.traitImmuniteFroid', descKey: 'step2.hybNat.traitImmuniteFroidDesc' },
      { nameKey: 'step2.hybNat.traitSensibiliteChaleur', descKey: 'step2.hybNat.traitSensibiliteChaleurDesc' },
      { nameKey: 'step2.hybNat.traitDependance', descKey: 'step2.hybNat.traitDependanceDesc' },
      { nameKey: 'step2.hybNat.traitClaustrophobie', descKey: 'step2.hybNat.traitClaustrophobieDesc' },
      { nameKey: 'step2.hybNat.traitBlocage', descKey: 'step2.hybNat.traitBlocageDesc' },
      { nameKey: 'step2.hybNat.traitRecherche', descKey: 'step2.hybNat.traitRechercheDesc' },
    ],
  },
  {
    id: 'GEN_HYB',
    cost: 5,
    attributes: [
      { label: 'Force', value: '+1' },
      { label: 'Constitution', value: '+1' },
      { label: 'Coordination', value: '+2' },
      { label: 'Présence', value: '-2' },
    ],
    conditions: {
      items: ['step2.genHyb.condition1'],
      noteKey: 'step2.genHyb.conditionNote',
    },
    traits: [
      { nameKey: 'step2.genHyb.traitAdaptation', descKey: 'step2.genHyb.traitAdaptationDesc' },
      { nameKey: 'step2.genHyb.traitImmuniteFroid', descKey: 'step2.genHyb.traitImmuniteFroidDesc' },
      { nameKey: 'step2.genHyb.traitClaustrophobie', descKey: 'step2.genHyb.traitClaustrophobieDesc' },
      { nameKey: 'step2.genHyb.traitCompetence', descKey: 'step2.genHyb.traitCompetenceDesc' },
      { nameKey: 'step2.genHyb.traitMutation', descKey: 'step2.genHyb.traitMutationDesc' },
      { nameKey: 'step2.genHyb.traitSensibiliteChaleur', descKey: 'step2.genHyb.traitSensibiliteChaleurDesc' },
      { nameKey: 'step2.genHyb.traitDependance', descKey: 'step2.genHyb.traitDependanceDesc' },
      { nameKey: 'step2.genHyb.traitBlocage', descKey: 'step2.genHyb.traitBlocageDesc' },
      { nameKey: 'step2.genHyb.traitRecherche', descKey: 'step2.genHyb.traitRechercheDesc' },
    ],
  },
  {
    id: 'TEC_HYB',
    cost: 5,
    costNoteKey: 'step2.tecHyb.costNote',
    attributes: [
      { label: 'Force', value: '+2' },
      { label: 'Constitution', value: '+3' },
      { label: 'Adaptation', value: '-2' },
      { label: 'Volonté', value: '+3' },
      { label: 'Présence', value: '-6 (min 3)' },
    ],
    conditions: {
      items: [
        'step2.tecHyb.condition1',
        'step2.tecHyb.condition2',
        'step2.tecHyb.condition3',
      ],
      noteKey: 'step2.tecHyb.conditionNote',
    },
    traits: [
      { nameKey: 'step2.tecHyb.traitImmuniteFroid', descKey: 'step2.tecHyb.traitImmuniteFroidDesc' },
      { nameKey: 'step2.tecHyb.traitClaustrophobie', descKey: 'step2.tecHyb.traitClaustrophobieDesc' },
      { nameKey: 'step2.tecHyb.traitCompetence', descKey: 'step2.tecHyb.traitCompetenceDesc' },
      { nameKey: 'step2.tecHyb.traitSensibiliteChaleur', descKey: 'step2.tecHyb.traitSensibiliteChaleurDesc' },
      { nameKey: 'step2.tecHyb.traitDependance', descKey: 'step2.tecHyb.traitDependanceDesc' },
      { nameKey: 'step2.tecHyb.traitRecherche', descKey: 'step2.tecHyb.traitRechercheDesc' },
    ],
  },
]

const getGenoKey = (id) => {
  switch (id) {
    case 'HUMAIN': return 'humain'
    case 'HYB_NAT': return 'hybNat'
    case 'GEN_HYB': return 'genHyb'
    case 'TEC_HYB': return 'tecHyb'
    default: return 'humain'
  }
}

const MOCK_BASE_ATTRS = { FOR: 12, CON: 13, COO: 14, ADA: 15, PER: 12, INT: 10, VOL: 14, PRE: 9 }

export default function Step2Genotype({ onNext, onPrev }) {
  const { t } = useTranslation('creation')
  const [selected, setSelected] = useState(null)
  const [isDeserter, setIsDeserter] = useState(false)
  const [expandedTrait, setExpandedTrait] = useState(null)
  const [expandedCondition, setExpandedCondition] = useState(false)

  const handleSelect = (geno) => {
    setSelected(geno)
    setIsDeserter(false)
    setExpandedTrait(null)
    setExpandedCondition(false)
  }

  const handleBack = () => {
    setSelected(null)
    setIsDeserter(false)
  }

  const handleConfirm = () => {
    if (selected) {
      onNext({ genotypeId: selected.id, isDeserter })
    }
  }

  if (selected) {
    const key = getGenoKey(selected.id)
    const effectiveCost = selected.id === 'TEC_HYB' && isDeserter ? 4 : selected.cost

    return (
      <div style={s.container}>

        <div style={s.detailFull}>
          <button style={s.backBtn} onClick={handleBack}>
            ← {t('step2.back')}
          </button>

          <h2 style={s.detailName}>
            {t(`step2.${key}.name`)}
            <span style={s.detailCost}>
              {effectiveCost > 0 ? `${effectiveCost} PC` : t('step2.free')}
            </span>
          </h2>

          <p style={s.detailDesc}>{t(`step2.${key}.desc`)}</p>

          {selected.costNoteKey && (
            <p style={s.costNote}>{t(selected.costNoteKey)}</p>
          )}

          {selected.id === 'TEC_HYB' && (
            <label style={s.checkLabel}>
              <input
                type="checkbox"
                checked={isDeserter}
                onChange={e => setIsDeserter(e.target.checked)}
                style={s.checkbox}
              />
              <span style={s.checkText}>{t('step2.deserter_label')}</span>
              {isDeserter && (
                <span style={s.checkCost}>{t('step2.deserter_cost')}</span>
              )}
            </label>
          )}

          {selected.attributes.length > 0 && (
            <div style={s.detailSection}>
              <h3 style={s.detailTitle}>{t('step2.attributesTitle')}</h3>
              <div style={s.attrGrid}>
                {selected.attributes.map(attr => (
                  <div key={attr.label} style={s.attrItem}>
                    <span style={s.attrLabel}>{attr.label}</span>
                    <span style={{
                      ...s.attrValue,
                      color: attr.value.startsWith('+') ? '#4a9e5c' : attr.value.startsWith('-') ? '#e05c5c' : '#9090c8',
                    }}>
                      {attr.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={s.detailSection}>
            <h3 style={s.detailTitle}>{t('step2.attr_after')}</h3>
            <div style={s.afterGrid}>
              {['FOR','CON','COO','ADA','PER','INT','VOL','PRE'].map(attrId => {
                const base = MOCK_BASE_ATTRS[attrId] || 7
                const modAttr = selected.attributes.find(a => {
                  const map = { Force:'FOR', Constitution:'CON', Coordination:'COO', Adaptation:'ADA', Perception:'PER', Intelligence:'INT', Volonté:'VOL', Présence:'PRE' }
                  return map[a.label] === attrId
                })
                const mod = modAttr ? parseInt(modAttr.value) || 0 : 0
                const effective = base + mod
                return (
                  <div key={attrId} style={s.afterItem}>
                    <span style={s.afterLabel}>{attrId}</span>
                    <span style={s.afterCalc}>
                      {base}{mod >= 0 ? '+' : ''}{mod}
                    </span>
                    <span style={{
                      ...s.afterValue,
                      color: effective > base ? '#4a9e5c' : effective < base ? '#e05c5c' : '#c0c0d0',
                    }}>
                      = {effective}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {selected.conditions && (
            <div style={s.detailSection}>
              <div
                style={s.accordionHeader}
                onClick={() => setExpandedCondition(!expandedCondition)}
              >
                <span>{t('step2.conditionsTitle')}</span>
                <span style={s.accordionArrow}>{expandedCondition ? '▾' : '▸'}</span>
              </div>
              {expandedCondition && (
                <div style={s.accordionBody}>
                  <ul style={s.condList}>
                    {selected.conditions.items.map((k, i) => (
                      <li key={i}>{t(k)}</li>
                    ))}
                  </ul>
                  {selected.conditions.noteKey && (
                    <p style={s.condNote}>{t(selected.conditions.noteKey)}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {selected.traits.length > 0 && (
            <div style={s.detailSection}>
              <h3 style={s.detailTitle}>{t('step2.traitsTitle')}</h3>
              {selected.traits.map((trait, i) => (
                <div key={i} style={s.accordion}>
                  <div
                    style={s.accordionHeader}
                    onClick={() => setExpandedTrait(expandedTrait === i ? null : i)}
                  >
                    <span>{t(trait.nameKey)}</span>
                    <span style={s.accordionArrow}>{expandedTrait === i ? '▾' : '▸'}</span>
                  </div>
                  {expandedTrait === i && (
                    <div style={s.accordionBody}>
                      <p style={s.traitDesc}>{t(trait.descKey)}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <button style={s.backBtn} onClick={handleBack}>
            ← {t('step2.back')}
          </button>

          <button style={s.selectBtn} onClick={handleConfirm}>
            {t('step2.select', { name: t(`step2.${key}.name`) })}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="wiz2-container">

      <div className="wiz2-carousel">
        {GENOTYPES.map(geno => {
          const key = getGenoKey(geno.id)
          return (
            <div
              key={geno.id}
              className="wiz2-card"
              onClick={() => handleSelect(geno)}
            >
              <img className="wiz2-card-img" src={GENO_IMAGES[geno.id]} alt="" />
              <div className="wiz2-vignette" />
              <div className="wiz2-card-top">
                <span className="wiz2-card-name">{t(`step2.${key}.name`)}</span>
                <span className={`wiz2-card-cost${geno.cost === 0 ? ' wiz2-card-cost--free' : ''}`}>
                  {geno.cost > 0 ? `${geno.cost} PC` : t('step2.free')}
                </span>
              </div>
              <div className="wiz2-card-bottom">
                <p className="wiz2-card-summary">{t(`step2.${key}.summary`)}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="wiz2-nav">
        {onPrev && (
          <button className="btn btn-ghost" onClick={onPrev}>
            ← {t('step2.prev')}
          </button>
        )}
      </div>
    </div>
  )
}

const s = {
  detailFull: {
    flex: 1,
    overflowY: 'auto',
    border: '1px solid #1e1e2e',
    borderRadius: '8px',
    padding: '16px 20px',
    backgroundColor: 'rgba(6,6,14,0.85)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  backBtn: {
    alignSelf: 'flex-start',
    padding: '6px 14px',
    border: '1px solid #2a2a3e',
    borderRadius: '4px',
    backgroundColor: '#0e0e1a',
    color: '#6a6a8a',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  detailName: {
    color: '#c0c0d0',
    fontSize: '17px',
    fontWeight: '700',
    margin: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailCost: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#5b8dee',
  },
  detailDesc: {
    color: '#9090c8',
    fontSize: '12px',
    lineHeight: '1.7',
    margin: 0,
  },
  costNote: {
    color: '#e0a85c',
    fontSize: '11px',
    fontStyle: 'italic',
    margin: 0,
  },
  checkLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: 'rgba(224,168,92,0.06)',
    borderRadius: '4px',
    border: '1px solid rgba(224,168,92,0.15)',
    cursor: 'pointer',
  },
  checkbox: {
    width: '16px',
    height: '16px',
    accentColor: '#e0a85c',
    cursor: 'pointer',
  },
  checkText: {
    color: '#c0c0d0',
    fontSize: '12px',
    fontWeight: '600',
    flex: 1,
  },
  checkCost: {
    color: '#e0a85c',
    fontSize: '12px',
    fontWeight: '700',
  },
  detailSection: {
    border: '1px solid #1e1e2e',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  detailTitle: {
    color: '#5b8dee',
    fontSize: '11px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    padding: '8px 12px',
    backgroundColor: 'rgba(14,14,26,0.9)',
    borderBottom: '1px solid #1e1e2e',
    margin: 0,
  },
  attrGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
    gap: '1px',
    padding: '8px',
  },
  attrItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 10px',
    backgroundColor: 'rgba(14,14,26,0.6)',
    borderRadius: '3px',
  },
  attrLabel: {
    color: '#5a5a7a',
    fontSize: '11px',
    fontWeight: '600',
  },
  attrValue: {
    fontSize: '12px',
    fontWeight: '700',
  },
  afterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '4px',
    padding: '8px',
  },
  afterItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 10px',
    backgroundColor: 'rgba(14,14,26,0.6)',
    borderRadius: '3px',
  },
  afterLabel: {
    color: '#5a5a7a',
    fontSize: '11px',
    fontWeight: '700',
    width: '32px',
  },
  afterCalc: {
    color: '#9090c8',
    fontSize: '12px',
    fontWeight: '600',
    flex: 1,
  },
  afterValue: {
    fontSize: '13px',
    fontWeight: '700',
  },
  accordion: {
    borderBottom: '1px solid #1a1a2e',
  },
  accordionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    cursor: 'pointer',
    color: '#9090c8',
    fontSize: '12px',
    fontWeight: '600',
  },
  accordionArrow: {
    color: '#5a5a7a',
    fontSize: '12px',
  },
  accordionBody: {
    padding: '8px 12px 12px 12px',
  },
  traitDesc: {
    color: '#6a6a8a',
    fontSize: '11px',
    lineHeight: '1.7',
    margin: 0,
  },
  condList: {
    color: '#9090c8',
    fontSize: '11px',
    lineHeight: '1.8',
    paddingLeft: '20px',
    margin: 0,
  },
  condNote: {
    color: '#e0a85c',
    fontSize: '10px',
    fontStyle: 'italic',
    marginTop: '8px',
  },
  selectBtn: {
    padding: '10px 24px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#5b8dee',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    alignSelf: 'center',
  },
}