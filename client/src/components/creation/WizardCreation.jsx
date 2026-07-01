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

export default function WizardCreation() {
  const { t } = useTranslation('creation')
  const { campaignId } = useParams()
  const {
    step, setStep,
    sheetId, isStarting, startError,
    startCreation, setCampaignId,
    creationState, setCreationState, resetCreation,
    setStep0Data, setStep1Data, setStep2Data, setStep3Data, setStep4Data, setStep5Data,
    getPcDispo,
  } = useCreationStore()

  const navigate = useNavigate()
  const [stepError, setStepError] = useState(null)

  useEffect(() => {
    if (campaignId) setCampaignId(campaignId)
  }, [campaignId, setCampaignId])

  const pcDispo = getPcDispo()
  const mockAmbiance = 'INTERMEDIAIRE'
  const mockIsFeminin = false

  const callStep = async (endpoint, body) => {
    setStepError(null)
    try {
      const res = await api.post(`/creation/${sheetId}/${endpoint}`, body)
      return res.data
    } catch (err) {
      const msg = err.response?.data?.error?.message
        || err.response?.data?.message
        || `Erreur ${err.response?.status ?? 'réseau'}`
      setStepError(msg)
      throw err
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
        totalSteps={5}
        pcDispo={pcDispo}
        infos={getInfos(step, mockAmbiance, t)}
      />

      {stepError && (
        <div className="wiz-error">{stepError}</div>
      )}

      <div style={st.body}>
        {step === 1 && (
          <Step1Attributes
            ambiance={mockAmbiance}
            isFeminin={mockIsFeminin}
            onPcChange={(n) => setStep1Data({ pcSpent: n })}
            onNext={async (data) => {
              try {
                await callStep('step1', data)
                setStep1Data(data)
                setStep(2)
              } catch { /* stepError affiché */ }
            }}
            onPrev={() => {
              setStepError(null)
              setStep1Data(null)
              setStep(0)
            }}
          />
        )}

        {step === 2 && (
          <Step2Genotype
            onNext={async (data) => {
              try {
                await callStep('step2', data)
                setStep2Data(data)
                setStep(3)
              } catch { /* stepError affiché */ }
            }}
            onPrev={() => {
              setStepError(null)
              setStep2Data(null)
              setStep(1)
            }}
          />
        )}

        {step === 3 && (
          <Step3Mutations
            pcDispo={pcDispo}
            onNext={async (data) => {
              try {
                await callStep('step3', data)
                setStep3Data(data)
                setStep(4)
              } catch { /* stepError affiché */ }
            }}
            onPrev={() => {
              setStepError(null)
              setStep2Data(null)  // Bug3 fix : efface coût génotype + cascade step3/4/5
              setStep(2)
            }}
          />
        )}

        {step === 4 && (
          <Step4Experience
            pcDispo={pcDispo}
            onNext={async (data) => {
              try {
                await callStep('step4', data)
                setStep4Data(data)
                setCreationState('draft_step4')
                setStep(5)
              } catch { /* stepError affiché */ }
            }}
            onPrev={() => {
              setStepError(null)
              setStep3Data(null)  // Bug3 fix : efface coût mutations + cascade step4/5
              setStep(3)
            }}
          />
        )}

        {step === 5 && (
          <Step5Advantages
            sheetId={sheetId}
            pcDispo={pcDispo}
            onNext={async (data) => {
              try {
                await callStep('step5', data)
                setStep5Data(data)
                await callStep('finalize', {})
                resetCreation()
                navigate('/')
              } catch { /* stepError affiché */ }
            }}
            onPrev={async () => {
              if (creationState === 'draft_step4') {
                try {
                  await api.delete(`/creation/${sheetId}/step4`)
                  setCreationState(null)
                } catch { /* ignore — on revient au step4 même si rollback échoue */ }
              }
              setStep(4)
            }}
          />
        )}
      </div>
    </div>
  )
}

function getInfos(step, ambiance, t) {
  if (step === 1) return <span className="wiz-info-badge">{t('wizard.info_step1', { ambiance, pool: 38 })}</span>
  if (step === 2) return <span className="wiz-info-badge">{t('wizard.info_step2')}</span>
  if (step === 3) return <span className="wiz-info-badge">{t('wizard.info_step3')}</span>
  if (step === 4) return <span className="wiz-info-badge">{t('wizard.info_step4')}</span>
  if (step === 5) return <span className="wiz-info-badge">{t('wizard.info_step5')}</span>
  return null
}

const st = {
  body: { flex: 1, display: 'flex', flexDirection: 'column' },
}
