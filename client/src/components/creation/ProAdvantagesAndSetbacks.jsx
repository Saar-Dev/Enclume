// client/src/components/creation/ProAdvantagesAndSetbacks.jsx
import { useEffect, useMemo, useReducer, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Canvas } from '@react-three/fiber'
import { computeProAdvantageAllocation, computeRandomBudgetDelta, getPendingCareerPickStep } from '../../../../shared/careerAdvantages.js'
import { getSetbackBlockCount, resolveSetback } from '../../../../shared/careerSetbacks.js'
import { resolveSetbackEffects } from '../../../../shared/setbackEffects.js'
import { WS } from '../../../../shared/events.js'
import { useSocket } from '../../lib/SocketContext.jsx'
import { useAuthStore } from '../../stores/authStore.js'
import DiceRoller from '../DiceRoller.jsx'
import DiceLights from '../DiceLights.jsx'
import { PRO_ADV_CATEGORY_RULE_KEYS } from './proAdvCategoryRuleKeys.js'

// dieType (pour le visuel 3D uniquement, P56 : absent du payload DICE_RESULT serveur) — dérivé de
// la formule elle-même plutôt que deviné par contexte, valable pour tout domaine (base ou sous-jet).
const dieTypeFromFormula = (formula) => (formula ?? '').replace(/^\d+/, '')

// ─── Reducer ────────────────────────────────────────────────────────────────
// Lot 5 : un seul jet en vol à la fois, tous domaines confondus (career_base/career_money/
// setback_base/setback_sub) — `awaiting` unifié plutôt que 4 flags séparés (piège : une résolution
// de Revers peut réclamer plusieurs jets en cascade, un flag booléen par domaine ne suffit plus).
// `setbackResolution` porte la résolution EN COURS d'un Revers (roll + answers accumulées) — ne
// rejoint `setbackRolls` (donc le payload envoyé au parent/serveur) qu'une fois complète
// (`resolveSetbackEffects` -> status 'done'), jamais avant : le serveur rejette tout `setbackRolls`
// incomplet (creationService.js), autant ne jamais lui en envoyer un.
const initialState = ([initialProAdvantages, initialRandomPicks, initialSetbackRolls, initialSetbackResolution]) => ({
  proAdvAllocations: initialProAdvantages || {},
  randomPicks: initialRandomPicks || {},
  setbackRolls: initialSetbackRolls || [],
  // Remontée depuis le parent (Step4Experience) pour survivre à un démontage/remontage de ce
  // composant (navigation entre sous-étapes) — jamais `awaiting` : aucun jet ne peut réellement
  // être "en vol" après un remount (le listener DICE_RESULT précédent est détruit avec lui), les
  // effets d'auto-résolution relanceront un jet frais pour l'étape encore en attente si besoin.
  setbackResolution: initialSetbackResolution || null,
  awaiting: null,
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
    case 'TOGGLE_RANDOM_POINTS': {
      const careerPicks = state.randomPicks[action.careerId] || []
      const updated = careerPicks.map(p => p.blockIndex === action.blockIndex ? { ...p, useAsPoints: !p.useAsPoints } : p)
      return { ...state, randomPicks: { ...state.randomPicks, [action.careerId]: updated } }
    }
    // Chasseur de primes/4 et consorts — décision immédiate, jamais un jet (pas de domaine `awaiting`).
    case 'SET_CAREER_CHOICE': {
      const careerPicks = state.randomPicks[action.careerId] || []
      const updated = careerPicks.map(p => p.blockIndex === action.blockIndex ? { ...p, choice: action.choice } : p)
      return { ...state, randomPicks: { ...state.randomPicks, [action.careerId]: updated } }
    }
    // "Formation" (Lot 6, skill_choice) — décision immédiate (choix d'une compétence), jamais un jet.
    case 'SET_CAREER_SKILL_CHOICE': {
      const careerPicks = state.randomPicks[action.careerId] || []
      const updated = careerPicks.map(p => p.blockIndex === action.blockIndex ? { ...p, chosenSkillId: action.skillId } : p)
      return { ...state, randomPicks: { ...state.randomPicks, [action.careerId]: updated } }
    }

    // ── Dés : démarrage générique (tous domaines) ──
    case 'START_AWAITING_ROLL':
      return { ...state, awaiting: action.awaiting }

    // ── Dés : résolution générique, routée par state.awaiting.domain ──
    case 'RESOLVE_AWAITING_ROLL': {
      if (!state.awaiting) return state
      const { domain } = state.awaiting
      const { roll } = action
      if (domain === 'career_base') {
        const { careerId, blockIndex } = state.awaiting
        const careerPicks = state.randomPicks[careerId] || []
        return {
          ...state,
          randomPicks: { ...state.randomPicks, [careerId]: [...careerPicks, { blockIndex, roll, useAsPoints: false }] },
          awaiting: null, dicePayload: null,
        }
      }
      if (domain === 'career_money') {
        const { careerId, blockIndex } = state.awaiting
        const careerPicks = state.randomPicks[careerId] || []
        const updated = careerPicks.map(p => p.blockIndex === blockIndex ? { ...p, moneyRoll: roll } : p)
        return { ...state, randomPicks: { ...state.randomPicks, [careerId]: updated }, awaiting: null, dicePayload: null }
      }
      if (domain === 'setback_base') {
        return { ...state, setbackResolution: { blockIndex: state.awaiting.blockIndex, roll, answers: {} }, awaiting: null, dicePayload: null }
      }
      if (domain === 'setback_sub') {
        if (!state.setbackResolution) return { ...state, awaiting: null, dicePayload: null }
        return {
          ...state,
          setbackResolution: { ...state.setbackResolution, answers: { ...state.setbackResolution.answers, [state.awaiting.key]: roll } },
          awaiting: null, dicePayload: null,
        }
      }
      return state
    }

    // ── Revers : décision joueur (choice imbriqué, ex. Emprisonnement) ──
    case 'SET_SETBACK_CHOICE': {
      if (!state.setbackResolution) return state
      return {
        ...state,
        setbackResolution: { ...state.setbackResolution, answers: { ...state.setbackResolution.answers, [action.key]: action.index } },
      }
    }
    // Résolution complète (resolveSetbackEffects -> 'done') : bascule dans setbackRolls, le seul
    // champ envoyé au parent/serveur — setbackResolution ne fuite jamais incomplet.
    case 'COMMIT_SETBACK_RESOLUTION': {
      if (!state.setbackResolution) return state
      const { blockIndex, roll, answers } = state.setbackResolution
      return { ...state, setbackRolls: [...state.setbackRolls, { blockIndex, roll, answers }], setbackResolution: null }
    }
    // Réouverture d'une résolution déjà committée devenue incomplète parce que le contexte a changé
    // après coup (Force Polaris acquis en Step5 après un Revers Polaris déjà résolu sans — seul cas
    // réel aujourd'hui). Sans ça, l'UI resterait bloquée à afficher un bouton/choix qui ne fait rien
    // (setbackResolution reste null tant que rien ne le recrée), alors que le serveur, lui,
    // recalculerait la même chose au prochain reconcile et rejetterait en 400.
    case 'REOPEN_SETBACK_RESOLUTION': {
      return {
        ...state,
        setbackRolls: state.setbackRolls.filter(sb => sb.blockIndex !== action.blockIndex),
        setbackResolution: { blockIndex: action.blockIndex, roll: action.roll, answers: action.answers },
      }
    }

    case 'SET_DICE_PAYLOAD':
      return { ...state, dicePayload: action.payload }
    case 'CLEAR_DICE':
      return { ...state, dicePayload: null, awaiting: null }

    // ── Avertissement ──
    case 'SET_ALLOC_WARNED':
      return { ...state, warnedAllocSignature: action.signature }

    default:
      return state
  }
}

// ─── Composant ──────────────────────────────────────────────────────────────
export default function ProAdvantagesAndSetbacks({
  selectedCareers, careers, totalYears, setbackRows, advantagesCatalog,
  initialProAdvantages, initialRandomPicks, initialSetbackRolls, initialSetbackResolution,
  onProAdvantagesChange, onRandomPicksChange, onSetbackRollsChange, onSetbackResolutionChange,
  randomProAdvantagesEnabled, reversEnabled, forcePolaris,
  onNext, onPrev,
}) {
  const { t } = useTranslation('creation')
  const socket = useSocket()
  const { user } = useAuthStore()
  const [state, dispatch] = useReducer(
    reducer, [initialProAdvantages, initialRandomPicks, initialSetbackRolls, initialSetbackResolution], initialState
  )

  const careersById = useMemo(() => new Map((careers ?? []).map(c => [c.id, c])), [careers])
  // Lot 5, 2026-07-23 : noms lisibles pour manual_grant_choice (candidates = advantage_id bruts,
  // ex. adv_044) — le catalogue vient de /creation/:sheetId/step5/ref (même source que Step5,
  // aucune duplication de données).
  const advantageNameById = useMemo(
    () => new Map((advantagesCatalog ?? []).map(a => [a.advantage_id, a.name])),
    [advantagesCatalog]
  )
  const setbackBlockCount = reversEnabled ? getSetbackBlockCount(totalYears) : 0
  const busy = !!state.awaiting

  // ── Règle dépliable sur une catégorie déjà affichée (pas de liste séparée) ──
  const [openRuleRows, setOpenRuleRows] = useState(() => new Set())
  const toggleRuleRow = (rowKey) => setOpenRuleRows(prev => {
    const next = new Set(prev)
    if (next.has(rowKey)) next.delete(rowKey)
    else next.add(rowKey)
    return next
  })

  // ── Sync vers parent (setbackRolls : uniquement des résolutions COMPLÈTES, jamais setbackResolution) ──
  useEffect(() => { onProAdvantagesChange?.(state.proAdvAllocations) }, [state.proAdvAllocations, onProAdvantagesChange])
  useEffect(() => { onRandomPicksChange?.(state.randomPicks) }, [state.randomPicks, onRandomPicksChange])
  useEffect(() => { onSetbackRollsChange?.(state.setbackRolls) }, [state.setbackRolls, onSetbackRollsChange])
  useEffect(() => { onSetbackResolutionChange?.(state.setbackResolution) }, [state.setbackResolution, onSetbackResolutionChange])

  // ── Écoute DICE_RESULT — routée par state.awaiting, plus par deux flags séparés ──
  useEffect(() => {
    if (!socket) return
    const handleResult = (payload) => {
      if (payload.userId !== user?.id || !state.awaiting) return
      dispatch({ type: 'SET_DICE_PAYLOAD', payload: { ...payload, dieType: dieTypeFromFormula(state.awaiting.die) } })
    }
    socket.on(WS.DICE_RESULT, handleResult)
    return () => socket.off(WS.DICE_RESULT, handleResult)
  }, [socket, user?.id, state.awaiting])

  // ── Réouverture : un Revers déjà committé peut redevenir incomplet si le contexte change après
  // coup (Force Polaris acquis en Step5 après un Revers Polaris déjà résolu sans) — le serveur
  // recalculera de toute façon avec le contexte ACTUEL au prochain reconcile (même philosophie que
  // tout le chantier : jamais un état figé), autant le détecter ici et rouvrir la résolution plutôt
  // que de laisser un bouton/choix affiché sans effet. ──
  useEffect(() => {
    if (busy || state.setbackResolution) return
    const stale = state.setbackRolls.find(sb =>
      resolveSetbackEffects(sb.roll, setbackRows, sb.answers, { force_polaris: forcePolaris }).status === 'pending'
    )
    if (stale) dispatch({ type: 'REOPEN_SETBACK_RESOLUTION', blockIndex: stale.blockIndex, roll: stale.roll, answers: stale.answers })
  }, [busy, state.setbackResolution, state.setbackRolls, setbackRows, forcePolaris])

  // ── Auto-résolution : Revers (subroll) PUIS carrière (money_reward), JAMAIS les deux dans le même
  // passage. Un seul effet, pas deux : deux effets indépendants lisant tous deux `busy` au même
  // rendu peuvent tous les deux le voir à `false` et dispatcher chacun un `awaiting` différent — le
  // second écrase le premier en state alors que le dé du premier a déjà été émis au serveur, et son
  // DICE_RESULT s'attribuerait ensuite à tort au domaine du second (bug de course réel, trouvé en
  // relisant ce fichier — reproductible dès qu'une résolution Revers ET un tirage carrière sont
  // restaurés simultanément au montage, cf. `initialSetbackResolution`). `firedSetback` ne bloque le
  // passage carrière QUE si un dé a réellement été émis côté Revers ce tour-ci — une cascade qui
  // attend un clic joueur (chained_setback/choice) ne doit jamais empêcher indéfiniment le jet de
  // détail carrière de se déclencher. ──
  useEffect(() => {
    if (!socket || busy) return
    let firedSetback = false

    if (state.setbackResolution) {
      const result = resolveSetbackEffects(
        state.setbackResolution.roll, setbackRows, state.setbackResolution.answers, { force_polaris: forcePolaris }
      )
      if (result.status === 'done') {
        dispatch({ type: 'COMMIT_SETBACK_RESOLUTION' })
        firedSetback = true
      } else if (result.status === 'pending' && result.kind === 'roll' && result.origin === 'subroll') {
        dispatch({ type: 'START_AWAITING_ROLL', awaiting: { domain: 'setback_sub', blockIndex: state.setbackResolution.blockIndex, key: result.key, die: result.die } })
        socket.emit(WS.DICE_ROLL, { formula: result.die })
        firedSetback = true
      }
      // chained_setback (jet joueur-initié) et choice : rien à auto-tirer, le rendu affiche le
      // bouton/les options — on ne "consomme" pas le tour, la carrière peut être vérifiée ci-dessous.
    }
    if (firedSetback) return

    for (const c of selectedCareers) {
      const career = careersById.get(c.career_id)
      if (!career) continue
      for (const pick of (state.randomPicks[c.career_id] ?? [])) {
        const rolledRow = (career.randomBenefits ?? []).find(r => r.roll === pick.roll)
        const step = rolledRow ? getPendingCareerPickStep(rolledRow, pick) : null
        if (step?.type === 'money_reward') {
          dispatch({ type: 'START_AWAITING_ROLL', awaiting: { domain: 'career_money', careerId: c.career_id, blockIndex: pick.blockIndex, die: step.die } })
          socket.emit(WS.DICE_ROLL, { formula: step.die })
          return
        }
      }
    }
  }, [socket, busy, state.setbackResolution, state.randomPicks, setbackRows, forcePolaris, selectedCareers, careersById])

  // ── Handlers dés (déclenchés par un clic joueur) ──
  const handleStartCareerBaseRoll = (careerId, blockIndex) => {
    if (!socket || busy) return
    dispatch({ type: 'START_AWAITING_ROLL', awaiting: { domain: 'career_base', careerId, blockIndex, die: '1d10' } })
    socket.emit(WS.DICE_ROLL, { formula: '1d10' })
  }
  const handleStartSetbackBaseRoll = (blockIndex) => {
    if (!socket || busy) return
    dispatch({ type: 'START_AWAITING_ROLL', awaiting: { domain: 'setback_base', blockIndex, die: '1d100' } })
    socket.emit(WS.DICE_ROLL, { formula: '1d100' })
  }
  const handleStartSetbackSubRoll = (blockIndex, key, die) => {
    if (!socket || busy) return
    dispatch({ type: 'START_AWAITING_ROLL', awaiting: { domain: 'setback_sub', blockIndex, key, die } })
    socket.emit(WS.DICE_ROLL, { formula: die })
  }
  const handleDiceOverlayDone = () => {
    if (!state.dicePayload) return
    dispatch({ type: 'RESOLVE_AWAITING_ROLL', roll: state.dicePayload.total })
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
  // Un pick de tirage carrière encore en attente (choice/money_reward/skill_choice, trouvé en
  // relecture critique 2026-07-23) n'a jamais été bloquant ici jusqu'à présent — le serveur le
  // rejetait déjà en 400 (resolveCareerRandomEffects lève une erreur), mais rien n'empêchait le
  // joueur de cliquer "Suivant" avant. Corrigé en même temps que l'ajout de skill_choice.
  const hasPendingCareerStep = selectedCareers.some(c => {
    const career = careersById.get(c.career_id)
    if (!career) return false
    return (state.randomPicks[c.career_id] ?? []).some(pick => {
      const rolledRow = (career.randomBenefits ?? []).find(r => r.roll === pick.roll)
      return rolledRow && getPendingCareerPickStep(rolledRow, pick) != null
    })
  })
  // busy (jet en vol) et setbackResolution (cascade Revers pas encore committée) bloquent tous deux
  // "Suivant" — un pick/Revers dont la résolution est incomplète ne doit jamais partir au serveur.
  const canNext = !hasOverBudget && allSetbacksRolled && !busy && !state.setbackResolution && !hasPendingCareerStep

  const incompleteSignature = selectedCareers
    .map(c => `${JSON.stringify(state.proAdvAllocations[c.career_id] || {})}:${JSON.stringify(state.randomPicks[c.career_id] || [])}`)
    .join('|')
  const allocWarned = state.warnedAllocSignature === incompleteSignature

  const handleNextClick = () => {
    if (hasOverBudget || !allSetbacksRolled || busy || state.setbackResolution) return
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
                      const pendingStep = rolledRow ? getPendingCareerPickStep(rolledRow, pick) : null
                      // Lot 5, 2026-07-23 : montant reellement obtenu (money_reward, ex. Pirate/3,
                      // Marchand itinerant/4) — jamais affiche jusqu'ici, seul un "effet applique"
                      // generique (meme defaut que cote Revers, retour Saar).
                      const moneyEffect = pick?.moneyRoll != null
                        ? (rolledRow?.effects ?? []).find(e => e.type === 'money_reward')
                        : null
                      const isAwaitingThis = state.awaiting?.careerId === career.id && state.awaiting?.blockIndex === blockIndex
                      return (
                        <div key={blockIndex} className="wiz4-randomrow">
                          <div className="wiz4-randomhead">
                            <span className="wiz4-randomlbl">{t('step4.career_random_block', { n: blockIndex + 1 })}</span>
                            {!pick && (
                              <button
                                className={`wiz4-rollbtn${busy ? ' dis' : ''}`}
                                onClick={() => handleStartCareerBaseRoll(career.id, blockIndex)}
                                disabled={busy}
                              >
                                {isAwaitingThis ? t('step4.career_random_rolling') : t('step4.career_random_roll_btn')}
                              </button>
                            )}
                          </div>
                          {pick && rolledRow && (
                            <div className="wiz4-randomresult">
                              <p className="wiz4-note">{rolledRow.description}</p>

                              {pendingStep?.type === 'choice' && (
                                <div className="wiz4-choicebtns">
                                  {pendingStep.options.map((opt, idx) => (
                                    <button
                                      key={idx} className="wiz4-choicebtn"
                                      onClick={() => dispatch({ type: 'SET_CAREER_CHOICE', careerId: career.id, blockIndex, choice: idx })}
                                    >
                                      {opt.label ?? t('step4.option_fallback', { n: idx + 1 })}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {pendingStep?.type === 'money_reward' && (
                                <p className="wiz4-note">{t('step4.career_random_rolling')}</p>
                              )}
                              {pendingStep?.type === 'skill_choice' && (
                                <select
                                  className="wiz4-skillselect"
                                  value=""
                                  onChange={(e) => dispatch({ type: 'SET_CAREER_SKILL_CHOICE', careerId: career.id, blockIndex, skillId: e.target.value })}
                                >
                                  <option value="" disabled>{t('step4.career_random_skill_choice_placeholder')}</option>
                                  {[...(career.skills ?? [])]
                                    .sort((a, b) => (a.label ?? a.skill_id).localeCompare(b.label ?? b.skill_id))
                                    .map(sk => (
                                      <option key={sk.skill_id} value={sk.skill_id}>{sk.label ?? sk.skill_id}</option>
                                    ))}
                                </select>
                              )}
                              {moneyEffect && (
                                <p className="wiz4-note wiz4-mono">
                                  {t('step4.career_random_money_result', {
                                    roll: pick.moneyRoll, multiplier: moneyEffect.multiplier,
                                    amount: pick.moneyRoll * moneyEffect.multiplier,
                                  })}
                                </p>
                              )}
                              {!pendingStep && (
                                <p className="wiz4-note">
                                  {!pick.useAsPoints && (rolledRow.effects ?? []).length > 0
                                    ? t('step4.career_random_applied_note')
                                    : t('step4.career_random_narrative_note')}
                                </p>
                              )}

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
                const committed = state.setbackRolls.find(r => r.blockIndex === blockIndex)
                const inProgress = state.setbackResolution?.blockIndex === blockIndex ? state.setbackResolution : null
                const current = committed ?? inProgress
                const resolvedRow = current ? resolveSetback(current.roll, setbackRows) : null
                const yearReached = 13 + blockIndex * 3
                const isAwaitingThis = state.awaiting?.blockIndex === blockIndex
                  && (state.awaiting?.domain === 'setback_base' || state.awaiting?.domain === 'setback_sub')

                // Recalcul pur (jamais stocké) : où en est la résolution de CE bloc, et — une fois
                // commitée — les effets finaux, pour l'affichage de manual_grant_choice.
                const liveResolution = current
                  ? resolveSetbackEffects(current.roll, setbackRows, current.answers, { force_polaris: forcePolaris })
                  : null

                return (
                  <div key={blockIndex} className="wiz4-randomrow">
                    <div className="wiz4-randomhead">
                      <span className="wiz4-randomlbl">{t('step4.setback_block', { year: yearReached })}</span>
                      {!current && (
                        <button
                          className={`wiz4-rollbtn${busy ? ' dis' : ''}`}
                          onClick={() => handleStartSetbackBaseRoll(blockIndex)}
                          disabled={busy}
                        >
                          {isAwaitingThis ? t('step4.career_random_rolling') : t('step4.setback_roll_btn')}
                        </button>
                      )}
                    </div>
                    {current && resolvedRow && (
                      <div className="wiz4-randomresult">
                        <p className="wiz4-note"><strong>{resolvedRow.name}</strong> ({current.roll})</p>
                        <p className="wiz4-note">{resolvedRow.description}</p>

                        <hr className="wiz4-divider" />

                        {/* Journal des jets deja repondus (chained_setback/subroll) — visible pendant
                            ET apres la resolution, pour qu'Attentat (2 jets enchaines) ou Choc
                            psychologique (jet auto-tire) ne restent jamais silencieux (retour Saar). */}
                        {(liveResolution?.history ?? []).length > 0 && (
                          <div className="wiz4-rolllog">
                            {liveResolution.history.map((h, i) => (
                              <span key={i} className={`wiz4-rolllog-item${h.type === 'chained_setback' && h.hit ? ' hit' : ''}`}>
                                {h.type === 'chained_setback'
                                  ? t(h.hit ? 'step4.setback_roll_hit' : 'step4.setback_roll_miss', { target: h.target, value: h.value })
                                  : t('step4.setback_roll_detail', { value: h.value })}
                              </span>
                            ))}
                          </div>
                        )}

                        {liveResolution?.status === 'pending' && liveResolution.kind === 'roll' && liveResolution.origin === 'chained_setback' && (
                          <button
                            className={`wiz4-rollbtn${busy ? ' dis' : ''}`}
                            onClick={() => handleStartSetbackSubRoll(blockIndex, liveResolution.key, liveResolution.die)}
                            disabled={busy}
                          >
                            {isAwaitingThis ? t('step4.career_random_rolling') : t('step4.setback_suspense_roll_btn')}
                          </button>
                        )}
                        {liveResolution?.status === 'pending' && liveResolution.kind === 'roll' && liveResolution.origin === 'subroll' && (
                          <p className="wiz4-note">{t('step4.career_random_rolling')}</p>
                        )}
                        {liveResolution?.status === 'pending' && liveResolution.kind === 'choice' && (
                          <div className="wiz4-choicebtns">
                            {liveResolution.options.map((opt, idx) => (
                              <button
                                key={idx} className="wiz4-choicebtn"
                                onClick={() => dispatch({ type: 'SET_SETBACK_CHOICE', key: liveResolution.key, index: idx })}
                              >
                                {opt.label ?? t('step4.option_fallback', { n: idx + 1 })}
                              </button>
                            ))}
                          </div>
                        )}
                        {committed && liveResolution?.status === 'done' && (
                          <p className="wiz4-note">
                            {liveResolution.effects.length > 0 ? t('step4.setback_applied_note') : t('step4.setback_narrative_note')}
                          </p>
                        )}
                        {committed && liveResolution?.status === 'done' && liveResolution.effects
                          .filter(e => e.type === 'manual_grant_choice')
                          .map((e, i) => (
                            <p key={i} className="wiz4-note wiz4-manual-note">
                              {t('step4.setback_manual_grant_note', {
                                candidates: (e.candidates ?? []).map(id => advantageNameById.get(id) ?? id).join(', '),
                              })}
                            </p>
                          ))}
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
            : !allSetbacksRolled || busy || state.setbackResolution
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
