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
import CharacterSheet from '../../character/CharacterSheet.jsx'

export default function WizardCreation() {
  const { t } = useTranslation('creation')
  const { campaignId } = useParams()
  const {
    step, setStep,
    sheetId, characterId, isStarting, startError,
    startCreation, setCampaignId,
    creationState, setCreationState, resetCreation,
    setStep0Data, setStep1Data, setStep2Data, setStep3Data, setStep4Data, setStep5Data,
    getPcDispo,
  } = useCreationStore()

  const navigate = useNavigate()
  const [stepError, setStepError] = useState(null)
  const [finalizing, setFinalizing] = useState(false)

  useEffect(() => {
    if (campaignId) setCampaignId(campaignId)
  }, [campaignId, setCampaignId])

  const pcDispo = getPcDispo()
  const mockAmbiance = 'INTERMEDIAIRE'
  const mockIsFeminin = false

  const navigateToStep = async (target) => {
    if (target === step || target < 1 || target > step) return
    if (step === 6 && target < 5) return
    setStepError(null)
    if (step >= 5 && target <= 4 && creationState === 'draft_step4') {
      try {
        await api.delete(`/creation/${sheetId}/step4`)
        setCreationState(null)
      } catch { /* on navigue quand même */ }
    }
    if      (target === 1) setStep1Data(null)
    else if (target === 2) setStep2Data(null)
    else if (target === 3) setStep3Data(null)
    else if (target === 4) setStep4Data(null)
    else if (target === 5) setStep5Data(null)
    setStep(target)
  }

  const handleFinalize = async () => {
    setFinalizing(true)
    try {
      await callStep('finalize', {})
      resetCreation()
      navigate('/')
    } catch {
      setFinalizing(false)
    }
  }

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
        totalSteps={6}
        pcDispo={pcDispo}
        infos={getInfos(step, mockAmbiance, t)}
        onStepClick={navigateToStep}
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
                setStep(6)
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
        {step === 6 && (
          <div style={st.step6}>
            <div style={st.step6Sheet}>
              <CharacterSheet
                characterId={characterId}
                isGm={false}
                isOwner={true}
                onSaved={() => {}}
              />
            </div>
            <div style={st.step6Nav}>
              <button className="btn btn-ghost" onClick={() => { setStepError(null); setStep5Data(null); setStep(5) }}>
                ← {t('wizard.prev')}
              </button>
              <button className="btn btn-gold" onClick={handleFinalize} disabled={finalizing}>
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
  if (step === 1) return <span className="wiz-info-badge">{t('wizard.info_step1', { ambiance, pool: 38 })}</span>
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
