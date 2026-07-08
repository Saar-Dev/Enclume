import { useEffect, useMemo, useReducer } from 'react'
import { useTranslation } from 'react-i18next'
import { Canvas } from '@react-three/fiber'
import { evaluateCareerEligibility } from '../../../../shared/careerEligibility.js'
import { computeSkillAllocation, getSkillCap } from '../../../../shared/careerSkills.js'
import { estimateSalaryFormula } from '../../../../shared/polarisUtils.js'
import { computeProAdvantageAllocation, computeRandomBudgetDelta } from '../../../../shared/careerAdvantages.js'
import { WS } from '../../../../shared/events.js'
import { useSocket } from '../../lib/SocketContext.jsx'
import { useAuthStore } from '../../stores/authStore.js'
import DiceRoller from '../DiceRoller.jsx'
import DiceLights from '../DiceLights.jsx'

// Couleur déterministe (hash → HSL) — rail + tags de provenance du board.
function careerHexColor(code) {
  let hash = 0
  for (let i = 0; i < (code ?? '').length; i++) hash = (hash * 31 + code.charCodeAt(i)) >>> 0
  return `hsl(${hash % 360}, 55%, 55%)`
}

function formatReason(t, r) {
  switch (r.code) {
    case 'prereq':
      return t('step4.career_ineligible_prereq', { years: r.minYears, career: r.careerName ?? r.careerId })
    case 'genotype':
      return t('step4.career_ineligible_genotype', { genotype: r.genotypeLabel })
    case 'attributes':
      return t('step4.career_ineligible_attributes', {
        list: r.failed.map(f => `${f.attr} ${f.have ?? '?'}/${f.min}`).join(', '),
      })
    case 'education':
      return r.present
        ? t('step4.career_ineligible_education_wrong', { fields: r.fields.join(' ou ') })
        : t('step4.career_ineligible_education_missing', { fields: r.fields.join(' ou ') })
    default:
      return t('step4.career_ineligible_generic')
  }
}

const initialReducerState = ([initialSkillAllocations, initialProAdvantages, initialOpenedSkills, initialRandomPicks]) => ({
  filter: 'eligible',
  selectedCareerId: null,
  years: 1,
  activeTab: 'metier',
  hoverCareerId: null,
  skillAllocations: initialSkillAllocations || {},
  proAdvAllocations: initialProAdvantages || {},
  openedSkills: initialOpenedSkills || [],
  randomPicks: initialRandomPicks || {},
  awaitingRandomRoll: null,
})

function careersReducer(state, action) {
  switch (action.type) {
    case 'SET_FILTER':
      return { ...state, filter: action.filter }
    case 'SELECT_CAREER':
      if (state.selectedCareerId === action.id) return { ...state, selectedCareerId: null }
      return { ...state, selectedCareerId: action.id, years: action.committedYears ?? 1, activeTab: 'metier' }
    case 'SET_HOVER':
      return { ...state, hoverCareerId: action.id }
    case 'SET_TAB':
      return { ...state, activeTab: action.tab }
    case 'SET_YEARS':
      return { ...state, years: Math.max(1, Math.min(50, action.years)) }
    case 'ALLOC_SKILL': {
      const nextTarget = (state.skillAllocations[action.skillId] ?? action.base) + action.delta
      const allocations = { ...state.skillAllocations }
      if (nextTarget <= action.base) delete allocations[action.skillId]
      else allocations[action.skillId] = nextTarget
      return { ...state, skillAllocations: allocations }
    }
    case 'PRUNE_ALLOCATIONS': {
      const allocations = {}
      for (const [id, v] of Object.entries(state.skillAllocations)) {
        if (action.validIds.has(id)) allocations[id] = v
      }
      return { ...state, skillAllocations: allocations }
    }
    case 'SET_ADV_POINTS': {
      const careerMap = { ...(state.proAdvAllocations[action.careerId] || {}) }
      if (action.pts <= 0) delete careerMap[action.category]
      else careerMap[action.category] = action.pts
      return { ...state, proAdvAllocations: { ...state.proAdvAllocations, [action.careerId]: careerMap } }
    }
    case 'PRUNE_ADV': {
      const proAdvAllocations = {}
      for (const [id, v] of Object.entries(state.proAdvAllocations)) {
        if (action.validIds.has(id)) proAdvAllocations[id] = v
      }
      return { ...state, proAdvAllocations }
    }
    case 'TOGGLE_OPENED_SKILL': {
      const has = state.openedSkills.includes(action.skillId)
      return {
        ...state,
        openedSkills: has
          ? state.openedSkills.filter(id => id !== action.skillId)
          : [...state.openedSkills, action.skillId],
      }
    }
    case 'SELECT_CHOICE_GROUP_SKILL': {
      const others = state.openedSkills.filter(id => !action.groupSkillIds.includes(id))
      return { ...state, openedSkills: [...others, action.skillId] }
    }
    case 'PRUNE_OPENED_SKILLS': {
      const openedSkills = state.openedSkills.filter(id => action.validIds.has(id))
      return { ...state, openedSkills }
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
    case 'PRUNE_RANDOM_PICKS': {
      const randomPicks = {}
      for (const [id, v] of Object.entries(state.randomPicks)) {
        if (action.validIds.has(id)) randomPicks[id] = v
      }
      return { ...state, randomPicks }
    }
    default:
      return state
  }
}

export default function CareersAllocator({
  pcDispo,
  selectedCareers,
  careers,
  onAdd,
  onRemove,
  onNext,
  onPrev,
  selectedGeoItem,
  selectedSocItem,
  selectedTrainingItem,
  selectedHigherEdItem,
  baseAge,
  attributes,
  genotypeId,
  higherEd,
  refSkills,
  initialSkillAllocations,
  onSkillAllocationsChange,
  initialProAdvantages,
  onProAdvantagesChange,
  initialOpenedSkills,
  onOpenedSkillsChange,
  initialRandomPicks,
  onRandomPicksChange,
}) {
  const { t } = useTranslation('creation')
  const socket = useSocket()
  const { user } = useAuthStore()
  const [state, dispatch] = useReducer(
    careersReducer,
    [initialSkillAllocations, initialProAdvantages, initialOpenedSkills, initialRandomPicks],
    initialReducerState
  )
  const { filter, selectedCareerId, years, activeTab, hoverCareerId } = state

  const careersById = useMemo(() => new Map((careers ?? []).map(c => [c.id, c])), [careers])
  const refSkillsById = useMemo(() => new Map((refSkills ?? []).map(s => [s.id, s])), [refSkills])
  const skillLabel = (id) => refSkillsById.get(id)?.label ?? id

  const career = careersById.get(selectedCareerId) || null
  const isAdded = career ? selectedCareers.some(c => c.career_id === career.id) : false
  const committedEntry = career ? selectedCareers.find(c => c.career_id === career.id) : null
  const displayYears = isAdded ? committedEntry.years : years

  const getTitleForYears = (titles, yrs) => {
    if (!titles || titles.length === 0) return null
    return titles.find(ti => yrs >= ti.min_years && (ti.max_years === null || yrs <= ti.max_years)) || titles[titles.length - 1]
  }
  const currentTitle = career ? getTitleForYears(career.titles, displayYears) : null

  const formatSalary = (title) => {
    if (!title) return '—'
    if (title.salary_per_year) return t('step4.career_salary_amount', { amount: title.salary_per_year })
    if (title.salary_formula) return t('step4.career_salary_random', { formula: title.salary_formula })
    return '—'
  }

  // Reproduit exactement la formule serveur (creationService.js reconcileCreation STEP4) :
  // salaire du titre courant × années. Formule aléatoire → estimation moyenne déterministe (pas de
  // Math.random en lecture seule), montant réel déterminé par le serveur à la validation.
  const salaryPerYear = (title) => {
    if (!title) return { amount: 0, isRandom: false }
    if (title.salary_per_year) return { amount: title.salary_per_year, isRandom: false }
    if (title.salary_formula) return { amount: estimateSalaryFormula(title.salary_formula), isRandom: true }
    return { amount: 0, isRandom: false }
  }

  // ── Éligibilité (Lot 0) ──────────────────────────────────────────
  const eligContext = useMemo(() => ({
    careers: selectedCareers.map(c => ({ career_id: c.career_id, years: c.years })),
    genotypeId,
    higherEd,
    attributes: attributes || {},
  }), [selectedCareers, genotypeId, higherEd, attributes])

  const eligibilityById = useMemo(() => {
    const map = new Map()
    for (const c of careers ?? []) {
      const prerequisites = (c.prerequisites ?? []).map(p => ({
        ...p,
        prerequisiteCareerName: careersById.get(p.prerequisite_career_id)?.name,
      }))
      map.set(c.id, evaluateCareerEligibility(
        { ...c, prerequisites, education: c.education ?? [] },
        eligContext
      ))
    }
    return map
  }, [careers, careersById, eligContext])

  const filteredCareers = (careers ?? []).filter(c => {
    if (filter === 'all') return true
    return eligibilityById.get(c.id)?.eligible ?? true
  })

  const eligibility = career ? eligibilityById.get(career.id) : null
  const eligible = eligibility?.eligible ?? true

  // ── PC (années = PC, inchangé) ───────────────────────────────────
  const totalPC = selectedCareers.reduce((sum, c) => sum + c.years, 0)
  const remainingPC = pcDispo - totalPC

  // ── Économies (Lot 3) — Σ salaire du titre courant × années par métier retenu ─
  const savingsInfo = useMemo(() => {
    let total = 0
    let isRandom = false
    for (const c of selectedCareers) {
      const refCareer = careersById.get(c.career_id)
      const title = getTitleForYears(refCareer?.titles, c.years)
      const { amount, isRandom: random } = salaryPerYear(title)
      total += amount * c.years
      if (random) isRandom = true
    }
    return { total, isRandom }
  }, [selectedCareers, careersById])

  // ── Avantages pro (Lot 4) — pool PAR MÉTIER, verrouillé tant que non retenu ──
  const advAllocation = career ? (state.proAdvAllocations[career.id] || {}) : {}
  // ── Tirage 1D10 (Lot 6) — retire 5 pts du budget par tranche jetée, cf. careerAdvantages.js.
  // Ignoré par computeProAdvantageAllocation si la carrière n'a aucune catégorie (Chasseur de
  // primes) : le jet y reste possible, sans effet sur un budget qui n'existe pas.
  const randomPicksForCareer = career ? (state.randomPicks[career.id] ?? []) : []
  const randomBudgetDeltaForCareer = career
    ? computeRandomBudgetDelta(randomPicksForCareer, career.randomBenefits ?? [])
    : 0
  const advResult = career && isAdded
    ? computeProAdvantageAllocation(advAllocation, {
        categories: (career.pointCategories ?? []).map(c => c.category),
        years: committedEntry.years,
        randomBudgetDelta: randomBudgetDeltaForCareer,
      })
    : null

  const allAdvSpent = selectedCareers.every(c => {
    const refCareer = careersById.get(c.career_id)
    const delta = computeRandomBudgetDelta(state.randomPicks[c.career_id] ?? [], refCareer?.randomBenefits ?? [])
    const result = computeProAdvantageAllocation(state.proAdvAllocations[c.career_id] || {}, {
      categories: (refCareer?.pointCategories ?? []).map(cat => cat.category),
      years: c.years,
      randomBudgetDelta: delta,
    })
    return result.remaining === 0
  })

  const handleAdvInc = (category) => {
    if (!isAdded || !advResult || advResult.remaining <= 0) return
    const current = advAllocation[category] ?? 0
    dispatch({ type: 'SET_ADV_POINTS', careerId: career.id, category, pts: current + 1 })
  }
  const handleAdvDec = (category) => {
    if (!isAdded) return
    const current = advAllocation[category] ?? 0
    if (current <= 0) return
    dispatch({ type: 'SET_ADV_POINTS', careerId: career.id, category, pts: current - 1 })
  }

  // ── Tirage 1D10 (Lot 6) — garde anti-course : un seul jet en vol à la fois, careerId/blockIndex
  // capturés au clic (jamais re-dérivés de la sélection courante à la résolution).
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
  const handleToggleRandomPoints = (careerId, blockIndex) => {
    dispatch({ type: 'TOGGLE_RANDOM_POINTS', careerId, blockIndex })
  }

  // ── Compétences d'origine (base) ─────────────────────────────────
  const baseMastery = useMemo(() => {
    const map = {}
    const add = (skills) => {
      ;(skills ?? []).filter(sk => !sk.conditional).forEach(sk => {
        map[sk.skill_id] = (map[sk.skill_id] ?? 0) + (sk.bonus ?? 0)
      })
    }
    add(selectedGeoItem?.skills)
    add(selectedSocItem?.skills)
    add(selectedTrainingItem?.skills)
    add(selectedHigherEdItem?.skills)
    return map
  }, [selectedGeoItem, selectedSocItem, selectedTrainingItem, selectedHigherEdItem])

  // ── Moteur de coût global (Lot 1) ─────────────────────────────────
  const boardSkillIds = useMemo(() => {
    const ids = new Set(Object.keys(baseMastery))
    for (const c of selectedCareers) {
      const refCareer = careersById.get(c.career_id)
      for (const sk of refCareer?.skills ?? []) {
        if (!sk.conditional || state.openedSkills.includes(sk.skill_id)) ids.add(sk.skill_id)
      }
    }
    return ids
  }, [baseMastery, selectedCareers, careersById, state.openedSkills])

  const skillAllocationCtx = useMemo(() => ({
    careers: selectedCareers.map(c => ({
      skills: (careersById.get(c.career_id)?.skills ?? [])
        .filter(sk => !sk.conditional || state.openedSkills.includes(sk.skill_id))
        .map(sk => sk.skill_id),
      years: c.years,
    })),
    higherEdSkills: (selectedHigherEdItem?.skills ?? []).filter(sk => !sk.conditional).map(sk => sk.skill_id),
    baseMastery,
    refSkills: refSkills ?? [],
    openedSkills: state.openedSkills,
  }), [selectedCareers, careersById, selectedHigherEdItem, baseMastery, refSkills, state.openedSkills])

  // Seules les compétences RÉELLEMENT touchées par le joueur (state.skillAllocations) sont
  // soumises au calcul de coût — une compétence non modifiée doit toujours coûter 0 (Lot 2 fix :
  // passer toutes les compétences du board ici, y compris non touchées, déclenchait le blocage
  // "(X) non ouvert" de calcSkillCost dès qu'une compétence réservée avait un bonus d'origine).
  const allocationResult = useMemo(
    () => computeSkillAllocation(state.skillAllocations, skillAllocationCtx),
    [state.skillAllocations, skillAllocationCtx]
  )

  const provenanceFor = (skillId) => {
    const tags = []
    for (const c of selectedCareers) {
      const refCareer = careersById.get(c.career_id)
      if (refCareer?.skills?.some(sk => sk.skill_id === skillId && (!sk.conditional || state.openedSkills.includes(sk.skill_id)))) {
        tags.push({ key: c.career_id, label: refCareer.name.slice(0, 3), color: careerHexColor(refCareer.code) })
      }
    }
    if (skillId in baseMastery) tags.push({ key: 'origin', label: t('step4.career_provenance_origin'), color: '#5a6072' })
    return tags
  }

  // Plafond calculé pour CHAQUE compétence du board (touchée ou non), indépendamment du coût.
  const boardGroups = useMemo(() => {
    const byFamily = {}
    for (const skillId of boardSkillIds) {
      const current = baseMastery[skillId] ?? 0
      const target = state.skillAllocations[skillId] ?? current
      const cap = getSkillCap(skillId, skillAllocationCtx)
      const family = refSkillsById.get(skillId)?.family ?? '?'
      ;(byFamily[family] ??= []).push({ skillId, current, target, cap, provenance: provenanceFor(skillId) })
    }
    return Object.entries(byFamily)
      .map(([family, skills]) => ({
        family,
        skills: skills.sort((a, b) => skillLabel(a.skillId).localeCompare(skillLabel(b.skillId))),
      }))
      .sort((a, b) => a.family.localeCompare(b.family))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardSkillIds, skillAllocationCtx, state.skillAllocations, baseMastery, refSkillsById, selectedCareers, careersById, state.openedSkills])

  // ── Purge des allocations orphelines (carrière retirée) ──────────
  useEffect(() => {
    dispatch({ type: 'PRUNE_ALLOCATIONS', validIds: boardSkillIds })
  }, [boardSkillIds])

  useEffect(() => {
    dispatch({ type: 'PRUNE_ADV', validIds: new Set(selectedCareers.map(c => c.career_id)) })
  }, [selectedCareers])

  useEffect(() => {
    dispatch({ type: 'PRUNE_RANDOM_PICKS', validIds: new Set(selectedCareers.map(c => c.career_id)) })
  }, [selectedCareers])

  // Écoute du résultat du jet en cours (Lot 6) — P3 : socket dans les deps, pattern DicePanel.jsx.
  useEffect(() => {
    if (!socket) return
    const handleResult = (payload) => {
      if (payload.userId !== user?.id) return
      // socketDice.js n'inclut jamais dieType dans le payload DICE_RESULT (calculé côté serveur pour
      // dice_config uniquement, jamais réémis) — SessionPage le reconstruit depuis la formule texte
      // (useSessionSocket.js:62). Ce composant ne lance jamais que '1d10' : constante connue ici,
      // pas une supposition — voir handleStartRoll.
      dispatch({ type: 'SET_AWAITING_PAYLOAD', payload: { ...payload, dieType: 'd10' } })
    }
    socket.on(WS.DICE_RESULT, handleResult)
    return () => socket.off(WS.DICE_RESULT, handleResult)
  }, [socket, user?.id])

  // Retire des choix "au choix" tout skill_id dont la carrière conditionnelle d'origine a été retirée.
  useEffect(() => {
    const validIds = new Set()
    for (const c of selectedCareers) {
      const refCareer = careersById.get(c.career_id)
      for (const sk of refCareer?.skills ?? []) if (sk.conditional) validIds.add(sk.skill_id)
    }
    dispatch({ type: 'PRUNE_OPENED_SKILLS', validIds })
  }, [selectedCareers, careersById])

  // ── Remontée au parent (payload global) ──────────────────────────
  useEffect(() => {
    onSkillAllocationsChange?.(state.skillAllocations)
  }, [state.skillAllocations, onSkillAllocationsChange])

  useEffect(() => {
    onProAdvantagesChange?.(state.proAdvAllocations)
  }, [state.proAdvAllocations, onProAdvantagesChange])

  useEffect(() => {
    onOpenedSkillsChange?.(state.openedSkills)
  }, [state.openedSkills, onOpenedSkillsChange])

  useEffect(() => {
    onRandomPicksChange?.(state.randomPicks)
  }, [state.randomPicks, onRandomPicksChange])

  const handleAllocInc = (row) => {
    if (allocationResult.remaining <= 0 || row.target >= row.cap) return
    dispatch({ type: 'ALLOC_SKILL', skillId: row.skillId, delta: 1, base: baseMastery[row.skillId] ?? 0 })
  }
  const handleAllocDec = (row) => {
    if (row.target <= (baseMastery[row.skillId] ?? 0)) return
    dispatch({ type: 'ALLOC_SKILL', skillId: row.skillId, delta: -1, base: baseMastery[row.skillId] ?? 0 })
  }

  const handleAdd = () => {
    if (!career || isAdded || !eligible) return
    if (years > remainingPC) return
    onAdd(career.id, career.name, career.titles, years)
  }

  const groupedSkills = career ? career.skills.filter(sk => !sk.conditional).reduce((acc, sk) => {
    ;(acc[sk.family] ??= []).push(sk)
    return acc
  }, {}) : {}

  // Compétences "au choix" (Lot 5) — groupées par choice_group (radio exclusif) ou solo (checkbox
  // indépendante), potentiellement multi-familles (ex. Médecin/Chirurgien : sciences + techniques).
  const choiceGroups = career ? Object.values(
    career.skills.filter(sk => sk.conditional).reduce((acc, sk) => {
      const key = sk.choice_group || `__solo_${sk.skill_id}`
      ;(acc[key] ??= { key, isSolo: !sk.choice_group, skillIds: [] }).skillIds.push(sk.skill_id)
      return acc
    }, {})
  ) : []

  const totalCareerYears = selectedCareers.reduce((sum, c) => sum + c.years, 0)
  const currentAge = baseAge + totalCareerYears

  let statusKey, statusOk
  if (selectedCareers.length === 0) {
    statusKey = 'career_status_none'; statusOk = false
  } else if (allocationResult.errors.some(e => e.code === 'over_cap')) {
    statusKey = 'career_status_cap'; statusOk = false
  } else if (allocationResult.remaining > 0) {
    statusKey = 'career_status_skills_left'; statusOk = false
  } else if (allocationResult.errors.some(e => e.code === 'over_budget')) {
    statusKey = 'career_status_cap'; statusOk = false
  } else if (!allAdvSpent) {
    statusKey = 'career_status_adv_left'; statusOk = false
  } else {
    statusKey = 'career_status_ok'; statusOk = true
  }
  const canNext = selectedCareers.length > 0 && allocationResult.errors.length === 0 &&
    allocationResult.remaining === 0 && allAdvSpent

  return (
    <>
    {state.awaitingRandomRoll?.payload && (
      <div className="wiz4-diceoverlay">
        <Canvas camera={{ position: [15, 15, 15], fov: 60 }}>
          <DiceLights />
          <DiceRoller payload={state.awaitingRandomRoll.payload} onDone={handleDiceOverlayDone} />
        </Canvas>
      </div>
    )}
    <div className="wiz4-cols">
      <div className="wiz4-rail">
        <div className="wiz4-seg">
          <button
            className={`wiz4-segbtn${filter === 'all' ? ' on' : ''}`}
            onClick={() => dispatch({ type: 'SET_FILTER', filter: 'all' })}
          >
            {t('step4.career_filter_all')}
          </button>
          <button
            className={`wiz4-segbtn${filter === 'eligible' ? ' on' : ''}`}
            onClick={() => dispatch({ type: 'SET_FILTER', filter: 'eligible' })}
          >
            {t('step4.career_filter_eligible')}
          </button>
        </div>
        {filteredCareers.map(c => {
          const added = selectedCareers.some(sc => sc.career_id === c.id)
          const committed = selectedCareers.find(sc => sc.career_id === c.id)
          const firstTitle = getTitleForYears(c.titles, 1)
          return (
            <div
              key={c.id}
              className={`wiz4-railrow${selectedCareerId === c.id ? ' sel' : ''}${added ? ' added' : ''}`}
              onClick={() => dispatch({ type: 'SELECT_CAREER', id: c.id, committedYears: committed?.years })}
              onMouseEnter={() => dispatch({ type: 'SET_HOVER', id: c.id })}
              onMouseLeave={() => dispatch({ type: 'SET_HOVER', id: null })}
            >
              <div className="wiz4-railbody">
                <div className="wiz4-railname">{c.name}</div>
                <div className="wiz4-railmeta">
                  <span className="wiz4-mono">{formatSalary(firstTitle)}</span>
                  <span>{firstTitle?.title}</span>
                  {c.restricted_geographic_origin && (
                    <span className="wiz4-restr" title={c.geographic_origin_details}>⚠</span>
                  )}
                </div>
                {added && (
                  <span className="wiz4-retenu">✓ {t('step4.career_retained')} · {committed.years} an(s)</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="wiz4-main">
        <div className="wiz4-agebar">
          <div className="wiz4-ageitem">
            <span className="wiz4-h">{t('step4.career_age_start')}</span>
            <span className="wiz4-agev wiz4-mono">{baseAge}</span>
          </div>
          <span className="wiz4-agesep" />
          <div className="wiz4-ageitem">
            <span className="wiz4-h">{t('step4.career_age_years')}</span>
            <span className="wiz4-agev wiz4-mono">+{totalCareerYears}</span>
          </div>
          <span className="wiz4-agesep" />
          <div className="wiz4-ageitem">
            <span className="wiz4-h">{t('step4.career_age_current')}</span>
            <span className="wiz4-agev wiz4-mono hi">{currentAge} ans</span>
          </div>
          <span className="wiz4-agesep" />
          <div className="wiz4-ageitem">
            <span className="wiz4-h">{t('step4.career_age_savings')}</span>
            <span className="wiz4-agev wiz4-mono gold">
              {selectedCareers.length > 0 ? `${savingsInfo.total}¤${savingsInfo.isRandom ? '*' : ''}` : '—'}
            </span>
          </div>
          <span className="wiz4-agenote">{t('step4.career_age_note')}</span>
        </div>

        {career && (
          <div className="wiz4-detail">
            <div className="wiz4-dtop">
              {career.illustration && (
                <img
                  className="wiz4-illus"
                  src={`${import.meta.env.VITE_API_URL}/api/assets/${career.illustration}`}
                  alt={career.name}
                />
              )}
              <div className="wiz4-dinfo">
                <div className="wiz4-dtitle">{career.name}</div>
                <div className="wiz4-drang">
                  {t('step4.career_starts', { salary: formatSalary(currentTitle) })}
                  {currentTitle && ` · ${t('step4.career_rank', { rang: currentTitle.title })}`}
                  {' · '}{t('step4.career_unlocks_skills', { count: career.skills.length })}
                </div>
                <div className="wiz4-ddesc">{career.description}</div>
                <div className="wiz4-dactions">
                  {!isAdded ? (
                    <div className="wiz4-yearctl">
                      <span className="wiz4-h">{t('step4.career_years_in')}</span>
                      <button
                        className="wiz4-stepbtn"
                        onClick={() => dispatch({ type: 'SET_YEARS', years: years - 1 })}
                        disabled={years <= 1}
                      >−</button>
                      <span className="wiz4-yearval">{years} an(s)</span>
                      <button
                        className="wiz4-stepbtn"
                        onClick={() => dispatch({ type: 'SET_YEARS', years: years + 1 })}
                        disabled={years >= Math.min(50, remainingPC)}
                      >＋</button>
                    </div>
                  ) : (
                    <div className="wiz4-yearctl">
                      <span className="wiz4-h">{t('step4.career_years_in')}</span>
                      <span className="wiz4-yearval">{committedEntry.years} an(s)</span>
                    </div>
                  )}
                  <div style={{ flex: 1 }} />
                  {!isAdded ? (
                    <button
                      className={`wiz4-addbtn${!eligible || years > remainingPC ? ' dis' : ''}`}
                      onClick={handleAdd}
                      disabled={!eligible || years > remainingPC}
                    >
                      {t('step4.career_add')}
                    </button>
                  ) : (
                    <>
                      <span className="wiz4-addbtn dis">✓ {t('step4.career_retained')}</span>
                      <button
                        className="wiz4-prev"
                        onClick={() => onRemove(selectedCareers.findIndex(sc => sc.career_id === career.id))}
                      >
                        {t('step4.career_remove')}
                      </button>
                    </>
                  )}
                </div>
                {!isAdded && !eligible && (
                  <p className="wiz4-note">
                    {eligibility.reasons.map(r => formatReason(t, r)).join(' · ')}
                  </p>
                )}
              </div>
            </div>

            <div className="wiz4-tabs">
              <button
                className={`wiz4-tab${activeTab === 'metier' ? ' on' : ''}`}
                onClick={() => dispatch({ type: 'SET_TAB', tab: 'metier' })}
              >{t('step4.career_tab_metier')}</button>
              <button
                className={`wiz4-tab${activeTab === 'carriere' ? ' on' : ''}`}
                onClick={() => dispatch({ type: 'SET_TAB', tab: 'carriere' })}
              >{t('step4.career_tab_carriere')}</button>
              <button
                className={`wiz4-tab${activeTab === 'avant' ? ' on' : ''}`}
                onClick={() => dispatch({ type: 'SET_TAB', tab: 'avant' })}
              >{t('step4.career_tab_avant')}</button>
            </div>
            <div className="wiz4-tabbody">
              {activeTab === 'metier' && (
                <>
                  {career.restricted_geographic_origin && career.geographic_origin_details && (
                    <div className="wiz4-block">
                      <span className="wiz4-h">{t('step4.career_geo_origin')}</span>
                      <div className="wiz4-geo">{career.geographic_origin_details}</div>
                    </div>
                  )}
                  <div className="wiz4-block">
                    <span className="wiz4-h">{t('step4.career_skills_pro')}</span>
                    <div className="wiz4-groups">
                      {Object.entries(groupedSkills).map(([family, skills]) => (
                        <div key={family}>
                          <div className="wiz4-grplbl">{family}</div>
                          <div className="wiz4-chips">
                            {skills.map(sk => (
                              <span key={sk.skill_id} className="wiz4-chip">
                                {skillLabel(sk.skill_id)}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {choiceGroups.length > 0 && (
                    <div className="wiz4-block">
                      <span className="wiz4-h">{t('step4.career_choice_title')}</span>
                      {!isAdded ? (
                        <p className="wiz4-note">{t('step4.career_choice_locked')}</p>
                      ) : (
                        <div className="wiz4-choice">
                          {choiceGroups.map(({ key, isSolo, skillIds }) => (
                            <div key={key} className="wiz4-choicegrp">
                              <span className="wiz4-choicelbl">
                                {isSolo ? t('step4.career_choice_solo_label') : t('step4.career_choice_group_label')}
                              </span>
                              {skillIds.map(skillId => {
                                const checked = state.openedSkills.includes(skillId)
                                return (
                                  <label key={skillId} className="wiz4-choiceopt">
                                    <input
                                      type={isSolo ? 'checkbox' : 'radio'}
                                      name={isSolo ? undefined : `choice_${career.id}_${key}`}
                                      checked={checked}
                                      onChange={() => {
                                        if (isSolo) {
                                          dispatch({ type: 'TOGGLE_OPENED_SKILL', skillId })
                                        } else {
                                          dispatch({ type: 'SELECT_CHOICE_GROUP_SKILL', skillId, groupSkillIds: skillIds })
                                        }
                                      }}
                                    />
                                    {skillLabel(skillId)}
                                  </label>
                                )
                              })}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
              {activeTab === 'carriere' && (
                <div className="wiz4-block">
                  <table className="wiz4-prog">
                    <thead>
                      <tr>
                        <th>{t('step4.career_prog_years')}</th>
                        <th>{t('step4.career_prog_title')}</th>
                        <th>{t('step4.career_prog_savings')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...career.titles].sort((a, b) => a.min_years - b.min_years).map(ti => (
                        <tr key={ti.id} className={ti === currentTitle ? 'cur' : ''}>
                          <td>{ti.min_years}{ti.max_years ? `–${ti.max_years}` : '+'}</td>
                          <td>{ti.title}</td>
                          <td>{formatSalary(ti)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="wiz4-ecobox">
                    <span className="wiz4-h">{t('step4.career_age_savings')}</span>
                    <span className="wiz4-agev wiz4-mono gold">
                      {t('step4.career_eco_cumul', {
                        years: displayYears,
                        amount: `${salaryPerYear(currentTitle).amount * displayYears}¤`,
                      })}
                    </span>
                    <p className="wiz4-note">
                      {salaryPerYear(currentTitle).isRandom
                        ? t('step4.career_eco_note_random')
                        : t('step4.career_eco_note_fixed')}
                    </p>
                  </div>
                </div>
              )}
              {activeTab === 'avant' && (
                <>
                  {(career.pointCategories ?? []).length === 0 ? (
                    <p className="wiz4-note">{t('step4.career_adv_none')}</p>
                  ) : !isAdded ? (
                    <p className="wiz4-note">{t('step4.career_adv_locked')}</p>
                  ) : (
                    <div className="wiz4-block">
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
                                onClick={() => handleAdvDec(cat.category)}
                                disabled={pts <= 0}
                              >−</button>
                              <span className="wiz4-val">{pts}</span>
                              <button
                                className={`wiz4-sbtn${advResult.remaining <= 0 ? ' dis' : ''}`}
                                onClick={() => handleAdvInc(cat.category)}
                                disabled={advResult.remaining <= 0}
                              >＋</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Lot 6 — Tirage 1D10. Disponible dès qu'un métier est retenu, indépendamment de
                      pointCategories (Chasseur de primes n'a aucune catégorie mais la LdB lui accorde
                      quand même cette table — la bascule "convertir en points" reste alors masquée,
                      cf. careerAdvantages.js). */}
                  {isAdded && (career.randomBenefits ?? []).length > 0 && Math.floor(committedEntry.years / 5) > 0 && (
                    <div className="wiz4-block">
                      <span className="wiz4-h">{t('step4.career_random_title')}</span>
                      {Array.from({ length: Math.floor(committedEntry.years / 5) }).map((_, blockIndex) => {
                        const pick = randomPicksForCareer.find(p => p.blockIndex === blockIndex)
                        const rolledRow = pick ? (career.randomBenefits ?? []).find(r => r.roll === pick.roll) : null
                        const isAwaitingThis = state.awaitingRandomRoll?.careerId === career.id
                          && state.awaitingRandomRoll?.blockIndex === blockIndex
                        return (
                          <div key={blockIndex} className="wiz4-randomrow">
                            <div className="wiz4-randomhead">
                              <span className="wiz4-randomlbl">{t('step4.career_random_block', { n: blockIndex + 1 })}</span>
                              {!pick && (
                                <button
                                  className={`wiz4-rollbtn${state.awaitingRandomRoll ? ' dis' : ''}`}
                                  onClick={() => handleStartRoll(career.id, blockIndex)}
                                  disabled={!!state.awaitingRandomRoll}
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
                                      onChange={() => handleToggleRandomPoints(career.id, blockIndex)}
                                    />
                                    {t('step4.career_random_points_toggle', { n: rolledRow.points_alt })}
                                  </label>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <div className="wiz4-board">
          <div className="wiz4-boardhead">
            <span className="wiz4-h">
              {t('step4.career_board_title')} <span className="wiz4-boardhint">— {t('step4.career_board_hint')}</span>
            </span>
            <span className={`wiz4-poolrem${allocationResult.remaining === 0 && allocationResult.budget > 0 ? ' ok' : ''}`}>
              <span className="wiz4-mono">{allocationResult.remaining}</span> {t('step4.career_points_remaining')}
            </span>
          </div>
          <div className="wiz4-scroll">
            {boardGroups.map(g => (
              <div key={g.family} className="wiz4-bgrp">
                <div className="wiz4-bgrplbl">{g.family}</div>
                {g.skills.map(row => (
                  <div
                    key={row.skillId}
                    className={`wiz4-skill${hoverCareerId && row.provenance.some(p => p.key === hoverCareerId) ? ' hl' : ''}`}
                  >
                    <div className="wiz4-skmain">
                      <span className="wiz4-sklabel">{skillLabel(row.skillId)}</span>
                      <div className="wiz4-prov">
                        {row.provenance.map(p => (
                          <span key={p.key} className="wiz4-provtag" style={{ background: p.color }}>{p.label}</span>
                        ))}
                      </div>
                    </div>
                    <div className="wiz4-ctl">
                      <span className="wiz4-base">{row.current > 0 ? t('step4.career_base', { n: row.current }) : '—'}</span>
                      <button
                        className={`wiz4-sbtn${row.target <= (baseMastery[row.skillId] ?? 0) ? ' dis' : ''}`}
                        onClick={() => handleAllocDec(row)}
                        disabled={row.target <= (baseMastery[row.skillId] ?? 0)}
                      >−</button>
                      <span className="wiz4-val">{row.target}</span>
                      <button
                        className={`wiz4-sbtn${allocationResult.remaining <= 0 || row.target >= row.cap ? ' dis' : ''}`}
                        onClick={() => handleAllocInc(row)}
                        disabled={allocationResult.remaining <= 0 || row.target >= row.cap}
                      >＋</button>
                      <span className="wiz4-total">+{row.target}</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="wiz4-foot">
          <button className="wiz4-prev" onClick={onPrev}>{t('step4.prev')}</button>
          <span className={`wiz4-status${statusOk ? ' ok' : ''}`}>
            {t(`step4.${statusKey}`, { n: allocationResult.remaining })}
          </span>
          <button className={`wiz4-next${canNext ? '' : ' dis'}`} onClick={onNext} disabled={!canNext}>
            {t('step4.next')}
          </button>
        </div>
      </div>
    </div>
    </>
  )
}
