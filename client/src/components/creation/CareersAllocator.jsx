import { useEffect, useMemo, useReducer } from 'react'
import { useTranslation } from 'react-i18next'
import { evaluateCareerEligibility } from '../../../../shared/careerEligibility.js'
import { computeSkillAllocation, getSkillCap } from '../../../../shared/careerSkills.js'

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

const initialReducerState = (initialSkillAllocations) => ({
  filter: 'all',
  selectedCareerId: null,
  years: 1,
  activeTab: 'metier',
  hoverCareerId: null,
  skillAllocations: initialSkillAllocations || {},
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
}) {
  const { t } = useTranslation('creation')
  const [state, dispatch] = useReducer(careersReducer, initialSkillAllocations, initialReducerState)
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
      for (const sk of refCareer?.skills ?? []) if (!sk.conditional) ids.add(sk.skill_id)
    }
    return ids
  }, [baseMastery, selectedCareers, careersById])

  const skillAllocationCtx = useMemo(() => ({
    careers: selectedCareers.map(c => ({
      skills: (careersById.get(c.career_id)?.skills ?? []).filter(sk => !sk.conditional).map(sk => sk.skill_id),
      years: c.years,
    })),
    higherEdSkills: (selectedHigherEdItem?.skills ?? []).filter(sk => !sk.conditional).map(sk => sk.skill_id),
    baseMastery,
    refSkills: refSkills ?? [],
    openedSkills: [],
  }), [selectedCareers, careersById, selectedHigherEdItem, baseMastery, refSkills])

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
      if (refCareer?.skills?.some(sk => sk.skill_id === skillId && !sk.conditional)) {
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
  }, [boardSkillIds, skillAllocationCtx, state.skillAllocations, baseMastery, refSkillsById, selectedCareers, careersById])

  // ── Purge des allocations orphelines (carrière retirée) ──────────
  useEffect(() => {
    dispatch({ type: 'PRUNE_ALLOCATIONS', validIds: boardSkillIds })
  }, [boardSkillIds])

  // ── Remontée au parent (payload global) ──────────────────────────
  useEffect(() => {
    onSkillAllocationsChange?.(state.skillAllocations)
  }, [state.skillAllocations, onSkillAllocationsChange])

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

  const groupedSkills = career ? career.skills.reduce((acc, sk) => {
    ;(acc[sk.family] ??= []).push(sk)
    return acc
  }, {}) : {}

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
  } else {
    statusKey = 'career_status_ok'; statusOk = true
  }
  const canNext = selectedCareers.length > 0 && allocationResult.errors.length === 0 && allocationResult.remaining === 0

  return (
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
              style={{ '--hex': careerHexColor(c.code) }}
              onClick={() => dispatch({ type: 'SELECT_CAREER', id: c.id, committedYears: committed?.years })}
              onMouseEnter={() => dispatch({ type: 'SET_HOVER', id: c.id })}
              onMouseLeave={() => dispatch({ type: 'SET_HOVER', id: null })}
            >
              <span className="wiz4-hex">{c.name.slice(0, 1).toUpperCase()}</span>
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
            <span className="wiz4-agev wiz4-mono gold">—</span>
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
                                {skillLabel(sk.skill_id)}{sk.conditional ? ` (${t('step4.career_conditional')})` : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {activeTab === 'carriere' && <p className="wiz4-note">{t('step4.career_tab_soon')}</p>}
              {activeTab === 'avant' && <p className="wiz4-note">{t('step4.career_tab_soon')}</p>}
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
  )
}
