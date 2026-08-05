// inventoryMath.js — calculs purs partagés client/serveur sur l'inventaire (PLAN_INVENTORY_UX.md §3).
// Autorité unique de la formule de poids porté (CLAUDE.md §1.4) : le serveur reste seul à calculer
// threshold/ini_penalty (dérivés de la Force + réglages de campagne, non disponibles côté client),
// mais total_weight est une pure somme sur les items déjà chargés — plutôt que de la dupliquer dans
// inventoryService.js et un module client séparé, les deux importent cette même fonction.

// Un item rangé au Coffre (stockage distant) ne compte jamais dans le poids porté.
export function computeTotalWeight(items) {
  return items.reduce((sum, item) => {
    if (item.container === 'Coffre') return sum
    if (item.ref_weight == null) return sum
    return sum + item.ref_weight * item.quantity
  }, 0)
}
