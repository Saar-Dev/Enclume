import { create } from 'zustand'

export const useTokenStore = create((set) => ({
  tokens: [],
  // Token actuellement sélectionné (clic sur un token, anneau visuel) — accessible hors de
  // Canvas3D depuis ce store (ex. résolution du token acteur pour une interaction d'entité,
  // client/src/lib/actingToken.js). Ancien état local de Canvas3D, promu ici le 2026-09-17.
  selectedTokenId: null,

  // Remplacement complet — chargement initial, changement de carte
  setTokens: (tokens) => set({ tokens }),

  setSelectedTokenId: (selectedTokenId) => set({ selectedTokenId }),

  // Ajout avec guard doublon — TOKEN_CREATED peut arriver à l'émetteur aussi
  addToken: (token) => set((state) => {
    const exists = state.tokens.find(t => t.id === token.id)
    if (exists) return state
    return { tokens: [...state.tokens, token] }
  }),

  // Suppression — TOKEN_DELETED, handleTokenDelete
  removeToken: (tokenId) => set((state) => ({
    tokens: state.tokens.filter(t => t.id !== tokenId),
  })),

  // Mise à jour partielle avec guard obsolescence — TOKEN_MOVED
  // partial = { id, pos_x, pos_y, pos_z, updated_at }
  updateToken: (partial) => set((state) => ({
    tokens: state.tokens.map(t => {
      if (t.id !== partial.id) return t
      // Guard obsolescence — ignorer si l'événement est plus ancien que l'état local
      if (partial.updated_at && t.updated_at && partial.updated_at < t.updated_at) return t
      return { ...t, ...partial }
    }),
  })),
}))