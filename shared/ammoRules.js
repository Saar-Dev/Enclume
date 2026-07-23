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
