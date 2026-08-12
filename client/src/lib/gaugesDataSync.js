import api from './api.js'
import { useCharacterStore } from '../stores/characterStore.js'

// PLAN_WIZARD_MATERIEL_GAUGES.md §3/§6 — pont entre GET .../gauges et characterStore, même patron
// que inventoryDataSync.js (dédup par characterId, séparé de useGaugesData.js pour être appelable
// hors composant depuis les handlers WS).

const inFlight = new Map()

function fetchGauges(characterId) {
  if (inFlight.has(characterId)) return inFlight.get(characterId)
  const promise = api.get(`/char-sheet/${characterId}/gauges`)
    .finally(() => inFlight.delete(characterId))
  inFlight.set(characterId, promise)
  return promise
}

export function populateGauges(characterId) {
  return fetchGauges(characterId)
    .then(res => {
      useCharacterStore.getState().setGauges(characterId, res.data.gauges || [])
    })
    .catch(err => console.error('Erreur chargement jauges :', err))
}
