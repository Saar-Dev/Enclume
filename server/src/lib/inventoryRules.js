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

// Grenade / Armes de jet (migration 333_ref_equipment_thrown_no_integrity.js, décision Saar
// 2026-09-09) : mêmes catégories, même raison déjà actée — consommables tenus en main (location
// équipable) mais SANS aucun état propre à l'exemplaire (jamais d'Intégrité depuis 333, jamais de
// munition chargée, jamais de mod — GRENADE-ACCEPTS-WEAPON-MODS exige déjà `fire_mode` pour en
// recevoir un, que ces catégories n'ont jamais). La règle « équipable = jamais stackable » existe
// pour protéger un état par-exemplaire qui, ici, ne peut structurellement pas exister : l'exception
// ne contourne pas l'invariant, elle constate qu'il ne s'applique pas à ces deux catégories.
const STACKABLE_DESPITE_EQUIPPED_CATEGORIES = new Set(['Grenade', 'Armes de jet'])

// Un item ne peut partager une ligne d'inventaire (quantity > 1) que s'il n'est NI équipable NI
// soumis au suivi d'Intégrité (`ref_equipment.has_integrity`, PLAN_USURE&INTEGRITE.md L1) : l'ITG
// est la propriété d'un objet physique unique — une valeur unique sur une pile de N serait
// indéfinie. Exception ci-dessus pour les deux catégories qui n'ont jamais cet état. Prend le `ref`
// catalogue (`{ location, has_integrity, category }`), tolère `null`/`undefined` (item custom sans
// equipment_id → stackable s'il n'a pas de location équipable).
export function canStack(ref) {
  if (STACKABLE_DESPITE_EQUIPPED_CATEGORIES.has(ref?.category)) return !ref?.has_integrity
  return !isEquippableLocation(ref?.location ?? null) && !ref?.has_integrity
}
