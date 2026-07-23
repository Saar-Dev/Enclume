// shared/weaponModRegistry.js — Registre unique des mods d'armes (docs/PLAN_MODDING_REFONTE.md).
// Chaque entrée route un `mod_key` (donnée catalogue, ref_equipment.mod_key — jamais une liste
// d'equipment_id en dur ici, cf. précédent PF2e Rule Elements cité dans le plan) vers ses handlers
// de hooks. Vide en Phase 1 (socle) : peuplé phase par phase (Phase 4 pour Groupe 4 ; Phase 2,
// différée — Strangler Fig — pour Groupe 1/2).
//
// Forme d'une entrée : { key, priority, hooks, statusCodes? }
// - statusCodes (optionnel, Phase 3) : codes token_statuses que ce mod peut poser via onTurnStart
//   (ex. ['ati_offensive', 'ati_defensive']). Lu par weaponModService.getAllModStatusCodes() pour le
//   nettoyage générique à COMBAT_END — un mod qui pose un badge doit déclarer son code ici, jamais
//   ailleurs, pour que le nettoyage reste automatique et ne dérive jamais du registre réel.

import { atiOnTurnStart, atiOnCalculateModifiers } from './mods/ati.js'
import { memoireOnBeforeAttack } from './mods/memoire.js'
import { projecteurOnBeforeAttack } from './mods/projecteur.js'

// Groupe 4 (docs/PLAN_MODDING_REFONTE.md Phase 4) — ATI/Mémoire/Projecteur partagent tous les trois
// le slot exclusif 'logiciel' (docs/PLAN_MODING_PHASEB.md, migration 141) : au plus un seul actif à
// la fois sur une même arme, jamais deux simultanément pour un même tir. priority identique (100,
// défaut) — l'ordre entre eux n'a donc aucun effet observable dans ce cas précis.
export const WEAPON_MOD_REGISTRY = [
  {
    key: 'ati',
    priority: 100,
    hooks: { onTurnStart: atiOnTurnStart, onCalculateModifiers: atiOnCalculateModifiers },
    statusCodes: ['ati_offensive', 'ati_defensive'],
  },
  {
    key: 'memoire',
    priority: 100,
    hooks: { onBeforeAttack: memoireOnBeforeAttack },
  },
  {
    key: 'projecteur',
    priority: 100,
    hooks: { onBeforeAttack: projecteurOnBeforeAttack },
  },
]

// mod_key inconnu ou NULL → undefined, jamais une erreur : resolveModHooks doit rester neutre pour
// tout mod sans handler enregistré (comportement actuel inchangé tant qu'une phase ne le couvre pas).
export function findModRegistryEntry(modKey) {
  return WEAPON_MOD_REGISTRY.find(entry => entry.key === modKey)
}
