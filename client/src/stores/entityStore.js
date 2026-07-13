import { create } from 'zustand'
import api from '../lib/api.js'

// ─── entityStore ──────────────────────────────────────────────────────────────
// Gère les instances d'entités (par battlemap) et les blueprints (global, conservés
// entre les cartes — un blueprint chargé une fois reste disponible).
//
// Séparation instances / blueprints :
//   entities   : tableau d'instances de la battlemap courante
//   blueprints : map { [blueprintId]: blueprint } — accumulée, jamais vidée entre cartes
//
// Les entités sont reçues avec leur blueprint embarqué (JOIN serveur).
// setBlueprintsFromEntities extrait et stocke tous les blueprints d'un batch.

export const useEntityStore = create((set, get) => ({
  entities: [],
  blueprints: {},   // { [blueprintId]: blueprint }

  // ─── Chargement initial ou MAP_SWITCH ─────────────────────────────────────
  // Remplace les instances, extrait et stocke les blueprints embarqués.
  setEntities: (entitiesWithBlueprints) => {
    const newBlueprints = {}
    for (const e of entitiesWithBlueprints) {
      if (e.blueprint) {
        newBlueprints[e.blueprint.id] = e.blueprint
      }
    }
    set(state => ({
      entities: entitiesWithBlueprints,
      blueprints: { ...state.blueprints, ...newBlueprints },
    }))
  },

  // ─── Chargement global des blueprints (indépendant des entités posées) ────
  // Appelé au montage de SessionPage et lors de l'ouverture de l'onglet Entités.
  // Récupère tous les blueprints non-deprecated via GET /api/entity-blueprints.
  // Merge dans blueprints{} — n'écrase pas les blueprints déjà présents.
  fetchBlueprints: async () => {
    try {
      const res = await api.get('/entity-blueprints')
      const fetched = res.data.blueprints || []
      const newBlueprints = {}
      for (const bp of fetched) {
        newBlueprints[bp.id] = bp
      }
      set(state => ({
        blueprints: { ...state.blueprints, ...newBlueprints },
      }))
    } catch (err) {
      console.error('Erreur fetchBlueprints :', err)
    }
  },

  refreshBuiltinModels: async () => {
    const res = await api.post('/entity-blueprints/refresh-builtins')
    const fetched = res.data.blueprints || []
    const builtinBlueprints = Object.fromEntries(fetched.map(bp => [bp.id, bp]))
    set(state => ({
      blueprints: {
        ...Object.fromEntries(Object.entries(state.blueprints).filter(([, bp]) => !bp.builtin_key)),
        ...builtinBlueprints,
      },
    }))
    return fetched.length
  },

  // ─── Ajout d'une entité (WS ENTITY_CREATED) ───────────────────────────────
  // Guard doublon — même pattern que tokenStore.addToken.
  addEntity: (entity) => {
    if (entity.blueprint) {
      set(state => ({
        entities: state.entities.some(e => e.id === entity.id)
          ? state.entities
          : [...state.entities, entity],
        blueprints: { ...state.blueprints, [entity.blueprint.id]: entity.blueprint },
      }))
    } else {
      set(state => ({
        entities: state.entities.some(e => e.id === entity.id)
          ? state.entities
          : [...state.entities, entity],
      }))
    }
  },

  // ─── Suppression d'une entité (WS ENTITY_DELETED) ─────────────────────────
  removeEntity: (entityId) => {
    set(state => ({
      entities: state.entities.filter(e => e.id !== entityId),
    }))
  },

  // ─── Mise à jour partielle d'une instance (WS ENTITY_UPDATED / ENTITY_MOVED) ──
  // Guard obsolescence via updated_at — même pattern que tokenStore.updateToken.
  updateEntity: (partial) => {
    console.log('[updateEntity] appelé — id:', partial.id, 'current_state_id:', partial.current_state_id, 'updated_at:', partial.updated_at)
    set(state => ({
      entities: state.entities.map(e => {
        if (e.id !== partial.id) return e
        // Guard obsolescence — ignorer les events plus anciens que l'état local
        if (partial.updated_at && e.updated_at && partial.updated_at < e.updated_at) {
          console.log('[updateEntity] BLOQUÉ — e.updated_at:', e.updated_at, '> partial.updated_at:', partial.updated_at)
          return e
        }
        console.log('[updateEntity] APPLIQUÉ — nouveau current_state_id:', partial.current_state_id)
        return { ...e, ...partial }
      }),
    }))
  },

  // ─── Upsert d'un blueprint (WorkshopPage / futur) ─────────────────────────
  upsertBlueprint: (blueprint) => {
    set(state => ({
      blueprints: { ...state.blueprints, [blueprint.id]: blueprint },
    }))
  },
}))
