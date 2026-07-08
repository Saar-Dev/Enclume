import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AgeSelector from './AgeSelector'
import BackgroundSelector from './BackgroundSelector'
import CareersAllocator from './CareersAllocator'
import { BG_META } from './backgroundMeta'
import Step4Summary from './Step4Summary'
import { useCreationStore } from '../../stores/creationStore'
import api from '../../lib/api'

const enrichBg = (bg) => ({ ...bg, ...(BG_META[bg.code] ?? {}) })

const SUB_STEPS = {
  AGE: 'age',
  GEO_ORIGIN: 'geo_origin',
  SOCIAL_ORIGIN: 'social_origin',
  TRAINING: 'training',
  HIGHER_ED: 'higher_ed',
  CAREERS: 'careers',
  SUMMARY: 'summary',
}

const SUB_STEP_ORDER = Object.values(SUB_STEPS)

export default function Step4Experience({ initialData, pcDispo, onNext, onPrev }) {
  const { t } = useTranslation('creation')
  const { sheetId, step1Data, step2Data, randomProAdvantagesEnabled, skillMaxLevelEnabled } = useCreationStore()
  const [subStep, setSubStep] = useState(initialData ? SUB_STEPS.SUMMARY : SUB_STEPS.AGE)
  const [highestSubStep, setHighestSubStep] = useState(() => initialData ? SUB_STEPS.SUMMARY : SUB_STEPS.AGE)
  const [age, setAge] = useState(initialData?.age ?? 16)
  const [originGeo, setOriginGeo] = useState(initialData?.originGeo ?? null)
  const [originSoc, setOriginSoc] = useState(initialData?.originSoc ?? null)
  const [training, setTraining] = useState(initialData?.training ?? null)
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
  const [refData, setRefData] = useState({ loading: true, geoOrigins: [], socialOrigins: [], trainings: [], higherEds: [], careers: [] })
  const [refSkills, setRefSkills] = useState([])

  const handleSkillAllocationsChange = useCallback((next) => setSkillAllocations(next), [])
  const handleProAdvantagesChange = useCallback((next) => setProAdvantages(next), [])
  const handleOpenedSkillsChange = useCallback((next) => setOpenedSkills(next), [])
  const handleRandomPicksChange = useCallback((next) => setRandomPicks(next), [])

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
      }))
      .catch(() => setRefData({ loading: false, geoOrigins: [], socialOrigins: [], trainings: [], higherEds: [], careers: [] }))
    api.get('/char-ref/skills')
      .then(res => setRefSkills(res.data.skills ?? []))
      .catch(() => setRefSkills([]))
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
  const totalPC = (higherEd ? 1 : 0) + careers.reduce((sum, c) => sum + c.years, 0)
  const remainingPC = pcDispo - totalPC
  const finalAge = age + (selectedHigherEdItem?.years_added ?? 0) + careers.reduce((sum, c) => sum + c.years, 0)

  // ─── Handlers ──────────────────────────────────────────────────
  const handleSelectGeoOrigin = (code) => {
  setOriginGeo(code)
  setOriginSoc(null)
  setTraining(null)
  setHigherEd(null)
  setGeoName('')
  setGeoNation('')
  setSocNation('')
  setConditionalChoices({})
}

  const handleRandomGeoOrigin = () => {
    if (enrichedGeoOrigins.length === 0) return
    const idx = Math.floor(Math.random() * enrichedGeoOrigins.length)
    handleSelectGeoOrigin(enrichedGeoOrigins[idx].code)
  }

  const handleSelectSocialOrigin = (code) => {
  setOriginSoc(code)
  setTraining(null)
  setHigherEd(null)
  setSocNation('')
  setConditionalChoices({})
}

  const handleRandomSocialOrigin = () => {
    if (filteredSocialOrigins.length === 0) return
    const idx = Math.floor(Math.random() * filteredSocialOrigins.length)
    handleSelectSocialOrigin(filteredSocialOrigins[idx].code)
  }

  const handleSelectTraining = (code) => {
  setTraining(code)
  setHigherEd(null)
  setConditionalChoices({})
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
  pcSpent: totalPC,
  appliedSkills: Object.values(conditionalChoices),
}
  }

  const handleSubmit = () => {
    onNext?.(buildPayload())
  }

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
          const isClickable = isReachable && !isActive && (ss !== SUB_STEPS.HIGHER_ED || showHigherEd)
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
    initialProAdvantages={proAdvantages}
    onProAdvantagesChange={handleProAdvantagesChange}
    initialOpenedSkills={openedSkills}
    onOpenedSkillsChange={handleOpenedSkillsChange}
    initialRandomPicks={randomPicks}
    onRandomPicksChange={handleRandomPicksChange}
    randomProAdvantagesEnabled={randomProAdvantagesEnabled}
    skillMaxLevelEnabled={skillMaxLevelEnabled}
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