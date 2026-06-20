import { create } from 'zustand'

export const useCombatStore = create((set) => ({
  phase: null,          // 'ROSTER' | 'ANNOUNCEMENT' | 'RESOLUTION' | null
  subPhase: null,       // 'SLOT_ACTIVE' | 'AWAITING_DEFENSE' | 'AWAITING_DAMAGE' | null
  roster: [],           // [{ id, token_id, base_ini, initiative, status, has_announced, has_resolved, is_surprised }]
  actions: [],          // [{ id, token_id, type, initiative_score, status, ... }]
  currentTurn: 1,
  activeSlotIdx: 0,
  activeTokenId: null,  // token_id du slot actif (ANNOUNCEMENT et RESOLUTION)
  announcedActions: [], // [{ tokenId, actionType, initiative, moveTarget, attackTargetId }] — cumul du tour

  setCombatState: ({ phase, subPhase, roster, actions, currentTurn, activeSlotIdx, activeTokenId }) => set({
    phase,
    subPhase: subPhase ?? null,
    roster: roster ?? [],
    actions: actions ?? [],
    currentTurn: currentTurn ?? 1,
    activeSlotIdx: activeSlotIdx ?? 0,
    activeTokenId: activeTokenId ?? null,
  }),

  setCombatSubPhase: (subPhase) => set({ subPhase }),

  updateRoster: (updatedRoster) => set({ roster: updatedRoster }),

  addAction: (action) => set((state) => ({
    actions: [...state.actions, action],
  })),

  advanceSlot: (activeSlotIdx, activeTokenId) => set({ activeSlotIdx, activeTokenId: activeTokenId ?? null }),

  setActions: (actions) => set({ actions }),

  setPhase: (phase) => set({ phase }),

  markTokenAnnounced: (tokenId, initiative) => set((state) => ({
    roster: state.roster.map(r =>
      r.token_id === tokenId
        ? { ...r, has_announced: true, ...(initiative !== undefined ? { initiative } : {}) }
        : r
    ),
  })),

  addAnnouncedAction: (entry) => set((state) => ({
    announcedActions: [...state.announcedActions, entry],
  })),

  resetAnnouncedActions: () => set({ announcedActions: [] }),

  resetCombat: () => set({
    phase: null,
    subPhase: null,
    roster: [],
    actions: [],
    currentTurn: 1,
    activeSlotIdx: 0,
    activeTokenId: null,
    announcedActions: [],
  }),
}))
