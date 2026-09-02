import { create } from 'zustand'

export const useSessionStore = create((set) => ({
  onlineUsers: new Set(),
  messagesByCampaign: {},   // { [campaignId]: Message[] }
  activeCampaignId: null,
  pendingEntityId: null,    // entityId dont l'action attend l'arbitrage GM (un seul à la fois)
  pendingConnectorId: null, // connector.worldId dont l'action de porte attend une réponse serveur
                            // (docs/PLANS/PLAN_INTERACTIONS_CONNECTEURS.md §8) — même patron que
                            // pendingEntityId : `onCommand` n'est pas réellement attendu jusqu'à la
                            // réponse réseau (socket, pas une promesse), un useState local dans
                            // DoorRuntimeControls se réinitialiserait avant la vraie réponse.
  criticalEffect: null,     // { kind: 'critical_success'|'catastrophe_risk', id } — un seul à la fois, v1
  declareError: null,       // { message, id } — bannière transitoire de refus de déclaration de combat (un seul à la fois)

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

  // Dédup par id (PLAN_CHAT.md §8.2) — un message chat persisté (id numérique de chat_messages) peut
  // arriver deux fois : une fois via l'historique paginé (setMessages/prependMessages), une fois via
  // chat:message_created temps réel si les deux se chevauchent au chargement. Les autres types de
  // messages (dés, système, actions...) ont un id construit avec un timestamp, jamais de collision.
  addMessage: (message) => set((state) => {
    const cid = state.activeCampaignId
    if (!cid) return {}
    const existing = state.messagesByCampaign[cid] || []
    if (message.id != null && existing.some((m) => m.id === message.id)) return {}
    return {
      messagesByCampaign: {
        ...state.messagesByCampaign,
        [cid]: [...existing, message],
      },
    }
  }),

  // setMessages/prependMessages (PLAN_CHAT.md §8.2, §8.4/§8.5) — chargement initial et pagination
  // ascendante de l'historique persisté. channelId n'est pas encore un axe de stockage séparé (pas de
  // vue multi-canal en V1, cf. EN_COURS.md Roadmap "Chat multi-canal") : les messages TEXT/WHISPER
  // rejoignent le même flux unique que les autres types, channelId reste une métadonnée par message
  // (déjà suffisant pour un futur filtre, sans restructurer le store à ce moment-là).
  // Fusion plutôt que remplacement : des messages temps réel (dice, système, chat) ont pu arriver
  // pendant le chargement de l'historique (§8.4) — un simple replace les perdrait.
  setMessages: (campaignId, channelId, messages) => set((state) => {
    const existing = state.messagesByCampaign[campaignId] || []
    const incomingIds = new Set(messages.map((m) => m.id))
    const keptExisting = existing.filter((m) => m.id == null || !incomingIds.has(m.id))
    return {
      messagesByCampaign: {
        ...state.messagesByCampaign,
        [campaignId]: [...messages, ...keptExisting],
      },
    }
  }),

  // Pagination ascendante (scroll infini, §8.5) — l'appelant fournit déjà les messages en ordre
  // chronologique (plus ancien en premier) ; l'API renvoie ses pages en DESC, la conversion est la
  // responsabilité de l'appelant (useChatSocket.js), pas du store.
  prependMessages: (campaignId, channelId, olderMessages) => set((state) => {
    const existing = state.messagesByCampaign[campaignId] || []
    const existingIds = new Set(existing.map((m) => m.id))
    const deduped = olderMessages.filter((m) => m.id == null || !existingIds.has(m.id))
    return {
      messagesByCampaign: {
        ...state.messagesByCampaign,
        [campaignId]: [...deduped, ...existing],
      },
    }
  }),

  // Suppression douce (§8.2) — retire le message du flux local ; pas de placeholder "message
  // supprimé" en V1 (non spécifié au plan, pas de dette silencieuse, juste hors scope V1).
  removeMessage: (campaignId, messageId) => set((state) => {
    const existing = state.messagesByCampaign[campaignId]
    if (!existing) return {}
    return {
      messagesByCampaign: {
        ...state.messagesByCampaign,
        [campaignId]: existing.filter((m) => m.id !== messageId),
      },
    }
  }),

  setPendingEntityId: (entityId) => set({ pendingEntityId: entityId }),
  clearPendingEntityId: () => set({ pendingEntityId: null }),

  setPendingConnectorId: (connectorId) => set({ pendingConnectorId: connectorId }),
  clearPendingConnectorId: () => set({ pendingConnectorId: null }),

  // Déclenchement/rendu séparés (docs/PLANS/PLAN_TEST_CRITIQUE.md Lot 3) : ce store ne fait que
  // porter l'état, CriticalEffectOverlay.jsx décide seul de l'apparence — remplacer le popup texte
  // par un vrai effet visuel plus tard ne touche que ce second fichier.
  triggerCriticalEffect: (kind) => set({ criticalEffect: { kind, id: Date.now() } }),
  clearCriticalEffect: () => set({ criticalEffect: null }),

  // Bannière transitoire « déclaration de combat refusée » (PLAN_RW_DECLARE_WINDOWS module 3) — même
  // séparation déclenchement/rendu que criticalEffect : useCombatSocket#onDeclareError pose (sur
  // COMBAT_DECLARE_ERROR, à côté du message de chat), un useEffect central l'auto-efface après 4 s,
  // CombatDeclareErrorBanner.jsx affiche. Jamais un socket.on dans une fenêtre de déclaration (P57).
  setDeclareError: (message) => set({ declareError: { message, id: Date.now() } }),
  clearDeclareError: () => set({ declareError: null }),

  // Vide tout l'état de session (usage futur : logout, tests)
  resetSession: () => set({
    onlineUsers: new Set(),
    messagesByCampaign: {},
    activeCampaignId: null,
    pendingEntityId: null,
    pendingConnectorId: null,
    criticalEffect: null,
    declareError: null,
  }),
}))
