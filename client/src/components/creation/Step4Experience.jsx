import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AgeSelector from './AgeSelector'
import BackgroundSelector from './BackgroundSelector'
import CareersAllocator from './CareersAllocator'
import ProAdvantagesAndSetbacks from './ProAdvantagesAndSetbacks'
import { BG_META } from './backgroundMeta'
import Step4Summary from './Step4Summary'
import { useCreationStore } from '../../stores/creationStore'
import { getSetbackBlockCount } from '../../../../shared/careerSetbacks.js'
import { originGeoOptionKey, originSocOptionKey, trainingOptionKey } from '../../../../shared/wizardOptionKeys.js'
import api from '../../lib/api'

const enrichBg = (bg) => ({ ...bg, ...(BG_META[bg.code] ?? {}) })

const SUB_STEPS = {
  AGE: 'age',
  GEO_ORIGIN: 'geo_origin',
  SOCIAL_ORIGIN: 'social_origin',
  TRAINING: 'training',
  HIGHER_ED: 'higher_ed',
  CAREERS: 'careers',
  ADVANTAGES_AND_SETBACKS: 'advantages_and_setbacks',
  SUMMARY: 'summary',
}

const SUB_STEP_ORDER = Object.values(SUB_STEPS)

export default function Step4Experience({ initialData, pcDispo, onNext, onPrev, onLiveChange }) {
  const { t } = useTranslation('creation')
  const { sheetId, step1Data, step2Data, step5Data, randomProAdvantagesEnabled, reversEnabled, skillMaxLevelEnabled, youngPenaltyEnabled, setStep4Data } = useCreationStore()
  const [subStep, setSubStep] = useState(initialData ? SUB_STEPS.SUMMARY : SUB_STEPS.AGE)
  const [highestSubStep, setHighestSubStep] = useState(() => initialData ? SUB_STEPS.SUMMARY : SUB_STEPS.AGE)
  const [age, setAge] = useState(initialData?.age ?? 16)
  const [originGeo, setOriginGeo] = useState(initialData?.originGeo ?? null)
  const [originSoc, setOriginSoc] = useState(initialData?.originSoc ?? null)
  const [training, setTraining] = useState(initialData?.training ?? null)
  const [autodidacteAllocations, setAutodidacteAllocations] = useState(initialData?.autodidacteAllocations ?? {})
  const [higherEd, setHigherEd] = useState(initialData?.higherEd ?? null)
  const [geoName, setGeoName] = useState(initialData?.geoName ?? '')
  const [geoNation, setGeoNation] = useState(initialData?.geoNation ?? '')
  const [socNation, setSocNation] = useState(initialData?.socNation ?? '')
  const [conditionalChoices, setConditionalChoices] = useState(initialData?.conditionalChoices ?? {})
  const [careers, setCareers] = useState(initialData?.careers ?? [])
  const [skillAllocations, setSkillAllocations] = useState(initialData?.skillAllocations ?? {})
  const [proAdvantages, setProAdvantages] = useState(initialData?.proAdvantages ?? {})
  const [openedSkills, setOpenedSkills] = useState(initialData?.openedSkills ?? [])
  const [randomPicks, setRandomPicks] = useState(initialData?.randomPicks ?? {})
  const [setbackRolls, setSetbackRolls] = useState(initialData?.setbackRolls ?? [])
  // Résolution de Revers EN COURS (cascade chained_setback/subroll/choice pas encore committée dans
  // setbackRolls) — remontée ici pour survivre à une navigation entre sous-étapes (ex. Carrières
  // puis retour sur Avantages & Revers, qui démonte/remonte ProAdvantagesAndSetbacks), même patron
  // que randomPicks/setbackRolls ci-dessus. Jamais envoyée au serveur (buildPayload ne la reprend
  // pas) : purement un confort UI local à cette sous-étape, incomplète par nature.
  const [setbackResolution, setSetbackResolution] = useState(initialData?.setbackResolution ?? null)
  const [refData, setRefData] = useState({ loading: true, geoOrigins: [], socialOrigins: [], trainings: [], higherEds: [], careers: [], setbacks: [] })
  const [refSkills, setRefSkills] = useState([])
  // Catalogue des avantages (Lot 5, 2026-07-23) : réutilisé tel quel depuis Step5 (même endpoint,
  // /creation/:sheetId/step5/ref) pour afficher un nom lisible sur la note manual_grant_choice
  // (Choc psychologique, Fugitif...) au lieu des codes advantage_id bruts (adv_044...).
  const [advantagesCatalog, setAdvantagesCatalog] = useState([])

  const handleSkillAllocationsChange = useCallback((next) => setSkillAllocations(next), [])
  const handleProAdvantagesChange = useCallback((next) => setProAdvantages(next), [])
  const handleOpenedSkillsChange = useCallback((next) => setOpenedSkills(next), [])
  const handleRandomPicksChange = useCallback((next) => setRandomPicks(next), [])
  const handleSetbackRollsChange = useCallback((next) => setSetbackRolls(next), [])
  const handleSetbackResolutionChange = useCallback((next) => setSetbackResolution(next), [])

  useEffect(() => {
    if (!sheetId) return
    api.get(`/creation/${sheetId}/step4/ref`)
      .then(res => setRefData({
        loading: false,
        geoOrigins: res.data.geoOrigins ?? [],
        socialOrigins: res.data.socialOrigins ?? [],
        trainings: res.data.trainings ?? [],
        higherEds: res.data.higherEds ?? [],
        careers: res.data.careers ?? [],
        setbacks: res.data.setbacks ?? [],
      }))
      .catch(() => setRefData({ loading: false, geoOrigins: [], socialOrigins: [], trainings: [], higherEds: [], careers: [], setbacks: [] }))
    api.get('/char-ref/skills')
      .then(res => setRefSkills(res.data.skills ?? []))
      .catch(() => setRefSkills([]))
    api.get(`/creation/${sheetId}/step5/ref`)
      .then(res => setAdvantagesCatalog(res.data ?? []))
      .catch(() => setAdvantagesCatalog([]))
  }, [sheetId])

  // ─── Données filtrées ──────────────────────────────────────────
  const enrichedGeoOrigins = refData.geoOrigins.map(enrichBg)
  const filteredSocialOrigins = refData.socialOrigins
    .filter(s => s.parent_code === originGeo || s.parent_code === null)
    .map(enrichBg)
  const filteredTrainings = refData.trainings
    .filter(t => t.parent_code === originSoc || t.parent_code === null)
    .map(enrichBg)
  const showHigherEd = training === 'education_scolaire'
  const filteredHigherEds = showHigherEd ? refData.higherEds.map(enrichBg) : []

  // ─── Éléments sélectionnés (avec détails) ──────────────────────
  const selectedGeoItem = enrichedGeoOrigins.find(g => g.code === originGeo) || null
  const selectedSocItem = filteredSocialOrigins.find(s => s.code === originSoc) || null
  const selectedTrainingItem = filteredTrainings.find(t => t.code === training) || null
  const selectedHigherEdItem = filteredHigherEds.find(h => h.code === higherEd) || null

  // ─── PC calculés ───────────────────────────────────────────────
  const totalCareerYears = careers.reduce((sum, c) => sum + c.years, 0)
  const totalPC = (higherEd ? 1 : 0) + totalCareerYears
  const finalAge = age + (selectedHigherEdItem?.years_added ?? 0) + totalCareerYears

  // Aperçu live du coût de l'étape 4 (avant soumission) — écrit directement dans le store
  // (setStep4Data est stable par construction, pas besoin de callback-prop mémoïsée).
  // getStepBudget() (consommé par CareersAllocator ci-dessous) ignore ce champ : seul
  // getPcDispo() (header) le lit, donc pas de double décompte possible.
  useEffect(() => {
    setStep4Data({ liveYears: totalPC })
  }, [totalPC, setStep4Data])

  // ─── OPT-06 (revers) — total cumulé, pas par carrière (shared/careerSetbacks.js) ───
  const setbackBlockCount = getSetbackBlockCount(totalCareerYears)
  const showSetbacks = !!reversEnabled && setbackBlockCount > 0
  // Dérivé (pas d'effet + setState) : si le joueur revient sur Carrières et réduit le total
  // d'années, une tranche déjà jetée peut devenir hors bornes — filtrée ici plutôt que purgée en
  // état, ProAdvantagesAndSetbacks se remonte avec cette valeur à chaque retour sur la sous-step.
  // Mémoïsé (useMemo, pas un .filter() nu) — sans ça, un nouveau tableau à chaque rendu redéclenche
  // l'effet de diffusion live plus bas (dépendance instable), cause racine confirmée d'un "Maximum
  // update depth exceeded" trouvé par Saar en test réel (combiné à l'effet liveYears juste en dessous,
  // qui écrit dans le store à chaque montage de cette étape).
  const validSetbackRolls = useMemo(
    () => setbackRolls.filter(r => r.blockIndex < setbackBlockCount),
    [setbackRolls, setbackBlockCount]
  )
  // Même garde pour la résolution en cours (même raison : une tranche redevenue hors bornes ne doit
  // pas rester "en cascade" indéfiniment côté UI).
  const validSetbackResolution = setbackResolution && setbackResolution.blockIndex < setbackBlockCount ? setbackResolution : null

  // Force Polaris (adv_077/078/079) — condition du palier 2 du Revers Polaris (§8.2). Choisie
  // exclusivement en Step5 (jamais accordée en Step2) : lors d'un 1er passage linéaire, step5Data
  // est encore null, donc faux — cohérent avec le serveur qui interroge char_advantages à cet
  // instant. Ne redevient pertinent que si le joueur revient sur Step4 après avoir déjà fait Step5.
  const forcePolaris = !!step5Data?.advantages?.some(id => ['adv_077', 'adv_078', 'adv_079'].includes(id))

  // ─── Handlers ──────────────────────────────────────────────────
  const handleSelectGeoOrigin = (code) => {
  if (code === originGeo) return
  setOriginGeo(code)
  setOriginSoc(null)
  setTraining(null)
  setHigherEd(null)
  setGeoName('')
  setGeoNation('')
  setSocNation('')
  setConditionalChoices({})
  setAutodidacteAllocations({})
}

  const handleRandomGeoOrigin = () => {
    if (enrichedGeoOrigins.length === 0) return
    const idx = Math.floor(Math.random() * enrichedGeoOrigins.length)
    handleSelectGeoOrigin(enrichedGeoOrigins[idx].code)
  }

  const handleSelectSocialOrigin = (code) => {
  if (code === originSoc) return
  setOriginSoc(code)
  setTraining(null)
  setHigherEd(null)
  setSocNation('')
  setConditionalChoices({})
  setAutodidacteAllocations({})
}

  const handleRandomSocialOrigin = () => {
    if (filteredSocialOrigins.length === 0) return
    const idx = Math.floor(Math.random() * filteredSocialOrigins.length)
    handleSelectSocialOrigin(filteredSocialOrigins[idx].code)
  }

  const handleSelectTraining = (code) => {
  if (code === training) return
  setTraining(code)
  setHigherEd(null)
  setConditionalChoices({})
  setAutodidacteAllocations({})
}

  const handleRandomTraining = () => {
    if (filteredTrainings.length === 0) return
    const idx = Math.floor(Math.random() * filteredTrainings.length)
    handleSelectTraining(filteredTrainings[idx].code)
  }

  const handleSelectHigherEd = (code) => {
    setHigherEd(code)
  }

  const handleSkipHigherEd = () => {
    setHigherEd(null)
  }
  
  const handleConditionalChoice = (compositeKey, skillId) => {
  setConditionalChoices(prev => {
    const next = { ...prev }
    if (skillId === null) {
      delete next[compositeKey]
    } else {
      next[compositeKey] = skillId
    }
    return next
  })
}

  const handleAddCareer = (careerId, careerName, careerTitles, years) => {
    setCareers(prev => [...prev, {
      career_id: careerId,
      career_name: careerName,
      titles: careerTitles,
      years,
    }])
  }

  const handleRemoveCareer = (index) => {
    setCareers(prev => prev.filter((_, i) => i !== index))
  }

  const buildPayload = () => {
    const careerEntries = careers.map(c => ({
      career_id: c.career_id,
      years: c.years,
      proAdvantages: proAdvantages[c.career_id] || {},
      randomPicks: randomPicks[c.career_id] || [],
    }))
    return {
  age,
  finalAge,
  originGeo,
  originSoc,
  training,
  higherEd,
  geoName,
  geoNation,
  socNation,
  careers: careerEntries,
  skillAllocations,
  openedSkills,
  autodidacteAllocations,
  setbackRolls: validSetbackRolls,
  pcSpent: totalPC,
  appliedSkills: Object.values(conditionalChoices),
}
  }

  const handleSubmit = () => {
    onNext?.(buildPayload())
  }

  // Diffusion live (Lot A4, docs/PLAN_WIZARDCOLLAB.md §2.5/§6.4bis) — réutilise buildPayload (même
  // forme que la soumission finale), jamais persisté ni validé côté serveur, purement cosmétique.
  // Déps = les champs bruts que buildPayload lit, pas la fonction elle-même (recréée à chaque rendu,
  // la lister ferait tourner l'effet en boucle sans rien apporter — même patron que l'effet
  // liveYears juste au-dessus).
  useEffect(() => {
    onLiveChange?.(buildPayload())
  }, [
    age, finalAge, originGeo, originSoc, training, higherEd, geoName, geoNation, socNation,
    careers, skillAllocations, openedSkills, autodidacteAllocations, validSetbackRolls, totalPC,
    conditionalChoices, onLiveChange,
  ])

  // ─── Navigation ────────────────────────────────────────────────
  const advanceSubStep = (next) => {
    setSubStep(next)
    setHighestSubStep(prev => {
      const nextIdx = SUB_STEP_ORDER.indexOf(next)
      const prevIdx = SUB_STEP_ORDER.indexOf(prev)
      return nextIdx > prevIdx ? next : prev
    })
  }

  const handleSubNext = () => {
    const idx = SUB_STEP_ORDER.indexOf(subStep)
    if (subStep === SUB_STEPS.TRAINING && !showHigherEd) {
      advanceSubStep(SUB_STEPS.CAREERS)
      return
    }

    if (idx < SUB_STEP_ORDER.length - 1) {
      advanceSubStep(SUB_STEP_ORDER[idx + 1])
    }
  }

  const handleSubPrev = () => {
    const idx = SUB_STEP_ORDER.indexOf(subStep)
    if (subStep === SUB_STEPS.CAREERS && !showHigherEd) {
      setSubStep(SUB_STEPS.TRAINING)
      return
    }
    if (subStep === SUB_STEPS.SUMMARY) {
  setSubStep(SUB_STEPS.ADVANTAGES_AND_SETBACKS)
  return
}
    if (idx > 0) {
      setSubStep(SUB_STEP_ORDER[idx - 1])
    } else {
      onPrev()
    }
  }

  // ─── Rendu ─────────────────────────────────────────────────────
  return (
    <div style={s.container}>
      <div style={s.subSteps}>
        {SUB_STEP_ORDER.map(ss => {
          const isActive = subStep === ss
          const isReachable = SUB_STEP_ORDER.indexOf(ss) <= SUB_STEP_ORDER.indexOf(highestSubStep)
          const isClickable = isReachable && !isActive
            && (ss !== SUB_STEPS.HIGHER_ED || showHigherEd)
          return (
            <span
              key={ss}
              style={{
                ...s.subStep,
                ...(isActive ? s.subStepActive : isReachable ? s.subStepDone : {}),
                cursor: isClickable ? 'pointer' : 'default',
              }}
              onClick={isClickable ? () => setSubStep(ss) : undefined}
            >
              {t(`step4.sub_${ss}`)}
            </span>
          )
        })}
      </div>

      {subStep === SUB_STEPS.AGE && (
        <AgeSelector
          age={age}
          onChange={setAge}
          attributes={step1Data?.attributes}
          youngPenaltyEnabled={youngPenaltyEnabled}
          onNext={handleSubNext}
          onPrev={handleSubPrev}
        />
      )}

      {subStep === SUB_STEPS.GEO_ORIGIN && (
        <BackgroundSelector
          title={t('step4.geo_origin_title')}
          items={enrichedGeoOrigins}
          selected={originGeo}
          selectedItem={selectedGeoItem}
          onSelect={handleSelectGeoOrigin}
          onRandom={handleRandomGeoOrigin}
          onNext={handleSubNext}
          onPrev={handleSubPrev}
          canNext={!!originGeo}
          randomLabel={t('step4.geo_random')}
          customName={geoName}
          onNameChange={setGeoName}
          nation={geoNation}
          onNationChange={setGeoNation}
		  conditionalChoices={conditionalChoices}
		  onConditionalChoice={handleConditionalChoice}
          optionKeyFor={originGeoOptionKey}
        />
      )}

      {subStep === SUB_STEPS.SOCIAL_ORIGIN && (
        <BackgroundSelector
          title={t('step4.social_origin_title')}
          items={filteredSocialOrigins}
          selected={originSoc}
          selectedItem={selectedSocItem}
          onSelect={handleSelectSocialOrigin}
          onRandom={handleRandomSocialOrigin}
          onNext={handleSubNext}
          onPrev={handleSubPrev}
          canNext={!!originSoc}
          randomLabel={t('step4.social_random')}
          nation={socNation}
          onNationChange={setSocNation}
          defaultNation={geoNation}
		  conditionalChoices={conditionalChoices}
		  onConditionalChoice={handleConditionalChoice}
          optionKeyFor={originSocOptionKey}
        />
      )}

      {subStep === SUB_STEPS.TRAINING && (
        <BackgroundSelector
          title={t('step4.training_title')}
          items={filteredTrainings}
          selected={training}
          selectedItem={selectedTrainingItem}
          onSelect={handleSelectTraining}
          onRandom={handleRandomTraining}
          onNext={handleSubNext}
          onPrev={handleSubPrev}
          canNext={!!training}
          randomLabel={t('step4.training_random')}
		  conditionalChoices={conditionalChoices}
		  onConditionalChoice={handleConditionalChoice}
          refSkills={refSkills}
          autodidacteAllocations={autodidacteAllocations}
          onAutodidacteAllocationsChange={setAutodidacteAllocations}
          optionKeyFor={trainingOptionKey}
        />
      )}

      {subStep === SUB_STEPS.HIGHER_ED && (
        showHigherEd ? (
          <BackgroundSelector
            title={t('step4.higher_ed_title')}
            items={filteredHigherEds}
            selected={higherEd}
            selectedItem={selectedHigherEdItem}
            onSelect={handleSelectHigherEd}
            onNext={handleSubNext}
            onPrev={handleSubPrev}
            canNext={true}
            extraInfo={t('step4.higher_ed_cost')}
            skipLabel={t('step4.higher_ed_skip')}
            onSkip={handleSkipHigherEd}
			conditionalChoices={conditionalChoices}
		    onConditionalChoice={handleConditionalChoice}
          />
        ) : (
          <div style={s.placeholder}>
            <p style={s.placeholderText}>{t('step4.higher_ed_unavailable')}</p>
            <div style={s.placeholderNav}>
              <button style={s.backBtn} onClick={handleSubPrev}>
                {t('step4.prev')}
              </button>
              <button style={s.nextBtn} onClick={handleSubNext}>
                {t('step4.next')}
              </button>
            </div>
          </div>
        )
      )}

{subStep === SUB_STEPS.CAREERS && (
  <CareersAllocator
    // pcDispo (prop) est getStepBudget() côté WizardCreation — toujours brut, jamais affecté
    // par la dépense en cours de cette étape. CareersAllocator soustrait lui-même son propre
    // totalPC (somme des années déjà choisies) : aucune compensation à faire ici.
    pcDispo={pcDispo - (higherEd ? 1 : 0)}
    selectedCareers={careers}
    careers={refData.careers}
    onAdd={handleAddCareer}
    onRemove={handleRemoveCareer}
    onNext={handleSubNext}
    onPrev={handleSubPrev}
    selectedGeoItem={selectedGeoItem}
    selectedSocItem={selectedSocItem}
    selectedTrainingItem={selectedTrainingItem}
    selectedHigherEdItem={selectedHigherEdItem}
    baseAge={age + (selectedHigherEdItem?.years_added ?? 0)}
    attributes={step1Data?.attributes}
    genotypeId={step2Data?.genotypeId}
    higherEd={higherEd}
    refSkills={refSkills}
    initialSkillAllocations={skillAllocations}
    onSkillAllocationsChange={handleSkillAllocationsChange}
    initialOpenedSkills={openedSkills}
    onOpenedSkillsChange={handleOpenedSkillsChange}
    skillMaxLevelEnabled={skillMaxLevelEnabled}
  />
)}

{subStep === SUB_STEPS.ADVANTAGES_AND_SETBACKS && (
  <ProAdvantagesAndSetbacks
    selectedCareers={careers}
    careers={refData.careers}
    totalYears={totalCareerYears}
    setbackRows={refData.setbacks}
    advantagesCatalog={advantagesCatalog}
    initialProAdvantages={proAdvantages}
    initialRandomPicks={randomPicks}
    initialSetbackRolls={setbackRolls}
    initialSetbackResolution={validSetbackResolution}
    onProAdvantagesChange={handleProAdvantagesChange}
    onRandomPicksChange={handleRandomPicksChange}
    onSetbackRollsChange={handleSetbackRollsChange}
    onSetbackResolutionChange={handleSetbackResolutionChange}
    randomProAdvantagesEnabled={randomProAdvantagesEnabled}
    reversEnabled={reversEnabled}
    forcePolaris={forcePolaris}
    onNext={handleSubNext}
    onPrev={handleSubPrev}
  />
)}

      {subStep === SUB_STEPS.SUMMARY && (
  <Step4Summary
    age={finalAge}
    originGeo={originGeo}
    originSoc={originSoc}
    training={training}
    higherEd={higherEd}
    careers={careers}
    geoName={geoName}
    geoNation={geoNation}
    socNation={socNation}
    selectedGeoItem={selectedGeoItem}
    selectedSocItem={selectedSocItem}
    selectedTrainingItem={selectedTrainingItem}
    selectedHigherEdItem={selectedHigherEdItem}
    onPrev={handleSubPrev}
    onSubmit={handleSubmit}
  />
)}
    </div>
  )
}

const s = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  subSteps: {
    display: 'flex',
    justifyContent: 'center',
    gap: '4px',
    padding: '12px 20px',
    borderBottom: '1px solid #1e1e2e',
    backgroundColor: '#0a0a18',
    flexWrap: 'wrap',
  },
  subStep: {
    padding: '4px 10px',
    borderRadius: '3px',
    color: '#5a5a7a',
    fontSize: '11px',
    fontWeight: '600',
    backgroundColor: 'transparent',
    border: '1px solid transparent',
    transition: 'all 0.15s ease',
  },
  subStepActive: {
    color: '#c8c8f0',
    backgroundColor: '#1a1a2e',
    borderColor: '#3a3a5e',
  },
  subStepDone: {
    color: '#7a8ab8',
    backgroundColor: 'rgba(91,141,238,0.06)',
    borderColor: 'rgba(91,141,238,0.22)',
  },
  placeholder: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '24px',
    padding: '60px 20px',
  },
  placeholderText: {
    color: '#e0a85c',
    fontSize: '16px',
    fontWeight: '600',
  },
  placeholderNav: {
    display: 'flex',
    gap: '16px',
  },
  backBtn: {
    padding: '8px 18px',
    backgroundColor: 'transparent',
    border: '1px solid #2a2a3e',
    borderRadius: '4px',
    color: '#8080a0',
    cursor: 'pointer',
    fontSize: '13px',
  },
}