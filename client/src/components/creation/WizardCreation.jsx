import { useTranslation } from 'react-i18next'
import { useCreationStore } from '../../stores/creationStore'
import WizardHeader from './WizardHeader'
import Step0Method from './Step0Method'
import Step1Attributes from './Step1Attributes'
import Step2Genotype from './Step2Genotype'
import Step3Mutations from './Step3Mutations'
import Step4Experience from './Step4Experience'

export default function WizardCreation() {
  const { t } = useTranslation('creation')
  const {
    step, setStep,
    setStep0Data, setStep1Data, setStep2Data, setStep3Data, setStep4Data,
    getPcDispo,
  } = useCreationStore()

  const pcDispo = getPcDispo()

  const mockAmbiance = 'INTERMEDIAIRE'
  const mockIsFeminin = false

  if (step === 0) {
    return (
      <Step0Method
        onNext={() => {
          setStep0Data({ method: 'point_buy' })
          setStep(1)
        }}
      />
    )
  }

  return (
    <div style={st.wrapper}>
      <WizardHeader
        step={step}
        totalSteps={5}
        pcDispo={pcDispo}
        infos={getInfos(step, mockAmbiance, t)}
      />

      <div style={st.body}>
        {step === 1 && (
          <Step1Attributes
            ambiance={mockAmbiance}
            isFeminin={mockIsFeminin}
            onPcChange={(n) => setStep1Data({ pcSpent: n })}
            onNext={(data) => {
              setStep1Data(data)
              setStep(2)
            }}
            onPrev={() => {
              setStep1Data(null)
              setStep(0)
            }}
          />
        )}

        {step === 2 && (
          <Step2Genotype
            onNext={(data) => {
              setStep2Data(data)
              setStep(3)
            }}
            onPrev={() => {
              setStep2Data(null)
              setStep(1)
            }}
          />
        )}

        {step === 3 && (
          <Step3Mutations
            pcDispo={pcDispo}
            onNext={(data) => {
              setStep3Data(data)
              setStep(4)
            }}
            onPrev={() => {
              setStep3Data(null)
              setStep(2)
            }}
          />
        )}

        {step === 4 && (
          <Step4Experience
            pcDispo={pcDispo}
            onNext={(data) => {
              setStep4Data(data)
              setStep(5)
            }}
            onPrev={() => {
              setStep4Data(null)
              setStep(3)
            }}
          />
        )}

        {step === 5 && (
          <div style={st.placeholder}>
            <p style={st.placeholderText}>{t('step5.coming_soon')}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function getInfos(step, ambiance, t) {
  if (step === 1) return <span style={st.badge}>{t('wizard.info_step1', { ambiance, pool: 38 })}</span>
  if (step === 2) return <span style={st.badge}>{t('wizard.info_step2')}</span>
  if (step === 3) return <span style={st.badge}>{t('wizard.info_step3')}</span>
  if (step === 4) return <span style={st.badge}>{t('wizard.info_step4')}</span>
  if (step === 5) return <span style={st.badge}>{t('wizard.info_step5')}</span>
  return null
}

const st = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#06060e',
  },
  body: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  badge: {
    display: 'inline-block',
    padding: '4px 10px',
    border: '1px solid #2a2a3e',
    borderRadius: '3px',
    color: '#9090c8',
    fontSize: '10px',
    fontWeight: '600',
    backgroundColor: '#0e0e1a',
  },
  placeholder: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#5a5a7a',
    fontSize: '14px',
  },
}
