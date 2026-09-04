// server/src/socket/socketCombatAoe.js
//
// Résolution de zone d'effet (AOE) en combat — extrait de socketCombatHelpers.js (2026-09-04,
// PLAN_ARMES_SPECIALES.md §1.4 segment 0a). Pur déplacement : aucun changement de comportement.
// Graphe d'import : ce module importe lib/services + 5 symboles de socketCombatHelpers.js
// (resolveCriticalFailReroll, fetchAssaultWeaponAndMods, resolveDroneIntegrityLoss, SITUATION_LABELS,
// TAILLE_LABELS) — jamais l'inverse. socketCombatResolution.js importe resolveAoeAssaultAction d'ici.

import { WS } from '../../../shared/events.js'
import db from '../db/knex.js'
import { parseDice } from '../lib/diceParser.js'
import { computeAttackRoll, computeAssaultRawDamage } from '../lib/combatAttackRoll.js'
import { applyCriticalSuccessBonus, getCriticalSuccessBonus } from '../../../shared/polarisTestResolution.js'
import { RANGED_SITUATION_MODS, isImpossibleRangedSituation, TAILLE_MODS } from '../../../shared/combatSituationMods.js'
import { isTestBlockingWound } from '../../../shared/woundConstants.js'
import { normalizeAoeShape, isPointInAoeShape } from '../../../shared/world/aoeShapes.js'
import { dbPositionToWorldPoint } from '../../../shared/world/worldMetrics.js'
import { resolveShotgunSpread, SHOTGUN_SPREAD_BY_BAND, parseWeaponRangeBands } from '../../../shared/combatRange.js'
import { getAoeMechanic } from '../../../shared/combatAoe.js'
import { calcDroneDegatsNets } from '../lib/charStats.js'
import * as damageService from '../lib/damageService.js'
import * as statusService from '../lib/statusService.js'
import * as exoAvarieService from '../lib/exoAvarieService.js'
import { maybeTriggerCatastrophe } from '../lib/catastropheService.js'
import { evaluateAoeVisibility } from '../services/worldVisibilityService.js'
import { getCampaignSettings } from '../lib/campaignSettingsService.js'
import { resolveCombatantTestContext } from '../lib/combatantContextService.js'
import {
  resolveCriticalFailReroll,
  fetchAssaultWeaponAndMods,
  resolveDroneIntegrityLoss,
  SITUATION_LABELS,
  TAILLE_LABELS,
} from './socketCombatHelpers.js'

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

// ─── Ciblage fusil à pompe — passe 2, PURE (segment 0d, PLAN_ARMES_SPECIALES.md §1.4) ──────────────
//
// Les candidats viennent d'une requête bulk sur le couloir le PLUS LARGE possible (sur-inclusif) ;
// chacun est ici retesté contre la largeur RÉELLE de son propre palier RAW — deux passes géométriques
// plutôt qu'une approximation d'un cône à largeur continue (PLAN_AOE.md §4/§6.2bis). Fonction pure :
// aucune DB, aucune émission — testable avec des candidats fixtures.
//
// Exclusions :
//  - le tireur lui-même : jamais une cible normale de sa propre gerbe. Auparavant exclu SEULEMENT par
//    accident (sa distance à l'origine ≈ 0 → palier bout portant → `spread.widthM === null` →
//    `continue` ci-dessous). Explicite ici — l'accident ne tient plus dès qu'une autre forme (cône
//    lance-flammes) n'a pas ce filtre bout-portant (PLAN_ARMES_SPECIALES.md #3) ;
//  - hors ligne de vue (couche 3, `evaluateAoeVisibility`) ;
//  - bout portant (< 2 m) : RAW « le tir ne touche qu'une cible », pas de zone géométrique — une
//    action de zone déclarée sans cible unique ne touche donc personne à cette distance en v1.
export function filterShotgunHitTargets({ visibilityTargets, shooterTokenId, origin, directionDeg, refRange, amplitudeM, metrics }) {
  const hitTargets = []
  for (const candidate of visibilityTargets) {
    if (candidate.tokenId === shooterTokenId) continue
    if (!candidate.hasLineOfSight) continue
    const range = resolveShotgunSpread(candidate.distanceToOriginM, refRange)
    if (range.status !== 'ok' || range.spread.widthM === null) continue
    const narrowShape = normalizeAoeShape({ shape: 'ray', origin, directionDeg, amplitudeM, widthM: range.spread.widthM })
    if (!isPointInAoeShape(candidate.position, narrowShape, metrics)) continue
    hitTargets.push({ ...candidate, band: range.band, spread: range.spread })
  }
  return hitTargets
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

// Décompte munitions — une seule cartouche pour toute la gerbe (RAW), pas par cible.
async function decrementAoeAmmo(campaignId, { character, weapon, action }) {
  const settings = await getCampaignSettings(db, campaignId)
  const skipDecrement = character.type === 'pnj' && settings.pnj_unlimited_ammo
  if (!skipDecrement && weapon.ammo_remaining !== null && weapon.ammo_remaining !== undefined) {
    const newRemaining = Math.max(0, weapon.ammo_remaining - (action.bullet_count ?? 1))
    await db('char_inventory').where({ id: action.weapon_inv_id }).update({ ammo_remaining: newRemaining })
  }
}

// Persistance (§3) — une ligne par cible touchée, écrite à la RÉSOLUTION. `modifierFn(ht)` fournit
// `damage_modifier` (fusil à pompe : `{ band, damageDice }`) ou null (mécanisme sans dispersion).
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

// Roule un dé signé de type "+1D10" / "-2D10" / "+0" → entier signé (0 pour "+0"/absent).
async function rollSignedDie(diceStr) {
  if (!diceStr || diceStr === '+0') return 0
  const sign = diceStr.startsWith('-') ? -1 : 1
  const rolled = await parseDice(diceStr.replace(/^[+-]/, ''))
  return sign * rolled.total
}

// resolveAoeTargetDamage — applique le dégât d'UNE cible touchée par une zone (dispatch drone/exo/
// humanoïde). AUCUNE émission COMBAT_ATTACK_RESULT ici (finalizeAoeResults les émet depuis `results`) ;
// les side-effects des services de dégât (EXO_AVARIE_UPDATED, WOUND_ADDED, Test de Choc, étourdissement)
// restent. Renvoie null si la cible n'a pas de fiche exploitable — jamais un throw.
// `locationsCount` : 1 pour le fusil à pompe, 1D3 pour le lance-flammes (humanoïde uniquement — un
// drone/une exo prend le dégât une seule fois). `armorReductionFactor` : 1 (défaut), 0.5 lance-flammes.
async function resolveAoeTargetDamage(io, campaignId, {
  hitTarget, degautsBruts, effectiveDamage, locationsCount = 1, armorReductionFactor = 1, shooter,
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
  // (localisation, armure, Blessure, Test de Choc propres) — même patron que resolveEnvironmentalHazardTicks.
  const results = []
  for (let i = 0; i < Math.max(1, locationsCount); i += 1) {
    const hitResult = await damageService.resolveTargetHit(io, db, campaignId, {
      degautsBruts, characterIdCible: cibleToken?.character_id ?? null,
      cibleType, char_sheet_id_cible, for_na_cible, con_na_cible, vol_na_cible,
      chocDsl: effectiveDamage ? effectiveDamage.choc : null,
      ammoFx: effectiveDamage ? (effectiveDamage.tags?.FX ?? null) : null,
      armorReductionFactor,
    })
    if (!hitResult) continue
    const { localisation, degatsNets, is_lethal, finalSeverity, shockResult } = hitResult
    if (shockResult) statusService.emitShockDiceResult(io, campaignId, shockResult, shooter.userId, shooter.tireurUsername, shooter.tireurColor)
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

// ─── Couche 4 AOE, phase B — orchestration (docs/PLANS/PLAN_AOE.md §8 + PLAN_ARMES_SPECIALES.md §1.4) ─
//
// resolveAoeAssaultAction — tronc mince : gates → géométrie/LOS → `filterShotgunHitTargets` → Phase A
// (`runAoePhaseA`) → munitions → bloc mécanisme `shotgun_spread` (persistance + dégât brut par cible)
// → générique (`resolveAoeTargetDamage` × cibles + `finalizeAoeResults`). Résolution IMMÉDIATE pour
// tout type de tireur (le différé armAwaitingDamage/confirmDamage a été envisagé pour le PJ puis
// écarté — PLAN_AOE.md §5.1 : il suppose UNE cible en attente, N pending d'un seul appel corrompent
// la fenêtre client). Différence PJ vs PNJ (`isPnjResult`) : le PJ reçoit UN COMBAT_ATTACK_PLAYER_RESULT
// agrégé (fenêtre-reçu non bloquante) au lieu d'un COMBAT_ATTACK_RESULT par entrée `results`.
//
// Identification de l'arme par `aoe_profile.mechanic` (donnée catalogue, `shared/combatAoe.js`,
// segment 0b) — plus par nom en dur. Le lance-flammes ajoutera son bloc mécanisme frère (segment 1).
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
    // Le seul jet joueur qui compte pour une arme de zone est le Test de tir (Phase A, déclenché par le
    // « Lancer » de CombatModifiersWindow). Le pipeline différé armAwaitingDamage/confirmDamage suppose
    // UNE cible en attente ; N pending d'un seul appel corrompent la fenêtre côté client — écarté.
    // Différence PJ vs PNJ : les résultats par cible sont agrégés dans UN COMBAT_ATTACK_PLAYER_RESULT
    // (fenêtre-reçu, non bloquant) au lieu d'un COMBAT_ATTACK_RESULT par cible destiné au MJ.
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

    if (!action.weapon_inv_id) return { suspend: false, emissions }
    const { weapon } = await fetchAssaultWeaponAndMods(action.weapon_inv_id, character.id)
    if (!weapon?.equipment_id) {
      console.warn(`[WS] resolveAoeAssaultAction — arme introuvable. weapon_inv_id:${action.weapon_inv_id}`)
      return { suspend: false, emissions }
    }
    // Identification par la donnée catalogue `aoe_profile.mechanic` (segment 0b, shared/combatAoe.js),
    // plus par `ref_name` en dur. Ce resolver ne gère que `shotgun_spread` pour l'instant — les autres
    // mécanismes (flamethrower...) sont rejetés avec un message clair jusqu'à leur branche dédiée
    // (segment 0d/1).
    if (getAoeMechanic(weapon.ref_aoe_profile) !== 'shotgun_spread') {
      const mech = getAoeMechanic(weapon.ref_aoe_profile)
      emissions.push({ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
        username: character.name,
        message: mech
          ? `${weapon.ref_name ?? 'Cette arme'} — résolution de zone « ${mech} » pas encore implémentée.`
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
    // Couloir géométrique le plus large possible (longue/extrême, 3m) pour la requête bulk — filtre
    // grossier volontairement sur-inclusif, chaque candidat est retesté plus bas avec la largeur RÉELLE
    // de son propre palier (PLAN_AOE.md §4/§6.2bis : un cône à angle fixe ne modélise pas exactement une
    // largeur qui croît par PALIERS discrets — deux passes géométriques plutôt qu'une approximation).
    const coarseWidthM = Math.max(...Object.values(SHOTGUN_SPREAD_BY_BAND).map(band => band.widthM || 0))

    const origin = dbPositionToWorldPoint(shooterToken)
    let aoeShape
    try {
      aoeShape = normalizeAoeShape({ shape: 'ray', origin, directionDeg: aoe.direction, amplitudeM, widthM: coarseWidthM })
    } catch (shapeErr) {
      console.warn(`[WS] resolveAoeAssaultAction — forme AOE invalide: ${shapeErr.message}`)
      return { suspend: false, emissions }
    }

    const visibility = await evaluateAoeVisibility({
      battlemapId: shooterToken.battlemap_id, aoeShape, casterToken: shooterToken, losSource: 'caster',
    })
    if (visibility.status !== 'ok') return { suspend: false, emissions }

    const metrics = visibility.metrics
    const hitTargets = filterShotgunHitTargets({
      visibilityTargets: visibility.targets,
      shooterTokenId: action.token_id,
      origin, directionDeg: aoe.direction,
      refRange: weapon.ref_range, amplitudeM, metrics,
    })

    // ── Jet de tir unique (Phase A) — jamais de branche "raté" ici, voir commentaire de tête.
    const phaseA = await runAoePhaseA({ character, weapon, confirmedModifiers })
    if (phaseA.blocked) { emissions.push(phaseA.blocked); return { suspend: false, emissions } }
    const { rollResult, diceEmission, tireurColor, tireurUsername } = phaseA
    emissions.push(diceEmission)
    await maybeTriggerCatastrophe(io, campaignId, action.token_id, rollResult.catastropheRisk, {
      site: 'assault_aoe', actorTokenId: action.token_id, targetTokenId: null,
    })

    await decrementAoeAmmo(campaignId, { character, weapon, action })

    if (hitTargets.length === 0) {
      // La gerbe est partie (RAW), personne dans le couloir. Jamais un COMBAT_ATTACK_RESULT « cible
      // unique » ici : le panneau hit/miss afficherait « Touché » sur une cible « ? » à 0 dégât dès
      // que le jet Phase A réussit (le Test de tir n'est pas un hit/miss d'action pour une zone).
      // → une ligne système en chat pour tout le monde ; le tireur PJ ferme sa fenêtre via aoeNoTargets.
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

    // ── Mécanisme `shotgun_spread` : persistance + dégât brut par cible (dé de dispersion du palier RAW).
    const targetRowIdByTokenId = await insertAoeTargetRows({
      actionId: action.id, hitTargets,
      modifierFn: (ht) => ({ band: ht.band, damageDice: ht.spread.damageDice }),
    })

    const perTargetInputs = []
    for (const ht of hitTargets) {
      // Formule ammo-aware (comme resolveAssaultAction) + dé de dispersion signé du palier RAW propre
      // à CETTE cible (§4). `portee: ht.band` ne fait que gater fire_mode_bonus_dmg au contact.
      const effectiveDamage = await damageService.getEffectiveWeaponDamage(db, action.weapon_inv_id, { rangeBand: ht.band })
      const baseRaw = effectiveDamage
        ? effectiveDamage.total
        : weapon.ref_damage_h ? (await parseDice(weapon.ref_damage_h.replace(/\s/g, ''))).total : 0
      const spreadRaw = await rollSignedDie(ht.spread.damageDice)
      const degautsBruts = computeAssaultRawDamage({
        rawDice: baseRaw + spreadRaw, mr: rollResult.mr, portee: ht.band, fireModeBonusDmg: action.fire_mode_bonus_dmg,
      })
      perTargetInputs.push({ hitTarget: ht, degautsBruts, effectiveDamage, locationsCount: 1, armorReductionFactor: 1 })
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

    return { suspend: false, emissions }
  } catch (err) {
    console.error('[WS] resolveAoeAssaultAction error:', err.message)
    return { suspend: false, emissions: [] }
  }
}
