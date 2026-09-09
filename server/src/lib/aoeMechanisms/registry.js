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
// Propriétés non-hook OPTIONNELLES (capacités de flux, lues par `resolveAoeAssaultAction` avec un
// défaut = comportement historique ; un mécanisme ne déclare QUE ce qui diffère) :
//   `needsWeaponRange` (défaut true)  — l'amplitude vient de `weapon.ref_range` ; false → du mécanisme.
//   `decrementsAmmo`   (défaut true)  — une cartouche décrémentée par résolution ; false → jamais.
//   `losSource`        (défaut 'caster' | 'origin') — LOS depuis le tireur ou depuis le point d'impact.
// Consommées par l'orchestrateur, jamais par le dispatch.

import { shotgunSpreadMechanism } from './shotgunSpread.js'
import { flamethrowerMechanism } from './flamethrower.js'
import { grenadeFragMechanism } from './grenadeFrag.js'
import { grenadeEnergyMechanism } from './grenadeEnergy.js'

export const AOE_MECHANISM_REGISTRY = [
  { key: 'shotgun_spread', ...shotgunSpreadMechanism },
  { key: 'flamethrower', ...flamethrowerMechanism },
  // grenade à fragmentation (PLAN_GRENADES.md §7, Segment 3) — dégression par palier + éclats.
  { key: 'grenade_frag', ...grenadeFragMechanism },
  // grenade à énergie (PLAN_GRENADES.md §6, Segment 3-bis) — champ d'énergie uniforme, rayon fixe,
  // pas de dégression / Choc / statut. Squelette cercle partagé : circleGrenade.js.
  { key: 'grenade_energy', ...grenadeEnergyMechanism },
]

// mechanic inconnu → undefined, jamais une erreur ici — le tronc décide seul du message d'erreur
// (comportement inchangé : « résolution de zone «X» pas encore implémentée »).
export function findAoeMechanismEntry(mechanic) {
  return AOE_MECHANISM_REGISTRY.find(entry => entry.key === mechanic)
}
