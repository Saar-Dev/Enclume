import { create } from 'zustand'
import api from '../lib/api.js'

// ─── worldRuntimeStore ──────────────────────────────────────────────────────
// Autorité unique côté client pour les effets/ascenseurs runtime d'une battlemap
// (docs/PLANS/PLAN_WORLD_RUNTIME_EFFECTS_STORE.md). Remplace 3 fetchs indépendants
// (Sidebar.jsx, Editor3D.jsx, Canvas3D.jsx) qui interrogeaient chacun /world-effects
// et /world-elevators avec leur propre état local divergent.
//
// La synchronisation (poll pendant transition, écoute WS.WORLD_RUNTIME_UPDATED) vit
// dans client/src/lib/useWorldRuntimeSync.js, pas ici — ce store ne fait que fetcher
// et exposer l'état, comme entityStore.fetchBlueprints.

const EMPTY_WORLD_EFFECTS = { definitions: [], instances: [], regions: [], featureStates: {} }

export const useWorldRuntimeStore = create((set) => ({
  worldEffects: EMPTY_WORLD_EFFECTS,
  runtimeElevatorStates: {},

  fetchWorldEffects: async (battlemapId) => {
    if (!battlemapId) {
      set({ worldEffects: EMPTY_WORLD_EFFECTS })
      return
    }
    try {
      const { data } = await api.get(`/battlemaps/${battlemapId}/world-effects`)
      set({ worldEffects: data.worldEffects || EMPTY_WORLD_EFFECTS })
    } catch (error) {
      console.error('[worldRuntimeStore] Erreur chargement effets runtime :', error)
    }
  },

  fetchRuntimeElevators: async (battlemapId) => {
    if (!battlemapId) {
      set({ runtimeElevatorStates: {} })
      return
    }
    try {
      const { data } = await api.get(`/battlemaps/${battlemapId}/world-elevators`)
      set({ runtimeElevatorStates: data.worldElevators?.states || {} })
    } catch (error) {
      console.error('[worldRuntimeStore] Erreur chargement ascenseurs runtime :', error)
    }
  },
}))
