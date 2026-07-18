// shared/weaponSlots.js
//
// Résolution canonique de « l'arme en main » à partir des slots de main (MG/MD/2M/Tr,
// docs/PLAN_INVENTORY_SLOTS.md, char_inventory_slots) — point unique, réutilisé par la route serveur
// `combat-equipment` (PNJ, CombatGmDeclareWindow) et par le fetch client PJ (CombatActionWindow) pour
// que les deux ne divergent jamais (`.claude/rules/core.md` — pas de logique métier dupliquée
// client/serveur). Trouvé Session 158 (Saar) : les deux implémentaient chacune leur propre variante
// incomplète (aucune ne gérait le slot deux-mains `2M`, celle du serveur ne filtrait en plus aucune
// catégorie — un Bouclier en main gauche pouvait être pris pour « l'arme »).
//
// Un item occupant un slot de main n'est une arme que s'il peut infliger des dégâts au combat
// (fire_mode pour le tir, damage_h pour le contact) — discriminant volontairement indépendant de
// `ref_equipment.category` (liste ouverte, une trentaine de catégories d'armes distinctes et
// croissante) plutôt qu'une liste d'inclusion à maintenir à chaque nouvelle catégorie catalogue.

export const HAND_WEAPON_SLOTS = ['MG', 'MD', '2M', 'Tr']

/**
 * @param {{ fire_mode?: string|null, ref_fire_mode?: string|null, damage_h?: string|null, ref_damage_h?: string|null }} item
 */
export function isWeaponItem(item) {
  if (!item) return false
  return Boolean(item.fire_mode ?? item.ref_fire_mode) || Boolean(item.damage_h ?? item.ref_damage_h)
}

/**
 * @param {Array<{ slot: string }>} slotRows — une entrée par (item, slot) occupé, le format déjà
 *   produit par une jointure char_inventory_slots (une ligne par slot — voir flattenItemsBySlot
 *   ci-dessous pour normaliser une API qui renvoie un tableau `slots` par item).
 * @returns {{ weaponMg: object|null, weaponMd: object|null, weapon2M: object|null,
 *   weaponTr: object|null, primaryWeapon: object|null, hasTwoWeapons: boolean }}
 */
export function resolveHandWeapons(slotRows) {
  const weapons = (slotRows ?? []).filter(isWeaponItem)
  const weaponMg = weapons.find(w => w.slot === 'MG') ?? null
  const weaponMd = weapons.find(w => w.slot === 'MD') ?? null
  const weapon2M = weapons.find(w => w.slot === '2M') ?? null
  const weaponTr = weapons.find(w => w.slot === 'Tr') ?? null
  return {
    weaponMg, weaponMd, weapon2M, weaponTr,
    // Un deux-mains occupe déjà les deux mains — jamais de dual-wield avec un 2M actif.
    hasTwoWeapons: Boolean(weaponMg && weaponMd) && !weapon2M,
    // Priorité RAW : le deux-mains d'abord (engage tout le personnage), puis l'arme montée sur
    // trépied, puis la main directrice (MD par défaut — même convention que slotPriority ailleurs,
    // ex. socketCombatHelpers.js resolveMeleeAction, main gauche seulement si explicitement préférée).
    primaryWeapon: weapon2M ?? weaponTr ?? weaponMd ?? weaponMg ?? null,
  }
}

/**
 * Aplatit des items porteurs d'un tableau `slots` (forme renvoyée par
 * inventoryService.getInventory — un item peut couvrir plusieurs slots à la fois, ex. une armure) en
 * une entrée par slot occupé — miroir du format 1-ligne-par-slot déjà renvoyé par la jointure
 * char_inventory_slots côté serveur, que resolveHandWeapons consomme.
 * @param {Array<{ slots?: string[] }>} items
 * @param {string[]} allowedSlots
 */
export function flattenItemsBySlot(items, allowedSlots = HAND_WEAPON_SLOTS) {
  const rows = []
  for (const item of items ?? []) {
    for (const slot of item?.slots ?? []) {
      if (allowedSlots.includes(slot)) rows.push({ ...item, slot })
    }
  }
  return rows
}
