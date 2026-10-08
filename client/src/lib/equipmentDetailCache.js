// client/src/lib/equipmentDetailCache.js
// Détail complet d'une ligne ref_equipment (GET /equipment/:id, déjà utilisée par
// EquipmentCatalogPage.jsx) — même route, pas une copie serveur : plusieurs lignes d'inventaire
// identiques (ex. 5 grenades du même modèle) partagent le même equipment_id, donc le même résultat,
// mis en cache ici pour qu'ouvrir le détail d'une 2ᵉ ligne du même objet ne refasse pas l'appel.
// Cache mémoire volontairement simple (Map, jamais invalidée) : ref_equipment est un catalogue de
// référence, pas une donnée de partie qui change pendant une session.
import api from './api.js'

const cache = new Map() // equipmentId -> Promise<item>

export function fetchEquipmentDetail(equipmentId) {
  if (!cache.has(equipmentId)) {
    const promise = api.get(`/equipment/${equipmentId}`)
      .then(res => res.data.item)
      .catch(err => { cache.delete(equipmentId); throw err })
    cache.set(equipmentId, promise)
  }
  return cache.get(equipmentId)
}
