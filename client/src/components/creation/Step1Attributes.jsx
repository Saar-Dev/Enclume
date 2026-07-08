// client/src/components/creation/Step1Attributes.jsx
// Refonte Session 130 : tableau aligné fiche perso (Base lecture seule + Mod.PC spinners)

import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  POOL_AMBIANCE,
  CHANCE_AMBIANCE,
  COST_LOOKUP,
  calcTotalCost,
  calcAN,
  PC_MAX_ETAPE1,
  calcPoolTotal,
} from '../../../../shared/polarisUtils.js'

const ATTR_IDS = ['FOR', 'CON', 'COO', 'ADA', 'PER', 'INT', 'VOL', 'PRE']

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

export default function Step1Attributes({ initialData, ambiance, femininBonusEnabled, onNext, onPrev, onPcChange }) {
  const { t } = useTranslation('creation')

  const ROW_TOOLTIPS = {
    base: femininBonusEnabled
      ? "Niveau de base : score initial de l'Attribut avant modificateurs. Fixé à 7 (5 en Force pour un personnage féminin)."
      : "Niveau de base : score initial de l'Attribut avant modificateurs. Fixé à 7.",
    pc: "Modificateur PC : points d'Attribut achetés avec des Points de Création. 1 PC = +2 points de pool.",
    na: "Niveau Actuel : somme du niveau de base et de tous les modificateurs. C'est la valeur réellement utilisée en jeu.",
    an: "Aptitude Naturelle : dérivée du Niveau Actuel, utilisée pour calculer le niveau de base des Compétences.",
  }

  const [charName, setCharName] = useState(initialData?.charName ?? '')
  const [playerName, setPlayerName] = useState(initialData?.playerName ?? '')
  const [isFeminin, setIsFeminin] = useState(initialData?.isFeminin ?? false)
  const [pcAlloues, setPcAlloues] = useState(initialData?.pcSpent ?? 0)

  // Description physique — narrative, non bloquante (REGLE_CREATION.txt:1317-1324)
  const [height, setHeight] = useState(initialData?.height ?? '')
  const [weight, setWeight] = useState(initialData?.weight ?? '')
  const [skin, setSkin] = useState(initialData?.skin ?? '')
  const [eyes, setEyes] = useState(initialData?.eyes ?? '')
  const [hair, setHair] = useState(initialData?.hair ?? '')
  const [build, setBuild] = useState(initialData?.build ?? '')
  const [distinctiveSigns, setDistinctiveSigns] = useState(initialData?.distinctiveSigns ?? '')
  const [handPref, setHandPref] = useState(initialData?.handPref ?? '')

  // modPC : points achetés par attribut (démarre à 0)
  const [modPC, setModPC] = useState(() => {
    if (initialData?.attributes) {
      // Recalcul depuis les attributs sauvegardés
      return Object.fromEntries(
        ATTR_IDS.map(id => {
          const base = (id === 'FOR' && initialData.isFeminin && femininBonusEnabled) ? 5 : 7
          return [id, Math.max(0, (initialData.attributes[id] || base) - base)]
        })
      )
    }
    return Object.fromEntries(ATTR_IDS.map(id => [id, 0]))
  })

  const [tooltip, setTooltip] = useState(null)
  const [rulesOpen, setRulesOpen] = useState(false)

  // Recalculer modPC si on change isFeminin (réinitialise FOR)
  const handleSetFeminin = useCallback((val) => {
    setIsFeminin(val)
    setModPC(prev => {
      // Si on passe à féminin et que FOR avait des points, on les garde mais la base change
      // Si FOR modPC ferait dépasser 20, on cap
      const baseFOR = (val && femininBonusEnabled) ? 5 : 7
      const maxMod = 20 - baseFOR
      return { ...prev, FOR: Math.min(prev.FOR, maxMod) }
    })
  }, [femininBonusEnabled])

  const baseAttrs = useMemo(
    () => Object.fromEntries(ATTR_IDS.map(id => [id, (id === 'FOR' && isFeminin && femininBonusEnabled) ? 5 : 7])),
    [isFeminin, femininBonusEnabled]
  )

  // Attributs complets (base + modPC)
  const attributs = useMemo(
    () => Object.fromEntries(ATTR_IDS.map(id => [id, baseAttrs[id] + modPC[id]])),
    [baseAttrs, modPC]
  )

  const poolBase = POOL_AMBIANCE[ambiance] || 38
  const poolTotal = calcPoolTotal(ambiance, pcAlloues)
  const totalCost = calcTotalCost(attributs, isFeminin && femininBonusEnabled)
  const pointsRestants = poolTotal - totalCost
  const chc = CHANCE_AMBIANCE[ambiance] || 13

  const handleBuyPc = useCallback(() => {
    if (pcAlloues >= PC_MAX_ETAPE1) return
    const next = pcAlloues + 1
    setPcAlloues(next)
    onPcChange?.(next)
  }, [pcAlloues, onPcChange])

  const handleCancelPc = useCallback(() => {
    if (pcAlloues <= 0) return
    const newPoolTotal = calcPoolTotal(ambiance, pcAlloues - 1)
    if (totalCost > newPoolTotal) return
    const next = pcAlloues - 1
    setPcAlloues(next)
    onPcChange?.(next)
  }, [pcAlloues, ambiance, totalCost, onPcChange])

  const handleModPC = useCallback((attrId, delta) => {
    setModPC(prev => {
      const current = prev[attrId]
      const next = current + delta
      if (next < 0) return prev
      const base = baseAttrs[attrId]
      if (base + next > 20) return prev
      // Vérifier coût total
      const newModPC = { ...prev, [attrId]: next }
      const newAttributs = Object.fromEntries(ATTR_IDS.map(id => [id, baseAttrs[id] + newModPC[id]]))
      const newCost = calcTotalCost(newAttributs, isFeminin && femininBonusEnabled)
      if (newCost > poolTotal) return prev
      return newModPC
    })
  }, [baseAttrs, isFeminin, femininBonusEnabled, poolTotal])

  // Tirage 2D10 Main directrice (REGLE_CREATION.txt:1301-1311) — pattern client pur,
  // identique au tirage aléatoire de Step3Mutations.jsx (Math.random, aucun aller-retour serveur).
  const handleRollHandPref = useCallback(() => {
    const d2d10 = (Math.floor(Math.random() * 10) + 1) + (Math.floor(Math.random() * 10) + 1)
    setHandPref(d2d10 >= 20 ? 'A' : d2d10 >= 16 ? 'L' : 'R')
  }, [])

  const showTooltip = (desc, event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setTooltip({ desc, top: rect.top, left: rect.left + rect.width / 2 })
  }

  const naMap = useMemo(
    () => Object.fromEntries(ATTR_IDS.map(id => [id, Math.max(3, attributs[id])])),
    [attributs]
  )

  const canBuyPc = pcAlloues < PC_MAX_ETAPE1
  const canCancelPc = pcAlloues > 0
  const canNext = pointsRestants === 0 && charName.trim().length > 0

  const canIncrement = (attrId) => {
    const base = baseAttrs[attrId]
    const currentMod = modPC[attrId]
    const nextVal = base + currentMod + 1
    if (nextVal > 20) return false
    return (COST_LOOKUP[nextVal] - COST_LOOKUP[nextVal - 1]) <= pointsRestants
  }
  const canDecrement = (attrId) => {
    return modPC[attrId] > 0
  }

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

      {/* ── Noms + Sexe ── */}
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
        <div className="wiz1-name-field" style={{ maxWidth: '100px' }}>
          <select
            className="wiz1-name-input"
            value={isFeminin ? 'F' : 'M'}
            onChange={e => handleSetFeminin(e.target.value === 'F')}
            style={{ cursor: 'pointer' }}
          >
            <option value="M">{t('step1.sexM')}</option>
            <option value="F">{t('step1.sexF')}</option>
          </select>
          <span className="wiz1-name-label">{t('step1.sex')}</span>
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
            {/* Ligne 1 — Niveau de base (lecture seule) */}
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
                  <span className="wiz1-readonly wiz1-val-base">{baseAttrs[id]}</span>
                </td>
              ))}
            </tr>

            {/* Ligne 2 — Mod. PC (spinners) */}
            <tr>
              <td
                className="wiz1-td-label"
                onMouseEnter={(e) => showTooltip(ROW_TOOLTIPS.pc, e)}
                onMouseLeave={() => setTooltip(null)}
              >
                {t('step1.rowModPC')}
              </td>
              {ATTR_IDS.map(id => (
                <td key={id} className="wiz1-td">
                  <div className="wiz1-spinner">
                    <button className="wiz1-spin-btn" disabled={!canDecrement(id)} onClick={() => handleModPC(id, -1)}>−</button>
                    <span className="wiz1-spin-value">{modPC[id]}</span>
                    <button className="wiz1-spin-btn" disabled={!canIncrement(id)} onClick={() => handleModPC(id, +1)}>+</button>
                  </div>
                </td>
              ))}
            </tr>

            {/* Ligne 3 — Niveau actuel (lecture seule) */}
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

            {/* Ligne 4 — Aptitude Naturelle (lecture seule) */}
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
              {femininBonusEnabled && <li>{t('step1.ruleFemininBonus')}</li>}
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

        {/* HUD points restants */}
        <div className={`wiz1-points-hud${hudOk ? ' wiz1-points-hud--ok' : ''}`}>
          <div className="wiz1-points-hud-main">
            <span className="wiz1-points-hud-num">{hudOk ? '✓' : pointsRestants}</span>
            <span className="wiz1-points-hud-label">
              {hudOk ? t('step1.pointsOk') : t('step1.pointsHudLabel')}
            </span>
          </div>
        </div>
      </div>

      {/* ── Bloc Description physique (narrative, non bloquant) ── */}
      <div className="wiz1-block">
        <div className="wiz1-block-title">{t('step1.descSectionTitle')}</div>
        <div className="wiz1-desc-grid">
          <label className="wiz1-desc-field">
            <span className="wiz1-desc-label">{t('step1.descHeight')}</span>
            <input
              className="wiz1-desc-input"
              type="number"
              step="0.01"
              value={height}
              onChange={e => setHeight(e.target.value)}
            />
          </label>
          <label className="wiz1-desc-field">
            <span className="wiz1-desc-label">{t('step1.descWeight')}</span>
            <input
              className="wiz1-desc-input"
              type="number"
              step="0.1"
              value={weight}
              onChange={e => setWeight(e.target.value)}
            />
          </label>
          <label className="wiz1-desc-field">
            <span className="wiz1-desc-label">{t('step1.descSkin')}</span>
            <input className="wiz1-desc-input" value={skin} onChange={e => setSkin(e.target.value)} />
          </label>
          <label className="wiz1-desc-field">
            <span className="wiz1-desc-label">{t('step1.descBuild')}</span>
            <input className="wiz1-desc-input" value={build} onChange={e => setBuild(e.target.value)} />
          </label>
          <label className="wiz1-desc-field">
            <span className="wiz1-desc-label">{t('step1.descEyes')}</span>
            <input className="wiz1-desc-input" value={eyes} onChange={e => setEyes(e.target.value)} />
          </label>
          <label className="wiz1-desc-field">
            <span className="wiz1-desc-label">{t('step1.descHair')}</span>
            <input className="wiz1-desc-input" value={hair} onChange={e => setHair(e.target.value)} />
          </label>
          <label className="wiz1-desc-field wiz1-desc-field--wide">
            <span className="wiz1-desc-label">{t('step1.descSigns')}</span>
            <input
              className="wiz1-desc-input"
              value={distinctiveSigns}
              onChange={e => setDistinctiveSigns(e.target.value)}
            />
          </label>
          <label className="wiz1-desc-field">
            <span className="wiz1-desc-label">{t('step1.descHand')}</span>
            <div className="wiz1-desc-hand-row">
              <select
                className="wiz1-desc-input"
                value={handPref}
                onChange={e => setHandPref(e.target.value)}
              >
                <option value="">{t('step1.handPlaceholder')}</option>
                <option value="R">{t('step1.handRight')}</option>
                <option value="L">{t('step1.handLeft')}</option>
                <option value="A">{t('step1.handAmbi')}</option>
              </select>
              <button type="button" className="wiz1-pc-btn" onClick={handleRollHandPref}>
                {t('step1.handRoll')}
              </button>
            </div>
          </label>
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
                {[...Array(PC_MAX_ETAPE1)].map((_, i) => (
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
          onClick={() => onNext({
            charName: charName.trim(),
            playerName: playerName.trim(),
            attributes: attributs,
            pcSpent: pcAlloues,
            isFeminin,
            height: height === '' ? null : parseFloat(height),
            weight: weight === '' ? null : parseFloat(weight),
            skin: skin.trim(),
            eyes: eyes.trim(),
            hair: hair.trim(),
            build: build.trim(),
            distinctiveSigns: distinctiveSigns.trim(),
            handPref: handPref || null,
          })}
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