import api from './api.js'
import { useCharacterStore } from '../stores/characterStore.js'
import { refreshDerivedTotals } from './inventoryDataSync.js'

// PLAN_INVENTORY_UX.md Étape 5 — primitives de mutation partagées entre les <select>/boutons existants
// (LocationPanel, ContainerPanel, WeaponPanel, InventoryPanel) et le futur drag & drop. Chaque appelant
// garde sa propre logique de calcul de valeur (slot composite multi-couche pour LocationPanel, code
// container pour ContainerPanel, slot de main pour WeaponPanel...) ; ce module ne porte que l'appel
// réseau + l'écriture store, jusqu'ici dupliqués à l'identique dans les 4 panneaux Matériel. Aucune
// gestion d'erreur ici : chaque appelant garde son propre message i18n contextuel via try/catch.

// confirmEmptyContainer : réservé au déséquipement d'un Sac à dos/Ceinture (slot 'D'/'Ce') dont le
// bac contient encore des objets — le serveur refuse (409) sans cette confirmation explicite et
// renvoie tous les objets déplacés au Coffre par socket s'il l'obtient (INV1, aucun changement direct
// à faire ici : cascadedItems arrive via INVENTORY_UPDATED, useCharacterSocket.js les upsert déjà).
export async function setItemSlot(characterId, itemId, slot, { confirmEmptyContainer } = {}) {
  const res = await api.put(`/char-sheet/${characterId}/inventory/${itemId}`, {
    slot,
    ...(confirmEmptyContainer ? { confirmEmptyContainer } : null),
  })
  useCharacterStore.getState().upsertInventoryItem(characterId, res.data.item)
  refreshDerivedTotals(characterId) // slot D/Ce force un container → poids porté potentiellement affecté
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

// PLAN_WIZARD_MATERIEL_GAUGES.md §4 — MJ only côté serveur (char-sheet.js rejette validated_by_gm
// si !req.isGm), pas de poids affecté ici, pas de refreshDerivedTotals.
export async function validateItem(characterId, itemId) {
  const res = await api.put(`/char-sheet/${characterId}/inventory/${itemId}`, { validated_by_gm: true })
  useCharacterStore.getState().upsertInventoryItem(characterId, res.data.item)
  return res.data.item
}
