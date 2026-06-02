import { create } from 'zustand'

export const useSessionStore = create((set) => ({
  onlineUsers: new Set(),
  messagesByCampaign: {},   // { [campaignId]: Message[] }
  activeCampaignId: null,
  pendingEntityId: null,    // entityId dont l'action attend l'arbitrage GM (un seul à la fois)

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

  // Vide tout l'état de session (usage futur : logout, tests)
  resetSession: () => set({
    onlineUsers: new Set(),
    messagesByCampaign: {},
    activeCampaignId: null,
    pendingEntityId: null,
  }),
}))
