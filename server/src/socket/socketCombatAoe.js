// server/src/socket/socketCombatAoe.js
//
// Résolution de zone d'effet (AOE) en combat — extrait de socketCombatHelpers.js (2026-09-04,
// PLAN_ARMES_SPECIALES.md §1.4 segment 0a). Tronc mince : les mécanismes spécifiques (fusil à pompe,
// lance-flammes) vivent dans server/src/lib/aoeMechanisms/ (registre, Segment 1.5, PLAN_ARMES_SPECIALES.md
// §1.4bis) — ce fichier ne connaît plus aucun `if (mechanic === ...)`, il dispatche via
// findAoeMechanismEntry et n'orchestre que ce qui est générique à tout mécanisme AOE (jet unique,
// munitions, persistance, application par cible, finalisation).
// Graphe d'import : ce module importe lib/services + le registre AOE + 5 symboles de
// socketCombatHelpers.js (resolveCriticalFailReroll, fetchAssaultWeaponAndMods,
// resolveDroneIntegrityLoss, SITUATION_LABELS, TAILLE_LABELS) — jamais l'inverse.
// socketCombatResolution.js importe resolveAoeAssaultAction d'ici.

import { WS } from '../../../shared/events.js'
import db from '../db/knex.js'
import { parseDice } from '../lib/diceParser.js'
import { computeAttackRoll } from '../lib/combatAttackRoll.js'
import { applyCriticalSuccessBonus, getCriticalSuccessBonus, resolveChanceTest } from '../../../shared/polarisTestResolution.js'
import { RANGED_SITUATION_MODS, isImpossibleRangedSituation, TAILLE_MODS } from '../../../shared/combatSituationMods.js'
import { isTestBlockingWound } from '../../../shared/woundConstants.js'
import { parseWeaponRangeBands } from '../../../shared/combatRange.js'
import { getAoeMechanic, normalizeGrenadeDetonation } from '../../../shared/combatAoe.js'
import { calcDroneDegatsNets } from '../lib/charStats.js'
import * as damageService from '../lib/damageService.js'
import * as statusService from '../lib/statusService.js'
import * as exoAvarieService from '../lib/exoAvarieService.js'
import { maybeTriggerCatastrophe } from '../lib/catastropheService.js'
import { openChanceChoice, SITE_HANDLERS } from '../lib/chanceCatastropheChoiceService.js'
import { spendChancePoints } from '../services/chanceService.js'
import { advanceTimeline, combatTimers, combatPreviews } from './combatTurnEngine.js'
import { evaluateAoeVisibility } from '../services/worldVisibilityService.js'
import { getBattlemapWorldSnapshot } from '../services/worldService.js'
import { getCampaignSettings } from '../lib/campaignSettingsService.js'
import { resolveCombatantTestContext, resolveCombatantDisplayIdentity } from '../lib/combatantContextService.js'
import { resolveScatter } from '../../../shared/world/aoeShapes.js'
import { dbPositionToWorldPoint } from '../../../shared/world/worldMetrics.js'
import { findAoeMechanismEntry } from '../lib/aoeMechanisms/registry.js'
import {
  resolveCriticalFailReroll,
  fetchAssaultWeaponAndMods,
  fetchDroneWeapon,
  resolveDroneIntegrityLoss,
  resolveChanceRecipientCharacterId,
  flushDeferredEmissions,
  SITUATION_LABELS,
  TAILLE_LABELS,
} from './socketCombatHelpers.js'
// fetchExoWeapon — import socket→socket (socketCombatExo.js n'importe jamais socketCombatAoe.js,
// vérifié : aucun cycle, même pattern que socketCombatResolution.js qui importe déjà les deux).
// Volontairement PAS dans server/src/lib/ : un adaptateur générique y aurait dû importer CE module
// (lib→socket, sens interdit partout ailleurs dans ce projet, vérifié par grep) pour réutiliser
// fetchAssaultWeaponAndMods/fetchExoWeapon — l'adaptateur reste donc ici, dans le tronc AOE lui-même
// (Segment 2, PLAN_ARMES_SPECIALES.md §1.4bis), pas un fichier lib/ séparé.
import { fetchExoWeapon } from './socketCombatExo.js'

// ─── Couche 4 AOE (docs/PLANS/PLAN_AOE.md §8 étape 8, phase A) ────────────────
//
// resolveAoeAttackRoll — UN SEUL Test de tir pour toute une action à zone d'effet (fusil à pompe,
// tir de suppression...), jamais un jet par cible. RAW (fusil à pompe) : "même sur un échec au Test
// de tir, les cibles peuvent être touchées, en revanche le modificateur d'échec réduit les
// dommages" — auto-touché pour tout le monde dans la zone, la marge de CE jet module ensuite le
// dégât de chaque cible individuellement (couche 4 phase B, par cible — dégression §4, couverture
// individuelle depuis evaluateAoeVisibility).
//
// Volontairement PAS resolveAssaultAction en boucle : ce jet exclut les 3 contributions propres à
// UNE cible précise que resolveAssaultAction mélange dans le même jet (couverture cible, bouclier
// adverse, cible sans défense — lignes ~3031-3041) puisqu'il n'y a pas "une" cible ici. Elles se
// déplacent en phase B, calculées par cible à partir des données déjà produites par la couche 3.
//
// Patron validé par triangulation externe (2026-08-27) : le système dnd5e de Foundry VTT (seul
// morceau de l'écosystème Foundry réellement open source, contrairement au cœur) sépare exactement
// ainsi une AOE — AttackActivity fait un jet unique, DamageApplication l'applique ensuite par cible
// séparément, avec résistances/immunités individuelles. Même séparation ici, adaptée aux primitives
// déjà partagées de ce projet (computeAttackRoll, applyCriticalSuccessBonus, resolveCriticalFailReroll
// ci-dessus) — aucune resaisie de la logique de résolution de Test, jamais un second noyau.
//
// `contributions` : liste de modificateurs INDÉPENDANTS de toute cible (portée du centre de la zone,
// mode de tir, malus santé/encombrement...) — à l'appelant de les assembler, cette fonction ne
// connaît rien du domaine combat au-delà du noyau de jet partagé.
export async function resolveAoeAttackRoll({ skillTotal, skillMastery, contributions = [] }) {
  const { total: rollAttaque, rolls: attackRolls, seed: attackSeed } = await parseDice('1d20')
  const outcome0 = computeAttackRoll({
    skillLabel: 'Compétence', skillTotal, totalLabel: 'Seuil', rollAttaque, contributions,
  })
  const outcomeCrit = applyCriticalSuccessBonus(outcome0, getCriticalSuccessBonus({ masteryLevel: skillMastery }))
  const outcome = await resolveCriticalFailReroll(outcomeCrit)
  return { ...outcome, rollAttaque, attackRolls, attackSeed }
}

// ─── Helpers du tronc AOE (segment 0d) — génériques à tout mécanisme de zone ───────────────────────

// runAoePhaseA — le jet unique (Phase A) + le contexte de Test du tireur. RAW : un seul Test de tir
// par action de zone, jamais un jet par cible ; la marge module le dégât, jamais un hit/miss global.
// Retourne `{ blocked }` (Blessure mortelle) ou `{ rollResult, diceEmission, tireurColor, tireurUsername }`.
// La catastrophe automatique reste à l'appelant (ordre d'émission identique à l'historique).
async function runAoePhaseA({ character, weapon, confirmedModifiers }) {
  const skillAssoc = await db('ref_equipment_skill_assoc').where({ item_id: weapon.equipment_id }).first()
  const ctxTireur = await resolveCombatantTestContext(db, character, skillAssoc?.skill_id ?? '')
  if (ctxTireur) {
    const woundsTireur = await db('character_wounds').where({ char_sheet_id: ctxTireur.sheetId })
    if (isTestBlockingWound(woundsTireur)) {
      return { blocked: { to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
        username: character.name, message: 'Blessure mortelle — aucune action de Test possible',
      } } }
    }
  }
  const skillTotal = ctxTireur?.skillTotal ?? 0
  const tailleModComp = TAILLE_MODS[confirmedModifiers?.taille]?.mod ?? 0
  const situationMods = confirmedModifiers?.situation ?? []
  const rollResult = await resolveAoeAttackRoll({
    skillTotal, skillMastery: ctxTireur?.mastery ?? 0,
    contributions: [
      { label: 'Malus santé / encombrement', value: ctxTireur?.effectiveMalus ?? 0, type: 'malus' },
      ...situationMods.reduce((acc, k) => {
        const v = RANGED_SITUATION_MODS[k]?.mod
        if (v !== undefined && v !== 0) acc.push({ label: SITUATION_LABELS[k] ?? k, value: v, type: v > 0 ? 'bonus' : 'malus' })
        return acc
      }, []),
      ...(tailleModComp !== 0 ? [{ label: TAILLE_LABELS[confirmedModifiers.taille] ?? confirmedModifiers.taille, value: tailleModComp, type: tailleModComp > 0 ? 'bonus' : 'malus' }] : []),
    ],
  })
  const userRow = character.user_id ? await db('users').where({ id: character.user_id }).select('color', 'username').first() : null
  const tireurColor = userRow?.color ?? '#c86030'
  const tireurUsername = userRow?.username ?? character.name ?? 'Inconnu'
  const diceEmission = { to: 'room', event: WS.DICE_RESULT, data: {
    userId: character.user_id ?? null, username: tireurUsername, color: tireurColor,
    formula: '1d20', rolls: rollResult.attackRolls, total: rollResult.rollAttaque,
    isCriticalSuccess: rollResult.isCriticalSuccess, isCriticalFail: rollResult.isCriticalFail,
    catastropheRisk: rollResult.catastropheRisk,
    seed: rollResult.attackSeed, timestamp: new Date().toISOString(),
    skillLabel: `${weapon.display_name ?? weapon.ref_name ?? 'Arme de zone'} — Tir en zone`,
    mechanicalTotal: skillTotal,
    diffLabel: rollResult.seuil - skillTotal >= 0 ? `+${rollResult.seuil - skillTotal}` : `${rollResult.seuil - skillTotal}`,
    chancesDeReussite: rollResult.seuil, isSuccess: rollResult.isSuccess, mr: rollResult.mr,
    breakdown: rollResult.breakdown,
  } }
  return { rollResult, diceEmission, tireurColor, tireurUsername }
}

// ─── Adaptateur d'arme AOE — agnostique au type de tireur (Segment 2, PLAN_ARMES_SPECIALES.md §1.4bis) ─
//
// Même patron que combatantContextService.js#resolveCombatantTestContext (guard clauses, pas de
// table — §1 du plan, doctrine Fowler déjà en place dans ce projet, 2-3 branches réelles). Le Seuil
// de Test a déjà son dispatcher partagé ; celui-ci fait la même chose pour « quelle est l'arme, sa
// portée, son profil AOE, ses munitions » — une propriété différente, jamais fusionnée avec le
// contexte de Test.
//
// fetchAoeShooterWeapon — arme normalisée quel que soit le type de tireur : `equipment_id`,
// `ref_range`, `ref_damage_h`, `ref_aoe_profile`, `ref_name`, `display_name`, `ammo_remaining` — les
// mêmes champs déjà lus par le tronc pour un tireur humanoïde (getOwnedHandWeapon les porte déjà tels
// quels), exo normalisé vers la même forme, aucune renomination à charge du reste du tronc. `null` si
// introuvable ou type pas encore supporté — jamais un throw (même contrat que fetchExoWeapon/
// fetchAssaultWeaponAndMods eux-mêmes).
//
// Segment 2a : pj/pnj + exo. Segment 2b : drone (même patron via fetchDroneWeapon). Type pas encore
// supporté → `null` explicite — le tronc traite ça comme « arme introuvable », message clair, même
// discipline que findAoeMechanismEntry pour un mécanisme inconnu.
async function fetchAoeShooterWeapon(character, action) {
  if (character.type === 'exo') {
    if (!action.exo_weapon_inv_id) return null
    const row = await fetchExoWeapon(action.exo_weapon_inv_id, character.id)
    if (!row?.equipment_id) return null
    return {
      equipment_id: row.equipment_id, ref_range: row.ref_range,
      ref_damage_h: row.effective_formula, ref_aoe_profile: row.ref_aoe_profile,
      ref_name: row.ref_name, display_name: row.display_name, ammo_remaining: row.ammo_remaining,
      // Choc d'arme (docs/PLANS/PLAN_CHOC_EXO_DRONE.md Palier B) — fetchExoWeapon porte déjà ces 3
      // colonnes (même correction que le Tir/CaC exo non-AOE), simplement absentes jusqu'ici de la
      // forme normalisée que ce tronc consomme.
      ref_shock: row.ref_shock, ref_shock_mechanism: row.ref_shock_mechanism, ref_shock_reduced_by_armor: row.ref_shock_reduced_by_armor,
    }
  }
  if (character.type === 'drone') {
    if (!action.drone_weapon_inv_id) return null
    const row = await fetchDroneWeapon(action.drone_weapon_inv_id)
    // Arme drone « maison » (label_override sans equipment_id) : jamais une arme de zone (aucun
    // aoe_profile sans ligne catalogue) — même garde que la branche exo.
    if (!row?.equipment_id) return null
    return {
      equipment_id: row.equipment_id, ref_range: row.ref_range,
      ref_damage_h: row.effective_formula, ref_aoe_profile: row.ref_aoe_profile,
      ref_name: row.ref_name, display_name: row.display_name,
      // drone_weapons.ammo_restant existe mais AUCUN chemin drone (Tir/CaC non plus) ne la décrémente
      // — pas de suivi de munition drone à ce jour (cf. decrementAoeShooterAmmo). `null` explicite.
      ammo_remaining: null,
      ref_shock: row.ref_shock, ref_shock_mechanism: row.ref_shock_mechanism, ref_shock_reduced_by_armor: row.ref_shock_reduced_by_armor,
    }
  }
  if (!action.weapon_inv_id) return null
  const { weapon } = await fetchAssaultWeaponAndMods(action.weapon_inv_id, character.id)
  return weapon?.equipment_id ? weapon : null
}

// Décompte munitions — une seule cartouche pour toute la gerbe (RAW), pas par cible. Reproduit
// fidèlement 2 comportements déjà en place ailleurs, PAS un nouveau comportement fusionné :
//  - humanoïde : skip si `pnj_unlimited_ammo` (réglage de campagne, comportement historique de cette
//    fonction, inchangé) ;
//  - exo : `resolveExoAssaultAction` (Tir/CaC exo non-AOE) ne vérifie JAMAIS `pnj_unlimited_ammo` —
//    ce réglage ne s'applique qu'à un tireur humanoïde, reproduit ici à l'identique (vérifié dans
//    socketCombatExo.js avant d'écrire cette branche), pas une omission.
// drone : no-op — `drone_weapons.ammo_restant` EXISTE (migration 39_drone_weapons.js) mais aucun
// chemin drone ne la décrémente (ni resolveDroneAssaultAction pour le Tir/CaC, vérifié). No-op ici =
// cohérence avec le Tir/CaC drone, pas un gap propre à l'AOE ; harmoniser le suivi munition drone est
// une dette distincte (ROADMAP.md).
async function decrementAoeShooterAmmo(campaignId, { character, weapon, action }) {
  if (weapon.ammo_remaining === null || weapon.ammo_remaining === undefined) return
  const bulletsFired = action.bullet_count ?? 1

  if (character.type === 'exo') {
    const newRemaining = Math.max(0, weapon.ammo_remaining - bulletsFired)
    await db('exo_weapons').where({ id: action.exo_weapon_inv_id }).update({ ammo_remaining: newRemaining })
    return
  }
  if (character.type === 'drone') return

  const settings = await getCampaignSettings(db, campaignId)
  if (character.type === 'pnj' && settings.pnj_unlimited_ammo) return
  const newRemaining = Math.max(0, weapon.ammo_remaining - bulletsFired)
  await db('char_inventory').where({ id: action.weapon_inv_id }).update({ ammo_remaining: newRemaining })
}

// Persistance (§3) — une ligne par cible touchée, écrite à la RÉSOLUTION. `modifierFn(ht)` fournit
// `damage_modifier` (fusil à pompe : `{ band, damageDice }`) ou null (mécanisme sans dispersion) —
// c'est `mech.targetRowModifier` du registre AOE (aoeMechanisms/registry.js), zéro branche ici.
async function insertAoeTargetRows({ actionId, hitTargets, modifierFn }) {
  const rows = await db('combat_action_targets').insert(hitTargets.map(ht => {
    const mod = modifierFn?.(ht) ?? null
    return {
      action_id: actionId,
      target_token_id: ht.tokenId,
      distance_m: ht.distanceToOriginM,
      has_line_of_sight: true,
      damage_modifier: mod == null ? null : JSON.stringify(mod),
    }
  })).returning(['id', 'target_token_id'])
  return new Map(rows.map(r => [r.target_token_id, r.id]))
}

// resolveAoeTargetDamage — applique le dégât d'UNE cible touchée par une zone (dispatch drone/exo/
// humanoïde). AUCUNE émission COMBAT_ATTACK_RESULT ici (finalizeAoeResults les émet depuis `results`) ;
// les side-effects des services de dégât (EXO_AVARIE_UPDATED, WOUND_ADDED, Test de Choc, étourdissement)
// restent. Renvoie null si la cible n'a pas de fiche exploitable — jamais un throw.
// `locationsCount` : 1 pour le fusil à pompe, 1D3 pour le lance-flammes (humanoïde uniquement — un
// drone/une exo prend le dégât une seule fois). `armorReductionFactor` : 1 (défaut), 0.5 lance-flammes
// — les deux viennent de `mech.computeTargetDamage`, générique ici.
async function resolveAoeTargetDamage(io, campaignId, {
  hitTarget, degautsBruts, effectiveDamage, shooterChocDsl = null, locationsCount = 1, armorReductionFactor = 1, shooter,
}) {
  const tokenId = hitTarget.tokenId
  const cibleToken = await db('tokens').where({ id: tokenId }).first()
  let cibleCharacter = null, char_sheet_id_cible = null
  let for_na_cible = 8, con_na_cible = 8, vol_na_cible = 8
  if (cibleToken?.character_id) {
    cibleCharacter = await db('characters').where({ id: cibleToken.character_id }).first()
    if (cibleCharacter) {
      const sheetCible = await db('char_sheet').where({ character_id: cibleCharacter.id }).first()
      if (sheetCible) {
        char_sheet_id_cible = sheetCible.id
        const naCible = await damageService.fetchCibleNA(db, cibleCharacter.id, sheetCible.id)
        for_na_cible = naCible.for_na; con_na_cible = naCible.con_na; vol_na_cible = naCible.vol_na
      }
    }
  }
  const name = cibleCharacter?.name ?? cibleToken?.label ?? 'Cible'
  const cibleType = cibleCharacter?.type ?? null
  const band = hitTarget.band ?? null

  if (cibleType === 'drone') {
    const droneSheet = await db('drone_sheet').where({ character_id: cibleCharacter.id }).first()
    if (!droneSheet) return null
    const { degatsNets } = calcDroneDegatsNets(droneSheet, degautsBruts)
    await resolveDroneIntegrityLoss(io, campaignId, cibleCharacter.id, tokenId, droneSheet, degatsNets)
    return { tokenId, cibleType, name, band, results: [
      { localisation: null, degautsBruts, degatsNets, severity: null, is_lethal: false, shockResult: null },
    ] }
  }

  if (cibleType === 'exo') {
    const exoResult = await exoAvarieService.resolveExoDamage(io, db, campaignId, { characterId: cibleCharacter.id, degautsBruts })
    if (!exoResult) return null
    return { tokenId, cibleType, name, band, results: [
      { localisation: null, degautsBruts, degatsNets: exoResult.degatsNets, severity: exoResult.severity, is_lethal: false, shockResult: null },
    ] }
  }

  // Humanoïde / décor — `locationsCount` Localisations, chacune un resolveTargetHit indépendant
  // (localisation, armure, Blessure) — même patron que resolveEnvironmentalHazardTicks.
  //
  // Choc d'arme (`effectiveDamage.choc` — ex. 2D6 lance-flammes) : UNE SEULE FOIS par cible touchée,
  // jamais par Localisation (décision Saar 2026-09-04, en session : « un seul choc par tir de
  // lance-flamme, c'est déjà largement assez punitif »). `resolveTargetHit` résout une Localisation
  // à la fois et ré-évaluerait `chocDsl` (donc son propre 2D6 + son propre Test de Choc D20) à
  // chaque appel s'il lui était passé tel quel dans la boucle — confirmé en session : 2
  // `applyStunWithDuration` indépendants sur la même cible pour un lance-flammes ayant touché 2
  // Localisations. Le fusil à pompe (`locationsCount` toujours 1) n'est jamais concerné — `i === 0`
  // y est systématiquement vrai, comportement inchangé.
  // Le Test de Choc "naturel" déclenché par la seule sévérité d'UNE blessure (indépendant de l'arme,
  // branche `woundResult` de `resolveTargetHit`) reste, lui, évalué à chaque Localisation — RAW
  // normal pour toute attaque à Localisations multiples, non concerné par cette décision.
  // `shooterChocDsl` (docs/PLANS/PLAN_CHOC_EXO_DRONE.md Palier B) : Choc d'un tireur exo, calculé une
  // fois par le tronc (pas par cible, `effectiveDamage` reste `null` pour un tireur non-humanoïde,
  // §510-518 ci-dessus) — repli seulement quand `effectiveDamage` lui-même est absent, jamais les deux
  // sources combinées (même précédence que confirmDamage, socketCombatHelpers.js).
  const results = []
  for (let i = 0; i < Math.max(1, locationsCount); i += 1) {
    const hitResult = await damageService.resolveTargetHit(io, db, campaignId, {
      degautsBruts, characterIdCible: cibleToken?.character_id ?? null,
      cibleType, char_sheet_id_cible, for_na_cible, con_na_cible, vol_na_cible,
      chocDsl: i === 0 ? (effectiveDamage ? effectiveDamage.choc : (shooterChocDsl ?? null)) : null,
      ammoFx: effectiveDamage ? (effectiveDamage.tags?.FX ?? null) : null,
      armorReductionFactor,
    })
    if (!hitResult) continue
    const { localisation, degatsNets, is_lethal, finalSeverity, shockResult } = hitResult
    // Test de Choc — c'est la CIBLE qui résiste (LdB p.243), jamais le tireur (ticket
    // CHOC-TEST-WRONG-ATTRIBUTION, docs/PLANS/PLAN_CHOC_TEST_ATTRIBUTION.md). `cibleCharacter`/`name`
    // déjà résolus plus haut dans cette fonction — aucune requête supplémentaire.
    if (shockResult) {
      const cibleIdentity = await resolveCombatantDisplayIdentity(db, cibleCharacter, name)
      statusService.emitShockDiceResult(io, campaignId, shockResult, cibleIdentity.userId, cibleIdentity.username, cibleIdentity.color)
    }
    if (shockResult?.outcome && shockResult.outcome !== 'ok') {
      statusService.applyStun(io, db, campaignId, {
        targetTokenId: tokenId, outcome: shockResult.outcome,
        userId: shooter.userId, username: shooter.tireurUsername, color: shooter.tireurColor,
      }).catch(err => console.error('[WS] applyStun error:', err.message))
    }
    results.push({ localisation, degautsBruts, degatsNets, severity: finalSeverity, is_lethal, shockResult })
  }
  if (results.length === 0) return null
  return { tokenId, cibleType, name, band, results }
}

// finalizeAoeResults — écrit `combat_action_targets.outcome` (JSON du tableau `results`), émet UN
// COMBAT_ATTACK_RESULT par entrée `results` (MJ/spectateurs), et — pour un tireur PJ — UN
// COMBAT_ATTACK_PLAYER_RESULT agrégé (fenêtre-reçu non bloquante, §5.1). Renvoie les émissions.
async function finalizeAoeResults({ perTargetResults, targetRowIdByTokenId, isPnjResult, rollResult, action }) {
  const emissions = []
  // `rollResult` absent = mécanisme sans Phase A (grenade : Test de Coordination fait au lancer,
  // §3d) — `roll`/`seuil` deviennent `null` (touché automatiquement, pas un hit/miss de jet).
  const rr = rollResult ?? {}
  for (const ptr of perTargetResults) {
    const rowId = targetRowIdByTokenId.get(ptr.tokenId)
    if (rowId) {
      await db('combat_action_targets').where({ id: rowId, outcome: null })
        .update({ outcome: JSON.stringify(ptr.results) })
    }
    for (const r of ptr.results) {
      emissions.push({ to: 'room', event: WS.COMBAT_ATTACK_RESULT, data: {
        tireurId: action.token_id, cibleId: ptr.tokenId,
        localisation: r.localisation, degautsBruts: r.degautsBruts, degatsNets: r.degatsNets,
        severity: r.severity, is_lethal: r.is_lethal, isSuccess: true, isPnj: isPnjResult,
        roll: rr.rollAttaque ?? null, chancesDeReussite: rr.seuil ?? null, shockResult: r.shockResult,
      } })
    }
  }
  if (!isPnjResult) {
    emissions.push({ to: 'socket', event: WS.COMBAT_ATTACK_PLAYER_RESULT, data: {
      hit: perTargetResults.length > 0,
      roll: rr.rollAttaque ?? null,
      seuil: rr.seuil ?? null,
      tireurTokenId: action.token_id,
      cibleTokenId: null,
      targets: perTargetResults.map(p => ({ name: p.name, band: p.band, results: p.results })),
    } })
  }
  return emissions
}

// resolveGrenadeThrow — « le lancer » d'une grenade visée « point » (RAW REGLES_ARMES_SPECIALES.md
// § « Grenades et mines »), commun à TOUT mécanisme AOE `shape: 'circle'` (Segment 3-bis) : garde
// humanoïde, Test de Coordination sur l'attribut COO, dispersion 1D6 sur échec (`resolveScatter`),
// snapshot d'arme. NE fait AUCUN effet de bord — pas d'émission, pas d'écriture DB, pas de retrait
// d'inventaire, pas de catastrophe : l'appelant (`resolveAoeAssaultAction`) enchaîne dans l'ordre
// historique (DICE_RESULT, catastrophe, écritures) puis la suite propre au mode de détonation
// (minuterie = entrée d'échelle T+1 ; percussion = §3f).
// Extraction PLAN_GRENADES.md §6 3f — behavior-preserving. Retourne `{ blocked: <emission> }` (garde
// échouée) OU `{ coord, resolvedOrigin, weaponSnapshot, failureMarginM, d6Roll, testCtx }`.
//
// PAS de garde sur le `mechanic` ici (3-bis/0) : deux invariants amont le couvrent déjà —
//  1. `resolveAoeAssaultAction` a vérifié `findAoeMechanismEntry(mechanic)` existe (message clair sinon) ;
//  2. `aoe.intendedOrigin` en base ⟹ l'annonce a validé `shape: 'circle'` (seule forme qui produit un
//     point visé). Un name-check redondant à mettre à jour par type = l'anti-pattern que le registre tue.
async function resolveGrenadeThrow({ action, aoe, character, weapon, shooterToken, worldMetrics }) {
  if (character.type !== 'pj' && character.type !== 'pnj') {
    return { blocked: { to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
      username: character.name, message: 'Lancer de grenade exo/drone — pas encore câblé (PLAN_GRENADES.md §3d).',
    } } }
  }

  const testCtx = await resolveCombatantTestContext(db, character, null, { attributeId: 'COO' })
  const wounds = testCtx?.sheetId ? await db('character_wounds').where({ char_sheet_id: testCtx.sheetId }) : []
  if (isTestBlockingWound(wounds)) {
    return { blocked: { to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
      username: character.name, message: 'Blessure mortelle — aucune action de Test possible',
    } } }
  }

  const coord = await resolveAoeAttackRoll({
    skillTotal: testCtx?.skillTotal ?? 0,
    skillMastery: 0,
    contributions: [{ label: 'Malus santé / encombrement', value: testCtx?.effectiveMalus ?? 0, type: 'malus' }],
  })

  const failureMarginM = coord.isSuccess ? 0 : -coord.mr // mr = seuil - roll < 0 sur échec → -mr = mètres ratés
  const { total: d6Roll } = await parseDice('1d6')
  const resolvedOrigin = resolveScatter({
    throwerPosition: dbPositionToWorldPoint(shooterToken),
    intendedOrigin: aoe.intendedOrigin, failureMarginM, d6Roll,
  }, worldMetrics)

  const weaponSnapshot = {
    refAoeProfile: weapon.ref_aoe_profile, refDamageH: weapon.ref_damage_h,
    refName: weapon.ref_name, equipmentId: weapon.equipment_id ?? null,
  }

  return { coord, resolvedOrigin, weaponSnapshot, failureMarginM, d6Roll, testCtx }
}

// consumeThrownGrenade — retrait de la grenade lancée de l'inventaire (RAW : amorcée puis lancée).
// Commun aux deux modes de détonation (minuterie / percussion). No-op si l'action ne porte pas de
// ligne d'inventaire (tireur non-humanoïde — jamais atteint aujourd'hui, garde de `resolveGrenadeThrow`).
async function consumeThrownGrenade(weaponInvId) {
  if (!weaponInvId) return
  const inv = await db('char_inventory').where({ id: weaponInvId }).first()
  if (inv && inv.quantity > 1) await db('char_inventory').where({ id: inv.id }).update({ quantity: inv.quantity - 1, updated_at: db.fn.now() })
  else if (inv) await db('char_inventory').where({ id: inv.id }).del()
}

// ─── Couche 4 AOE, phase B — orchestration (docs/PLANS/PLAN_AOE.md §8 + PLAN_ARMES_SPECIALES.md §1.4/§1.4bis) ─
//
// resolveAoeAssaultAction — tronc mince : gates → identification du mécanisme (registre,
// aoeMechanisms/registry.js) → forme + ciblage (`mech.buildShape`/`mech.filterTargets`) → Phase A
// (`runAoePhaseA`) → munitions → pseudo-cibles (`mech.extraTargets`) → persistance
// (`mech.targetRowModifier`) → dégât brut par cible (`mech.computeTargetDamage`) → générique
// (`resolveAoeTargetDamage` × cibles + `finalizeAoeResults`) → effets post-résolution
// (`mech.postResolve`). Résolution IMMÉDIATE pour tout type de tireur (le différé
// armAwaitingDamage/confirmDamage a été envisagé pour le PJ puis écarté — PLAN_AOE.md §5.1 : il
// suppose UNE cible en attente, N pending d'un seul appel corrompent la fenêtre client). Différence
// PJ vs PNJ (`isPnjResult`) : le PJ reçoit UN COMBAT_ATTACK_PLAYER_RESULT agrégé (fenêtre-reçu non
// bloquante) au lieu d'un COMBAT_ATTACK_RESULT par entrée `results`.
//
// Identification de l'arme par `aoe_profile.mechanic` (donnée catalogue, `shared/combatAoe.js`,
// segment 0b) — plus par nom en dur. Le dispatch lui-même (forme, ciblage, dégât, effets de bord) est
// délégué au registre (`server/src/lib/aoeMechanisms/registry.js`, Segment 1.5) — ce tronc ne connaît
// plus AUCUN mécanisme par son nom. Ajouter un mécanisme = ajouter une entrée au registre, jamais une
// ligne ici.
//
// `ctx` — objet immuable reconstruit à spread à chaque étape (jamais muté en place), accumule les
// ingrédients dont les hooks du mécanisme ont besoin : `character`, `action`, `confirmedModifiers`,
// `weapon`, `shooterToken`, `aoe`, `amplitudeM`, puis `aoeShape`/`metrics`/`rollResult`/
// `hadExtraTargets` au fil des étapes.
//
// RAW relu intégralement avant ce code (docs/REGLES/REGLES_ARMES_SPECIALES.md:18-52) — 3 points
// corrigent une hypothèse antérieure du plan :
// 1. "même sur un échec au Test de tir, les cibles peuvent être touchées" — AUCUNE branche "raté" ici,
//    contrairement à un Tir normal : le jet unique (Phase A) ne fait que moduler `mr`, jamais un
//    hit/miss de toute l'action. Cohérent avec le commentaire déjà écrit en tête de resolveAoeAttackRoll.
// 2. Le "Test de Chance" RAW à longue/extrême portée (la cible évite complètement d'être touchée)
//    n'est PAS câblé dans cette tranche AOE — écart RAW explicite (CLAUDE.md §1.9), lié au chantier
//    Chance (docs/PLANS/PLAN_CHANCE.md). CORRECTION (2026-09-05) : contrairement à ce que ce
//    commentaire affirmait, le score de Chance EXISTE (`char_sheet.chc`, migration 22, déjà consommé
//    par le Test de Chance du Petit bouclier, damageService.js). Ce qui manque = la réserve
//    dépensable + la primitive `resolveChanceTest` partagée + le geste de dépense (PLAN_CHANCE.md §3).
//    Le wiring AOE (retirer la cible de `resolveTargets` sur réussite du Test) est l'étape 6 de ce plan.
// 3. Bonus de protection +3 (gilet pare-balles/couverture légère, spécifique à la dispersion de plombs)
//    et blocage par une cible interposée ("derrière une cible exposée") : non modélisés, gap RAW connu,
//    hors scope de cette tranche (nuance d'armure/occlusion par un combattant, pas une question d'AOE).
//
// Dual-wield non supporté ici (action.offhand_weapon_inv_id ignoré) — cas RAW marginal pour un fusil à
// pompe, simplification v1 assumée plutôt qu'un branchement non testé.
export async function resolveAoeAssaultAction(io, campaignId, action, confirmedModifiers, character, pendingMaps, options = {}) {
  console.log(`[DBG] resolveAoeAssaultAction — début token:${action.token_id} type_perso:${character.type}`)
  const emissions = [] // hors du try : le catch doit pouvoir renvoyer ce qui a déjà été produit
  try {
    const aoe = action.modifiers?.aoe
    if (!aoe) return { suspend: false, emissions }

    // Tireur PJ : résolution immédiate comme le PNJ (docs/PLANS/PLAN_AOE.md §5.1 révisé + §8 étape 10).
    const isPnjResult = character.type !== 'pj'

    if (isImpossibleRangedSituation(confirmedModifiers?.situation ?? [])) {
      emissions.push({ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
        username: character.name,
        message: 'Tir impossible — Allure maximale du tireur ou obscurité totale',
      } })
      return { suspend: false, emissions }
    }

    if (aoe.mode === 'suppression') {
      emissions.push({ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
        username: character.name,
        message: 'Tir de suppression — résolution pas encore implémentée (docs/PLANS/PLAN_AOE.md).',
      } })
      return { suspend: false, emissions }
    }

    // Visée d'un POINT (grenade) : `aoe.intendedOrigin` posé à l'ANNONCE, `aoe.resolvedOrigin` posé au
    // LANCER (plus bas). Le garde du lancer est placé APRÈS l'arme/le mécanisme/la position/les
    // metrics (il en a besoin) — voir « ── LANCER » ci-dessous.

    // Arme : normalement `fetchAoeShooterWeapon` (char_inventory). Pour l'EXPLOSION différée d'une
    // grenade (Tour+1), la grenade a quitté l'inventaire au lancer → `aoe.weaponSnapshot` (posé au
    // lancer) fait foi : la résolution différée ne demande rien à un état qu'elle ne possède plus
    // (PLAN_GRENADES.md §3d, analyse à charge #1).
    const weapon = aoe.weaponSnapshot
      ? { ref_aoe_profile: aoe.weaponSnapshot.refAoeProfile, ref_damage_h: aoe.weaponSnapshot.refDamageH, ref_name: aoe.weaponSnapshot.refName, equipment_id: aoe.weaponSnapshot.equipmentId ?? null }
      : await fetchAoeShooterWeapon(character, action)
    if (!weapon) {
      console.warn(`[WS] resolveAoeAssaultAction — arme introuvable. type:${character.type} weapon_inv_id:${action.weapon_inv_id} exo_weapon_inv_id:${action.exo_weapon_inv_id} drone_weapon_inv_id:${action.drone_weapon_inv_id}`)
      return { suspend: false, emissions }
    }
    // Identification par la donnée catalogue `aoe_profile.mechanic` (segment 0b, shared/combatAoe.js) ;
    // le registre (aoeMechanisms/registry.js) fournit l'implémentation. Un `mechanic` structurellement
    // valide (shared/combatAoe.js) mais absent du registre → message clair, jamais un silence (même
    // philosophie que l'ancien dispatch en dur, désormais générique).
    const mechanic = getAoeMechanic(weapon.ref_aoe_profile)
    const mech = findAoeMechanismEntry(mechanic)
    if (!mech) {
      emissions.push({ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
        username: character.name,
        message: mechanic
          ? `${weapon.ref_name ?? 'Cette arme'} — résolution de zone « ${mechanic} » pas encore implémentée.`
          : `${weapon.ref_name ?? 'Cette arme'} — dispersion en zone inconnue pour cette arme.`,
      } })
      return { suspend: false, emissions }
    }

    const shooterToken = await db('tokens').where({ id: action.token_id }).first()
    if (!shooterToken || shooterToken.position_space !== 'world-feet') {
      emissions.push({ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
        username: character.name,
        message: 'Tir en zone impossible — position tireur incompatible avec le moteur de monde',
      } })
      return { suspend: false, emissions }
    }

    const battlemap = await db('battlemaps').where({ id: shooterToken.battlemap_id }).first()
    const worldMetrics = getBattlemapWorldSnapshot(battlemap).metrics // caché (snapshotCache) — evaluateAoeVisibility le réchauffe aussi

    // ── LANCER (RÉSOLUTION du Tour T) — grenade visée « point », pas encore résolue ────────────────
    // Test de Coordination (RAW REGLES_ARMES_SPECIALES.md § « Grenades et mines » : attribut COO
    // littéral) ; sur échec, dispersion à `|marge d'échec|` mètres, direction 1D6. Le point d'impact
    // réel est figé maintenant. Suite selon le mode de détonation (PLAN_GRENADES.md §3 pt 2 / §6 3f) :
    //  - `minuterie` (défaut) : explosion différée au Tour+1 au rang d'Initiative du lanceur (entrée
    //    d'échelle `autoResolve`, résolue par le moteur — 3d-2) ;
    //  - `percussion` : explosion IMMÉDIATE, ce Tour T, au point d'impact (fall-through vers le bloc
    //    explosion ci-dessous) ;
    //  - `drone` : réservé structurellement, rejeté ici (sous-système entité autonome non construit).
    // Écart RAW acté (JOURNAL8) : pas de modificateur de taille « zone visée » en v1 (on vise un point).
    if (aoe.intendedOrigin && !aoe.resolvedOrigin) {
      const detonation = normalizeGrenadeDetonation(aoe.detonation)

      // `drone` — rejet AVANT le Test de Coordination et la consommation : la grenade reste intacte
      // (motif de refus permanent qui ne peut pas changer, patron `findAoeMechanismEntry`).
      if (detonation === 'drone') {
        emissions.push({ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
          username: character.name,
          message: `${weapon.ref_name ?? 'Cette grenade'} — option « drone » pas encore câblée (sous-système entité autonome, PLAN_GRENADES.md §3 pt 2).`,
        } })
        return { suspend: false, emissions }
      }

      const thrown = await resolveGrenadeThrow({ action, aoe, character, weapon, shooterToken, worldMetrics })
      if (thrown.blocked) { emissions.push(thrown.blocked); return { suspend: false, emissions } }
      const { coord, resolvedOrigin, weaponSnapshot, failureMarginM, d6Roll, testCtx } = thrown

      const { username: coordUsername, color: coordColor } = await resolveCombatantDisplayIdentity(db, character)
      emissions.push({ to: 'room', event: WS.DICE_RESULT, data: {
        userId: character.user_id ?? null, username: coordUsername, color: coordColor,
        formula: '1d20', rolls: coord.attackRolls, total: coord.rollAttaque,
        isCriticalSuccess: coord.isCriticalSuccess, isCriticalFail: coord.isCriticalFail,
        catastropheRisk: coord.catastropheRisk, seed: coord.attackSeed, timestamp: new Date().toISOString(),
        skillLabel: `${weapon.ref_name ?? 'Grenade'} — Lancer (Test de Coordination)`,
        mechanicalTotal: testCtx?.skillTotal ?? 0, chancesDeReussite: coord.seuil,
        isSuccess: coord.isSuccess, mr: coord.mr, breakdown: coord.breakdown,
      } })
      await maybeTriggerCatastrophe(io, campaignId, action.token_id, coord.catastropheRisk, {
        site: 'grenade_throw', actorTokenId: action.token_id, targetTokenId: null,
      })

      // Point d'impact réel figé en mémoire — le `buildShape` d'un mécanisme cercle lit `aoe.resolvedOrigin`.
      aoe.resolvedOrigin = resolvedOrigin
      aoe.weaponSnapshot = weaponSnapshot

      if (detonation === 'percussion') {
        // Option « à percussion » (RAW : « n'explose que si elle heurte quelque chose ») → explosion
        // au contact = ce Tour, au point d'impact. Pas de minuterie, pas d'entrée d'échelle : on
        // persiste le point (audit / cohérence combat_action_targets) et on POURSUIT dans le bloc
        // explosion ci-dessous. Écart RAW acté (JOURNAL8, 3f/10) : le RAW ne précise pas le timing de
        // la percussion — lecture retenue « au contact = ce Tour ».
        await db('combat_actions').where({ id: action.id }).update({
          modifiers: db.raw("jsonb_set(jsonb_set(modifiers, '{aoe,resolvedOrigin}', ?::jsonb), '{aoe,weaponSnapshot}', ?::jsonb)",
            [JSON.stringify(resolvedOrigin), JSON.stringify(weaponSnapshot)]),
          updated_at: db.fn.now(),
        })
        await consumeThrownGrenade(action.weapon_inv_id)
        emissions.push({ to: 'room', event: WS.COMBAT_SYSTEM_NOTICE, data: {
          i18nKey: 'session.grenadeThrownPercussion',
          params: { label: character.name ?? shooterToken.label ?? '?' },
          timestamp: new Date().toISOString(),
        } })
        // Marqueur 3D éphémère (§3f) — montre où la grenade a atterri, concomitant à l'explosion.
        // `ephemeral: true` → le client l'auto-retire après ~5 s (pas d'entrée d'échelle, pas de
        // COMBAT_GRENADE_EXPLODED, pas de ré-émission en reconnexion). `entryId` = id d'action.
        emissions.push({ to: 'room', event: WS.COMBAT_GRENADE_ARMED, data: {
          entryId: action.id,
          tokenId: action.token_id,
          resolvedOrigin,
          explodesOnTurn: null,
          scattered: !coord.isSuccess,
          ephemeral: true,
        } })
        // PAS de return — fall-through vers le bloc explosion (Tour T).
      } else {
        // `minuterie` (défaut) — comportement historique inchangé (§3d).
        const [stateRow, rosterRow] = await Promise.all([
          db('combat_state').where({ campaign_id: campaignId }).select('current_turn').first(),
          db('combat_roster').where({ campaign_id: campaignId, token_id: action.token_id }).first(),
        ])
        const currentTurn = stateRow?.current_turn ?? 1

        await db('combat_actions').where({ id: action.id }).update({
          modifiers: db.raw("jsonb_set(jsonb_set(modifiers, '{aoe,resolvedOrigin}', ?::jsonb), '{aoe,weaponSnapshot}', ?::jsonb)",
            [JSON.stringify(resolvedOrigin), JSON.stringify(weaponSnapshot)]),
          turn_number: currentTurn + 1, // survit au wipe endTurn (M3) + trouvé par le dispatch au Tour+1
          updated_at: db.fn.now(),
        })
        const [armedEntry] = await db('combat_timeline_entries').insert({
          campaign_id: campaignId, turn_number: currentTurn, resolve_on_turn: currentTurn + 1,
          token_id: action.token_id, combat_action_id: action.id,
          phase_position: (rosterRow?.base_ini ?? 0) * 100 + 1, // « rang d'Initiative normal », juste avant l'action propre du lanceur
          status: 'scheduled',
          resolution_snapshot: JSON.stringify({ autoResolve: true, resolvedOrigin, scattered: !coord.isSuccess, d6Roll, marginM: failureMarginM }),
        }).returning('id')

        await consumeThrownGrenade(action.weapon_inv_id)

        emissions.push({ to: 'room', event: WS.COMBAT_SYSTEM_NOTICE, data: {
          i18nKey: 'session.grenadeArmed',
          params: { label: character.name ?? shooterToken.label ?? '?' },
          timestamp: new Date().toISOString(),
        } })
        // Marqueur 3D côté client (§3d-3) — position réelle au sol entre le lancer et l'explosion Tour+1.
        emissions.push({ to: 'room', event: WS.COMBAT_GRENADE_ARMED, data: {
          entryId: armedEntry.id,
          tokenId: action.token_id,
          resolvedOrigin,
          explodesOnTurn: currentTurn + 1,
          scattered: !coord.isSuccess,
        } })
        return { suspend: false, emissions }
      }
    }

    // Amplitude de la zone = portée extrême de l'arme (fusil à pompe, lance-flammes — `ref_range`).
    // Un mécanisme qui tire son amplitude de son propre profil (`grenade_frag` : rayon RAW fixe dans
    // `buildShape`) déclare `needsWeaponRange: false` — pas de colonne `ref_range` pour une grenade
    // (PLAN_GRENADES.md §5, Segment 3b). Défaut `true` : comportement historique inchangé.
    let amplitudeM
    if (mech.needsWeaponRange ?? true) {
      const thresholds = parseWeaponRangeBands(weapon.ref_range)
      if (!thresholds) {
        emissions.push({ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
          username: character.name, message: 'Tir en zone impossible — portée d\'arme non exploitable',
        } })
        return { suspend: false, emissions }
      }
      amplitudeM = thresholds[thresholds.length - 1]
    }

    let ctx = { character, action, confirmedModifiers, weapon, shooterToken, aoe, amplitudeM }

    // ── Forme de la zone — spécifique au mécanisme (`mech.buildShape`). Chaque mécanisme décide sa
    // propre origine (position du tireur pour cône/rayon ; un futur mécanisme lancé calculerait la
    // sienne via resolveScatter, sans jamais toucher ce tronc).
    let aoeShape
    try {
      aoeShape = mech.buildShape(ctx)
    } catch (shapeErr) {
      console.warn(`[WS] resolveAoeAssaultAction — forme AOE invalide: ${shapeErr.message}`)
      emissions.push({ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
        username: character.name,
        message: 'Tir en zone impossible — profil de zone d\'effet de l\'arme invalide',
      } })
      return { suspend: false, emissions }
    }
    ctx = { ...ctx, aoeShape }

    // LOS de la zone : depuis le tireur (`'caster'`) pour un projectile qui part de lui (fusil à
    // pompe, lance-flammes) ; depuis le point d'impact (`'origin'`) pour une explosion (`grenade_frag`)
    // — une cible masquée au lanceur mais à découvert du souffle est touchée. Défaut `'caster'`.
    const visibility = await evaluateAoeVisibility({
      battlemapId: shooterToken.battlemap_id, aoeShape, casterToken: shooterToken,
      losSource: mech.losSource ?? 'caster',
    })
    if (visibility.status !== 'ok') return { suspend: false, emissions }

    ctx = { ...ctx, metrics: visibility.metrics }

    // ── Ciblage géométrique — spécifique au mécanisme (`mech.filterTargets`).
    const hitTargets = mech.filterTargets(ctx, visibility.targets)

    // ── Jet de tir unique (Phase A) — jamais de branche "raté" ici, voir commentaire de tête.
    // `rollsPhaseA` (défaut `true`) : une grenade a déjà passé son Test de Coordination au LANCER
    // (Tour T) ; l'explosion (Tour+1) ne relance rien — `grenade_frag` déclare `rollsPhaseA: false`.
    // `rollResult` reste `undefined` en aval (les hooks `grenade_frag` ne le lisent pas ;
    // `finalizeAoeResults` et la branche 0-cible tolèrent l'absence).
    let rollResult, tireurColor, tireurUsername
    if (mech.rollsPhaseA ?? true) {
      const phaseA = await runAoePhaseA({ character, weapon, confirmedModifiers })
      if (phaseA.blocked) { emissions.push(phaseA.blocked); return { suspend: false, emissions } }
      ;({ rollResult, tireurColor, tireurUsername } = phaseA)
      emissions.push(phaseA.diceEmission)
      await maybeTriggerCatastrophe(io, campaignId, action.token_id, rollResult.catastropheRisk, {
        site: 'assault_aoe', actorTokenId: action.token_id, targetTokenId: null,
      })
    } else {
      const id = await resolveCombatantDisplayIdentity(db, character)
      tireurUsername = id.username
      tireurColor = id.color
    }

    // Une grenade est consommée au LANCER (T1), jamais à l'explosion → `decrementsAmmo: false`.
    // Défaut `true` : fusil à pompe / lance-flammes décrémentent une cartouche par gerbe, inchangé.
    if (mech.decrementsAmmo ?? true) {
      await decrementAoeShooterAmmo(campaignId, { character, weapon, action })
    }

    if (hitTargets.length === 0) {
      // Le tir est parti (RAW), personne dans la zone d'effet. Jamais un COMBAT_ATTACK_RESULT
      // « cible unique » ici : le panneau hit/miss afficherait « Touché » sur une cible « ? » à 0
      // dégât dès que le jet Phase A réussit (le Test de tir n'est pas un hit/miss d'action pour une
      // zone). → une ligne système en chat pour tout le monde ; le tireur PJ ferme sa fenêtre via
      // aoeNoTargets.
      const shooterLabel = character.name ?? shooterToken.label ?? '?'
      emissions.push({ to: 'room', event: WS.COMBAT_SYSTEM_NOTICE, data: {
        i18nKey: 'session.aoeNoTargets', params: { label: shooterLabel }, timestamp: new Date().toISOString(),
      } })
      if (!isPnjResult) {
        emissions.push({ to: 'socket', event: WS.COMBAT_ATTACK_PLAYER_RESULT, data: {
          hit: false, aoeNoTargets: true,
          roll: rollResult?.rollAttaque ?? null, seuil: rollResult?.seuil ?? null,
          tireurTokenId: action.token_id, cibleTokenId: null,
        } })
      }
      return { suspend: false, emissions }
    }

    ctx = { ...ctx, rollResult }

    // ── Cibles à résoudre = cibles touchées + pseudo-cibles éventuelles du mécanisme
    // (`mech.extraTargets` — auto-éclaboussure du lance-flammes < 3 m, décision B ; aucune pour le
    // fusil à pompe). `hadExtraTargets` posé génériquement pour `postResolve` (ex. la notice
    // d'auto-éclaboussure du lance-flammes).
    const extras = mech.extraTargets(ctx, hitTargets)
    ctx = { ...ctx, hadExtraTargets: extras.length > 0 }
    const resolveTargets = [...hitTargets, ...extras]

    // ── Forçage / Test de Chance à portée longue/extrême (PLAN_CHANCE.md L4, RAW REGLES_ARMES_
    // SPECIALES.md:34-40 fusil à pompe / :99-104 explosion-grenade — même règle aux deux endroits ;
    // jamais le lance-flammes, qui ne dégresse pas par bande, `band` y est toujours `null` donc jamais
    // retenu ci-dessous). Cible par cible : ouvre un choix Chance (patron Aggregator/Scatter-Gather,
    // PLAN_CHANCE.md §12) pour chaque cible dont le destinataire existe (pj/pnj/pilote d'exo via
    // `resolveChanceRecipientCharacterId` — jamais un drone, aucune Chance possible). Si au moins une
    // fenêtre s'ouvre, toute la suite (dégât + émission agrégée) est différée jusqu'à ce que le
    // groupe entier ait répondu (`SITE_HANDLERS.aoe_avoidance`) — jamais un `await` bloquant ici, la
    // fonction retourne immédiatement (même discipline que tous les sites L3e).
    const AOE_AVOIDANCE_BANDS = new Set(['longue', 'extreme'])
    // RAW : bonus +5 au Test de Chance à portée extrême, aucun bonus à longue portée — même valeur
    // aux deux sections RAW citées ci-dessus.
    const AOE_AVOIDANCE_MODIFIER = { longue: 0, extreme: 5 }
    const avoidanceOpenings = []
    for (const ht of resolveTargets) {
      if (!AOE_AVOIDANCE_BANDS.has(ht.band)) continue
      const cibleToken = await db('tokens').where({ id: ht.tokenId }).first()
      if (!cibleToken?.character_id) continue
      const cibleCharacter = await db('characters').where({ id: cibleToken.character_id }).first()
      if (!cibleCharacter) continue
      const recipientCharacterId = await resolveChanceRecipientCharacterId(cibleCharacter.id, cibleCharacter.type)
      if (!recipientCharacterId) continue // drone — reste normalement touché, aucun choix possible
      avoidanceOpenings.push({
        targetTokenId: ht.tokenId, recipientCharacterId,
        cibleName: cibleCharacter.name ?? cibleToken.label ?? '?',
        modifier: AOE_AVOIDANCE_MODIFIER[ht.band] ?? 0,
      })
    }

    if (avoidanceOpenings.length > 0) {
      // Contexte gelé, identique pour toutes les lignes du groupe (même `action_id`), relu par le
      // handler à la dernière résolution. Jamais `mech` lui-même (porte des fonctions, non JSON-safe)
      // — `mechanic` (chaîne) suffit à le retrouver via `findAoeMechanismEntry`, patron déjà établi
      // dans ce fichier (ligne ~512).
      const groupCtx = { ctx, mechanic, resolveTargets, isPnjResult, tireurColor, tireurUsername }
      for (const opening of avoidanceOpenings) {
        await openChanceChoice(io, campaignId, opening.recipientCharacterId, {
          testLabel: `${weapon.ref_name ?? 'Tir en zone'} — Éviter la zone d'effet (${opening.cibleName})`,
          site: 'aoe_avoidance',
          actionId: action.id,
          targetTokenId: opening.targetTokenId,
          context: { groupCtx, modifier: opening.modifier },
        })
      }
      return { suspend: true, emissions }
    }

    return await finalizeAoeResolution(io, campaignId, { ctx, mechanic, resolveTargets, isPnjResult, tireurColor, tireurUsername })
  } catch (err) {
    console.error('[WS] resolveAoeAssaultAction error:', err.message)
    // Ne jamais perdre en silence ce qui a déjà été produit (DICE_RESULT du jet de tir / Test de
    // Coordination, notices) — une exception en cours d'explosion AOE (fusil à pompe, lance-flammes,
    // grenade percussion) laissait jusqu'ici le joueur sans aucun retour. Pattern
    // socketCombatResolution.js:419-425 (« dès qu'un truc marche pas, le système doit dire pourquoi »).
    emissions.push({ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
      username: character.name,
      message: `Erreur interne en résolvant l'action de zone (${err.message}) — le Tour continue, résultat éventuellement incomplet, prévenez le MJ.`,
    } })
    return { suspend: false, emissions }
  }
}

// finalizeAoeResolution — tout ce qui suit le calcul de `resolveTargets` (persistance + dégât par
// cible + finalisation + effets post-résolution), extrait pour être appelable immédiatement (aucune
// cible éligible au forçage/Test de Chance L4) ou en différé depuis `finishAoeAvoidanceChoice`, une
// fois le groupe entier résolu — autorité unique, jamais dupliquée entre les deux chemins.
// `mechanic` (chaîne, pas `mech` — fonctions non JSON-safe) permet de retrouver le mécanisme
// identiquement dans les deux cas via `findAoeMechanismEntry`. `avoidedTokenIds` retire des cibles de
// `resolveTargets` sans jamais toucher aux lignes déjà persistées ailleurs (rien n'est encore écrit
// en base pour ces cibles avant ce point).
async function finalizeAoeResolution(io, campaignId, {
  ctx, mechanic, resolveTargets, isPnjResult, tireurColor, tireurUsername, avoidedTokenIds = [],
}) {
  const emissions = []
  const { character, action, weapon } = ctx
  const mech = findAoeMechanismEntry(mechanic)
  const finalTargets = avoidedTokenIds.length === 0
    ? resolveTargets
    : resolveTargets.filter(ht => !avoidedTokenIds.includes(ht.tokenId))

  if (finalTargets.length === 0) {
    // Toutes les cibles éligibles ont évité (forçage/Test de Chance, PLAN_CHANCE.md L4) — même
    // traitement que « personne dans la zone » (hitTargets.length===0, immédiat) : le tir est parti,
    // personne n'est touché, jamais un COMBAT_ATTACK_RESULT cible unique.
    const shooterLabel = character.name ?? '?'
    emissions.push({ to: 'room', event: WS.COMBAT_SYSTEM_NOTICE, data: {
      i18nKey: 'session.aoeNoTargets', params: { label: shooterLabel }, timestamp: new Date().toISOString(),
    } })
    if (!isPnjResult) {
      emissions.push({ to: 'socket', event: WS.COMBAT_ATTACK_PLAYER_RESULT, data: {
        hit: false, aoeNoTargets: true,
        roll: ctx.rollResult?.rollAttaque ?? null, seuil: ctx.rollResult?.seuil ?? null,
        tireurTokenId: action.token_id, cibleTokenId: null,
      } })
    }
    return { suspend: false, emissions }
  }

  const targetRowIdByTokenId = await insertAoeTargetRows({
    actionId: action.id, hitTargets: finalTargets, modifierFn: mech.targetRowModifier,
  })

  const isHumanoidShooter = character.type === 'pj' || character.type === 'pnj'
  const shooterChocDsl = !isHumanoidShooter && weapon.equipment_id ? damageService.buildWeaponShockDsl({
    shock: weapon.ref_shock, shockMechanism: weapon.ref_shock_mechanism, reducedByArmor: weapon.ref_shock_reduced_by_armor,
  }) : null
  const perTargetInputs = []
  for (const ht of finalTargets) {
    const effectiveDamage = isHumanoidShooter
      ? await damageService.getEffectiveWeaponDamage(db, action.weapon_inv_id, { rangeBand: ht.band ?? null })
      : null
    const baseRaw = effectiveDamage
      ? effectiveDamage.total
      : weapon.ref_damage_h ? (await parseDice(weapon.ref_damage_h.replace(/\s/g, ''))).total : 0
    const { degautsBruts, locationsCount, armorReductionFactor } = await mech.computeTargetDamage(ctx, ht, { effectiveDamage, baseRaw })
    perTargetInputs.push({ hitTarget: ht, degautsBruts, effectiveDamage, shooterChocDsl, locationsCount, armorReductionFactor })
  }

  const shooter = { userId: character.user_id, tireurUsername, tireurColor }
  const perTargetResults = []
  for (const inp of perTargetInputs) {
    const ptr = await resolveAoeTargetDamage(io, campaignId, { ...inp, shooter })
    if (ptr) perTargetResults.push(ptr)
  }
  emissions.push(...await finalizeAoeResults({
    perTargetResults, targetRowIdByTokenId, isPnjResult, rollResult: ctx.rollResult, action,
  }))

  emissions.push(...await mech.postResolve(io, campaignId, ctx, perTargetResults))

  return { suspend: false, emissions }
}

// finishAoeAvoidanceChoice — SITE_HANDLERS.aoe_avoidance (PLAN_CHANCE.md L4). Contrairement aux
// sites L3e (une cible, un choix, une finalisation), une action AOE peut ouvrir PLUSIEURS lignes
// pending_chance_choices (une par cible éligible, même `action_id`) — patron Aggregator/Scatter-
// Gather (Enterprise Integration Patterns) : chaque résolution individuelle contribue son `outcome`,
// la DERNIÈRE déclenche la finalisation agrégée pour tout le groupe.
async function finishAoeAvoidanceChoice(io, campaignId, resolved, { choice, context }) {
  const { groupCtx, modifier } = context
  const emissions = []

  const sheet = await db('char_sheet').where({ character_id: resolved.character_id }).first()
  const recipientCharacter = sheet ? await db('characters').where({ id: resolved.character_id }).first() : null

  // Défaut RAW : timeout ou choix non reconnu → reste touché normalement (pas de forçage silencieux,
  // même discipline que L3e/L6).
  let outcome = 'hit'
  if (choice === 'force' && sheet) {
    try {
      await spendChancePoints(sheet.id, 1, { reason: 'Forçage AOE — Événement favorable' })
      outcome = 'avoided'
    } catch (err) {
      // Chance insuffisante entre l'ouverture du choix et sa résolution (rare, concurrence d'une
      // autre dépense entre-temps) — RAW ne permet jamais un forçage non payé ; jamais un throw qui
      // laisserait la ligne sans `outcome` (bloquerait la jonction du groupe pour rien).
      console.warn(`[WS] finishAoeAvoidanceChoice — forçage refusé (${err.message}), cible traitée comme touchée.`)
    }
  } else if (choice === 'attempt' && sheet) {
    const { total: roll } = await parseDice('1d20')
    const testOutcome = resolveChanceTest(sheet.chc, roll, { modifier })
    const identity = recipientCharacter
      ? await resolveCombatantDisplayIdentity(db, recipientCharacter)
      : { username: 'Inconnu', color: '#808080' }
    emissions.push({ to: 'room', event: WS.DICE_RESULT, data: {
      userId: recipientCharacter?.user_id ?? null, username: identity.username, color: identity.color,
      formula: '1d20', rolls: [roll], total: roll,
      isCriticalSuccess: testOutcome.isCriticalSuccess, isCriticalFail: testOutcome.isCriticalFail,
      catastropheRisk: false, // décision Saar 2026-09-11 — pas de Catastrophe sur un Test de Chance
      seed: null, timestamp: new Date().toISOString(),
      skillLabel: 'Test de Chance — Éviter la zone d\'effet',
      mechanicalTotal: sheet.chc, chancesDeReussite: sheet.chc + modifier,
      diffLabel: modifier >= 0 ? `+${modifier}` : `${modifier}`,
      isSuccess: testOutcome.isSuccess, mr: testOutcome.mr,
    } })
    outcome = testOutcome.isSuccess ? 'avoided' : 'hit'
  }

  // Jonction Aggregator — verrou consultatif Postgres scopé à l'action AOE (`pg_advisory_xact_lock`,
  // patron déjà validé ce chantier via `.forUpdate()` dans chanceService.js, ici un verrou de
  // transaction plutôt que de lignes : un simple comptage sans exclusion mutuelle laisserait DEUX
  // résolutions quasi simultanées se croire chacune « la dernière » si leurs lectures se chevauchent).
  // Le verrou n'entoure QUE l'écriture de cet `outcome` + le comptage — jamais `finalizeAoeResolution`
  // (potentiellement long : dégâts, plusieurs émissions), relâché avant de l'appeler.
  const { isLast, avoidedTokenIds } = await db.transaction(async (trx) => {
    await trx.raw('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [resolved.action_id])
    await trx('pending_chance_choices').where({ id: resolved.id }).update({ outcome })
    const remaining = await trx('pending_chance_choices')
      .where({ action_id: resolved.action_id, site: 'aoe_avoidance' })
      .whereNull('outcome')
      .count('* as n')
      .first()
    if (Number(remaining.n) > 0) return { isLast: false, avoidedTokenIds: [] }
    const avoidedRows = await trx('pending_chance_choices')
      .where({ action_id: resolved.action_id, site: 'aoe_avoidance', outcome: 'avoided' })
      .select('target_token_id')
    return { isLast: true, avoidedTokenIds: avoidedRows.map(r => r.target_token_id) }
  })

  const shooterUserId = groupCtx.ctx.character.user_id ?? null
  if (!isLast) {
    await flushDeferredEmissions(io, campaignId, shooterUserId, emissions)
    return
  }

  const finalized = await finalizeAoeResolution(io, campaignId, { ...groupCtx, avoidedTokenIds })
  await flushDeferredEmissions(io, campaignId, shooterUserId, [...emissions, ...finalized.emissions])
  await advanceTimeline(io, campaignId, { combatTimers, combatPreviews })
}

SITE_HANDLERS.aoe_avoidance = finishAoeAvoidanceChoice
