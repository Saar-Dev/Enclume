import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCreationStore } from '../../stores/creationStore'
import api from '../../lib/api'
import WizardHeader from './WizardHeader'
import Step0Method from './Step0Method'
import Step1Attributes from './Step1Attributes'
import Step2Genotype from './Step2Genotype'
import Step3Mutations from './Step3Mutations'
import Step4Experience from './Step4Experience'
import Step5Advantages from './Step5Advantages'
import WizardReview from './WizardReview'
import { POOL_AMBIANCE } from '../../../../shared/polarisUtils.js'

export default function WizardCreation() {
  const { t } = useTranslation('creation')
  const { campaignId } = useParams()
  const {
    step, setStep,
    highestStep, setHighestStep,
    sheetId, characterId, isStarting, startError,
    startCreation, setCampaignId,
    resetCreation,
    step1Data, step2Data, step3Data, step4Data, step5Data,
    setStep0Data, setStep1Data, setStep2Data, setStep3Data, setStep4Data, setStep5Data,
    getPcDispo,
    ambiance: storeAmbiance,
    randomMutationsEnabled,
  } = useCreationStore()

  const navigate = useNavigate()
  const [stepError, setStepError] = useState(null)
  const [finalizing, setFinalizing] = useState(false)

  useEffect(() => {
    if (campaignId) setCampaignId(campaignId)
  }, [campaignId, setCampaignId])

  const pcDispo = getPcDispo()
  const ambiance = storeAmbiance ?? 'INTERMEDIAIRE'
  const mockIsFeminin = false

  const canFinalize = !!step1Data?.charName && !!step2Data && !!step3Data && !!step4Data && !!step5Data

  const navigateToStep = (target) => {
    if (target === step || target < 1 || target > highestStep) return
    setStepError(null)
    setStep(target)
  }

  const handleFinalize = async () => {
    setFinalizing(true)
    setStepError(null)
    try {
      await api.post(`/creation/${sheetId}/finalize`, {
        step1: step1Data, step2: step2Data, step3: step3Data,
        step4: step4Data, step5: step5Data,
      })
      resetCreation()
      navigate('/')
    } catch (err) {
      const msg = err.response?.data?.error?.message
        || err.response?.data?.message
        || `Erreur ${err.response?.status ?? 'réseau'}`
      setStepError(msg)
      setFinalizing(false)
    }
  }

  if (step === 0) {
    return (
      <>
        {startError && (
          <div className="wiz-error">{startError}</div>
        )}
        <Step0Method
          onNext={async () => {
            if (isStarting) return
            setStep0Data({ method: 'point_buy' })
            try {
              await startCreation(campaignId)
              setHighestStep(1)
              setStep(1)
            } catch { /* startError stocké dans le store */ }
          }}
        />
      </>
    )
  }

  return (
    <div className="wiz-shell">
      <WizardHeader
        step={step}
        totalSteps={6}
        highestStep={highestStep}
        pcDispo={pcDispo}
        infos={getInfos(step, ambiance, t)}
        onStepClick={navigateToStep}
      />

      {stepError && (
        <div className="wiz-error">{stepError}</div>
      )}

      <div style={st.body}>
        {step === 1 && (
          <Step1Attributes
            initialData={step1Data}
            ambiance={ambiance}
            isFeminin={mockIsFeminin}
            onPcChange={(n) => setStep1Data({ pcSpent: n })}
            onNext={(data) => {
              setStep1Data(data)
              setHighestStep(2)
              setStep(2)
            }}
            onPrev={() => {
              setStepError(null)
              setStep(0)
            }}
          />
        )}

        {step === 2 && (
          <Step2Genotype
            initialData={step2Data}
            onNext={(data) => {
              setStep2Data(data)
              setHighestStep(3)
              setStep(3)
            }}
            onPrev={() => {
              setStepError(null)
              setStep(1)
            }}
          />
        )}

        {step === 3 && (
          <Step3Mutations
            initialData={step3Data}
            sheetId={sheetId}
            pcDispo={pcDispo}
            randomMutationsEnabled={randomMutationsEnabled}
            onNext={(data) => {
              setStep3Data(data)
              setHighestStep(4)
              setStep(4)
            }}
            onPrev={() => {
              setStepError(null)
              setStep(2)
            }}
          />
        )}

        {step === 4 && (
          <Step4Experience
            initialData={step4Data}
            pcDispo={pcDispo}
            onNext={(data) => {
              setStep4Data(data)
              setHighestStep(5)
              setStep(5)
            }}
            onPrev={() => {
              setStepError(null)
              setStep(3)
            }}
          />
        )}

        {step === 5 && (
          <Step5Advantages
            initialData={step5Data}
            sheetId={sheetId}
            pcDispo={pcDispo}
            onNext={(data) => {
              setStep5Data(data)
              setHighestStep(6)
              setStep(6)
            }}
            onPrev={() => {
              setStepError(null)
              setStep(4)
            }}
          />
        )}

        {step === 6 && (
          <div style={st.step6}>
            <div style={st.step6Sheet}>
              <WizardReview
                step1Data={step1Data}
                step2Data={step2Data}
                step3Data={step3Data}
                step4Data={step4Data}
                step5Data={step5Data}
                pcDispo={pcDispo}
              />
            </div>
            <div style={st.step6Nav}>
              <button className="btn btn-ghost" onClick={() => { setStepError(null); setStep(5) }}>
                ← {t('wizard.prev')}
              </button>
              <button className="btn btn-gold" onClick={handleFinalize} disabled={finalizing || !canFinalize}>
                {finalizing ? '…' : t('wizard.finalize')} →
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

function getInfos(step, ambiance, t) {
  if (step === 1) return <span className="wiz-info-badge">{t('wizard.info_step1', { ambiance, pool: POOL_AMBIANCE[ambiance] ?? 38 })}</span>
  if (step === 2) return <span className="wiz-info-badge">{t('wizard.info_step2')}</span>
  if (step === 3) return <span className="wiz-info-badge">{t('wizard.info_step3')}</span>
  if (step === 4) return <span className="wiz-info-badge">{t('wizard.info_step4')}</span>
  if (step === 5) return <span className="wiz-info-badge">{t('wizard.info_step5')}</span>
  if (step === 6) return <span className="wiz-info-badge">{t('wizard.info_step6')}</span>
  return null
}

const st = {
  body: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  step6: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  step6Sheet: { flex: 1, overflowY: 'auto', minHeight: 0 },
  step6Nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    borderTop: '1px solid #1e1e2e',
    flexShrink: 0,
  },
}
