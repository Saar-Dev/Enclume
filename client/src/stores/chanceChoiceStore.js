import { create } from 'zustand'

// chanceChoiceStore — source unique des choix Chance en attente (CHANCE_CHOICE_PENDING/RESOLVED),
// jusqu'ici un `useState` local à CatastropheChoiceQueue.jsx (toujours monté, seul consommateur).
// PLAN_CHANCE.md L5 (retour Saar 2026-09-12, fusion Tir) : CombatDamageWindow.jsx a désormais besoin
// de lire cette même donnée depuis un arbre React différent (sous CombatOverlay, pas sous
// SessionPage) — une seconde copie locale y divergerait (règle react.md), d'où l'extraction ici.
// CatastropheChoiceQueue.jsx reste l'unique abonné aux événements socket et alimente ce store ;
// il n'y a toujours qu'UNE fenêtre visible par choix (jamais deux affichages du même choix) grâce à
// `activeWoundWindowId` : quand CombatDamageWindow prend en charge un choix `wound_severity` en
// ligne, il l'annonce ici et CatastropheChoiceQueue l'exclut de sa propre file.
export const useChanceChoiceStore = create((set) => ({
  entries: [],
  activeWoundWindowId: null,

  addPending: (entry) => set((state) => ({ entries: [...state.entries, entry] })),
  removeResolved: (id) => set((state) => ({
    entries: state.entries.filter((e) => e.id !== id),
  })),

  setActiveWoundWindowId: (woundId) => set({ activeWoundWindowId: woundId ?? null }),
  clearActiveWoundWindowId: () => set({ activeWoundWindowId: null }),

  reset: () => set({ entries: [], activeWoundWindowId: null }),
}))
