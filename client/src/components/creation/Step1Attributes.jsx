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
  const [rulesOpen, setRulesOpen] = useState(false)

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
  const canNext = pointsRestants === 0 && charName.trim().length > 0

  const dotColor = (i) => {
    if (i >= pcAlloues) return { backgroundColor: 'rgba(255,255,255,.04)', borderColor: 'rgba(255,255,255,.1)' }
    if (i >= 7) return { backgroundColor: '#e05c5c', borderColor: '#e05c5c' }
    if (i >= 5) return { backgroundColor: '#e0a85c', borderColor: '#e0a85c' }
    return { backgroundColor: '#2FD7FF', borderColor: '#2FD7FF' }
  }

  const costColor = (niv) => {
    if (COST_LOOKUP[niv] >= 10) return { color: '#e05c5c', fontWeight: '700' }
    if (COST_LOOKUP[niv] >= 3)  return { color: '#e0a85c' }
    return { color: '#76E8FF' }
  }

  const hudOk = pointsRestants === 0

  return (
    <div className="wiz1-container">

      {/* ── Noms ── */}
      <div className="wiz1-names-row">
        <div className="wiz1-name-field">
          <input
            className="wiz1-name-input"
            value={charName}
            onChange={e => setCharName(e.target.value)}
            placeholder={t('step1.charNamePlaceholder')}
          />
          <span className="wiz1-name-label">{t('step1.charName')}</span>
        </div>
        <div className="wiz1-name-field">
          <input
            className="wiz1-name-input"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            placeholder={t('step1.playerNamePlaceholder')}
          />
          <span className="wiz1-name-label">{t('step1.playerName')}</span>
        </div>
      </div>

      {/* ── Bloc Attributs + Règles (accordion) ── */}
      <div className="wiz1-block">
        <div className="wiz1-block-title">{t('step1.tableTitle')}</div>
        <table className="wiz1-table">
          <thead>
            <tr>
              <th className="wiz1-th"></th>
              {ATTR_IDS.map(id => (
                <th
                  key={id}
                  className="wiz1-th wiz1-th-attr"
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
                className="wiz1-td-label"
                onMouseEnter={(e) => showTooltip(ROW_TOOLTIPS.base, e)}
                onMouseLeave={() => setTooltip(null)}
              >
                {t('step1.rowBase')}
              </td>
              {ATTR_IDS.map(id => (
                <td key={id} className="wiz1-td">
                  <div className="wiz1-spinner">
                    <button className="wiz1-spin-btn" onClick={() => handleChange(id, -1)}>−</button>
                    <span className="wiz1-spin-value">{attributs[id]}</span>
                    <button className="wiz1-spin-btn" onClick={() => handleChange(id, +1)}>+</button>
                  </div>
                </td>
              ))}
            </tr>

            <tr className="wiz1-row-na">
              <td
                className="wiz1-td-label"
                onMouseEnter={(e) => showTooltip(ROW_TOOLTIPS.na, e)}
                onMouseLeave={() => setTooltip(null)}
              >
                {t('step1.rowNA')}
              </td>
              {ATTR_IDS.map(id => (
                <td key={id} className="wiz1-td">
                  <span className="wiz1-readonly wiz1-val-na">{naMap[id]}</span>
                </td>
              ))}
            </tr>

            <tr className="wiz1-row-an">
              <td
                className="wiz1-td-label"
                onMouseEnter={(e) => showTooltip(ROW_TOOLTIPS.an, e)}
                onMouseLeave={() => setTooltip(null)}
              >
                {t('step1.rowAN')}
              </td>
              {ATTR_IDS.map(id => (
                <td key={id} className="wiz1-td">
                  <span className="wiz1-readonly wiz1-val-an">
                    {calcAN(naMap[id]) >= 0 ? `+${calcAN(naMap[id])}` : calcAN(naMap[id])}
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        {/* Accordion règles */}
        <button
          className={`wiz1-accordion-trigger${rulesOpen ? ' wiz1-accordion-trigger--open' : ''}`}
          onClick={() => setRulesOpen(o => !o)}
        >
          <span>{t('step1.rulesTitle')}</span>
          <span className="wiz1-accordion-chevron">{rulesOpen ? '▲' : '▼'}</span>
        </button>
        <div className={`wiz1-accordion-body${rulesOpen ? ' wiz1-accordion-body--open' : ''}`}>
          <div className="wiz1-rules-content">
            <ul className="wiz1-rules-list">
              <li>{t('step1.rule1')}</li>
              <li>{t('step1.rule2')}</li>
              <li>{t('step1.rule3')}</li>
              <li>{t('step1.rule4')}</li>
            </ul>
            <table className="wiz1-cost-table">
              <thead>
                <tr>
                  <th className="wiz1-cost-th wiz1-cost-td-label">{t('step1.costColNiveau')}</th>
                  {[8,9,10,11,12,13,14,15,16,17,18,19,20].map(niv => (
                    <th key={niv} className="wiz1-cost-th">{niv}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="wiz1-cost-td wiz1-cost-td-label">{t('step1.costColCout')}</td>
                  {[8,9,10,11,12,13,14,15,16,17,18,19,20].map(niv => (
                    <td key={niv} className="wiz1-cost-td" style={costColor(niv)}>{COST_LOOKUP[niv]}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* HUD points restants — en bas de la card Attributs */}
        <div className={`wiz1-points-hud${hudOk ? ' wiz1-points-hud--ok' : ''}`}>
          <div className="wiz1-points-hud-main">
            <span className="wiz1-points-hud-num">{hudOk ? '✓' : pointsRestants}</span>
            <span className="wiz1-points-hud-label">
              {hudOk ? t('step1.pointsOk') : t('step1.pointsHudLabel')}
            </span>
          </div>
          {isFeminin && (
            <span className={`wiz1-counter ${bonusFemininUtilises <= 2 ? 'wiz1-counter-ok' : 'wiz1-counter-warn'}`}>
              {t('step1.bonusFeminin', { n: 2 - bonusFemininUtilises })}
            </span>
          )}
        </div>
      </div>

      {/* ── Bloc PC ── */}
      <div className="wiz1-block">
        <div className="wiz1-block-title">{t('step1.pcTitle')}</div>
        <div className="wiz1-pc-content">
          <p className="wiz1-pc-desc">{t('step1.pcDesc')}</p>
          <div className="wiz1-pc-controls">
            <span className="wiz1-pc-info">
              {pcAlloues} {t('step1.pcAlloues')} = +{pcAlloues * 2} {t('step1.pointsSup')}
            </span>
            <div className="wiz1-pc-buttons">
              <button
                className={`wiz1-pc-btn${!canCancelPc ? ' wiz1-pc-btn-disabled' : ''}`}
                disabled={!canCancelPc}
                onClick={handleCancelPc}
              >
                {t('step1.pcCancel')}
              </button>
              <button
                className={`wiz1-pc-btn wiz1-pc-btn-buy${!canBuyPc ? ' wiz1-pc-btn-disabled' : ''}`}
                disabled={!canBuyPc}
                onClick={handleBuyPc}
              >
                −1 PC
              </button>
              <div className="wiz1-pc-meter">
                {[...Array(PC_MAX)].map((_, i) => (
                  <div key={i} className="wiz1-pc-meter-dot" style={dotColor(i)} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bloc Chance ── */}
      <div className="wiz1-block">
        <div className="wiz1-block-title">{t('step1.chcTitle')}</div>
        <div className="wiz1-chc-row">
          <span className="wiz1-chc-badge">{chc}</span>
          <p className="wiz1-chc-desc">{t('step1.chcDesc')}</p>
        </div>
      </div>

      {/* ── Navigation ── */}
      <div className="wiz1-nav">
        {onPrev && (
          <button className="btn btn-ghost" onClick={onPrev}>
            ← {t('step1.prev')}
          </button>
        )}
        <button
          className={`wiz-btn-start${hudOk ? ' wiz-btn-start--pulse' : ''}`}
          disabled={!canNext}
          onClick={() => onNext({ charName: charName.trim(), playerName: playerName.trim(), attributes: attributs, pcSpent: pcAlloues })}
        >
          {t('step1.next')} →
        </button>
      </div>

      {tooltip && (
        <div
          className="wiz1-tooltip"
          style={{ top: tooltip.top, left: tooltip.left }}
        >
          {tooltip.desc}
        </div>
      )}

    </div>
  )
}
