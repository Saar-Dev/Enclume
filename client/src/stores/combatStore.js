import { create } from 'zustand'

export const useCombatStore = create((set) => ({
  phase: null,          // 'ROSTER' | 'ANNOUNCEMENT' | 'RESOLUTION' | null
  subPhase: null,       // 'SLOT_ACTIVE' | 'AWAITING_DEFENSE' | 'AWAITING_DAMAGE' | null
  roster: [],           // [{ id, token_id, base_ini, initiative, status, has_announced, has_resolved, is_surprised }]
  actions: [],          // [{ id, token_id, type, initiative_score, status, ... }]
  currentTurn: 1,
  activeSlotIdx: 0,      // ANNOUNCEMENT uniquement (COMBAT_SLOT_ADVANCED) — plus lu en RESOLUTION (Lot B)
  activeTokenId: null,  // token_id du slot actif (ANNOUNCEMENT) ou du pas courant de l'échelle (RESOLUTION)
  announcedActions: [], // [{ tokenId, actionType, initiative, moveTarget, attackTargetId }] — cumul du tour

  // Échelle de phases (docs/PLAN_COMBAT_TIMELINE.md Lot B/C) — alimentée par COMBAT_TIMELINE_UPDATED.
  timelineEntries: [],  // [{ id, token_id, combat_action_id, declaration_group_id, phase_position, status }]
  currentStep: null,    // { kind: 'entry', tokenId, entry } | { kind: 'simple', tokenId } | { kind: 'delayed_turn', tokenId, groupId } | null

  setCombatState: ({ phase, subPhase, roster, actions, currentTurn, activeSlotIdx, activeTokenId }) => set({
    phase,
    subPhase: subPhase ?? null,
    roster: roster ?? [],
    actions: actions ?? [],
    currentTurn: currentTurn ?? 1,
    activeSlotIdx: activeSlotIdx ?? 0,
    activeTokenId: activeTokenId ?? null,
  }),

  // Un seul événement serveur pousse l'intégralité de l'échelle courante à chaque changement (§6quater :
  // « nouvel événement WS, poussé par le serveur à chaque changement de l'échelle ») — pas de mutation
  // incrémentale côté client, la source de vérité reste le serveur. activeTokenId dérive de currentStep
  // pour rester compatible avec les consommateurs existants (CombatActionWindow, CombatOverlay).
  // `subPhase` (Session 159, retour Saar — « Agir maintenant devrait apparaître immédiatement ») :
  // seul canal qui pousse réellement le sub_phase courant en jeu normal (le serveur ne le broadcastait
  // nulle part ailleurs hors reconnexion) — sans ce champ ici, `subPhase` restait figé à sa valeur
  // initiale (null) toute la partie, rendant muettes toutes les conditions `subPhase === 'SLOT_ACTIVE'`.
  setTimelineState: ({ turnNumber, entries, currentStep, subPhase }) => set((state) => ({
    timelineEntries: entries ?? [],
    currentStep: currentStep ?? null,
    currentTurn: turnNumber ?? state.currentTurn,
    activeTokenId: currentStep?.tokenId ?? null,
    subPhase: subPhase !== undefined ? subPhase : state.subPhase,
  })),

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
    timelineEntries: [],
    currentStep: null,
  }),
}))
