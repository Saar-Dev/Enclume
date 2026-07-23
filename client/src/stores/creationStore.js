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

  setHighestStep: (n) => set(s => ({ highestStep: Math.max(s.highestStep, n) })),

  startCreation: async (campaignId) => {
    set({ isStarting: true, startError: null })
    try {
      const res = await api.post('/creation/start', { campaignId })
      const { sheetId, characterId, ambiance, randomMutationsEnabled, femininBonusEnabled, randomProAdvantagesEnabled, reversEnabled, skillMaxLevelEnabled, youngPenaltyEnabled } = res.data
      set({ sheetId, characterId, ambiance, randomMutationsEnabled, femininBonusEnabled, randomProAdvantagesEnabled, reversEnabled, skillMaxLevelEnabled, youngPenaltyEnabled, isStarting: false })
      return { sheetId, characterId, ambiance, randomMutationsEnabled, femininBonusEnabled, randomProAdvantagesEnabled, reversEnabled, skillMaxLevelEnabled, youngPenaltyEnabled }
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
  }),
}))
