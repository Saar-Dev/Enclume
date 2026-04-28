import { create } from 'zustand'

export const useSessionStore = create((set) => ({
  onlineUsers: new Set(),
  messages: [],

  // Remplacement complet de la liste des utilisateurs en ligne
  // Appelé au SESSION_JOINED avec la liste initiale des connectés
  setOnlineUsers: (onlineUsers) => set({ onlineUsers }),

  // Ajout d'un utilisateur en ligne — SESSION_USER_JOINED
  addOnlineUser: (userId) => set((state) => ({
    onlineUsers: new Set([...state.onlineUsers, userId]),
  })),

  // Suppression d'un utilisateur en ligne — SESSION_USER_LEFT
  removeOnlineUser: (userId) => set((state) => {
    const next = new Set(state.onlineUsers)
    next.delete(userId)
    return { onlineUsers: next }
  }),

  // Ajout d'un message — chat, système, résultats de dés (futur)
  // Appelé par CHAT_MESSAGE, SESSION_USER_JOINED, SESSION_USER_LEFT
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message],
  })),

  // Reset complet — à appeler lors d'une reconnexion (reconnectTrigger)
  // pour ne pas accumuler les messages système de connexion/déconnexion
  resetSession: () => set({ onlineUsers: new Set(), messages: [] }),
}))
