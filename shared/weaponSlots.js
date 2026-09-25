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
// Un item occupant un slot de main n'est une arme que s'il peut infliger un effet de combat — tir
// (fire_mode), dégât physique au contact (damage_h), ou Choc (shock, docs/PLAN_CHOC1.md/SYSTEME/
// DOMMAGES.md : une arme « Choc pur » comme la Dague neurale n'a ni fire_mode ni damage_h, elle
// disparaîtrait sinon complètement de la détection — bug réel trouvé Session CHOC1, côté MJ/PNJ
// uniquement, la Dague neurale n'était jamais reconnue comme arme en main) — discriminant
// volontairement indépendant de `ref_equipment.category` (liste ouverte, une trentaine de catégories
// d'armes distinctes et croissante) plutôt qu'une liste d'inclusion à maintenir à chaque nouvelle
// catégorie catalogue.

export const HAND_WEAPON_SLOTS = ['MG', 'MD', '2M', 'Tr']

/**
 * Comment un objet se tient à la main, d'après son emplacement catalogue (`ref_equipment.location`) — autorité unique,
 * consommée par la fiche (WeaponPanel : où équiper) ET par « Permuter » en combat (PLAN_PRISE_EN_MAIN.md : quel objet
 * peut être pris en main, dans quelle main). Déplacée depuis WeaponPanel.jsx, comportement inchangé : la fiche et le combat
 * ne peuvent plus diverger sur « ce qui se tient à une main / deux mains / sur trépied ».
 *
 * Valeurs réelles du catalogue pour un objet tenu : `M` (une main, boucliers compris), `2M`, `Tr` (trépied pur), `2M/Tr`
 * (arme lourde tenable à deux mains OU montée sur trépied — par défaut à deux mains).
 *
 * @param {string|null|undefined} refLocation
 * @returns {{ type: '1H'|'2M_Tr'|'2M'|'Tr'|'unknown', defaultSlot: string }}
 */
export function getSlotInfo(refLocation) {
  const locs = (refLocation || '').split('/')
  if (locs.includes('M'))                          return { type: '1H',    defaultSlot: 'MG' }
  if (locs.includes('2M') && locs.includes('Tr')) return { type: '2M_Tr', defaultSlot: '2M' }
  if (locs.includes('2M'))                         return { type: '2M',    defaultSlot: '2M' }
  if (locs.includes('Tr'))                         return { type: 'Tr',    defaultSlot: 'Tr' }
  return { type: 'unknown', defaultSlot: '' }
}

/**
 * @param {{ fire_mode?: string|null, ref_fire_mode?: string|null, damage_h?: string|null, ref_damage_h?: string|null, shock?: string|null, ref_shock?: string|null }} item
 */
export function isWeaponItem(item) {
  if (!item) return false
  return Boolean(item.fire_mode ?? item.ref_fire_mode)
      || Boolean(item.damage_h ?? item.ref_damage_h)
      || Boolean(item.shock ?? item.ref_shock)
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
 * Lignes d'affichage « arme(s) en main » (ARMEMENT, COM20/COM2) — autorité unique de l'ordre et de la
 * règle de préfixe, consommée à l'identique par CombatGmDeclareWindow.jsx (PNJ) et
 * CombatActionWindow.jsx (PJ) pour qu'elles ne divergent plus jamais. Trouvé Session 158+ (Saar) :
 * chaque composant maintenait son propre tableau `[['MG', w], ['MD', w]]` en dur — l'ajout du 2M
 * Session 158 n'a été répercuté que côté PJ (COM2), et `Tr` (arme montée sur trépied, slot réel —
 * `inventoryService.js` WEAPON_SLOTS) n'a jamais été ajouté nulle part.
 *
 * @param {{ MG?: object|null, MD?: object|null, '2M'?: object|null, Tr?: object|null }} weaponsBySlot
 * @returns {{ rows: Array<{ slot: string, weapon: object }>, showSlotLabel: boolean }}
 */
export function handSlotDisplayRows(weaponsBySlot) {
  const rows = HAND_WEAPON_SLOTS
    .map(slot => ({ slot, weapon: weaponsBySlot?.[slot] ?? null }))
    .filter(r => r.weapon)
  // Une seule main occupée (MG seul ou MD seul) : pas de préfixe (ambigu autrement). Toute autre
  // configuration (plusieurs mains occupées, ou une main "spéciale" seule type 2M/Tr) précise le slot.
  const showSlotLabel = rows.length > 1 || (rows.length === 1 && !['MG', 'MD'].includes(rows[0].slot))
  return { rows, showSlotLabel }
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
