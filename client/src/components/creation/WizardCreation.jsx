import { useCallback, useEffect, useRef, useState } from 'react'
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
import StepMaterielEtBiens from './StepMaterielEtBiens'
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
    sheetId, characterId, isStarting, startError,
    startCreation, loadExistingSheet, setCampaignId,
    resetCreation,
    step1Data, step2Data, step3Data, step4Data, step5Data,
    liveStep1Data, liveStep2Data, liveStep3Data, liveStep4Data, liveStep5Data,
    setStep0Data, setStep1Data, setStep2Data, setStep3Data, setStep4Data, setStep5Data,
    getPcDispo, getStepBudget,
    ambiance: storeAmbiance,
    randomMutationsEnabled,
    femininBonusEnabled,
    isGmView, guideModeActive, setGuideModeActive,
    stateSyncVersion,
  } = useCreationStore()

  // Diffusion live des champs en cours de saisie (Lot A4, docs/PLAN_WIZARDCOLLAB.md §2.5/§6.4bis) —
  // WizardCreation.jsx ne peut pas appeler useWizardLiveEmit() lui-même (il rend le SocketProvider,
  // n'en est pas descendant, même contrainte documentée pour useSocket() dans WizardLockSync.jsx) :
  // la ref est déposée par WizardLockSync (descendant du Provider), lue ici de façon impérative.
  const emitLiveRef = useRef(() => {})
  // Priorité au brouillon live côté MJ uniquement (§2.5) — le joueur voit toujours sa propre saisie
  // locale (initialData ne sert qu'au montage initial de son point de vue, jamais un live-overlay
  // sur lui-même).
  const liveOr = (live, committed) => (isGmView && live != null ? live : committed)

  // Callbacks stables (useCallback, jamais des fléchées inline) — WizardCreation et Step4Experience
  // s'abonnent au store entier sans sélecteur (useCreationStore() déjà ainsi avant ce chantier),
  // donc toute écriture store re-rend ces deux composants. Une fléchée inline en prop `onLiveChange`
  // serait recréée à chaque rendu, redéclenchant l'effet de chaque composant d'étape (qui la liste en
  // dépendance) sans rapport avec un vrai changement de champ — cause racine confirmée d'un
  // "Maximum update depth exceeded" trouvé par Saar en test réel. `emitLiveRef` est une ref (identité
  // stable), lue via `.current` au moment de l'appel, jamais capturée — ces callbacks n'ont donc
  // besoin d'aucune dépendance.
  const onLiveChange1 = useCallback((data) => emitLiveRef.current(1, data), [])
  const onLiveChange2 = useCallback((data) => emitLiveRef.current(2, data), [])
  const onLiveChange3 = useCallback((data) => emitLiveRef.current(3, data), [])
  const onLiveChange4 = useCallback((data) => emitLiveRef.current(4, data), [])
  const onLiveChange5 = useCallback((data) => emitLiveRef.current(5, data), [])

  // Force un remontage des composants d'étape uniquement côté MJ quand une donnée distante arrive
  // (WIZARD_STATE_SYNC → applyStateSync incrémente stateSyncVersion) — leur useState(initialData)
  // interne ne se resynchronise sinon jamais après le montage (comportement standard React, pas un
  // oubli). Jamais côté joueur (isGmView=false) : sa propre saisie ne doit jamais être interrompue.
  // Exigence Saar : une modification de l'un doit être IMMÉDIATEMENT visible chez l'autre.
  const gmSyncKey = isGmView ? `gm-sync-${stateSyncVersion}` : undefined

  const navigate = useNavigate()
  const [stepError, setStepError] = useState(null)
  const [finalizing, setFinalizing] = useState(false)
  const [advancing, setAdvancing] = useState(false)

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

  // Persiste l'étape en base AVANT de faire avancer l'écran — cause racine d'un bug réel trouvé en
  // test navigateur (Saar) : sans ceci, seuls "Voir ma fiche" et "Terminer" atteignaient le serveur,
  // donc un MJ ouvrant le personnage d'un joueur qui n'avait fait ni l'un ni l'autre voyait une
  // fiche vide. `useCreationStore.getState()` (pas la variable `step1Data` fermée par ce render) :
  // setStepNData() fait un merge synchrone juste avant, la valeur définitive est déjà en store au
  // moment de cet appel. En cas d'échec serveur (ex. validateStep1) : reste sur l'étape courante et
  // affiche l'erreur, jamais un avancement local optimiste que le serveur aurait refusé.
  const advanceStep = async (stepKey, data, setStepData, nextStep) => {
    if (advancing) return
    setStepData(data)
    setAdvancing(true)
    setStepError(null)
    try {
      const payload = { [stepKey]: useCreationStore.getState()[`${stepKey}Data`] }
      await api.post(`/creation/${sheetId}/reconcile`, payload)
      setHighestStep(nextStep)
      setStep(nextStep)
    } catch (err) {
      const msg = err.response?.data?.error?.message
        || err.response?.data?.message
        || `Erreur ${err.response?.status ?? 'réseau'}`
      setStepError(msg)
    } finally {
      setAdvancing(false)
    }
  }

  // Step6 "Matériel & Biens" (docs/PLAN_WIZARD_MATERIEL.md §3) : aucune donnée à soumettre — les
  // objets/notes s'écrivent immédiatement via leurs propres routes (char-sheet.js), jamais via
  // reconcile. Le seul rôle de cet appel est de signaler aux autres clients de la room que l'étape
  // est dépassée (marqueur {step6:true}, jamais lu par reconcileCreation elle-même) et de mettre à
  // jour creation_state pour la reprise à froid. Jamais bloquant (décision Saar) : aucune condition
  // sur l'action du MJ, disponible dès l'arrivée sur l'étape.
  const advanceStep6 = async () => {
    if (advancing) return
    setAdvancing(true)
    setStepError(null)
    try {
      await api.post(`/creation/${sheetId}/reconcile`, { step6: true })
      setHighestStep(7)
      setStep(7)
    } catch (err) {
      const msg = err.response?.data?.error?.message
        || err.response?.data?.message
        || `Erreur ${err.response?.status ?? 'réseau'}`
      setStepError(msg)
    } finally {
      setAdvancing(false)
    }
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
    <WizardLockSync sheetId={sheetId} emitLiveRef={emitLiveRef} />
    <div className="wiz-shell">
      <WizardHeader
        step={step}
        totalSteps={7}
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
            key={gmSyncKey}
            initialData={liveOr(liveStep1Data, step1Data)}
            ambiance={ambiance}
            femininBonusEnabled={femininBonusEnabled}
            onPcChange={(n) => setStep1Data({ pcSpent: n })}
            onLiveChange={onLiveChange1}
            onNext={(data) => advanceStep('step1', data, setStep1Data, 2)}
            onPrev={() => {
              setStepError(null)
              setStep(0)
            }}
          />
        )}

        {step === 2 && (
          <Step2Genotype
            key={gmSyncKey}
            initialData={liveOr(liveStep2Data, step2Data)}
            onLiveChange={onLiveChange2}
            onNext={(data) => advanceStep('step2', data, setStep2Data, 3)}
            onPrev={() => {
              setStepError(null)
              setStep(1)
            }}
          />
        )}

        {step === 3 && (
          <Step3Mutations
            key={gmSyncKey}
            initialData={liveOr(liveStep3Data, step3Data)}
            sheetId={sheetId}
            pcDispo={stepBudget}
            randomMutationsEnabled={randomMutationsEnabled}
            onLiveChange={onLiveChange3}
            onNext={(data) => advanceStep('step3', data, setStep3Data, 4)}
            onPrev={() => {
              setStepError(null)
              setStep(2)
            }}
          />
        )}

        {step === 4 && (
          <Step4Experience
            key={gmSyncKey}
            initialData={liveOr(liveStep4Data, step4Data)}
            pcDispo={stepBudget}
            onLiveChange={onLiveChange4}
            onNext={(data) => advanceStep('step4', data, setStep4Data, 5)}
            onPrev={() => {
              setStepError(null)
              setStep(3)
            }}
          />
        )}

        {step === 5 && (
          <Step5Advantages
            key={gmSyncKey}
            initialData={liveOr(liveStep5Data, step5Data)}
            sheetId={sheetId}
            pcDispo={stepBudget}
            onLiveChange={onLiveChange5}
            onNext={(data) => advanceStep('step5', data, setStep5Data, 6)}
            onPrev={() => {
              setStepError(null)
              setStep(4)
            }}
          />
        )}

        {step === 6 && (
          <StepMaterielEtBiens
            characterId={characterId}
            isGmView={isGmView}
            onPrev={() => { setStepError(null); setStep(5) }}
            onNext={advanceStep6}
            advancing={advancing}
          />
        )}

        {step === 7 && (
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
              <button className="btn btn-ghost" onClick={() => { setStepError(null); setStep(6) }}>
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
  if (step === 7) return <span className="wiz-info-badge">{t('wizard.info_step7')}</span>
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
