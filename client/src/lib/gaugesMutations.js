import api from './api.js'
import { useCharacterStore } from '../stores/characterStore.js'

// PLAN_WIZARD_MATERIEL_GAUGES.md §3/§5/§6 — MJ only côté serveur (char-sheet.js). Même patron que
// inventoryMutations.js : appel réseau + écriture store, jamais de gestion d'erreur ici (chaque
// appelant garde son propre try/catch contextuel).
export async function adjustGauge(characterId, categoryKey, delta) {
  const res = await api.patch(`/char-sheet/${characterId}/gauges/${categoryKey}`, { delta })
  useCharacterStore.getState().setGauge(characterId, categoryKey, res.data.value)
  return res.data.value
}
