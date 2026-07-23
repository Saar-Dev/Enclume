import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCreationStore } from '../../stores/creationStore'
import { useAuthStore } from '../../stores/authStore'
import api from '../../lib/api'
import CharacterWindow from '../../character/CharacterWindow'
import WizardHeader from './WizardHeader'
import WizardLockSync from './WizardLockSync'
import Step0Method from './Step0Method'
import Step1Attributes from './Step1Attributes'
import Step2Genotype from './Step2Genotype'
import Step3Mutations from './Step3Mutations'
import Step4Experience from './Step4Experience'
import Step5Advantages from './Step5Advantages'
import WizardReview from './WizardReview'
import { SocketProvider } from '../../lib/SocketContext.jsx'
import { POOL_AMBIANCE } from '../../../../shared/polarisUtils.js'

export default function WizardCreation() {
  const { t } = useTranslation('creation')
  const { campaignId, sheetId: urlSheetId } = useParams()
  const { user } = useAuthStore()
  const {
    step, setStep,
    highestStep, setHighestStep,
    sheetId, isStarting, startError,
    startCreation, loadExistingSheet, setCampaignId,
    resetCreation,
    step1Data, step2Data, step3Data, step4Data, step5Data,
    setStep0Data, setStep1Data, setStep2Data, setStep3Data, setStep4Data, setStep5Data,
    getPcDispo, getStepBudget,
    ambiance: storeAmbiance,
    randomMutationsEnabled,
    femininBonusEnabled,
    isGmView, guideModeActive, setGuideModeActive,
  } = useCreationStore()

  const navigate = useNavigate()
  const [stepError, setStepError] = useState(null)
  const [finalizing, setFinalizing] = useState(false)

  // Reprise d'un personnage existant — route /campaigns/:campaignId/creation/:sheetId (Lot A3,
  // docs/PLAN_WIZARDCOLLAB.md §6.2). MJ ouvrant le brouillon d'un joueur, ou lien direct de reprise.
  useEffect(() => {
    if (urlSheetId && urlSheetId !== sheetId) {
      loadExistingSheet(urlSheetId).catch(() => { /* startError déjà posé par le store */ })
    }
  }, [urlSheetId, sheetId, loadExistingSheet])

  // Hygiène de navigation — même invariant que le nettoyage de room côté serveur (WIZARD_JOIN,
  // Lot A1) : la route sans :sheetId représente toujours SON PROPRE personnage, jamais l'état
  // laissé par un MJ qui vient de consulter celui d'un autre joueur (isGmView=true dans le store).
  // Sans ce garde-fou, quitter le personnage du joueur A pour /creation (le sien) afficherait
  // silencieusement le shell avec les données de A tant que l'utilisateur n'a pas rafraîchi.
  useEffect(() => {
    if (!urlSheetId && isGmView) resetCreation()
  }, [urlSheetId, isGmView, resetCreation])

  // ─── Fenêtre fiche personnage (lecture seule) ────────────────────────────
  const [peekOpen, setPeekOpen] = useState(false)
  const [peekCharacter, setPeekCharacter] = useState(null)
  const [peekIsGm, setPeekIsGm] = useState(false)
  const [peekLoading, setPeekLoading] = useState(false)

  useEffect(() => {
    if (campaignId) setCampaignId(campaignId)
  }, [campaignId, setCampaignId])

  const pcDispo = getPcDispo()
  const stepBudget = getStepBudget()
  const ambiance = storeAmbiance ?? 'INTERMEDIAIRE'

  const navigateToStep = (target) => {
    if (target === step || target < 1 || target > highestStep) return
    setStepError(null)
    setStep(target)
  }

  const openPeek = async () => {
    if (peekLoading) return
    setPeekLoading(true)
    setStepError(null)
    try {
      await api.post(`/creation/${sheetId}/reconcile`, {
        step1: step1Data, step2: step2Data, step3: step3Data,
        step4: step4Data, step5: step5Data,
      })
      const res = await api.get(`/creation/${sheetId}/preview`)
      setPeekCharacter(res.data.character)
      setPeekIsGm(res.data.isGm)
      setPeekOpen(true)
    } catch (err) {
      const msg = err.response?.data?.error?.message
        || err.response?.data?.message
        || `Erreur ${err.response?.status ?? 'réseau'}`
      setStepError(msg)
    } finally {
      setPeekLoading(false)
    }
  }

  const handleTerminate = async () => {
    setFinalizing(true)
    setStepError(null)
    try {
      await api.post(`/creation/${sheetId}/reconcile`, {
        step1: step1Data, step2: step2Data, step3: step3Data,
        step4: step4Data, step5: step5Data,
        finalize: true,
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

  // Reprise en cours (ou échouée) — jamais Step0Method (démarrage neuf) pour une reprise ciblée.
  if (urlSheetId && urlSheetId !== sheetId) {
    return (
      <>
        {startError
          ? <div className="wiz-error">{startError}</div>
          : <div className="wiz-info-badge">{t('wizard.loading')}</div>}
      </>
    )
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
    <SocketProvider campaignId={campaignId}>
    <WizardLockSync sheetId={sheetId} />
    <div className="wiz-shell">
      <WizardHeader
        step={step}
        totalSteps={6}
        highestStep={highestStep}
        pcDispo={pcDispo}
        infos={getInfos(step, ambiance, t)}
        onStepClick={navigateToStep}
        hasCharacter={!!step1Data}
        onOpenPeek={openPeek}
        peekLoading={peekLoading}
        isGmView={isGmView}
        guideModeActive={guideModeActive}
        onToggleGuideMode={() => setGuideModeActive(!guideModeActive)}
      />

      {stepError && (
        <div className="wiz-error">{stepError}</div>
      )}

      <div style={st.body}>
        {step === 1 && (
          <Step1Attributes
            initialData={step1Data}
            ambiance={ambiance}
            femininBonusEnabled={femininBonusEnabled}
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
            pcDispo={stepBudget}
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
            pcDispo={stepBudget}
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
            pcDispo={stepBudget}
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
              <button className="btn btn-ghost" onClick={openPeek} disabled={peekLoading}>
                {peekLoading ? '…' : t('wizard.open_sheet')}
              </button>
              <button className="btn btn-gold" onClick={handleTerminate} disabled={finalizing}>
                {finalizing ? '…' : t('wizard.finalize')} →
              </button>
            </div>
          </div>
        )}

      </div>

      {peekOpen && peekCharacter && (
        <CharacterWindow
          character={{ ...peekCharacter, _currentUserId: user.id }}
          isGm={peekIsGm}
          forceReadOnly
          onClose={() => setPeekOpen(false)}
        />
      )}
    </div>
    </SocketProvider>
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
