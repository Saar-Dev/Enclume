import { create } from 'zustand'

export const useCharacterStore = create((set) => ({
  characters: [],
  members: [],
  isGm: false,

  // Remplacement complet — chargement initial (loadSession)
  setCharacters: (characters) => set({ characters }),

  // Remplacement complet + calcul isGm — loadSession
  // userId = user?.id depuis authStore, passé par l'appelant
  setMembers: (members, userId) => set({
    members,
    isGm: members.find(m => m.id === userId)?.role === 'gm' ?? false,
  }),

  // Ajout simple — création depuis Sidebar (handleCreateCharacter)
  addCharacter: (character) => set((state) => ({
    characters: [...state.characters, character],
  })),

  // Suppression — handleDelete dans CharacterWindow
  removeCharacter: (characterId) => set((state) => ({
    characters: state.characters.filter(c => c.id !== characterId),
  })),

  // Mise à jour partielle — mutations Sidebar (description, gm_notes, visible, user_id)
  // partial = { id, ...champs modifiés }
  updateCharacter: (partial) => set((state) => ({
    characters: state.characters.map(c =>
      c.id !== partial.id ? c : { ...c, ...partial }
    ),
  })),

  // Ajout ou remplacement — handler WS CHARACTER_UPDATED
  // Si visible:false et non-GM → retirer du store (le joueur ne doit plus voir ce character)
  // Si le character existe déjà → remplace (mise à jour)
  // Si le character n'existe pas → ajoute (nouvellement visible pour un joueur)
  upsertCharacter: (character) => set((state) => {
    if (!character.visible && !state.isGm) {
      return { characters: state.characters.filter(c => c.id !== character.id) }
    }
    const exists = state.characters.find(c => c.id === character.id)
    if (exists) {
      return {
        characters: state.characters.map(c =>
          c.id === character.id ? character : c
        ),
      }
    }
    return { characters: [...state.characters, character] }
  }),

  woundsByCharId: {},
  setWounds: (charId, wounds) => set((state) => ({
    woundsByCharId: { ...state.woundsByCharId, [charId]: wounds },
  })),

  // Source unique de vérité inventaire (PLAN_INVENTORY_UX.md §3). threshold et ini_penalty (dérivés
  // de la Force + réglages de campagne, cf. inventoryService.js — calcEncumbrancePenalty n'est jamais
  // dupliqué côté client), sols (monnaie, WS.SOLS_UPDATED dédié) et hand_pref (identité du personnage,
  // ne change jamais via une mutation d'inventaire) vivent dans des clés séparées d'inventoryByCharId :
  // ce ne sont pas des données d'inventaire, une propriété = une autorité.
  inventoryByCharId: {},
  thresholdByCharId: {},
  iniPenaltyByCharId: {},
  solsByCharId: {},
  handPrefByCharId: {},
  // Course fetch-vs-subscribe (§3.4 point 1) : incrémenté à chaque écriture (fetch complet appliqué,
  // upsert/remove incrémental). Un fetch capture l'epoch avant de partir (getState().inventoryFetchEpoch)
  // et le repasse à setInventory ; si l'epoch a bougé entre-temps (upsert WS ou mutation locale plus
  // récente), le fetch est périmé et son résultat est ignoré au lieu d'écraser le store.
  inventoryFetchEpoch: {},

  // Remplacement complet — premier chargement d'un characterId. `epoch`, si fourni, doit correspondre
  // à inventoryFetchEpoch[charId] au moment du set ; sinon (fetch périmé) l'appel est ignoré.
  setInventory: (charId, items, { threshold, sols, iniPenalty, handPref, epoch } = {}) => set((state) => {
    const currentEpoch = state.inventoryFetchEpoch[charId] ?? 0
    if (epoch !== undefined && epoch !== currentEpoch) {
      return state
    }
    return {
      inventoryByCharId: { ...state.inventoryByCharId, [charId]: items },
      thresholdByCharId: threshold === undefined
        ? state.thresholdByCharId
        : { ...state.thresholdByCharId, [charId]: threshold },
      iniPenaltyByCharId: iniPenalty === undefined
        ? state.iniPenaltyByCharId
        : { ...state.iniPenaltyByCharId, [charId]: iniPenalty },
      solsByCharId: sols === undefined
        ? state.solsByCharId
        : { ...state.solsByCharId, [charId]: sols },
      handPrefByCharId: handPref === undefined
        ? state.handPrefByCharId
        : { ...state.handPrefByCharId, [charId]: handPref },
      inventoryFetchEpoch: { ...state.inventoryFetchEpoch, [charId]: currentEpoch + 1 },
    }
  }),

  // Rafraîchit threshold/ini_penalty seuls (poids porté recalculé côté serveur après une mutation
  // observée par WS) — ne touche jamais items, pas de garde epoch nécessaire (aucune course avec
  // upsert/removeInventoryItem, autorité différente).
  setDerivedTotals: (charId, { threshold, iniPenalty }) => set((state) => ({
    thresholdByCharId: threshold === undefined
      ? state.thresholdByCharId
      : { ...state.thresholdByCharId, [charId]: threshold },
    iniPenaltyByCharId: iniPenalty === undefined
      ? state.iniPenaltyByCharId
      : { ...state.iniPenaltyByCharId, [charId]: iniPenalty },
  })),

  // Écriture incrémentale — handler WS INVENTORY_ADDED/UPDATED ou réponse HTTP d'une mutation locale.
  // No-op si ce characterId n'a jamais été peuplé par un fetch complet (state.inventoryByCharId[charId]
  // === undefined) : un event WS peut arriver pour un personnage qu'aucun panneau n'affiche chez ce
  // client (ex. GM connecté, joueur non consulté) — créer une entrée partielle (un seul item) bloquerait
  // silencieusement le futur fetch initial de ce personnage (useInventoryData ne fetch que si absent).
  upsertInventoryItem: (charId, item) => set((state) => {
    const items = state.inventoryByCharId[charId]
    if (items === undefined) return state
    const exists = items.some(i => i.id === item.id)
    return {
      inventoryByCharId: {
        ...state.inventoryByCharId,
        [charId]: exists
          ? items.map(i => i.id === item.id ? item : i)
          : [...items, item],
      },
      inventoryFetchEpoch: { ...state.inventoryFetchEpoch, [charId]: (state.inventoryFetchEpoch[charId] ?? 0) + 1 },
    }
  }),

  // Écriture incrémentale — handler WS INVENTORY_REMOVED ou réponse HTTP d'une suppression locale.
  removeInventoryItem: (charId, itemId) => set((state) => {
    const items = state.inventoryByCharId[charId]
    if (!items) return state
    return {
      inventoryByCharId: { ...state.inventoryByCharId, [charId]: items.filter(i => i.id !== itemId) },
      inventoryFetchEpoch: { ...state.inventoryFetchEpoch, [charId]: (state.inventoryFetchEpoch[charId] ?? 0) + 1 },
    }
  }),

  // Handler WS SOLS_UPDATED, ou réponse HTTP d'une mutation locale des sols.
  setSols: (charId, sols) => set((state) => ({
    solsByCharId: { ...state.solsByCharId, [charId]: sols },
  })),
}))