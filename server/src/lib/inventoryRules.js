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
