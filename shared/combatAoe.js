// shared/combatAoe.js
//
// Autorité unique : « cette arme est-elle une arme de zone (AOE) ? » et « quel mécanisme AOE ? ».
// Remplace l'identification par nom en dur (`SHOTGUN_SPREAD_WEAPON_NAMES`, `ref_name === 'Lance-flammes'`)
// — l'AOE-ness est désormais une DONNÉE portée par `ref_equipment.aoe_profile` (JSONB), pas du code.
// Pattern inspiré de Foundry VTT dnd5e (`target.template = { type, size, width, units }` résolu via un
// registre `CONFIG.areaTargetTypes`). Cadre : `docs/PLANS/PLAN_ARMES_SPECIALES.md` §1.6.
//
// Forme de `aoe_profile` :
//   { "shape": "ray" | "cone" | "circle", "mechanic": "<id>", ...params propres au mécanisme }
// Exemples :
//   { "shape": "ray",  "mechanic": "shotgun_spread" }
//   { "shape": "cone", "mechanic": "flamethrower", "angleDeg": 30 }
//
// Les tables mécaniques RAW (dispersion par palier `SHOTGUN_SPREAD_BY_BAND`, feu continu registre
// hazard) restent où elles vivent — le profil ne fait que POINTER vers le bon mécanisme.

import { SHAPES } from './world/aoeShapes.js'

// Mécanismes de résolution AOE câblés — un `mechanic` ↔ une fonction `resolve<X>Targets` côté serveur
// (`server/src/socket/socketCombatAoe.js`). Ajouter une entrée ici EN MÊME TEMPS que le resolver.
// Le dispatch serveur gate sur l'appartenance à cette liste : un profil dont le `mechanic` n'y est
// pas encore est structurellement valide (`getAoeProfile` le renvoie) mais rejeté à la résolution
// avec un message clair — jamais un silence. Tableau gelé (`Object.freeze` sur un `Set` ne bloque
// PAS `.add` — sur un tableau, `.push` lève bien en module ESM).
export const AOE_MECHANICS = Object.freeze([
  'shotgun_spread', // fusil à pompe — cône/couloir + dispersion par palier
  'flamethrower',   // lance-flammes — cône, feu continu, pas de dégression par portée
])

// isKnownAoeMechanic — garde du dispatch serveur (voir commentaire ci-dessus).
export function isKnownAoeMechanic(mechanic) {
  return AOE_MECHANICS.includes(mechanic)
}

// getAoeProfile — normalise la valeur brute de `ref_equipment.aoe_profile` en profil validé, ou null.
// Accepte : objet (JSONB déjà parsé par `pg`), chaîne JSON, null/undefined. Valide la STRUCTURE
// seulement (shape connue + mechanic = chaîne non vide) — l'appartenance de `mechanic` à
// `AOE_MECHANICS` est la garde du dispatch serveur, pas d'ici.
export function getAoeProfile(raw) {
  if (raw == null) return null
  let profile = raw
  if (typeof raw === 'string') {
    try { profile = JSON.parse(raw) }
    catch { return null }
  }
  if (typeof profile !== 'object' || Array.isArray(profile)) return null
  if (!SHAPES.has(profile.shape)) return null
  if (typeof profile.mechanic !== 'string' || profile.mechanic.length === 0) return null
  return profile
}

// isAoeWeapon — l'arme a-t-elle un profil AOE valide ? Remplace `isShotgunSpreadWeapon(ref_name)`
// dans les 3 fenêtres de déclaration (éligibilité « Viser une zone ») et le resolver.
export function isAoeWeapon(raw) {
  return getAoeProfile(raw) !== null
}

// getAoeMechanic — identifiant du mécanisme, ou null. Consommé par le dispatch serveur ET
// `combatExclusiveActions.js` (exclusivité d'une Action de zone décidée par mécanisme, plus par nom).
export function getAoeMechanic(raw) {
  return getAoeProfile(raw)?.mechanic ?? null
}
