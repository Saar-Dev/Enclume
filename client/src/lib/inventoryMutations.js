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

// PLAN_USURE&INTEGRITE.md §6 — édition d'ITG (MJ ou propriétaire, D3). La route PUT route les 3
// champs (`integrity_current` / `integrity_max` / `malfunction_severity`) vers
// `integrityService.adjustIntegrity` (autorité serveur, verrou, validation de cohérence).
// `changes` : sous-ensemble de ces 3 clés — `malfunction_severity: null` remet « Opérationnel ».
// Poids porté non affecté (l'ITG ne change pas la masse) → pas de refreshDerivedTotals.
export async function setItemIntegrity(characterId, itemId, changes) {
  const res = await api.put(`/char-sheet/${characterId}/inventory/${itemId}`, changes)
  useCharacterStore.getState().upsertInventoryItem(characterId, res.data.item)
  return res.data.item
}

// PLAN_USURE&INTEGRITE.md §5.3 — « Lancer ITG occasion » (MJ only côté serveur) : réétablit l'ITG
// comme un achat d'occasion (ITG max de la qualité, courante = jet de la formule d'occasion).
export async function rollItemOccasionIntegrity(characterId, itemId) {
  const res = await api.post(`/char-sheet/${characterId}/inventory/${itemId}/roll-integrity`)
  useCharacterStore.getState().upsertInventoryItem(characterId, res.data.item)
  return res.data.item
}

// PLAN_USURE&INTEGRITE.md §9 — bouton « Usage intensif » (MJ only) : ITG <= 5 → panne systématique,
// au-dessus → test de panne (1D20 sous l'ITG). Renvoie { item, panne }.
export async function intensiveUseTest(characterId, itemId) {
  const res = await api.post(`/char-sheet/${characterId}/inventory/${itemId}/panne-test`)
  useCharacterStore.getState().upsertInventoryItem(characterId, res.data.item)
  return res.data
}

// PLAN_USURE&INTEGRITE.md §8 (L6) — « Réparer soi-même » : crée une demande de réparation en attente
// de validation MJ. Ne change pas l'item (l'ITG bougera au jet, après approbation) → pas d'upsert.
// Renvoie { echeance: { id, status } }.
export async function requestRepair(characterId, itemId) {
  const res = await api.post(`/char-sheet/${characterId}/inventory/${itemId}/repair-request`)
  return res.data
}

// L6c — Seuil prévisionnel d'une réparation soi-même (affiché avant la demande). Read-only.
// Renvoie { skillLabel, skillTotal, ntMalus, activeMalus, threshold }.
export async function fetchRepairPreview(characterId, itemId) {
  const res = await api.get(`/char-sheet/${characterId}/inventory/${itemId}/repair-preview`)
  return res.data
}

// PLAN_USURE&INTEGRITE.md §8 (L6c-B) — « Annuler ma demande » : l'échéance de réparation encore
// vivante passe 'cancelled' (même logique que l'annulation d'une offre de revente). Le serveur émet
// INVENTORY_UPDATED (repair_request_status → null) → pas d'upsert local ici.
export async function cancelRepairRequest(characterId, itemId) {
  const res = await api.post(`/char-sheet/${characterId}/inventory/${itemId}/repair-cancel`)
  return res.data
}
