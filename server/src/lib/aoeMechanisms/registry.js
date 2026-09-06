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
// Propriété non-hook optionnelle : `losSource` ('caster' par défaut si absente | 'origin') — d'où
// part la LOS de la zone (le tireur pour cône/rayon, le point d'impact pour une grenade). Consommée
// par l'orchestrateur, pas par le dispatch.

import { shotgunSpreadMechanism } from './shotgunSpread.js'
import { flamethrowerMechanism } from './flamethrower.js'
import { grenadeFragMechanism } from './grenadeFrag.js'

export const AOE_MECHANISM_REGISTRY = [
  { key: 'shotgun_spread', ...shotgunSpreadMechanism },
  { key: 'flamethrower', ...flamethrowerMechanism },
  // grenade à fragmentation (PLAN_GRENADES.md §7, Segment 3). Résolution de l'explosion seule ; le
  // lancer / Test de Coordination / dispersion / différé sont l'orchestrateur (3b-3e), pas encore
  // câblé — une grenade déclarée aujourd'hui serait rejetée en amont (aucune ligne `aoe_profile`
  // `grenade_frag` au catalogue avant la migration 3g).
  { key: 'grenade_frag', ...grenadeFragMechanism },
]

// mechanic inconnu → undefined, jamais une erreur ici — le tronc décide seul du message d'erreur
// (comportement inchangé : « résolution de zone «X» pas encore implémentée »).
export function findAoeMechanismEntry(mechanic) {
  return AOE_MECHANISM_REGISTRY.find(entry => entry.key === mechanic)
}
