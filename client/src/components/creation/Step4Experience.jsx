import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AgeSelector from './AgeSelector'
import BackgroundSelector from './BackgroundSelector'
import CareersAllocator from './CareersAllocator'
import { geoOrigins, socialOrigins, trainings, higherEds } from './mockStep4Data'
import Step4Summary from './Step4Summary'
import { useCreationStore } from '../../stores/creationStore'
import api from '../../lib/api'

const SUB_STEPS = {
  AGE: 'age',
  GEO_ORIGIN: 'geo_origin',
  SOCIAL_ORIGIN: 'social_origin',
  TRAINING: 'training',
  HIGHER_ED: 'higher_ed',
  CAREERS: 'careers',
  SUMMARY: 'summary',
}

export default function Step4Experience({ pcDispo, onNext, onPrev }) {
  const { t } = useTranslation('creation')
  const { sheetId } = useCreationStore()
  const [subStep, setSubStep] = useState(SUB_STEPS.AGE)
  const [age, setAge] = useState(16)
  const [originGeo, setOriginGeo] = useState(null)
  const [originSoc, setOriginSoc] = useState(null)
  const [training, setTraining] = useState(null)
  const [higherEd, setHigherEd] = useState(null)
  const [geoName, setGeoName] = useState('')
  const [geoNation, setGeoNation] = useState('')
  const [socNation, setSocNation] = useState('')
  const [careers, setCareers] = useState([])
  const [refData, setRefData] = useState({ loading: true, careers: [] })

  useEffect(() => {
    if (!sheetId) return
    api.get(`/creation/${sheetId}/step4/ref`)
      .then(res => setRefData({ loading: false, careers: res.data.careers ?? [] }))
      .catch(() => setRefData({ loading: false, careers: [] }))
  }, [sheetId])

  // ─── Données filtrées ──────────────────────────────────────────
  const filteredSocialOrigins = socialOrigins.filter(s => {
    if (s.parent_code === originGeo) return true
    if (s.allowed_parents && s.allowed_parents.includes(originGeo)) return true
    if (s.parent_code === null && !s.allowed_parents) return true
    return false
  })

  const filteredTrainings = trainings.filter(t => {
  if (t.parent_code === originSoc) return true
  if (t.parent_code === null && !t.allowed_parents) return true
  if (t.allowed_parents && t.allowed_parents.includes(originSoc)) return true
  return false
})

  const showHigherEd = training === 'education_scolaire'
  const filteredHigherEds = showHigherEd ? higherEds : []

  // ─── Éléments sélectionnés (avec détails) ──────────────────────
  const selectedGeoItem = geoOrigins.find(g => g.code === originGeo) || null
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
  }

  const handleRandomGeoOrigin = () => {
    const idx = Math.floor(Math.random() * geoOrigins.length)
    handleSelectGeoOrigin(geoOrigins[idx].code)
  }

  const handleSelectSocialOrigin = (code) => {
    setOriginSoc(code)
    setTraining(null)
    setHigherEd(null)
    setSocNation('')
  }

  const handleRandomSocialOrigin = () => {
    if (filteredSocialOrigins.length === 0) return
    const idx = Math.floor(Math.random() * filteredSocialOrigins.length)
    handleSelectSocialOrigin(filteredSocialOrigins[idx].code)
  }

  const handleSelectTraining = (code) => {
    setTraining(code)
    setHigherEd(null)
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

  const handleAddCareer = (careerId, careerName, careerTitles, years, skillAllocations) => {
    setCareers(prev => [...prev, {
      career_id: careerId,
      career_name: careerName,
      titles: careerTitles,
      years,
      skillAllocations: skillAllocations || {},
    }])
  }

  const handleRemoveCareer = (index) => {
    setCareers(prev => prev.filter((_, i) => i !== index))
  }

  const buildPayload = () => {
    const careerEntries = careers.map(c => ({
      career_id: c.career_id,
      years: c.years,
      skillAllocations: c.skillAllocations || {},
    }))
    return {
      age: finalAge,
      originGeo,
      originSoc,
      training,
      higherEd,
      geoName,
      geoNation,
      socNation,
      careers: careerEntries,
      pcSpent: totalPC,
    }
  }

  const handleSubmit = () => {
    onNext?.(buildPayload())
  }

  // ─── Navigation ────────────────────────────────────────────────
  const handleSubNext = () => {
    const order = Object.values(SUB_STEPS)
    const idx = order.indexOf(subStep)

    if (subStep === SUB_STEPS.TRAINING && !showHigherEd) {
      setSubStep(SUB_STEPS.CAREERS)
      return
    }

    if (idx < order.length - 1) {
      setSubStep(order[idx + 1])
    }
  }

  const handleSubPrev = () => {
    const order = Object.values(SUB_STEPS)
    const idx = order.indexOf(subStep)

    if (subStep === SUB_STEPS.CAREERS && !showHigherEd) {
      setSubStep(SUB_STEPS.TRAINING)
      return
    }

    if (idx > 0) {
      setSubStep(order[idx - 1])
    } else {
      onPrev()
    }
  }

  // ─── Rendu ─────────────────────────────────────────────────────
  return (
    <div style={s.container}>
      <div style={s.subSteps}>
        {Object.values(SUB_STEPS).map(step => (
          <span
            key={step}
            style={{
              ...s.subStep,
              ...(subStep === step ? s.subStepActive : {}),
            }}
          >
            {t(`step4.sub_${step}`)}
          </span>
        ))}
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
          items={geoOrigins}
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