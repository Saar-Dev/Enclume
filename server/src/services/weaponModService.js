// server/src/services/weaponModService.js
// Point d'entrée unique pour les hooks de mods d'armes (docs/PLAN_MODDING_REFONTE.md).
// Phase 1 (socle) : moteur générique seul, shared/weaponModRegistry.js est vide — aucun mod n'a de
// handler tant que Phase 2 (différée, Strangler Fig) ou Phase 4 ne peuplent le registre. Partout où
// resolveModHooks est câblé avant ça, il reste neutre (résultat par défaut, aucun effet).

import db from '../db/knex.js'
import { parseDice } from '../lib/diceParser.js'
import { findModRegistryEntry, WEAPON_MOD_REGISTRY } from '../../../shared/weaponModRegistry.js'

// installedMods : lignes char_inventory_mods jointes à ref_equipment, doivent porter `mod_key`
// (ref_equipment.mod_key), `bonus` (ref_equipment.bonus — niveau de l'appareil, injecté en
// `context.modLevel` par mod, cf. modContext ci-dessous) et `state` (char_inventory_mods.state) pour
// être routées ici. Un mod sans mod_key connu (NULL, ou aucune entrée registre pour ce hook) est
// simplement ignoré — jamais une erreur, comportement identique à "aucun mod installé".
function applicableHandlers(mods, hookName) {
  return (mods ?? [])
    .map(mod => ({ mod, entry: findModRegistryEntry(mod.mod_key) }))
    .filter(({ entry }) => entry?.hooks?.[hookName])
    .sort((a, b) => (a.entry.priority ?? 100) - (b.entry.priority ?? 100))
}

// modLevel est une propriété DU MOD (ref_equipment.bonus — "Test avec le niveau de l'appareil"),
// jamais un champ global du contexte partagé : deux mods actifs simultanément (slots orthogonaux,
// ex. Lunette + ATI) ont chacun leur propre niveau. Injecté ici, un seul endroit, pour qu'aucun
// handler ni appelant n'ait à le recopier depuis mod.bonus lui-même.
function modContext(mod, context) {
  return { ...context, modLevel: mod.bonus ?? null }
}

// onCalculateModifiers — chaque handler ne voit que son propre modState (isolation), les bonus/malus
// sont additionnés indépendamment, breakdowns concaténés dans l'ordre de priority.
async function resolveOnCalculateModifiers(handlers, context) {
  let bonusAttaque = 0
  let bonusDefense = 0
  const breakdowns = []
  for (const { mod, entry } of handlers) {
    const result = await entry.hooks.onCalculateModifiers(mod.state ?? null, modContext(mod, context))
    bonusAttaque += result?.bonusAttaque ?? 0
    bonusDefense += result?.bonusDefense ?? 0
    if (result?.breakdowns?.length) breakdowns.push(...result.breakdowns)
  }
  return { bonusAttaque, bonusDefense, breakdowns }
}

// onBeforeAttack — contexte enchaîné dans l'ordre de priority : un adjustedModifiers retourné par un
// handler est visible par le suivant avant que celui-ci ne décide blocked. Arrêt immédiat sur
// blocked: true, aucun handler suivant appelé.
async function resolveOnBeforeAttack(handlers, context) {
  let adjustedModifiers = null
  for (const { mod, entry } of handlers) {
    const runningContext = adjustedModifiers ? { ...modContext(mod, context), adjustedModifiers } : modContext(mod, context)
    const result = await entry.hooks.onBeforeAttack(mod.state ?? null, runningContext)
    if (result?.blocked) {
      return { blocked: true, reason: result.reason ?? null, adjustedModifiers }
    }
    if (result?.adjustedModifiers) {
      adjustedModifiers = { ...adjustedModifiers, ...result.adjustedModifiers }
    }
  }
  return { blocked: false, reason: null, adjustedModifiers }
}

// onDeclare — Phase 1 Déclaration (ex. coût INI + bonus stocké de la Lunette). Un seul mod du slot
// optique peut être mod_requires_aim=true à la fois (exclusivité garantie à l'installation), sommer
// reste sûr même si registré comme un cas général à N mods.
async function resolveOnDeclare(handlers, context) {
  let iniCostDelta = 0
  let bonusComp = 0
  for (const { mod, entry } of handlers) {
    const result = await entry.hooks.onDeclare(mod.state ?? null, modContext(mod, context))
    iniCostDelta += result?.iniCostDelta ?? 0
    bonusComp += result?.bonusComp ?? 0
  }
  return { iniCostDelta, bonusComp }
}

// onTurnStart — un état par mod, jamais fusionné (isolation) : le résultat reste un tableau pour que
// l'appelant (Phase 3, startResolutionPhase) persiste chaque état sur sa propre ligne
// char_inventory_mods.
async function resolveOnTurnStart(handlers, context) {
  const results = []
  for (const { mod, entry } of handlers) {
    const result = await entry.hooks.onTurnStart(mod.state ?? null, modContext(mod, context))
    results.push({ mod, updatedState: result?.updatedState ?? null, tokenEffects: result?.tokenEffects ?? [] })
  }
  return results
}

const RESOLVERS = {
  onDeclare: resolveOnDeclare,
  onTurnStart: resolveOnTurnStart,
  onBeforeAttack: resolveOnBeforeAttack,
  onCalculateModifiers: resolveOnCalculateModifiers,
}

export async function resolveModHooks(mods, hookName, context) {
  const resolver = RESOLVERS[hookName]
  if (!resolver) throw new Error(`[weaponModService] hook inconnu: ${hookName}`)
  const handlers = applicableHandlers(mods, hookName)
  // rollDice injecté ici (Phase 3, docs/PLAN_MODDING_REFONTE.md §3.3) — un seul endroit, aucun
  // appelant de resolveModHooks n'a à s'en souvenir. Basé sur parseDice (async, cf. correctif
  // "signatures pures fausses" du plan) : ATI/Mémoire/Projecteur (Phase 4) l'utiliseront pour leurs
  // Tests "avec le niveau de l'appareil".
  const enrichedContext = { ...context, rollDice: parseDice }
  return resolver(handlers, enrichedContext)
}

// getAllCombatMods(campaignId) — Phase 3 (docs/PLAN_MODDING_REFONTE.md §3.1). Tous les mods
// installés sur toute arme de chaque personnage en lice dans ce combat, avec leur state — pas
// seulement l'arme d'une action précise (contrairement à fetchAssaultWeaponAndMods, propre à la
// Résolution d'un tir). Un mod à état (Groupe 4, ex. ATI) doit ticker à chaque tour indépendamment
// de l'arme effectivement utilisée ce tour-là.
export async function getAllCombatMods(campaignId) {
  const rows = await db('combat_roster as roster')
    .join('tokens', 'roster.token_id', 'tokens.id')
    .join('char_inventory as ci', 'tokens.character_id', 'ci.character_id')
    .join('char_inventory_mods as cim', 'cim.weapon_inv_id', 'ci.id')
    .join('ref_equipment as re', 'cim.equipment_id', 're.id')
    .where({ 'roster.campaign_id': campaignId, 'roster.status': 'active' })
    .select('roster.token_id', 'cim.id', 're.mod_key', 're.bonus', 'cim.state')

  const byToken = new Map()
  for (const row of rows) {
    if (!byToken.has(row.token_id)) byToken.set(row.token_id, [])
    byToken.get(row.token_id).push({ id: row.id, mod_key: row.mod_key, bonus: row.bonus, state: row.state })
  }
  return Array.from(byToken, ([tokenId, mods]) => ({ tokenId, mods }))
}

// getAllModStatusCodes() — union des `statusCodes` optionnels déclarés par chaque entrée du
// registre (badges token_statuses qu'un mod peut poser, ex. ati_offensive/ati_defensive). Lu
// dynamiquement à COMBAT_END (Phase 3.4) pour savoir quels codes nettoyer, sans jamais les lister en
// dur ailleurs que dans le registre lui-même (autorité unique).
export function getAllModStatusCodes() {
  return WEAPON_MOD_REGISTRY.flatMap(entry => entry.statusCodes ?? [])
}
