import { create } from 'zustand'
import api from '../lib/api'

const PC_TOTAL = 20

// Partagé par getPcDispo() (vivant, header) et getStepBudget() (brut, budget interne par étape) —
// source unique pour éviter que les deux calculs divergent un jour.
const computeGenoCost = (s) => !s.step2Data ? 0
  : s.step2Data.genotypeId === 'HUMAIN' ? 0
  : s.step2Data.isDeserter ? 4 : 5

export const useCreationStore = create((set, get) => ({
  step: 0,
  highestStep: 0,
  step0Data: null, // { method: 'point_buy' | 'archetype' }
  step1Data: null, // { charName, playerName, attributes, pcSpent }
  step2Data: null, // { genotypeId: string, isDeserter: boolean }
  step3Data: null, // { method: string, mutations: [], kept: [], removed: [], d20Result: N, pcSpent: number }
  step4Data: null, // { age (baseAge), finalAge, originGeo, originSoc, training, higherEd, careers: [], pcSpent: number }
  step5Data: null, // { advantages: [], pcNet: number }

  sheetId: null,
  characterId: null,
  campaignId: null,
  creationState: null,
  isStarting: false,
  startError: null,
  ambiance: null,
  randomMutationsEnabled: null,
  femininBonusEnabled: null,
  randomProAdvantagesEnabled: null,
  reversEnabled: null,
  skillMaxLevelEnabled: null,
  youngPenaltyEnabled: null,

  // Wizard collaboratif GM/Joueur (docs/PLAN_WIZARDCOLLAB.md Lot A2). lockedOptions est la
  // projection locale de WIZARD_LOCKS_SYNC (Set<optionKey> — préfixes shared/wizardOptionKeys.js
  // déjà uniques par domaine, pas besoin de scoper par step). isGmView/ownerUserId restent false/
  // null tant que le Lot A3 (MJ ouvre le brouillon d'un joueur) n'est pas câblé.
  lockedOptions: new Set(),
  isGmView: false,
  ownerUserId: null,
  guideModeActive: true,
  // Conservé pour le log de conflit non bloquant MJ/joueur (Lot B, docs/PLAN_WIZARDCOLLAB.md §4.5) —
  // republié en seenUpdatedAt par un futur reconcile MJ. Pas encore consommé (Lot B pas câblé).
  lastSeenUpdatedAt: null,
  stateSyncVersion: 0,

  // Brouillon en cours de saisie, éphémère (docs/PLAN_WIZARDCOLLAB.md Lot A4, §2.5) — reçu de
  // WIZARD_LIVE_UPDATE, jamais persisté, jamais lu par getPcDispo/getStepBudget (purement cosmétique).
  // Distinct de stepNData (durable) : purgé dès que le stepNData correspondant arrive (applyStateSync
  // ci-dessous), jamais confondu avec une donnée acquise.
  liveStep1Data: null,
  liveStep2Data: null,
  liveStep3Data: null,
  liveStep4Data: null,
  liveStep5Data: null,

  // Vivant — pour le header (WizardHeader) : reflète la dépense en cours de l'étape 4 avant
  // même sa soumission (liveYears), en plus des étapes déjà committed.
  getPcDispo: () => {
    const s = get()
    const genoCost = computeGenoCost(s)
    const step4Cost = s.step4Data?.pcSpent ?? s.step4Data?.liveYears ?? 0
    return PC_TOTAL
      - (s.step1Data?.pcSpent ?? 0)
      - genoCost
      - (s.step3Data?.pcSpent ?? 0)
      - step4Cost
      + (s.step5Data?.pcNet ?? 0)
  },

  // Brut — pour le budget interne d'une étape (CareersAllocator, Step3Mutations,
  // Step5Advantages) : ne lit JAMAIS liveYears, uniquement les valeurs committed des autres
  // étapes. Ces composants font leur propre soustraction de ce qu'ils allouent en interne ;
  // leur passer une valeur déjà nette de la dépense en cours créerait un double décompte.
  getStepBudget: () => {
    const s = get()
    const genoCost = computeGenoCost(s)
    return PC_TOTAL
      - (s.step1Data?.pcSpent ?? 0)
      - genoCost
      - (s.step3Data?.pcSpent ?? 0)
      - (s.step4Data?.pcSpent ?? 0)
      + (s.step5Data?.pcNet ?? 0)
  },

  setStep: (step) => set({ step }),
  setCampaignId: (campaignId) => set({ campaignId }),
  setCreationState: (creationState) => set({ creationState }),

  // locks : Array<{step, optionKey}> reçu de WIZARD_LOCKS_SYNC — état complet faisant autorité,
  // recalculé serveur à chaque bascule (jamais un merge local, docs/PLAN_WIZARDCOLLAB.md §2.1).
  setLockedOptions: (locks) => set({ lockedOptions: new Set((locks ?? []).map(l => l.optionKey)) }),
  setIsGmView: (isGmView) => set({ isGmView }),
  setOwnerUserId: (ownerUserId) => set({ ownerUserId }),
  setGuideModeActive: (guideModeActive) => set({ guideModeActive }),

  // Reçu de WIZARD_STATE_SYNC (Wizard collaboratif) — remplace intégralement chaque stepNData fourni
  // par ce qui est réellement en base, jamais un merge : contrairement à setStepNData (édition locale
  // en cours, doit préserver les champs non touchés par un update partiel comme onPcChange), ceci
  // reflète l'état serveur canonique après un reconcile distant, un merge risquerait de mélanger des
  // champs locaux périmés avec la version serveur.
  // stateSyncVersion : incrémenté à chaque appel — WizardCreation.jsx l'utilise en `key` côté MJ pour
  // forcer un remontage des composants d'étape (leur useState(initialData) ne se resynchronise
  // sinon qu'au montage, jamais sur un changement de props — sans ce remount, "immédiatement
  // visible" exigé par Saar n'est pas respecté pour une étape déjà affichée). Jamais côté joueur
  // (isGmView=false) : lui ne doit jamais être remonté pendant sa propre saisie.
  applyStateSync: (steps) => set((s) => {
    const next = { stateSyncVersion: s.stateSyncVersion + 1 }
    // L'état durable qui arrive supersède tout brouillon live affiché pour cette étape (Lot A4,
    // §2.5 dernier paragraphe) — sans cette purge, un liveStepNData périmé resterait affiché après
    // la validation réelle de l'étape.
    if (steps.step1) { next.step1Data = steps.step1; next.liveStep1Data = null }
    if (steps.step2) { next.step2Data = steps.step2; next.liveStep2Data = null }
    if (steps.step3) { next.step3Data = steps.step3; next.liveStep3Data = null }
    if (steps.step4) { next.step4Data = steps.step4; next.liveStep4Data = null }
    if (steps.step5) { next.step5Data = steps.step5; next.liveStep5Data = null }

    // La présence d'une clé stepN dans ce payload signifie que routes/creation.js#reconcile vient
    // de la persister avec succès à l'instant — donc que N+1 est désormais atteignable, exactement
    // la même sémantique que advanceStep() applique localement chez l'auteur de la soumission
    // (setHighestStep(nextStep)). Signal exact, contrairement à l'heuristique de contenu de
    // loadExistingSheet (nécessaire là-bas seulement faute de mieux au chargement à froid, où rien
    // n'indique quelle étape vient d'être touchée).
    // step6 (docs/PLAN_WIZARD_MATERIEL.md §3) : marqueur booléen pur, jamais un objet de données —
    // aucun step6Data/liveStep6Data n'existe, cette étape ne persiste rien. La formule générique
    // (Number(key.slice(4)) + 1) donne déjà 7 pour 'step6', aucun cas particulier nécessaire.
    let hs = s.highestStep
    for (const key of ['step1', 'step2', 'step3', 'step4', 'step5', 'step6']) {
      if (steps[key]) hs = Math.max(hs, Number(key.slice(4)) + 1)
    }
    next.highestStep = hs

    // Suivi "en direct" MJ uniquement (docs/PLAN_WIZARDCOLLAB.md, décision Saar) : avance l'écran
    // affiché seulement si le MJ était déjà à la frontière avant ce sync (motif auto-scroll de
    // chat) — jamais s'il a navigué en arrière pour relire une étape, il ne doit pas en être arraché.
    if (s.isGmView && s.step === s.highestStep && hs > s.highestStep) next.step = hs

    return next
  }),

  // Reçu de WIZARD_LIVE_UPDATE (Lot A4, docs/PLAN_WIZARDCOLLAB.md §2.5/§5bis) — jamais l'écho de sa
  // propre saisie (le serveur diffuse via socket.to, émetteur exclu, WizardLockSync.jsx). Réutilise
  // stateSyncVersion (même compteur qu'applyStateSync) : aucun nouveau mécanisme de remount à
  // inventer, WizardCreation.jsx#gmSyncKey réagit déjà à ses incréments sans savoir quelle action
  // l'a déclenché.
  applyLiveDraft: (step, data) => set(s => ({
    [`liveStep${step}Data`]: data,
    stateSyncVersion: s.stateSyncVersion + 1,
  })),

  setHighestStep: (n) => set(s => ({ highestStep: Math.max(s.highestStep, n) })),

  startCreation: async (campaignId) => {
    set({ isStarting: true, startError: null })
    try {
      const res = await api.post('/creation/start', { campaignId })
      const { sheetId, characterId, ambiance, randomMutationsEnabled, femininBonusEnabled, randomProAdvantagesEnabled, reversEnabled, skillMaxLevelEnabled, youngPenaltyEnabled, isGm } = res.data
      // isGmView = rôle réel de campagne (docs/PLAN_WIZARD_MATERIEL.md), pas seulement "MJ en train
      // d'observer le brouillon d'un autre" (loadExistingSheet) — un MJ démarrant son propre brouillon
      // via ce flux normal doit aussi être reconnu comme MJ sur Step6 (bug réel corrigé).
      set({ sheetId, characterId, ambiance, randomMutationsEnabled, femininBonusEnabled, randomProAdvantagesEnabled, reversEnabled, skillMaxLevelEnabled, youngPenaltyEnabled, isGmView: !!isGm, isStarting: false })
      return { sheetId, characterId, ambiance, randomMutationsEnabled, femininBonusEnabled, randomProAdvantagesEnabled, reversEnabled, skillMaxLevelEnabled, youngPenaltyEnabled }
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || `Erreur ${err.response?.status ?? 'réseau'}`
      set({ startError: msg, isStarting: false })
      throw err
    }
  },

  // MJ ouvre le brouillon d'un joueur, ou un joueur reprend le sien via un lien direct (Lot A3,
  // docs/PLAN_WIZARDCOLLAB.md §6.1) — hydrate tout le store depuis GET /:sheetId/state au lieu de
  // startCreation. highestStep reconstruit au mieux depuis la présence de données réelles par étape
  // (aucun suivi serveur de la progression — architecture client-primary) : imprécis par nature,
  // sans conséquence sur les données elles-mêmes (déjà toutes chargées), seulement sur l'écran
  // affiché en premier.
  loadExistingSheet: async (sheetId) => {
    set({ isStarting: true, startError: null })
    try {
      const res = await api.get(`/creation/${sheetId}/state`)
      const {
        step1, step2, step3, step4, step5, updatedAt, creationState, isGm, ownerUserId, characterId, campaignId,
        ambiance, randomMutationsEnabled, femininBonusEnabled, randomProAdvantagesEnabled,
        reversEnabled, skillMaxLevelEnabled, youngPenaltyEnabled,
      } = res.data

      let highestStep = 1
      if (step2?.genotypeId) highestStep = 2
      if (step3?.method) highestStep = 3
      if (step4?.careers?.length > 0) highestStep = 4
      if (highestStep === 4 && step5?.advantages?.length > 0) highestStep = 5
      // Step6 ne persiste aucune donnée d'étape (docs/PLAN_WIZARD_MATERIEL.md §3/§3bis) — l'heuristique
      // de contenu ci-dessus ne peut jamais la détecter. creation_state est le seul indice disponible
      // à froid (hors session live, où applyStateSync couvre déjà le cas via WIZARD_STATE_SYNC).
      if (creationState === 'step6_done') highestStep = Math.max(highestStep, 7)

      set({
        sheetId, characterId, campaignId,
        ambiance, randomMutationsEnabled, femininBonusEnabled, randomProAdvantagesEnabled,
        reversEnabled, skillMaxLevelEnabled, youngPenaltyEnabled,
        step1Data: step1, step2Data: step2, step3Data: step3, step4Data: step4, step5Data: step5,
        step: highestStep, highestStep,
        isGmView: isGm, ownerUserId, lastSeenUpdatedAt: updatedAt, creationState,
        isStarting: false,
      })
      return { sheetId }
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || `Erreur ${err.response?.status ?? 'réseau'}`
      set({ startError: msg, isStarting: false })
      throw err
    }
  },

  setStep0Data: (data) => set({ step0Data: data }),
  // Merge (pas overwrite) : onPcChange envoie { pcSpent: n } partiel sans perdre charName/attributes
  setStep1Data: (data) => set(s => ({
    step1Data: data === null ? null : { ...(s.step1Data ?? {}), ...data },
  })),
  setStep2Data: (data) => set({ step2Data: data }),
  setStep3Data: (data) => set({ step3Data: data }),
  // Merge (pas overwrite) : onPcChange envoie { liveYears: n } partiel sans perdre careers/origins
  setStep4Data: (data) => set(s => ({
    step4Data: data === null ? null : { ...(s.step4Data ?? {}), ...data },
  })),
  setStep5Data: (data) => set({ step5Data: data }),

  resetCreation: () => set({
    step: 0,
    highestStep: 0,
    step0Data: null, step1Data: null, step2Data: null,
    step3Data: null, step4Data: null, step5Data: null,
    sheetId: null, characterId: null, campaignId: null,
    creationState: null,
    isStarting: false, startError: null,
    ambiance: null,
    randomMutationsEnabled: null,
    femininBonusEnabled: null,
    randomProAdvantagesEnabled: null,
    reversEnabled: null,
    skillMaxLevelEnabled: null,
    youngPenaltyEnabled: null,
    lockedOptions: new Set(),
    isGmView: false,
    ownerUserId: null,
    guideModeActive: true,
    lastSeenUpdatedAt: null,
    liveStep1Data: null,
    liveStep2Data: null,
    liveStep3Data: null,
    liveStep4Data: null,
    liveStep5Data: null,
  }),
}))
