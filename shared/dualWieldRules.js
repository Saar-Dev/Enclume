// shared/dualWieldRules.js — décision unique "quelle main tire" pour un Tir à deux armes (COM29,
// docs/REGLES/REGLESYSCOMBAT.md p.226). Fonction pure, aucun accès DB : réutilisée à l'identique par
// la Déclaration (fail-fast, socketCombatAnnouncement.js) et la Résolution (autorité,
// resolveAssaultAction dans socketCombatHelpers.js) pour éviter toute dérive entre les deux points de
// contrôle — même pattern que shared/ammoRules.js::hasEnoughAmmo (dont ce module consomme le résultat,
// sans dupliquer sa logique de comptage de munitions : responsabilité distincte, arbitrage de tir).
//
// Règle produit (Saar) : jamais de blocage total tant qu'une main peut encore tirer — l'autre main à
// sec dégrade en tir simple (bonus deux armes annulé), jamais un refus d'agir.
/**
 * @param {{ primaryAmmoOk: boolean, offhandAmmoOk?: boolean, isDualWield: boolean }} params
 * @returns {{ fires: 'both'|'primary'|'offhand'|null, dualWieldApplied: boolean,
 *   degraded: 'primary'|'offhand'|null }} degraded = la main qui n'a pas pu tirer, si dégradation.
 */
export function resolveDualWieldFire({ primaryAmmoOk, offhandAmmoOk = false, isDualWield }) {
  if (!isDualWield) return { fires: primaryAmmoOk ? 'primary' : null, dualWieldApplied: false, degraded: null }
  if (primaryAmmoOk && offhandAmmoOk) return { fires: 'both', dualWieldApplied: true, degraded: null }
  if (primaryAmmoOk) return { fires: 'primary', dualWieldApplied: false, degraded: 'offhand' }
  if (offhandAmmoOk) return { fires: 'offhand', dualWieldApplied: false, degraded: 'primary' }
  return { fires: null, dualWieldApplied: false, degraded: null }
}
