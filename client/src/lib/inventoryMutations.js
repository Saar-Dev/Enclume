import api from './api.js'
import { useCharacterStore } from '../stores/characterStore.js'
import { refreshDerivedTotals } from './inventoryDataSync.js'

// PLAN_INVENTORY_UX.md Étape 5 — primitives de mutation partagées entre les <select>/boutons existants
// (LocationPanel, ContainerPanel, WeaponPanel, InventoryPanel) et le futur drag & drop. Chaque appelant
// garde sa propre logique de calcul de valeur (slot composite multi-couche pour LocationPanel, code
// container pour ContainerPanel, slot de main pour WeaponPanel...) ; ce module ne porte que l'appel
// réseau + l'écriture store, jusqu'ici dupliqués à l'identique dans les 4 panneaux Matériel. Aucune
// gestion d'erreur ici : chaque appelant garde son propre message i18n contextuel via try/catch.

export async function setItemSlot(characterId, itemId, slot) {
  const res = await api.put(`/char-sheet/${characterId}/inventory/${itemId}`, { slot })
  useCharacterStore.getState().upsertInventoryItem(characterId, res.data.item)
  return res.data.item
}

export async function setItemContainer(characterId, itemId, container) {
  const res = await api.put(`/char-sheet/${characterId}/inventory/${itemId}`, { container })
  useCharacterStore.getState().upsertInventoryItem(characterId, res.data.item)
  refreshDerivedTotals(characterId) // container change → poids porté affecté (shared/inventoryMath.js)
  return res.data.item
}

export async function deleteItem(characterId, itemId) {
  await api.delete(`/char-sheet/${characterId}/inventory/${itemId}`)
  useCharacterStore.getState().removeInventoryItem(characterId, itemId)
  refreshDerivedTotals(characterId)
}
