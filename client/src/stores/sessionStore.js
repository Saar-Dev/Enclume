import { create } from 'zustand'

export const useSessionStore = create((set) => ({
  onlineUsers: new Set(),
  messagesByCampaign: {},   // { [campaignId]: Message[] }
  activeCampaignId: null,
  pendingEntityId: null,    // entityId dont l'action attend l'arbitrage GM (un seul à la fois)
  criticalEffect: null,     // { kind: 'critical_success'|'catastrophe_risk', id } — un seul à la fois, v1

  setActiveCampaign: (campaignId) => set({ activeCampaignId: campaignId }),

  setOnlineUsers: (onlineUsers) => set({ onlineUsers }),

  addOnlineUser: (userId) => set((state) => ({
    onlineUsers: new Set([...state.onlineUsers, userId]),
  })),

  removeOnlineUser: (userId) => set((state) => {
    const next = new Set(state.onlineUsers)
    next.delete(userId)
    return { onlineUsers: next }
  }),

  addMessage: (message) => set((state) => {
    const cid = state.activeCampaignId
    if (!cid) return {}
    const existing = state.messagesByCampaign[cid] || []
    return {
      messagesByCampaign: {
        ...state.messagesByCampaign,
        [cid]: [...existing, message],
      },
    }
  }),

  setPendingEntityId: (entityId) => set({ pendingEntityId: entityId }),
  clearPendingEntityId: () => set({ pendingEntityId: null }),

  // Déclenchement/rendu séparés (docs/PLANS/PLAN_TEST_CRITIQUE.md Lot 3) : ce store ne fait que
  // porter l'état, CriticalEffectOverlay.jsx décide seul de l'apparence — remplacer le popup texte
  // par un vrai effet visuel plus tard ne touche que ce second fichier.
  triggerCriticalEffect: (kind) => set({ criticalEffect: { kind, id: Date.now() } }),
  clearCriticalEffect: () => set({ criticalEffect: null }),

  // Vide tout l'état de session (usage futur : logout, tests)
  resetSession: () => set({
    onlineUsers: new Set(),
    messagesByCampaign: {},
    activeCampaignId: null,
    pendingEntityId: null,
    criticalEffect: null,
  }),
}))
