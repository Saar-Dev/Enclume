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
import { applyCriticalSuccessBonus, getCriticalSuccessBonus } from '../../../shared/polarisTestResolution.js'
import { RANGED_SITUATION_MODS, isImpossibleRangedSituation, TAILLE_MODS } from '../../../shared/combatSituationMods.js'
import { isTestBlockingWound } from '../../../shared/woundConstants.js'
import { parseWeaponRangeBands } from '../../../shared/combatRange.js'
import { getAoeMechanic } from '../../../shared/combatAoe.js'
import { calcDroneDegatsNets } from '../lib/charStats.js'
import * as damageService from '../lib/damageService.js'
import * as statusService from '../lib/statusService.js'
import * as exoAvarieService from '../lib/exoAvarieService.js'
import { maybeTriggerCatastrophe } from '../lib/catastropheService.js'
import { evaluateAoeVisibility } from '../services/worldVisibilityService.js'
import { getCampaignSettings } from '../lib/campaignSettingsService.js'
import { resolveCombatantTestContext, resolveCombatantDisplayIdentity } from '../lib/combatantContextService.js'
import { findAoeMechanismEntry } from '../lib/aoeMechanisms/registry.js'
import {
  resolveCriticalFailReroll,
  fetchAssaultWeaponAndMods,
  resolveDroneIntegrityLoss,
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
// Segment 2a (ce lot) : pj/pnj + exo. Drone : `null` explicite (Segment 2b, pas câblé) — le tronc
// traite ça comme « arme introuvable », message clair, même discipline que findAoeMechanismEntry pour
// un mécanisme inconnu.
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
  if (character.type === 'drone') return null // Segment 2b
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
// drone : no-op — `drone_weapons` n'a aucune colonne munitions (migration 39_drone_weapons.js), aucun
// tracking possible ; Segment 2b n'y changera rien (gap de schéma, pas de ce lot).
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
        roll: rollResult.rollAttaque, chancesDeReussite: rollResult.seuil, shockResult: r.shockResult,
      } })
    }
  }
  if (!isPnjResult) {
    emissions.push({ to: 'socket', event: WS.COMBAT_ATTACK_PLAYER_RESULT, data: {
      hit: perTargetResults.length > 0,
      roll: rollResult.rollAttaque,
      seuil: rollResult.seuil,
      tireurTokenId: action.token_id,
      cibleTokenId: null,
      targets: perTargetResults.map(p => ({ name: p.name, band: p.band, results: p.results })),
    } })
  }
  return emissions
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
// 2. Aucune colonne "Chance" n'existe nulle part dans le schéma (vérifié : grep sur toutes les
//    migrations, zéro résultat char_sheet). Le "Test de Chance" RAW à longue/extrême portée (évite
//    complètement d'être touché) n'est donc PAS auto-résolu par un faux jet inventé — la décision v4
//    (§5.2, "le serveur résout automatiquement") est affinée ici : en l'absence de tout score de Chance
//    modélisé, "automatique" veut dire "ignoré pour cette tranche", pas un jet fabriqué sans seuil réel.
//    Écart RAW explicite et documenté (CLAUDE.md §1.9), lié au chantier Chance déjà différé (ROADMAP §4).
// 3. Bonus de protection +3 (gilet pare-balles/couverture légère, spécifique à la dispersion de plombs)
//    et blocage par une cible interposée ("derrière une cible exposée") : non modélisés, gap RAW connu,
//    hors scope de cette tranche (nuance d'armure/occlusion par un combattant, pas une question d'AOE).
//
// Dual-wield non supporté ici (action.offhand_weapon_inv_id ignoré) — cas RAW marginal pour un fusil à
// pompe, simplification v1 assumée plutôt qu'un branchement non testé.
export async function resolveAoeAssaultAction(io, campaignId, action, confirmedModifiers, character, pendingMaps, options = {}) {
  console.log(`[DBG] resolveAoeAssaultAction — début token:${action.token_id} type_perso:${character.type}`)
  try {
    const emissions = []
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

    // Arme normalisée quel que soit le type de tireur (pj/pnj/exo — drone : Segment 2b, pas encore
    // câblé) — fetchAoeShooterWeapon ci-dessus, jamais action.weapon_inv_id lu en dur ici : ce champ
    // n'existe que pour un tireur humanoïde (exo/drone portent exo_weapon_inv_id/drone_weapon_inv_id).
    const weapon = await fetchAoeShooterWeapon(character, action)
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

    const thresholds = parseWeaponRangeBands(weapon.ref_range)
    if (!thresholds) {
      emissions.push({ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
        username: character.name, message: 'Tir en zone impossible — portée d\'arme non exploitable',
      } })
      return { suspend: false, emissions }
    }
    const amplitudeM = thresholds[thresholds.length - 1]

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

    const visibility = await evaluateAoeVisibility({
      battlemapId: shooterToken.battlemap_id, aoeShape, casterToken: shooterToken, losSource: 'caster',
    })
    if (visibility.status !== 'ok') return { suspend: false, emissions }

    ctx = { ...ctx, metrics: visibility.metrics }

    // ── Ciblage géométrique — spécifique au mécanisme (`mech.filterTargets`).
    const hitTargets = mech.filterTargets(ctx, visibility.targets)

    // ── Jet de tir unique (Phase A) — jamais de branche "raté" ici, voir commentaire de tête.
    const phaseA = await runAoePhaseA({ character, weapon, confirmedModifiers })
    if (phaseA.blocked) { emissions.push(phaseA.blocked); return { suspend: false, emissions } }
    const { rollResult, diceEmission, tireurColor, tireurUsername } = phaseA
    emissions.push(diceEmission)
    await maybeTriggerCatastrophe(io, campaignId, action.token_id, rollResult.catastropheRisk, {
      site: 'assault_aoe', actorTokenId: action.token_id, targetTokenId: null,
    })

    await decrementAoeShooterAmmo(campaignId, { character, weapon, action })

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
          roll: rollResult.rollAttaque, seuil: rollResult.seuil,
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

    // ── Persistance (§3) — une ligne combat_action_targets par cible (pseudo-cible incluse).
    const targetRowIdByTokenId = await insertAoeTargetRows({
      actionId: action.id, hitTargets: resolveTargets, modifierFn: mech.targetRowModifier,
    })

    // ── Dégât brut par cible — préparation commune aux deux mécanismes existants
    // (`getEffectiveWeaponDamage`/repli `ref_damage_h`, comme resolveAssaultAction), puis délégation
    // à `mech.computeTargetDamage` pour la formule propre au mécanisme (dispersion fusil à pompe,
    // 2D10 sec + Localisations lance-flammes).
    // getEffectiveWeaponDamage (ammo/mods-aware) est strictement char_inventory-only par construction
    // (damageService.js#_fetchWeaponAndAmmo) — jamais appelé pour exo/drone (ni l'un ni l'autre n'a de
    // munitions/mods dans ce sens, vérifié : resolveExoAssaultAction/resolveDroneAssaultAction ne
    // l'appellent jamais non plus). weapon.ref_damage_h (déjà résolu par fetchAoeShooterWeapon —
    // COALESCE override/catalogue côté exo) sert alors directement de baseRaw.
    const isHumanoidShooter = character.type === 'pj' || character.type === 'pnj'
    // Choc d'arme pour un tireur exo (docs/PLANS/PLAN_CHOC_EXO_DRONE.md Palier B) — indépendant de
    // `effectiveDamage`/`getEffectiveWeaponDamage` (ammo/mods-aware, strictement char_inventory-only,
    // inchangé ci-dessous) : le Choc est une propriété de l'arme elle-même, pas de la munition, donc
    // calculé une seule fois ici plutôt que par cible. Tireur drone : jamais atteint (fetchAoeShooterWeapon
    // renvoie déjà `null` pour un drone, `!weapon` a fait sortir la fonction plus haut, §Segment 2b
    // PLAN_ARMES_SPECIALES.md). `weapon.equipment_id` : garde une arme exo "maison" (label_override
    // sans ref_equipment_id, mêmes colonnes shock alors indéfinies).
    const shooterChocDsl = !isHumanoidShooter && weapon.equipment_id ? damageService.buildWeaponShockDsl({
      shock: weapon.ref_shock, shockMechanism: weapon.ref_shock_mechanism, reducedByArmor: weapon.ref_shock_reduced_by_armor,
    }) : null
    const perTargetInputs = []
    for (const ht of resolveTargets) {
      const effectiveDamage = isHumanoidShooter
        ? await damageService.getEffectiveWeaponDamage(db, action.weapon_inv_id, { rangeBand: ht.band ?? null })
        : null
      const baseRaw = effectiveDamage
        ? effectiveDamage.total
        : weapon.ref_damage_h ? (await parseDice(weapon.ref_damage_h.replace(/\s/g, ''))).total : 0
      const { degautsBruts, locationsCount, armorReductionFactor } = await mech.computeTargetDamage(ctx, ht, { effectiveDamage, baseRaw })
      perTargetInputs.push({ hitTarget: ht, degautsBruts, effectiveDamage, shooterChocDsl, locationsCount, armorReductionFactor })
    }

    // ── Générique : application par cible + finalisation (outcome + émissions + agrégat PJ).
    const shooter = { userId: character.user_id, tireurUsername, tireurColor }
    const perTargetResults = []
    for (const inp of perTargetInputs) {
      const ptr = await resolveAoeTargetDamage(io, campaignId, { ...inp, shooter })
      if (ptr) perTargetResults.push(ptr)
    }
    emissions.push(...await finalizeAoeResults({
      perTargetResults, targetRowIdByTokenId, isPnjResult, rollResult, action,
    }))

    // ── Effets post-résolution spécifiques au mécanisme (`mech.postResolve` — feu continu +
    // auto-éclaboussure pour le lance-flammes, aucun effet pour le fusil à pompe).
    emissions.push(...await mech.postResolve(io, campaignId, ctx, perTargetResults))

    return { suspend: false, emissions }
  } catch (err) {
    console.error('[WS] resolveAoeAssaultAction error:', err.message)
    return { suspend: false, emissions: [] }
  }
}
