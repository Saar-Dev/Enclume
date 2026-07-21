// client/src/components/creation/ProAdvantagesAndSetbacks.jsx
import { useEffect, useReducer, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Canvas } from '@react-three/fiber'
import { computeProAdvantageAllocation, computeRandomBudgetDelta } from '../../../../shared/careerAdvantages.js'
import { getSetbackBlockCount, resolveSetback } from '../../../../shared/careerSetbacks.js'
import { WS } from '../../../../shared/events.js'
import { useSocket } from '../../lib/SocketContext.jsx'
import { useAuthStore } from '../../stores/authStore.js'
import DiceRoller from '../DiceRoller.jsx'
import DiceLights from '../DiceLights.jsx'
import { PRO_ADV_CATEGORY_RULE_KEYS } from './proAdvCategoryRuleKeys.js'

// ─── Reducer ────────────────────────────────────────────────────────────────
const initialState = ([initialProAdvantages, initialRandomPicks, initialSetbackRolls]) => ({
  proAdvAllocations: initialProAdvantages || {},
  randomPicks: initialRandomPicks || {},
  setbackRolls: initialSetbackRolls || [],
  awaitingRandomRoll: null,
  awaitingSetbackBlock: null,
  dicePayload: null,
  warnedAllocSignature: null,
})

function reducer(state, action) {
  switch (action.type) {
    // ── Avantages pro : répartition manuelle ──
    case 'SET_ADV_POINTS': {
      const careerMap = { ...(state.proAdvAllocations[action.careerId] || {}) }
      if (action.pts <= 0) delete careerMap[action.category]
      else careerMap[action.category] = action.pts
      return { ...state, proAdvAllocations: { ...state.proAdvAllocations, [action.careerId]: careerMap } }
    }

    // ── Avantages pro : tirage 1D10 ──
    case 'SET_AWAITING_ROLL':
      return { ...state, awaitingRandomRoll: { careerId: action.careerId, blockIndex: action.blockIndex } }
    case 'RESOLVE_RANDOM_ROLL': {
      if (!state.awaitingRandomRoll) return state
      const { careerId, blockIndex } = state.awaitingRandomRoll
      const careerPicks = state.randomPicks[careerId] || []
      return {
        ...state,
        randomPicks: {
          ...state.randomPicks,
          [careerId]: [...careerPicks, { blockIndex, roll: action.roll, useAsPoints: false }],
        },
        awaitingRandomRoll: null,
        dicePayload: null,
      }
    }
    case 'TOGGLE_RANDOM_POINTS': {
      const careerPicks = state.randomPicks[action.careerId] || []
      const updated = careerPicks.map(p => p.blockIndex === action.blockIndex ? { ...p, useAsPoints: !p.useAsPoints } : p)
      return { ...state, randomPicks: { ...state.randomPicks, [action.careerId]: updated } }
    }

    // ── Revers : tirage 1D100 ──
    case 'SET_AWAITING_SETBACK':
      return { ...state, awaitingSetbackBlock: action.blockIndex }
    case 'RESOLVE_SETBACK_ROLL': {
      if (state.awaitingSetbackBlock === null) return state
      return {
        ...state,
        setbackRolls: [...state.setbackRolls, { blockIndex: state.awaitingSetbackBlock, roll: action.roll }],
        awaitingSetbackBlock: null,
        dicePayload: null,
      }
    }

    // ── Dés ──
    case 'SET_DICE_PAYLOAD':
      return { ...state, dicePayload: action.payload }
    case 'CLEAR_DICE':
      return { ...state, dicePayload: null, awaitingRandomRoll: null, awaitingSetbackBlock: null }

    // ── Avertissement ──
    case 'SET_ALLOC_WARNED':
      return { ...state, warnedAllocSignature: action.signature }

    default:
      return state
  }
}

// ─── Composant ──────────────────────────────────────────────────────────────
export default function ProAdvantagesAndSetbacks({
  selectedCareers, careers, totalYears, setbackRows,
  initialProAdvantages, initialRandomPicks, initialSetbackRolls,
  onProAdvantagesChange, onRandomPicksChange, onSetbackRollsChange,
  randomProAdvantagesEnabled, reversEnabled,
  onNext, onPrev,
}) {
  const { t } = useTranslation('creation')
  const socket = useSocket()
  const { user } = useAuthStore()
  const [state, dispatch] = useReducer(reducer, [initialProAdvantages, initialRandomPicks, initialSetbackRolls], initialState)

  const careersById = new Map((careers ?? []).map(c => [c.id, c]))
  const setbackBlockCount = reversEnabled ? getSetbackBlockCount(totalYears) : 0

  // ── Règle dépliable sur une catégorie déjà affichée (pas de liste séparée) ──
  const [openRuleRows, setOpenRuleRows] = useState(() => new Set())
  const toggleRuleRow = (rowKey) => setOpenRuleRows(prev => {
    const next = new Set(prev)
    if (next.has(rowKey)) next.delete(rowKey)
    else next.add(rowKey)
    return next
  })

  // ── Sync vers parent ──
  useEffect(() => { onProAdvantagesChange?.(state.proAdvAllocations) }, [state.proAdvAllocations, onProAdvantagesChange])
  useEffect(() => { onRandomPicksChange?.(state.randomPicks) }, [state.randomPicks, onRandomPicksChange])
  useEffect(() => { onSetbackRollsChange?.(state.setbackRolls) }, [state.setbackRolls, onSetbackRollsChange])

  // ── Écoute DICE_RESULT (P56 : dieType absent du payload serveur, à fournir ici) ──
  useEffect(() => {
    if (!socket) return
    const handleResult = (payload) => {
      if (payload.userId !== user?.id) return
      if (state.awaitingRandomRoll) {
        dispatch({ type: 'SET_DICE_PAYLOAD', payload: { ...payload, dieType: 'd10' } })
      } else if (state.awaitingSetbackBlock !== null) {
        dispatch({ type: 'SET_DICE_PAYLOAD', payload: { ...payload, dieType: 'd100' } })
      }
    }
    socket.on(WS.DICE_RESULT, handleResult)
    return () => socket.off(WS.DICE_RESULT, handleResult)
  }, [socket, user?.id, state.awaitingRandomRoll, state.awaitingSetbackBlock])

  // ── Handlers dés ──
  const handleStartAdvRoll = (careerId, blockIndex) => {
    if (!socket || state.awaitingRandomRoll || state.awaitingSetbackBlock !== null) return
    dispatch({ type: 'SET_AWAITING_ROLL', careerId, blockIndex })
    socket.emit(WS.DICE_ROLL, { formula: '1d10' })
  }
  const handleStartSetbackRoll = (blockIndex) => {
    if (!socket || state.awaitingSetbackBlock !== null || state.awaitingRandomRoll) return
    dispatch({ type: 'SET_AWAITING_SETBACK', blockIndex })
    socket.emit(WS.DICE_ROLL, { formula: '1d100' })
  }
  const handleDiceOverlayDone = () => {
    if (!state.dicePayload) return
    if (state.awaitingRandomRoll) {
      dispatch({ type: 'RESOLVE_RANDOM_ROLL', roll: state.dicePayload.total })
    } else if (state.awaitingSetbackBlock !== null) {
      dispatch({ type: 'RESOLVE_SETBACK_ROLL', roll: state.dicePayload.total })
    }
  }

  // ── Validation ──
  const advResultsByCareer = selectedCareers
    .map(c => {
      const refCareer = careersById.get(c.career_id)
      if (!refCareer || (refCareer.pointCategories ?? []).length === 0) return null
      const delta = computeRandomBudgetDelta(state.randomPicks[c.career_id] ?? [], refCareer.randomBenefits ?? [])
      return computeProAdvantageAllocation(state.proAdvAllocations[c.career_id] || {}, {
        categories: refCareer.pointCategories.map(cat => cat.category),
        years: c.years,
        randomBudgetDelta: delta,
      })
    })
    .filter(Boolean)

  const hasOverBudget = advResultsByCareer.some(r => r.remaining < 0)
  const hasUnderSpent = advResultsByCareer.some(r => r.remaining > 0)
  const allSetbacksRolled = setbackBlockCount === 0 || state.setbackRolls.length >= setbackBlockCount
  const canNext = !hasOverBudget && allSetbacksRolled

  const incompleteSignature = selectedCareers
    .map(c => `${JSON.stringify(state.proAdvAllocations[c.career_id] || {})}:${JSON.stringify(state.randomPicks[c.career_id] || [])}`)
    .join('|')
  const allocWarned = state.warnedAllocSignature === incompleteSignature

  const handleNextClick = () => {
    if (hasOverBudget || !allSetbacksRolled) return
    if (hasUnderSpent && !allocWarned) {
      dispatch({ type: 'SET_ALLOC_WARNED', signature: incompleteSignature })
      return
    }
    onNext()
  }

  // ── Rendu ──
  return (
    <div style={s.outer}>
      {/* Overlay dés 3D */}
      {state.dicePayload && (
        <div className="wiz4-diceoverlay">
          <Canvas camera={{ position: [15, 15, 15], fov: 60 }}>
            <DiceLights />
            <DiceRoller payload={state.dicePayload} onDone={handleDiceOverlayDone} />
          </Canvas>
        </div>
      )}

      <div style={s.columns}>

        {/* ── Colonne gauche : Avantages pro ── */}
        <div style={s.colLeft}>
          <div className="wiz4-block">
            <span className="wiz4-h">{t('step4.pro_advantages_title')}</span>
            <p className="wiz4-note">{t('step4.pro_advantages_intro')}</p>
          </div>
          {selectedCareers.map(c => {
            const career = careersById.get(c.career_id)
            if (!career) return null
            const advAllocation = state.proAdvAllocations[c.career_id] || {}
            const randomPicksForCareer = state.randomPicks[c.career_id] ?? []
            const randomBudgetDelta = computeRandomBudgetDelta(randomPicksForCareer, career.randomBenefits ?? [])
            const advResult = computeProAdvantageAllocation(advAllocation, {
              categories: (career.pointCategories ?? []).map(cat => cat.category),
              years: c.years,
              randomBudgetDelta,
            })
            const blockCount = Math.floor(c.years / 5)

            return (
              <div key={c.career_id} className="wiz4-block">
                <span className="wiz4-h">{career.name}</span>

                {(career.pointCategories ?? []).length > 0 && (
                  <>
                    <div className="wiz4-boardhead">
                      <span className="wiz4-h">{t('step4.career_adv_title')}</span>
                      <span className={`wiz4-poolrem${advResult.remaining === 0 ? ' ok' : ''}`}>
                        <span className="wiz4-mono">{advResult.remaining}</span> {t('step4.career_points_remaining')}
                      </span>
                    </div>
                    {career.pointCategories.map(cat => {
                      const pts = advAllocation[cat.category] ?? 0
                      const ruleKey = PRO_ADV_CATEGORY_RULE_KEYS[cat.category]
                      const rowKey = `${c.career_id}:${cat.id}`
                      const isRuleOpen = openRuleRows.has(rowKey)
                      return (
                        <div key={cat.id}>
                          <div className="wiz4-skill">
                            <div className="wiz4-skmain">
                              {ruleKey ? (
                                <button className="wiz4-sklabel-btn" onClick={() => toggleRuleRow(rowKey)}>
                                  <span className="wiz4-sklabel">{cat.category}</span>
                                  <span className="wiz1-accordion-chevron">{isRuleOpen ? '▲' : '▼'}</span>
                                </button>
                              ) : (
                                <span className="wiz4-sklabel">{cat.category}</span>
                              )}
                            </div>
                            <div className="wiz4-ctl">
                              <button className={`wiz4-sbtn${pts <= 0 ? ' dis' : ''}`} onClick={() => dispatch({ type: 'SET_ADV_POINTS', careerId: c.career_id, category: cat.category, pts: pts - 1 })} disabled={pts <= 0}>−</button>
                              <span className="wiz4-val">{pts}</span>
                              <button className={`wiz4-sbtn${advResult.remaining <= 0 ? ' dis' : ''}`} onClick={() => dispatch({ type: 'SET_ADV_POINTS', careerId: c.career_id, category: cat.category, pts: pts + 1 })} disabled={advResult.remaining <= 0}>＋</button>
                            </div>
                          </div>
                          {ruleKey && (
                            <div className={`wiz4-rules-body${isRuleOpen ? ' wiz4-rules-body--open' : ''}`}>
                              <p className="wiz4-rules-text">{t(`step4.pro_adv_rules.${ruleKey}.body`)}</p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </>
                )}

                {(career.pointCategories ?? []).length === 0 && (
                  <p className="wiz4-note">{t('step4.career_adv_none')}</p>
                )}

                {randomProAdvantagesEnabled !== false && (career.randomBenefits ?? []).length > 0 && blockCount > 0 && (
                  <>
                    <span className="wiz4-h">{t('step4.career_random_title')}</span>
                    {Array.from({ length: blockCount }).map((_, blockIndex) => {
                      const pick = randomPicksForCareer.find(p => p.blockIndex === blockIndex)
                      const rolledRow = pick ? (career.randomBenefits ?? []).find(r => r.roll === pick.roll) : null
                      const isAwaitingThis = state.awaitingRandomRoll?.careerId === career.id && state.awaitingRandomRoll?.blockIndex === blockIndex
                      return (
                        <div key={blockIndex} className="wiz4-randomrow">
                          <div className="wiz4-randomhead">
                            <span className="wiz4-randomlbl">{t('step4.career_random_block', { n: blockIndex + 1 })}</span>
                            {!pick && (
                              <button
                                className={`wiz4-rollbtn${state.awaitingRandomRoll || state.awaitingSetbackBlock !== null ? ' dis' : ''}`}
                                onClick={() => handleStartAdvRoll(career.id, blockIndex)}
                                disabled={!!(state.awaitingRandomRoll || state.awaitingSetbackBlock !== null)}
                              >
                                {isAwaitingThis ? t('step4.career_random_rolling') : t('step4.career_random_roll_btn')}
                              </button>
                            )}
                          </div>
                          {pick && rolledRow && (
                            <div className="wiz4-randomresult">
                              <p className="wiz4-note">{rolledRow.description}</p>
                              <p className="wiz4-note">
                                {!pick.useAsPoints && (rolledRow.effects ?? []).length > 0
                                  ? t('step4.career_random_applied_note')
                                  : t('step4.career_random_narrative_note')}
                              </p>
                              {(career.pointCategories ?? []).length > 0 && rolledRow.points_alt != null && (
                                <label className="wiz4-choiceopt">
                                  <input type="checkbox" checked={!!pick.useAsPoints} onChange={() => dispatch({ type: 'TOGGLE_RANDOM_POINTS', careerId: career.id, blockIndex })} />
                                  {t('step4.career_random_points_toggle', { n: rolledRow.points_alt })}
                                </label>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Colonne droite : Revers ── */}
        <div style={s.colRight}>
          {reversEnabled && setbackBlockCount > 0 && (
            <div className="wiz4-block">
              <span className="wiz4-h">{t('step4.setback_title')}</span>
              <p className="wiz4-note">{t('step4.setback_intro')}</p>
              {Array.from({ length: setbackBlockCount }, (_, i) => i).map(blockIndex => {
                const pick = state.setbackRolls.find(r => r.blockIndex === blockIndex)
                const resolved = pick ? resolveSetback(pick.roll, setbackRows) : null
                const yearReached = 13 + blockIndex * 3
                const isAwaitingThis = state.awaitingSetbackBlock === blockIndex
                return (
                  <div key={blockIndex} className="wiz4-randomrow">
                    <div className="wiz4-randomhead">
                      <span className="wiz4-randomlbl">{t('step4.setback_block', { year: yearReached })}</span>
                      {!pick && (
                        <button
                          className={`wiz4-rollbtn${state.awaitingSetbackBlock !== null || state.awaitingRandomRoll ? ' dis' : ''}`}
                          onClick={() => handleStartSetbackRoll(blockIndex)}
                          disabled={state.awaitingSetbackBlock !== null || !!state.awaitingRandomRoll}
                        >
                          {isAwaitingThis ? t('step4.career_random_rolling') : t('step4.setback_roll_btn')}
                        </button>
                      )}
                    </div>
                    {pick && resolved && (
                      <div className="wiz4-randomresult">
                        <p className="wiz4-note"><strong>{resolved.name}</strong> ({pick.roll})</p>
                        <p className="wiz4-note">{resolved.description}</p>
                        <p className="wiz4-note">{t('step4.career_random_narrative_note')}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {(!reversEnabled || setbackBlockCount === 0) && (
            <p className="wiz4-note">{t('step4.setback_none')}</p>
          )}
        </div>
      </div>

      {/* ── Footer commun ── */}
      <div className="wiz4-foot">
        <button className="wiz4-prev" onClick={onPrev}>{t('step4.prev')}</button>
        <span className={`wiz4-status${canNext && !hasUnderSpent ? ' ok' : ''}`}>
          {hasOverBudget
            ? t('step4.career_status_adv_over')
            : !allSetbacksRolled
              ? t('step4.setback_status_left')
              : hasUnderSpent
                ? t('step4.career_status_adv_left')
                : t('step4.career_status_ok')}
        </span>
        <button className={`wiz4-next${canNext ? '' : ' dis'}`} onClick={handleNextClick} disabled={!canNext}>
          {t('step4.next')}
        </button>
      </div>
      {allocWarned && hasUnderSpent && !hasOverBudget && allSetbacksRolled && (
        <p className="wiz4-alloc-warning">{t('step4.career_alloc_warning')}</p>
      )}
    </div>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const s = {
  outer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  columns: {
    flex: 1,
    display: 'flex',
    gap: '16px',
    padding: '16px',
    minHeight: 0,
  },
  colLeft: {
    flex: '3',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  colRight: {
    flex: '2',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
}