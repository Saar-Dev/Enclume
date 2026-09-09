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

// Un item ne peut partager une ligne d'inventaire (quantity > 1) que s'il n'est NI équipable NI
// soumis au suivi d'Intégrité (`ref_equipment.has_integrity`, PLAN_USURE&INTEGRITE.md L1) : l'ITG
// est la propriété d'un objet physique unique — une valeur unique sur une pile de N serait
// indéfinie. Prend le `ref` catalogue (`{ location, has_integrity }`), tolère `null`/`undefined`
// (item custom sans equipment_id → stackable s'il n'a pas de location équipable).
export function canStack(ref) {
  return !isEquippableLocation(ref?.location ?? null) && !ref?.has_integrity
}
