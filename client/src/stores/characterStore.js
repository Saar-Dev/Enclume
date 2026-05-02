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

  // Suppression — handleDelete dans CharacterModal
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
}))