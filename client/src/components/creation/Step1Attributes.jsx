// client/src/components/creation/Step1Attributes.jsx
// Correction : bouton Suivant désactivé si pointsRestants !== 0

import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  POOL_AMBIANCE,
  CHANCE_AMBIANCE,
  COST_LOOKUP,
  calcTotalCost,
  calcAN,
} from '../../../../shared/polarisUtils.js'

const ATTR_IDS = ['FOR', 'CON', 'COO', 'ADA', 'PER', 'INT', 'VOL', 'PRE']
const PC_MAX = 8

const ATTR_DESCRIPTIONS = {
  FOR: "La Force est une mesure de la puissance brute d'un individu, sa capacité musculaire.",
  CON: "La Constitution caractérise l'endurance d'un individu, sa santé, sa résistance à l'effort physique, aux poisons, aux maladies, aux traumatismes, aux conditions extrêmes.",
  COO: "La Coordination détermine la coordination neuromusculaire du personnage, mais aussi plus largement son agilité physique, son sens de l'équilibre, la fluidité et la précision de ses gestes, de ses mouvements et de ses déplacements.",
  ADA: "L'Adaptation représente la capacité du personnage à s'adapter à son environnement, et notamment à une situation qui change brutalement, les réflexes issus de son instinct de survie et la rapidité de sa réflexion.",
  PER: "La Perception détermine l'acuité des cinq sens du personnage, mais aussi sa vigilance, l'attention qu'il porte à son environnement ou au comportement des gens, sa capacité à remarquer les petits détails du monde qui l'entoure.",
  INT: "L'Intelligence mesure les capacités mentales d'un individu. C'est aussi sa faculté d'assimilation de nouvelles connaissances.",
  VOL: "La Volonté détermine la résistance mentale d'une personne, sa capacité à maîtriser ses réactions en situation de stress et le temps pendant lequel elle peut maintenir sa concentration sur une action quelconque. C'est aussi sa persévérance, sa force de caractère et sa volonté de survivre face à l'adversité.",
  PRE: "La Présence est une mesure de l'aura dégagée par une personne, de son charisme. Son importance est vitale dans toutes les actions relationnelles : séduire, impressionner, commander, intimider…",
}

const ROW_TOOLTIPS = {
  base: "Niveau de base : score initial de l'Attribut avant modificateurs. Fixé à cette étape, il ne changera plus.",
  modGen: 'Mod. Type Génétique : bonus ou malus appliqué par le type génétique du personnage (Étape 2).',
  na: "Niveau Actuel : somme du niveau de base et de tous les modificateurs. C'est la valeur réellement utilisée en jeu.",
  an: "Aptitude Naturelle : dérivée du Niveau Actuel, utilisée pour calculer le niveau de base des Compétences.",
}

export default function Step1Attributes({ ambiance, isFeminin, onNext, onPrev, onPcChange }) {
  const { t } = useTranslation('creation')

  const [charName, setCharName] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [pcAlloues, setPcAlloues] = useState(0)
  const [attributs, setAttributs] = useState(() =>
    Object.fromEntries(ATTR_IDS.map(id => [id, id === 'FOR' && isFeminin ? 5 : 7]))
  )
  const [tooltip, setTooltip] = useState(null)

  const poolBase = POOL_AMBIANCE[ambiance] || 38
  const poolTotal = poolBase + (pcAlloues * 2)
  const totalCost = calcTotalCost(attributs, isFeminin)
  const pointsRestants = poolTotal - totalCost
  const chc = CHANCE_AMBIANCE[ambiance] || 13

  const handleBuyPc = useCallback(() => {
    if (pcAlloues >= PC_MAX) return
    const next = pcAlloues + 1
    setPcAlloues(next)
    onPcChange?.(next)
  }, [pcAlloues, onPcChange])

  const handleCancelPc = useCallback(() => {
    if (pcAlloues <= 0) return
    const newPoolBase = poolBase + ((pcAlloues - 1) * 2)
    if (totalCost > newPoolBase) return
    const next = pcAlloues - 1
    setPcAlloues(next)
    onPcChange?.(next)
  }, [pcAlloues, poolBase, totalCost, onPcChange])

  const handleChange = useCallback((attrId, delta) => {
    setAttributs(prev => {
      const current = prev[attrId]
      const next = current + delta
      const base = (attrId === 'FOR' && isFeminin) ? 5 : 7
      if (next < base || next > 20) return prev
      const newAttributs = { ...prev, [attrId]: next }
      const newCost = calcTotalCost(newAttributs, isFeminin)
      if (newCost > poolTotal) return prev
      if (isFeminin) {
        const bonusCOO = Math.max(0, newAttributs['COO'] - 7)
        const bonusPRE = Math.max(0, newAttributs['PRE'] - 7)
        if (bonusCOO + bonusPRE > 2) return prev
      }
      return newAttributs
    })
  }, [isFeminin, poolTotal])

  const showTooltip = (desc, event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setTooltip({ desc, top: rect.top, left: rect.left + rect.width / 2 })
  }

  const naMap = useMemo(
    () => Object.fromEntries(ATTR_IDS.map(id => [id, Math.max(3, attributs[id])])),
    [attributs]
  )

  const bonusFemininUtilises = useMemo(() => {
    if (!isFeminin) return 0
    return Math.max(0, attributs['COO'] - 7) + Math.max(0, attributs['PRE'] - 7)
  }, [attributs, isFeminin])

  const canBuyPc = pcAlloues < PC_MAX
  const canCancelPc = pcAlloues > 0
  const canNext = pointsRestants === 0

  return (
    <div style={s.container}>

      <div style={s.namesRow}>
        <div style={s.nameField}>
          <input
            style={s.nameInput}
            value={charName}
            onChange={e => setCharName(e.target.value)}
            placeholder={t('step1.charNamePlaceholder')}
          />
          <span style={s.nameLabel}>{t('step1.charName')}</span>
        </div>
        <div style={s.nameField}>
          <input
            style={s.nameInput}
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            placeholder={t('step1.playerNamePlaceholder')}
          />
          <span style={s.nameLabel}>{t('step1.playerName')}</span>
        </div>
      </div>

      <div style={s.block}>
        <div style={s.blockTitle}>{t('step1.tableTitle')}</div>
        <table style={s.attrTable}>
          <thead>
            <tr>
              <th style={s.th}></th>
              {ATTR_IDS.map(id => (
                <th
                  key={id}
                  style={{ ...s.th, cursor: 'help' }}
                  onMouseEnter={(e) => showTooltip(ATTR_DESCRIPTIONS[id], e)}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {t(`step1.attr${id}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>

            <tr>
              <td
                style={{ ...s.tdLabel, cursor: 'help' }}
                onMouseEnter={(e) => showTooltip(ROW_TOOLTIPS.base, e)}
                onMouseLeave={() => setTooltip(null)}
              >
                {t('step1.rowBase')}
              </td>
              {ATTR_IDS.map(id => (
                <td key={id} style={s.td}>
                  <div style={s.spinner}>
                    <button style={s.spinBtn} onClick={() => handleChange(id, -1)}>−</button>
                    <span style={s.spinValue}>{attributs[id]}</span>
                    <button style={s.spinBtn} onClick={() => handleChange(id, +1)}>+</button>
                  </div>
                </td>
              ))}
            </tr>

            <tr>
              <td
                style={{ ...s.tdLabel, cursor: 'help' }}
                onMouseEnter={(e) => showTooltip(ROW_TOOLTIPS.modGen, e)}
                onMouseLeave={() => setTooltip(null)}
              >
                {t('step1.rowModGen')}
              </td>
              {ATTR_IDS.map(id => (
                <td key={id} style={s.td}>
                  <span style={s.readonly}>0</span>
                </td>
              ))}
            </tr>

            <tr style={{ backgroundColor: 'rgba(91,141,238,0.08)' }}>
              <td
                style={{ ...s.tdLabel, cursor: 'help' }}
                onMouseEnter={(e) => showTooltip(ROW_TOOLTIPS.na, e)}
                onMouseLeave={() => setTooltip(null)}
              >
                {t('step1.rowNA')}
              </td>
              {ATTR_IDS.map(id => (
                <td key={id} style={s.td}>
                  <span style={{ ...s.readonly, color: '#5b8dee', fontWeight: '700' }}>
                    {naMap[id]}
                  </span>
                </td>
              ))}
            </tr>

            <tr style={{ backgroundColor: 'rgba(91,141,238,0.04)' }}>
              <td
                style={{ ...s.tdLabel, cursor: 'help' }}
                onMouseEnter={(e) => showTooltip(ROW_TOOLTIPS.an, e)}
                onMouseLeave={() => setTooltip(null)}
              >
                {t('step1.rowAN')}
              </td>
              {ATTR_IDS.map(id => (
                <td key={id} style={s.td}>
                  <span style={{ ...s.readonly, color: '#9090c8' }}>
                    {calcAN(naMap[id]) >= 0 ? `+${calcAN(naMap[id])}` : calcAN(naMap[id])}
                  </span>
                </td>
              ))}
            </tr>

          </tbody>
        </table>

        <div style={s.counterRow}>
          <span style={{
            ...s.counter,
            ...(pointsRestants === 0 ? s.counterOk : s.counterWarn),
          }}>
            {pointsRestants > 0
              ? t('step1.pointsRestants', { n: pointsRestants })
              : t('step1.pointsOk')}
          </span>
          {isFeminin && (
            <span style={{
              ...s.counter,
              ...(bonusFemininUtilises <= 2 ? s.counterOk : s.counterWarn),
            }}>
              {t('step1.bonusFeminin', { n: 2 - bonusFemininUtilises })}
            </span>
          )}
        </div>
      </div>

      <div style={s.block}>
        <div style={s.blockTitle}>{t('step1.rulesTitle')}</div>
        <div style={s.rulesContent}>
          <ul style={s.rulesList}>
            <li>{t('step1.rule1')}</li>
            <li>{t('step1.rule2')}</li>
            <li>{t('step1.rule3')}</li>
            <li>{t('step1.rule4')}</li>
          </ul>
          <table style={s.costTable}>
            <thead>
              <tr>
                <th style={s.costTh}>{t('step1.costColNiveau')}</th>
                {[8,9,10,11,12,13,14,15,16,17,18,19,20].map(niv => (
                  <th key={niv} style={s.costTh}>{niv}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={s.costTdLabel}>{t('step1.costColCout')}</td>
                {[8,9,10,11,12,13,14,15,16,17,18,19,20].map(niv => (
                  <td key={niv} style={{
                    ...s.costTd,
                    color: COST_LOOKUP[niv] >= 10 ? '#e05c5c' : COST_LOOKUP[niv] >= 3 ? '#e0a85c' : '#9090c8',
                    fontWeight: COST_LOOKUP[niv] >= 10 ? '700' : '400',
                  }}>{COST_LOOKUP[niv]}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={s.block}>
        <div style={s.blockTitle}>{t('step1.pcTitle')}</div>
        <div style={s.pcContent}>
          <p style={s.pcDesc}>{t('step1.pcDesc')}</p>
          <div style={s.pcControls}>
            <span style={s.pcInfo}>
              {pcAlloues} {t('step1.pcAlloues')} = +{pcAlloues * 2} {t('step1.pointsSup')}
            </span>
            <div style={s.pcButtons}>
              <button
                style={{ ...s.pcBtn, ...(!canCancelPc ? s.pcBtnDisabled : {}) }}
                disabled={!canCancelPc}
                onClick={handleCancelPc}
              >
                {t('step1.pcCancel')}
              </button>
              <button
                style={{ ...s.pcBtn, ...s.pcBtnBuy, ...(!canBuyPc ? s.pcBtnDisabled : {}) }}
                disabled={!canBuyPc}
                onClick={handleBuyPc}
              >
                −1 PC
              </button>
              <div style={s.pcMeter}>
                {[...Array(PC_MAX)].map((_, i) => (
                  <div key={i} style={{
                    ...s.pcMeterDot,
                    backgroundColor: i < pcAlloues
                      ? i >= 7 ? '#e05c5c' : i >= 5 ? '#e0a85c' : '#5b8dee'
                      : '#1a1a2e',
                    borderColor: i < pcAlloues
                      ? i >= 7 ? '#e05c5c' : i >= 5 ? '#e0a85c' : '#5b8dee'
                      : '#2a2a3e',
                  }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={s.block}>
        <div style={s.blockTitle}>{t('step1.chcTitle')}</div>
        <div style={s.chcRow}>
          <span style={s.chcBadge}>{chc}</span>
          <p style={s.chcDesc}>{t('step1.chcDesc')}</p>
        </div>
      </div>

      <div style={s.nav}>
        {onPrev && (
          <button style={s.prevBtn} onClick={onPrev}>
            ← {t('step1.prev')}
          </button>
        )}
        <button
          style={{
            ...s.nextBtn,
            ...(!canNext ? s.nextBtnDisabled : {}),
          }}
          disabled={!canNext}
          onClick={() => onNext({ pcSpent: pcAlloues })}
        >
          {t('step1.next')} →
        </button>
      </div>

      {tooltip && (
        <div style={{
          ...s.tooltip,
          top: tooltip.top,
          left: tooltip.left,
        }}>
          {tooltip.desc}
        </div>
      )}

    </div>
  )
}

const s = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    padding: '16px 20px 40px',
    maxWidth: '960px',
    margin: '0 auto',
    flex: 1,
    width: '100%',
  },
  namesRow: {
    display: 'flex',
    gap: '16px',
  },
  nameField: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  nameInput: {
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid #2a2a3e',
    color: '#c0c0d0',
    fontSize: '14px',
    fontWeight: '600',
    padding: '4px 0',
    outline: 'none',
  },
  nameLabel: {
    fontSize: '9px',
    color: '#3a3a5e',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  block: {
    border: '1px solid #1e1e2e',
    borderRadius: '6px',
    overflow: 'hidden',
    backgroundColor: 'rgba(6,6,14,0.85)',
  },
  blockTitle: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#5b8dee',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    padding: '8px 12px',
    backgroundColor: 'rgba(14,14,26,0.9)',
    borderBottom: '1px solid #1e1e2e',
  },
  attrTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '11px',
  },
  th: {
    padding: '6px 4px',
    color: '#5a5a7a',
    fontSize: '10px',
    fontWeight: '600',
    textAlign: 'center',
    borderBottom: '1px solid #1e1e2e',
    backgroundColor: 'rgba(14,14,26,0.9)',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '4px 2px',
    textAlign: 'center',
    borderBottom: '1px solid #1a1a2e',
  },
  tdLabel: {
    padding: '4px 10px',
    color: '#6a6a8a',
    fontSize: '11px',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid #1a1a2e',
    borderRight: '1px solid #1e1e2e',
    minWidth: '130px',
  },
  spinner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  spinBtn: {
    width: '26px',
    height: '26px',
    border: '1px solid #2a2a3e',
    borderRadius: '3px',
    backgroundColor: '#0e0e1a',
    color: '#9090c8',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: '1',
  },
  spinValue: {
    display: 'inline-block',
    minWidth: '24px',
    color: '#c0c0d0',
    fontSize: '13px',
    fontWeight: '700',
    textAlign: 'center',
  },
  readonly: {
    display: 'inline-block',
    minWidth: '24px',
    color: '#8888a8',
    fontSize: '12px',
    fontWeight: '600',
    textAlign: 'center',
  },
  counterRow: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center',
    padding: '10px 12px',
    borderTop: '1px solid #1e1e2e',
  },
  counter: {
    display: 'inline-block',
    padding: '6px 16px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '700',
  },
  counterWarn: {
    color: '#e0a85c',
    backgroundColor: 'rgba(224,168,92,0.08)',
    border: '1px solid rgba(224,168,92,0.25)',
  },
  counterOk: {
    color: '#4a9e5c',
    backgroundColor: 'rgba(74,158,92,0.08)',
    border: '1px solid rgba(74,158,92,0.25)',
  },
  rulesContent: {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  rulesList: {
    padding: '0 0 0 20px',
    margin: 0,
    color: '#9090c8',
    fontSize: '11px',
    lineHeight: '1.8',
    alignSelf: 'flex-start',
  },
  costTable: {
    borderCollapse: 'collapse',
    fontSize: '11px',
    width: '100%',
    overflowX: 'auto',
  },
  costTh: {
    padding: '4px 8px',
    color: '#5a5a7a',
    fontSize: '10px',
    fontWeight: '600',
    textAlign: 'center',
    borderBottom: '1px solid #1e1e2e',
  },
  costTd: {
    padding: '4px 8px',
    color: '#9090c8',
    textAlign: 'center',
    borderBottom: '1px solid #1a1a2e',
  },
  costTdLabel: {
    padding: '4px 10px',
    color: '#5a5a7a',
    fontSize: '10px',
    fontWeight: '600',
    textAlign: 'left',
    borderBottom: '1px solid #1a1a2e',
    borderRight: '1px solid #1e1e2e',
  },
  pcContent: {
    padding: '12px',
  },
  pcDesc: {
    color: '#9090c8',
    fontSize: '11px',
    lineHeight: '1.6',
    margin: '0 0 12px 0',
  },
  pcControls: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
  },
  pcInfo: {
    color: '#5b8dee',
    fontSize: '13px',
    fontWeight: '700',
  },
  pcButtons: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  pcBtn: {
    padding: '6px 16px',
    border: '1px solid #5b8dee',
    borderRadius: '4px',
    backgroundColor: 'rgba(91,141,238,0.12)',
    color: '#5b8dee',
    fontSize: '11px',
    fontWeight: '700',
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  pcBtnBuy: {
    backgroundColor: 'rgba(224,168,92,0.15)',
    borderColor: '#e0a85c',
    color: '#e0a85c',
  },
  pcBtnDisabled: {
    borderColor: '#2a2a3e',
    backgroundColor: '#0e0e1a',
    color: '#3a3a5e',
    cursor: 'not-allowed',
  },
  pcMeter: {
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
  },
  pcMeterDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    border: '1px solid #2a2a3e',
    transition: 'all 0.2s ease',
  },
  chcRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '12px',
  },
  chcBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '48px',
    height: '48px',
    border: '2px solid #5b8dee',
    borderRadius: '50%',
    color: '#5b8dee',
    fontSize: '20px',
    fontWeight: '700',
    backgroundColor: 'rgba(91,141,238,0.08)',
    flexShrink: 0,
  },
  chcDesc: {
    color: '#6a6a8a',
    fontSize: '11px',
    lineHeight: '1.6',
    margin: 0,
  },
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderTop: '1px solid #1e1e2e',
    marginTop: '8px',
  },
  prevBtn: {
    padding: '8px 16px',
    border: '1px solid #2a2a3e',
    borderRadius: '4px',
    backgroundColor: '#0e0e1a',
    color: '#6a6a8a',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  nextBtn: {
    padding: '8px 20px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#5b8dee',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginLeft: 'auto',
  },
  nextBtnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  tooltip: {
    position: 'fixed',
    backgroundColor: '#0a0a14',
    border: '1px solid #2a2a4e',
    borderRadius: '4px',
    padding: '8px 10px',
    fontSize: '10px',
    color: '#b0b0c8',
    whiteSpace: 'pre-line',
    width: '240px',
    zIndex: 1000,
    lineHeight: '1.6',
    pointerEvents: 'none',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    transform: 'translate(-50%, calc(-100% - 8px))',
  },
}