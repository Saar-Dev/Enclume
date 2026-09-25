// inventoryMath.js — calculs purs partagés client/serveur sur l'inventaire (PLAN_INVENTORY_UX.md §3).
// Autorité unique de la formule de poids porté (CLAUDE.md §1.4) : le serveur reste seul à calculer
// threshold/ini_penalty (dérivés de la Force + réglages de campagne, non disponibles côté client),
// mais total_weight est une pure somme sur les items déjà chargés — plutôt que de la dupliquer dans
// inventoryService.js et un module client séparé, les deux importent cette même fonction.

// Poids d'une ligne d'inventaire : poids catalogue × quantité ; un poids absent compte 0 (autorité unique de cette formule).
export function itemWeightKg(item) {
  if (item.ref_weight == null) return 0
  return item.ref_weight * item.quantity
}

// Un item rangé au Coffre (stockage distant) ne compte jamais dans le poids porté.
export function computeTotalWeight(items) {
  return items.reduce((sum, item) => {
    if (item.container === 'Coffre') return sum
    return sum + itemWeightKg(item)
  }, 0)
}

// ─── Capacité des conteneurs (Sac / Ceinture) — règle R5 de « Permuter » (docs/Old/PLAN_PRISE_EN_MAIN.md) ─────────────
// `ref_equipment.capacity` est en kilogrammes ; elle n'était qu'AFFICHÉE (ContainerPanel), jamais contrôlée. Ces fonctions
// pures ne contrôlent rien seules : elles servent à décider si une arme SORTANTE peut être rangée (refus sinon), pour le
// serveur (autorité, à la résolution) comme pour le client (aperçu, grisage) — une seule formule.

// Emplacement (`char_inventory_slots.slot_code`) de l'objet qui FOURNIT chaque conteneur porté.
const CONTAINER_PROVIDER_SLOT = Object.freeze({ Sac: 'D', Ceinture: 'Ce' })

// Tolérance d'arrondi : les poids sont des `real` (0,3 kg = 0.3000000119… en flottant), une somme de trois grenades ne
// vaut pas exactement 0.9. Bien en dessous du gramme, bien au-dessus du bruit de calcul.
const WEIGHT_EPSILON_KG = 1e-6

/**
 * Poids RANGÉ dans un conteneur : les objets qui y sont, sans emplacement. Un objet équipé (arme en main, armure portée, le
 * contenant lui-même) garde `container = 'Sac'` mais occupe un emplacement : il n'est pas « rangé » et ne compte pas.
 * Même formule de poids que le poids porté (`computeTotalWeight` : poids absent = 0, × quantité).
 *
 * @param {Array<{ container?: string, slots?: string[]|null, ref_weight?: number|null, quantity?: number }>} items
 * @param {'Sac'|'Ceinture'} container
 * @returns {number} kg
 */
export function containerFillKg(items, container) {
  return computeTotalWeight((items ?? []).filter(item => item.container === container && !(item.slots?.length)))
}

/**
 * État d'un conteneur porté : est-il équipé (un objet occupe son slot `D` / `Ce`) et quelle capacité annonce-t-il ?
 * `capacityKg = null` = sans limite (bouteille, caisson, extracteur en emplacement `D` : `ref_equipment.capacity` NULL).
 *
 * @param {Array<{ slots?: string[]|null, ref_capacity?: number|string|null }>} items
 * @param {'Sac'|'Ceinture'} container
 * @returns {{ available: boolean, capacityKg: number|null, fillKg: number }}
 */
export function containerState(items, container) {
  const providerSlot = CONTAINER_PROVIDER_SLOT[container]
  const provider = providerSlot ? (items ?? []).find(item => item.slots?.includes(providerSlot)) : null
  const capacity = provider?.ref_capacity
  return {
    available: Boolean(provider),
    capacityKg: capacity == null ? null : Number(capacity),
    fillKg: containerFillKg(items, container),
  }
}

/**
 * Règle « ne jamais empirer » (R5) : après l'échange, le poids rangé ne dépasse ni la capacité du conteneur, ni — s'il la
 * dépassait DÉJÀ — ce qu'il pesait avant. Autrement dit `après ≤ max(capacité, avant)` : un conteneur conforme reste conforme,
 * un conteneur déjà trop plein n'est jamais aggravé (une arme plus légère que celle qui entre rentre toujours).
 * Capacité absente = sans limite.
 *
 * @param {{ capacityKg: number|null, fillKg: number, deltaKg: number }} p
 *   `deltaKg` = (poids des objets qui entrent dans le conteneur) − (poids de celui qui en sort)
 * @returns {boolean}
 */
export function fitsInContainer({ capacityKg, fillKg, deltaKg }) {
  if (capacityKg == null) return true
  const after = fillKg + deltaKg
  return after <= Math.max(capacityKg, fillKg) + WEIGHT_EPSILON_KG
}
