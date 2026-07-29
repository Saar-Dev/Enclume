import { create } from 'zustand'

export const useMapStore = create((set) => ({
  battlemap: null,
  battlemaps: [],
  // docs/PLAN_BATTLEMAP2D.md §9 (Lot 4) — liste plate {id, parent_folder_id, name}, le sélecteur
  // reconstruit l'arbre côté client.
  folders: [],

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

  // ─── Dossiers (docs/PLAN_BATTLEMAP2D.md §9, Lot 4) ────────────────────────────
  setFolders: (folders) => set({ folders }),
  addFolder: (folder) => set((state) => ({ folders: [...state.folders, folder] })),
  updateFolder: (id, patch) => set((state) => ({
    folders: state.folders.map(f => f.id === id ? { ...f, ...patch } : f),
  })),
  // Suppression — le serveur CASCADE les sous-dossiers et cartes ; l'appelant recharge folders +
  // battlemaps depuis le serveur après un DELETE plutôt que de retrancher côté client la fermeture
  // transitive (plus simple, plus sûr qu'une reconstruction locale de l'arbre supprimé).
  removeFolder: (folderId) => set((state) => ({
    folders: state.folders.filter(f => f.id !== folderId),
  })),
}))
