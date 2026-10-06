// Un item équipable (arme ou protection occupant un emplacement corporel/arme) ne stacke
// jamais : chaque exemplaire reste une ligne char_inventory indépendante (quantity=1),
// slot propre, état de munition propre (current_ammo/ammo_remaining est déjà par-exemplaire
// pour les armes). Seuls les items non équipables (munitions, matériel, consommables)
// peuvent partager une ligne à quantity > 1.
// 'D'/'Ce' : location marquant "fournit un container" (Sac/Ceinture), pas un emplacement
// corporel — ne compte pas comme équipable.
const NON_EQUIP_LOCATIONS = new Set(['D', 'Ce'])

export function isEquippableLocation(location) {
  return location != null && !NON_EQUIP_LOCATIONS.has(location)
}

// GRENADE-STACK-BY-TYPE (2026-10-06) — généralisé après recherche (patron « définition vs instance »
// des inventaires de jeu : un exemplaire ne reste jamais seul s'il porte une donnée propre à lui-même
// — durabilité, charges —, FoundryVTT dnd5e distingue exactement pareil un objet à charges d'un
// consommable groupable). Deux données réellement propres à un exemplaire : `has_integrity` (ITG
// suivie, PLAN_USURE&INTEGRITE.md L1 — une valeur unique sur une pile de N serait indéfinie) et un
// chargeur suivi (`current_ammo`/`ammo_remaining` par exemplaire, posé par `resolveAmmoInit` —
// inventoryService.js — SEULEMENT quand l'item est équipé en main ET porte `caliber`, même garde que
// `weaponAmmoStatus`/`ammoRules.js`). `caliber` seul ne suffit pas : une MUNITION porte aussi un
// `caliber` (le sien — ce qu'elle EST, pas ce qu'elle charge) sans jamais recevoir de chargeur propre
// — testé en base (non-régression) avant de fixer cette règle. Un item équipable sans ITG ni chargeur
// réellement chargeable (grenade, arme de jet, arme de corps à corps basique, armure simple de bas
// niveau technologique...) est un doublon parfait d'un autre exemplaire identique.
// Prend le `ref` catalogue (`{ has_integrity, caliber, location }`), tolère `null`/`undefined` (item
// custom sans equipment_id → stackable).
export function canStack(ref) {
  if (ref?.has_integrity) return false
  if (ref?.caliber && isEquippableLocation(ref?.location ?? null)) return false
  return true
}
