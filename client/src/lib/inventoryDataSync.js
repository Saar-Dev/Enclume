import api from './api.js'
import { useCharacterStore } from '../stores/characterStore.js'

// PLAN_INVENTORY_UX.md §3 — pont entre GET /inventory et characterStore. Séparé de useInventoryData.js
// (façade React) car appelé aussi hors composant, depuis les handlers WS (useCharacterSocket.js,
// useWizardInventorySync.js) qui ne peuvent pas invoquer un hook.

// Dédup par characterId : évite les fetches concurrents redondants quand plusieurs consommateurs
// (les 3 panneaux Matériel montés ensemble, un handler WS) le déclenchent au même moment.
const inFlight = new Map()

function fetchInventory(characterId) {
  if (inFlight.has(characterId)) return inFlight.get(characterId)
  const promise = api.get(`/char-sheet/${characterId}/inventory`)
    .finally(() => inFlight.delete(characterId))
  inFlight.set(characterId, promise)
  return promise
}

// Premier chargement — store vide pour ce characterId. Remplace items + toutes les données dérivées
// (garde epoch, §3.4 point 1 : ignoré si une écriture plus récente a eu lieu entre-temps).
export function populateInventory(characterId) {
  const epoch = useCharacterStore.getState().inventoryFetchEpoch[characterId] ?? 0
  return fetchInventory(characterId)
    .then(res => {
      useCharacterStore.getState().setInventory(characterId, res.data.items || [], {
        threshold:  res.data.threshold ?? 0,
        sols:       res.data.sols ?? 0,
        iniPenalty: res.data.ini_penalty ?? 0,
        handPref:   res.data.hand_pref || 'R',
        epoch,
      })
    })
    .catch(err => console.error('Erreur chargement inventaire :', err))
}

// Rafraîchit uniquement threshold/ini_penalty après un event WS observé sur un characterId déjà
// chargé (poids porté recalculé côté serveur) — ne touche jamais items, déjà à jour via
// upsertInventoryItem/removeInventoryItem, pour ne pas retomber dans la course fetch-vs-subscribe.
export function refreshDerivedTotals(characterId) {
  return fetchInventory(characterId)
    .then(res => {
      useCharacterStore.getState().setDerivedTotals(characterId, {
        threshold:  res.data.threshold ?? 0,
        iniPenalty: res.data.ini_penalty ?? 0,
      })
    })
    .catch(err => console.error('Erreur rafraîchissement poids/malus :', err))
}
