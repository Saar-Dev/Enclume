import { create } from 'zustand'

export const useMapStore = create((set) => ({
  battlemap: null,
  battlemaps: [],

  // Remplacement complet — chargement initial, loadMap, MAP_SWITCH
  setBattlemap: (battlemap) => set({ battlemap }),

  // Remplacement complet — chargement initial (loadSession)
  setBattlemaps: (battlemaps) => set({ battlemaps }),

  // Renommage atomique — met à jour le nom dans la liste ET dans battlemap si active
  // Garantit que les deux ne sont jamais désynchronisés.
  renameBattlemap: (id, name) => set((state) => ({
    battlemaps: state.battlemaps.map(bm =>
      bm.id === id ? { ...bm, name } : bm
    ),
    battlemap: state.battlemap?.id === id
      ? { ...state.battlemap, name }
      : state.battlemap,
  })),

  // Fusion partielle — modale "Paramètres" (grille, image). Met à jour battlemap active ET la liste,
  // même garantie de synchronisation que renameBattlemap.
  updateBattlemap: (id, patch) => set((state) => ({
    battlemaps: state.battlemaps.map(bm =>
      bm.id === id ? { ...bm, ...patch } : bm
    ),
    battlemap: state.battlemap?.id === id
      ? { ...state.battlemap, ...patch }
      : state.battlemap,
  })),

  // Ajout dans la liste — duplication, création
  addBattlemap: (battlemap) => set((state) => ({
    battlemaps: [...state.battlemaps, battlemap],
  })),

  // Suppression de la liste — handleMapDelete
  // Ne touche pas battlemap active — l'appelant gère le chargement de la suivante.
  removeBattlemap: (battlemapId) => set((state) => ({
    battlemaps: state.battlemaps.filter(bm => bm.id !== battlemapId),
  })),
}))
