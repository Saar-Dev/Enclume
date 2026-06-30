import { create } from 'zustand'

const PC_TOTAL = 20

export const useCreationStore = create((set, get) => ({
  step: 0,
  step0Data: null, // { method: 'point_buy' | 'archetype' }
  step1Data: null, // { pcSpent: number }
  step2Data: null, // { genotypeId: string, isDeserter: boolean }
  step3Data: null, // { method: string, mutations: [], pcSpent: number }
  step4Data: null, // { age, originGeo, originSoc, training, higherEd, careers: [], pcSpent: number }
  step5Data: null, // { advantages: [] }

  getPcDispo: () => {
    const s = get()
    const genoCost = !s.step2Data ? 0
      : s.step2Data.genotypeId === 'HUMAIN' ? 0
      : s.step2Data.isDeserter ? 4 : 5
    return PC_TOTAL
      - (s.step1Data?.pcSpent ?? 0)
      - genoCost
      - (s.step3Data?.pcSpent ?? 0)
      - (s.step4Data?.pcSpent ?? 0)
  },

  setStep: (step) => set({ step }),

  setStep0Data: (data) => set({ step0Data: data }),

  setStep1Data: (data) => set({
    step1Data: data,
    step2Data: null,
    step3Data: null,
    step4Data: null,
    step5Data: null,
  }),

  setStep2Data: (data) => set({
    step2Data: data,
    step3Data: null,
    step4Data: null,
    step5Data: null,
  }),

  setStep3Data: (data) => set({
    step3Data: data,
    step4Data: null,
    step5Data: null,
  }),

  setStep4Data: (data) => set({
    step4Data: data,
    step5Data: null,
  }),

  setStep5Data: (data) => set({ step5Data: data }),

  resetCreation: () => set({
    step: 0,
    step0Data: null,
    step1Data: null,
    step2Data: null,
    step3Data: null,
    step4Data: null,
    step5Data: null,
  }),
}))
