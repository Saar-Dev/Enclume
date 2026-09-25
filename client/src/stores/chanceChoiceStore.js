import { create } from 'zustand'

// chanceChoiceStore — source unique des choix Chance en attente (CHANCE_CHOICE_PENDING/RESOLVED) et de la position du panneau
// « Résolution du tir » (résultat de blessure), au-dessus duquel s'ancre la réaction de blessure.
//
// CatastropheChoiceQueue.jsx reste l'unique abonné aux événements socket et alimente `entries` (filtrage d'audience : le joueur
// propriétaire pour un PJ, le MJ pour un PNJ). Deux lecteurs : la carte Catastrophe/Chance (CatastropheChoiceQueue) pour les
// familles hors blessure, et WoundReactionDock.jsx pour les réactions de blessure (`site === 'wound_severity'`) — jamais deux
// affichages du même choix : la carte ignore les blessures, le dock ignore tout le reste.
//
// resultPanelRect — { left, top, width } (px viewport) du panneau de résultat de blessure actuellement affiché, publié par
// `useResultPanelRect` (CombatResultPanels.jsx) ; `null` s'il n'y en a aucun. Le dock s'y ancre (« même axe, au-dessus » — maquette,
// planche I) ou, à défaut, se place à l'endroit où ce panneau apparaîtrait. Aucune valeur visuelle : de la géométrie mesurée.
export const useChanceChoiceStore = create((set) => ({
  entries: [],
  resultPanelRect: null,

  addPending: (entry) => set((state) => ({ entries: [...state.entries, entry] })),
  removeResolved: (id) => set((state) => ({
    entries: state.entries.filter((e) => e.id !== id),
  })),

  setResultPanelRect: (rect) => set({ resultPanelRect: rect }),

  reset: () => set({ entries: [], resultPanelRect: null }),
}))
