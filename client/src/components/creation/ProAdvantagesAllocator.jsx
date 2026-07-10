import { useEffect, useReducer } from 'react'
import { useTranslation } from 'react-i18next'
import { Canvas } from '@react-three/fiber'
import { computeProAdvantageAllocation, computeRandomBudgetDelta } from '../../../../shared/careerAdvantages.js'
import { WS } from '../../../../shared/events.js'
import { useSocket } from '../../lib/SocketContext.jsx'
import { useAuthStore } from '../../stores/authStore.js'
import DiceRoller from '../DiceRoller.jsx'
import DiceLights from '../DiceLights.jsx'

// Sous-step dédiée "Avantages pro" (Session 141 suite 10) — regroupe, PAR MÉTIER RETENU, la
// répartition manuelle (Lot 4) et le Tirage 1D10 (Lot 6), déménagés depuis l'onglet "avant" de
// CareersAllocator.jsx (invisible, enterré dans le détail d'un seul métier à la fois). Les deux
// mécaniques restent liées (un jet converti en points modifie le budget manuel) donc elles restent
// sur le même écran — seule leur position dans le Wizard change, pas leur interaction.

const initialState = ([initialProAdvantages, initialRandomPicks]) => ({
  proAdvAllocations: initialProAdvantages || {},
  randomPicks: initialRandomPicks || {},
  awaitingRandomRoll: null,
  warnedAllocSignature: null,
})

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ADV_POINTS': {
      const careerMap = { ...(state.proAdvAllocations[action.careerId] || {}) }
      if (action.pts <= 0) delete careerMap[action.category]
      else careerMap[action.category] = action.pts
      return { ...state, proAdvAllocations: { ...state.proAdvAllocations, [action.careerId]: careerMap } }
    }
    case 'SET_AWAITING_ROLL':
      return { ...state, awaitingRandomRoll: { careerId: action.careerId, blockIndex: action.blockIndex, payload: null } }
    case 'SET_AWAITING_PAYLOAD':
      if (!state.awaitingRandomRoll) return state
      return { ...state, awaitingRandomRoll: { ...state.awaitingRandomRoll, payload: action.payload } }
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
      }
    }
    case 'TOGGLE_RANDOM_POINTS': {
      const careerPicks = state.randomPicks[action.careerId] || []
      const updated = careerPicks.map(p => p.blockIndex === action.blockIndex ? { ...p, useAsPoints: !p.useAsPoints } : p)
      return { ...state, randomPicks: { ...state.randomPicks, [action.careerId]: updated } }
    }
    case 'SET_ALLOC_WARNED':
      return { ...state, warnedAllocSignature: action.signature }
    default:
      return state
  }
}

// Un bloc par métier retenu — décomposition "field array" (un sous-composant par élément répété)
// plutôt qu'un unique retour JSX géant.
function CareerAdvantageBlock({ t, career, years, advAllocation, randomPicksForCareer, randomProAdvantagesEnabled, awaitingRandomRoll, onInc, onDec, onStartRoll, onTogglePoints }) {
  const randomBudgetDelta = computeRandomBudgetDelta(randomPicksForCareer, career.randomBenefits ?? [])
  const advResult = computeProAdvantageAllocation(advAllocation, {
    categories: (career.pointCategories ?? []).map(c => c.category),
    years,
    randomBudgetDelta,
  })
  const blockCount = Math.floor(years / 5)

  return (
    <div className="wiz4-block">
      <span className="wiz4-h">{career.name}</span>

      {(career.pointCategories ?? []).length === 0 ? (
        <p className="wiz4-note">{t('step4.career_adv_none')}</p>
      ) : (
        <>
          <div className="wiz4-boardhead">
            <span className="wiz4-h">{t('step4.career_adv_title')}</span>
            <span className={`wiz4-poolrem${advResult.remaining === 0 ? ' ok' : ''}`}>
              <span className="wiz4-mono">{advResult.remaining}</span> {t('step4.career_points_remaining')}
            </span>
          </div>
          {career.pointCategories.map(cat => {
            const pts = advAllocation[cat.category] ?? 0
            return (
              <div key={cat.id} className="wiz4-skill">
                <div className="wiz4-skmain">
                  <span className="wiz4-sklabel">{cat.category}</span>
                </div>
                <div className="wiz4-ctl">
                  <button
                    className={`wiz4-sbtn${pts <= 0 ? ' dis' : ''}`}
                    onClick={() => onDec(cat.category)}
                    disabled={pts <= 0}
                  >−</button>
                  <span className="wiz4-val">{pts}</span>
                  <button
                    className={`wiz4-sbtn${advResult.remaining <= 0 ? ' dis' : ''}`}
                    onClick={() => onInc(cat.category)}
                    disabled={advResult.remaining <= 0}
                  >＋</button>
                </div>
              </div>
            )
          })}
        </>
      )}

      {/* Tirage 1D10 (Lot 6). Disponible indépendamment de pointCategories (Chasseur de primes
          n'a aucune catégorie mais la LdB lui accorde quand même cette table — la bascule
          "convertir en points" reste alors masquée, cf. careerAdvantages.js). */}
      {randomProAdvantagesEnabled !== false && (career.randomBenefits ?? []).length > 0 && blockCount > 0 && (
        <>
          <span className="wiz4-h">{t('step4.career_random_title')}</span>
          {Array.from({ length: blockCount }).map((_, blockIndex) => {
            const pick = randomPicksForCareer.find(p => p.blockIndex === blockIndex)
            const rolledRow = pick ? (career.randomBenefits ?? []).find(r => r.roll === pick.roll) : null
            const isAwaitingThis = awaitingRandomRoll?.careerId === career.id && awaitingRandomRoll?.blockIndex === blockIndex
            return (
              <div key={blockIndex} className="wiz4-randomrow">
                <div className="wiz4-randomhead">
                  <span className="wiz4-randomlbl">{t('step4.career_random_block', { n: blockIndex + 1 })}</span>
                  {!pick && (
                    <button
                      className={`wiz4-rollbtn${awaitingRandomRoll ? ' dis' : ''}`}
                      onClick={() => onStartRoll(career.id, blockIndex)}
                      disabled={!!awaitingRandomRoll}
                    >
                      {isAwaitingThis ? t('step4.career_random_rolling') : t('step4.career_random_roll_btn')}
                    </button>
                  )}
                </div>
                {pick && rolledRow && (
                  <div className="wiz4-randomresult">
                    <p className="wiz4-note">{rolledRow.description}</p>
                    <p className="wiz4-note">{t('step4.career_random_narrative_note')}</p>
                    {(career.pointCategories ?? []).length > 0 && rolledRow.points_alt != null && (
                      <label className="wiz4-choiceopt">
                        <input
                          type="checkbox"
                          checked={!!pick.useAsPoints}
                          onChange={() => onTogglePoints(career.id, blockIndex)}
                        />
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
}

export default function ProAdvantagesAllocator({
  selectedCareers,
  careers,
  initialProAdvantages,
  onProAdvantagesChange,
  initialRandomPicks,
  onRandomPicksChange,
  randomProAdvantagesEnabled,
  onNext,
  onPrev,
}) {
  const { t } = useTranslation('creation')
  const socket = useSocket()
  const { user } = useAuthStore()
  const [state, dispatch] = useReducer(reducer, [initialProAdvantages, initialRandomPicks], initialState)

  const careersById = new Map((careers ?? []).map(c => [c.id, c]))

  useEffect(() => {
    onProAdvantagesChange?.(state.proAdvAllocations)
  }, [state.proAdvAllocations, onProAdvantagesChange])

  useEffect(() => {
    onRandomPicksChange?.(state.randomPicks)
  }, [state.randomPicks, onRandomPicksChange])

  // Écoute du résultat du jet en cours — P3 : socket dans les deps, pattern CareersAllocator.jsx.
  useEffect(() => {
    if (!socket) return
    const handleResult = (payload) => {
      if (payload.userId !== user?.id) return
      if (!state.awaitingRandomRoll) return
      // Ce composant ne lance jamais que '1d10' : constante connue ici, pas une supposition.
      dispatch({ type: 'SET_AWAITING_PAYLOAD', payload: { ...payload, dieType: 'd10' } })
    }
    socket.on(WS.DICE_RESULT, handleResult)
    return () => socket.off(WS.DICE_RESULT, handleResult)
  }, [socket, user?.id, state.awaitingRandomRoll])

  const handleStartRoll = (careerId, blockIndex) => {
    if (!socket || state.awaitingRandomRoll) return
    dispatch({ type: 'SET_AWAITING_ROLL', careerId, blockIndex })
    socket.emit(WS.DICE_ROLL, { formula: '1d10' })
  }
  const handleDiceOverlayDone = () => {
    const payload = state.awaitingRandomRoll?.payload
    if (!payload) return
    dispatch({ type: 'RESOLVE_RANDOM_ROLL', roll: payload.total })
  }
  const handleTogglePoints = (careerId, blockIndex) => {
    dispatch({ type: 'TOGGLE_RANDOM_POINTS', careerId, blockIndex })
  }

  // Résultats par métier (une seule passe, réutilisée pour les deux checks ci-dessous).
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

  // Sur-dépensé = vraie violation de règle (atteignable en convertissant un jet en points APRÈS
  // avoir déjà tout réparti manuellement — le budget baisse rétroactivement) — cohérent avec le
  // rejet serveur (creationService.js STEP4, err.code==='over_budget') : blocage dur, jamais
  // contournable par avertissement, contrairement au sous-dépensé (gâchis, pas une règle violée).
  const hasOverBudget = advResultsByCareer.some(r => r.remaining < 0)
  const hasUnderSpent = advResultsByCareer.some(r => r.remaining > 0)
  const canNext = !hasOverBudget
  // Inclut randomPicks : un jet (même sans toucher proAdvAllocations) change le budget via
  // randomBudgetDelta, donc l'état "incomplet" — une signature basée sur proAdvAllocations seul
  // resterait figée après un jet et laisserait passer un avertissement obsolète.
  const incompleteSignature = selectedCareers
    .map(c => `${JSON.stringify(state.proAdvAllocations[c.career_id] || {})}:${JSON.stringify(state.randomPicks[c.career_id] || [])}`)
    .join('|')
  const allocWarned = state.warnedAllocSignature === incompleteSignature

  const handleNextClick = () => {
    if (hasOverBudget) return
    if (hasUnderSpent && !allocWarned) {
      dispatch({ type: 'SET_ALLOC_WARNED', signature: incompleteSignature })
      return
    }
    onNext()
  }

  return (
    <div className="wiz4-cols">
      {state.awaitingRandomRoll?.payload && (
        <div className="wiz4-diceoverlay">
          <Canvas camera={{ position: [15, 15, 15], fov: 60 }}>
            <DiceLights />
            <DiceRoller payload={state.awaitingRandomRoll.payload} onDone={handleDiceOverlayDone} />
          </Canvas>
        </div>
      )}
      <div className="wiz4-main">
        <div className="wiz4-block">
          <span className="wiz4-h">{t('step4.pro_advantages_title')}</span>
          <p className="wiz4-note">{t('step4.pro_advantages_intro')}</p>
        </div>

        {selectedCareers.map(c => {
          const career = careersById.get(c.career_id)
          if (!career) return null
          return (
            <CareerAdvantageBlock
              key={c.career_id}
              t={t}
              career={career}
              years={c.years}
              advAllocation={state.proAdvAllocations[c.career_id] || {}}
              randomPicksForCareer={state.randomPicks[c.career_id] ?? []}
              randomProAdvantagesEnabled={randomProAdvantagesEnabled}
              awaitingRandomRoll={state.awaitingRandomRoll}
              onInc={(category) => dispatch({ type: 'SET_ADV_POINTS', careerId: c.career_id, category, pts: (state.proAdvAllocations[c.career_id]?.[category] ?? 0) + 1 })}
              onDec={(category) => dispatch({ type: 'SET_ADV_POINTS', careerId: c.career_id, category, pts: Math.max(0, (state.proAdvAllocations[c.career_id]?.[category] ?? 0) - 1) })}
              onStartRoll={handleStartRoll}
              onTogglePoints={handleTogglePoints}
            />
          )
        })}

        <div className="wiz4-foot">
          <button className="wiz4-prev" onClick={onPrev}>{t('step4.prev')}</button>
          <span className={`wiz4-status${!hasOverBudget && !hasUnderSpent ? ' ok' : ''}`}>
            {hasOverBudget
              ? t('step4.career_status_adv_over')
              : hasUnderSpent
                ? t('step4.career_status_adv_left')
                : t('step4.career_status_ok')}
          </span>
          <button className={`wiz4-next${canNext ? '' : ' dis'}`} onClick={handleNextClick} disabled={!canNext}>
            {t('step4.next')}
          </button>
        </div>
        {allocWarned && hasUnderSpent && !hasOverBudget && (
          <p className="wiz4-alloc-warning">{t('step4.career_alloc_warning')}</p>
        )}
      </div>
    </div>
  )
}
