// shared/ammoRules.js — règle unique "munitions suffisantes pour tirer" (COM25).
// Fonction pure, aucun accès DB : réutilisée à la Déclaration (fail-fast, socketCombatAnnouncement.js)
// et à la Résolution (autorité, resolveAssaultAction dans socketCombatHelpers.js) pour éviter toute
// dérive entre les deux points de contrôle — même pattern que shared/combatRange.js.
export function hasEnoughAmmo(ammoRemaining, bulletCount, { isPnj = false, pnjUnlimitedAmmo = false } = {}) {
  if (ammoRemaining === null || ammoRemaining === undefined) return true // tracking désactivé (arme sans chargeur suivi)
  if (isPnj && pnjUnlimitedAmmo) return true
  return ammoRemaining >= (bulletCount ?? 1)
}

// parseAmmoCapacity — extrait la capacité numérique d'un chargeur depuis `ref_equipment.ammo_count`
// (colonne texte, ex. "7", "10 (2x)") — autorité unique, réutilisée par weaponAmmoStatus ci-dessous et
// par la validation munitions Tir Multi (socketCombatAnnouncement.js, docs/PLAN_TIRMULTI.md).
export function parseAmmoCapacity(ammoCountRaw) {
  if (ammoCountRaw == null) return null
  const match = String(ammoCountRaw).match(/\d+/)
  return match ? parseInt(match[0], 10) : null
}

// initialMagazineOnEquip — chargeur PLEIN donné à une arme à calibre à sa toute première mise en main (`ammo_remaining` encore
// NULL), sans consommer de stock (Session 81, 2026-06-04 : correctif voulu, sans lui le bouton de tir restait grisé ; règle
// conservée par la décision R16 de PLAN_PRISE_EN_MAIN.md). Autorité UNIQUE : le serveur (`inventoryService.resolveAmmoInit`,
// à l'écriture) et le client (aperçu d'une permutation, `applyDeclaredSwap`) l'appellent — l'aperçu affiche ce que le serveur
// écrira, jamais une copie de la règle. `null` = pas de suivi de chargeur : arme sans calibre (CaC, Choc…) ou capacité illisible.
export function initialMagazineOnEquip(caliber, ammoCountRaw) {
  if (!caliber) return null
  const capacity = parseAmmoCapacity(ammoCountRaw)
  return capacity != null && capacity > 0 ? capacity : null
}

// weaponAmmoStatus — statut visuel munitions d'une arme équipée (COM28), utilisé par
// CombatActionWindow.jsx et CombatGmDeclareWindow.jsx. Autorité : `caliber` non nul, même condition
// que resolveAmmoInit (server/src/services/inventoryService.js) pour l'auto-init munitions à
// l'équipement — une arme sans calibre (CaC, choc électrique...) n'a jamais de munitions trackées,
// même si son ref_ammo_count catalogue porte une valeur sans rapport (ex. charges de choc Matraque Mao).
export function weaponAmmoStatus(ammoRemaining, ammoCountRaw, caliber) {
  if (!caliber) return null
  const capacity = parseAmmoCapacity(ammoCountRaw)
  if (!capacity) return null
  const remaining = ammoRemaining ?? 0
  if (remaining <= 0) return 'empty'
  if (remaining / capacity <= 0.25) return 'low'
  return 'ok'
}

// ammoMatchesWeapon — règle unique « cette munition va dans cette arme » : même calibre, non vide.
// Autorité partagée par le serveur (COMBAT_ITEM_UPDATE `current_ammo`, rechargement), le combat
// (fenêtre de déclaration), la fiche (WeaponPanel) et les suggestions d'inventaire
// (itemSuggestions.js). `ref_equipment.caliber` est le seul lien arme ↔ munition ; la table
// `ref_equipment_ammo_compat` n'est pas lue (vide, jamais alimentée). Deux calibres absents ne sont
// JAMAIS compatibles : une arme sans calibre n'a pas de munition suivie (weaponAmmoStatus).
export function ammoMatchesWeapon(weaponCaliber, ammoCaliber) {
  return !!weaponCaliber && !!ammoCaliber && weaponCaliber === ammoCaliber
}

// isCompatibleAmmoItem — une ligne d'INVENTAIRE est-elle une munition utilisable pour recharger une arme de ce calibre ? Armes ET munitions
// portent `ref_equipment.caliber` : le calibre seul ferait passer pour « munition » une arme rangée du même calibre (le combat l'a fait,
// la fiche jamais) — d'où la famille. Un objet au Coffre (stockage distant) n'est pas à portée. Autorité unique de la fiche (WeaponPanel)
// et de la fenêtre de déclaration de combat (rechargement) ; `item` = ligne de `inventoryService.getInventory` (`ref_family`, `ref_caliber`).
export const AMMO_FAMILY = 'Munitions'
export function isCompatibleAmmoItem(item, weaponCaliber) {
  return item?.ref_family === AMMO_FAMILY
    && ammoMatchesWeapon(weaponCaliber, item.ref_caliber)
    && item.container !== 'Coffre'
}
