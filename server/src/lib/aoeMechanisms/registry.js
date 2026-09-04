// server/src/lib/aoeMechanisms/registry.js
//
// Registre unique des mécanismes de résolution AOE (Segment 1.5, PLAN_ARMES_SPECIALES.md §1.4bis). Un
// `mechanic` (donnée catalogue, `ref_equipment.aoe_profile.mechanic` — shared/combatAoe.js) ↔ une
// entrée ici. Le tronc (socketCombatAoe.js) dispatche exclusivement via `findAoeMechanismEntry`, zéro
// `if (mechanic === ...)`. Même patron que shared/weaponModRegistry.js/findModRegistryEntry — mais
// server-only : les hooks `buildShape`/`computeTargetDamage`/`postResolve` touchent DB/io,
// contrairement aux hooks purs de shared/mods/*.js (vérifié en amont : aucun besoin de réutilisation
// côté client — l'aperçu AOE, client/src/lib/aoePreviewShape.js, a déjà sa propre géométrie,
// délibérément séparée pour la triangulation de rendu, pas une lacune à combler ici).
//
// Ajouter un mécanisme = ajouter une entrée ici, jamais toucher le tronc (+ l'ajouter à
// shared/combatAoe.js#AOE_MECHANICS, autorité d'éligibilité côté déclaration — les deux listes sont
// volontairement distinctes : un `mechanic` peut être éligible à la déclaration avant d'avoir un
// resolver ici, cf. commentaire shared/combatAoe.js:24, rejeté alors avec un message clair).
//
// Forme d'une entrée : { key, buildShape, filterTargets, extraTargets, targetRowModifier,
// computeTargetDamage, postResolve } — voir shotgunSpread.js pour le détail de chaque hook.

import { shotgunSpreadMechanism } from './shotgunSpread.js'
import { flamethrowerMechanism } from './flamethrower.js'

export const AOE_MECHANISM_REGISTRY = [
  { key: 'shotgun_spread', ...shotgunSpreadMechanism },
  { key: 'flamethrower', ...flamethrowerMechanism },
]

// mechanic inconnu → undefined, jamais une erreur ici — le tronc décide seul du message d'erreur
// (comportement inchangé : « résolution de zone «X» pas encore implémentée »).
export function findAoeMechanismEntry(mechanic) {
  return AOE_MECHANISM_REGISTRY.find(entry => entry.key === mechanic)
}
