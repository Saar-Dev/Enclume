// server/src/socket/socketCombatExo.js — Résolution Tir/CaC exo-armure (PLAN_EXOARMURE.md §16.4)
//
// Module dédié (2026-08-26, retour Saar sur l'organisation du fichier) — plutôt que d'empiler encore
// dans socketCombatHelpers.js (déjà volumineux), le code propre à l'exo vit ici, dans SON PROPRE
// fragment. Ce fichier ne réimplémente rien : il compose des primitives déjà génériques, exportées
// depuis socketCombatHelpers.js (portée/LOS, dispatch de dégâts par type de cible pour le Tir,
// branchement de défense active pour le CaC) et combatantContextService.js (Seuil du pilote,
// substitution EXF, plafond Manœuvre d'armure déjà appliqué). Voir docs/ROADMAP.md §5 pour la dette
// d'architecture plus large identifiée en écrivant ce module (dispatch attaquant×action incohérent
// entre Tir et CaC, resolveDroneAssaultAction qui mélange encore Tir/CaC) — non traitée ici,
// délibérément, pour ne pas mélanger un rework structurel avec l'ajout de fonctionnalité.
import { WS } from '../../../shared/events.js'
import db from '../db/knex.js'
import { parseDice } from '../lib/diceParser.js'
import { applyCriticalSuccessBonus, getCriticalSuccessBonus } from '../../../shared/polarisTestResolution.js'
import { computeAttackRoll } from '../lib/combatAttackRoll.js'
import { getCampaignSettings } from '../lib/campaignSettingsService.js'
import { maybeTriggerCatastrophe } from '../lib/catastropheService.js'
import { resolveCombatantTestContext, resolveCombatantIdentity } from '../lib/combatantContextService.js'
import { isTestBlockingWound } from '../../../shared/woundConstants.js'
import {
  isImpossibleRangedSituation, RANGED_SITUATION_MODS, sumRangedSituationMods,
  CAC_SITUATION_MODS, TAILLE_MODS, PORTEE_MOD_COMP,
} from '../../../shared/combatSituationMods.js'
import {
  isTargetDefenseless,
  checkMeleeReach, resolveRangedDistance, resolveAttackLOS,
  resolveCriticalFailReroll,
  resolveAttackHitDrone, resolveAttackHitExo, resolveAttackHitPnj, resolveAttackHitPj,
  resolveDefenselessTarget, resolveMeleeDefensePnj, resolveMeleeDefenseDrone, resolveMeleeDefensePj,
  PORTEE_LABELS, TAILLE_LABELS, SITUATION_LABELS,
} from './socketCombatHelpers.js'

// ─── resolveExoAssaultAction — résolution Tir exo-armure ───────────────────────────────────────────
// Appelée depuis resolveAssaultAction (socketCombatHelpers.js) quand character.type === 'exo'.
// Mirroir structurel de resolveDroneAssaultAction pour la portée/LOS (helpers partagés) — mais le
// Seuil suit le pipeline humanoïde réel (resolveCombatantTestContext → pilote + EXF + plafond
// Manœuvre d'armure déjà appliqué, §16.2.1/16.2.2), pas un programme.level à plat comme un drone : un
// pilote d'exo est un PJ/PNJ avec de vraies Compétences, contrairement à un drone. Dispatch de dégâts
// par type de cible entièrement réutilisé (resolveAttackHit*) — aucune réécriture de l'application
// des dégâts, déjà générique.
//
// Simplifications documentées (RAW non couvert par ce Lot, pas un oubli silencieux, CLAUDE.md §1.9) :
// - Bouclier adverse (malus Armes de jet/trait) omis — aucune arme exo cataloguée n'est de cette
//   catégorie à ce jour (§16.2.4, 4 armes = Arme à énergie/Lance-harpon), toujours 0 en pratique.
// - Mods d'arme (Lunette...), Tir visé, Localisation visée, dual-wield, Tir Multi : tous exclus dès
//   la Déclaration (socketCombatAnnouncement.js) — aucune donnée à consommer ici.
// - Arme exo "maison" (label_override sans ref_equipment_id) : `effective_formula` sera toujours null
//   (exo_weapons n'a pas de colonne damage_formula propre, contrairement à drone_weapons) — bail-out
//   gracieux ci-dessous, jamais un crash. Gap de schéma pré-existant (Lot C), pas introduit ici.
export async function resolveExoAssaultAction(io, campaignId, action, confirmedModifiers, character, pendingMaps, options = {}) {
  console.log(`[DBG] resolveExoAssaultAction — début token:${action.token_id} exo_weapon:${action.exo_weapon_inv_id} target:${action.target_token_id}`)
  try {
    const emissions = []
    if (isImpossibleRangedSituation(confirmedModifiers?.situation ?? [])) {
      emissions.push({ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
        username: character.name,
        message: 'Tir impossible — Allure maximale du tireur ou obscurité totale',
      } })
      return { suspend: false, emissions }
    }
    if (!action.exo_weapon_inv_id || !action.target_token_id) return { suspend: false, emissions }

    // 1. Arme exo — re-vérifiée à la Résolution (combat.md : seule la Résolution vérifie ce qui est
    // réellement possible), jamais confiance au fetch de la Déclaration (arme a pu être retirée du
    // loadout entre-temps, ownership rescopée sur character.id).
    const weapon = await db('exo_weapons')
      .leftJoin('ref_equipment', 'exo_weapons.ref_equipment_id', 'ref_equipment.id')
      .where({ 'exo_weapons.id': action.exo_weapon_inv_id, 'exo_weapons.character_id': character.id })
      .select(
        'exo_weapons.ref_equipment_id as equipment_id',
        'exo_weapons.ammo_remaining',
        'ref_equipment.range as ref_range',
        'ref_equipment.damage_h as effective_formula',
        db.raw(`COALESCE(exo_weapons.label_override, ref_equipment.name) as display_name`),
      )
      .first()

    if (!weapon?.effective_formula) {
      console.warn(`[WS] resolveExoAssaultAction — arme sans formule. exo_weapon_inv_id:${action.exo_weapon_inv_id}`)
      emissions.push({ to: 'room', event: WS.DICE_RESULT, data: {
        userId: null, username: character.name ?? 'Exo-armure', color: '#808080',
        formula: '—', rolls: [], total: 0,
        isCriticalSuccess: false, isCriticalFail: false, seed: null,
        timestamp: new Date().toISOString(),
        skillLabel: 'Armement exo — arme sans formule de dégâts',
        mechanicalTotal: 0, diffLabel: '', chancesDeReussite: 0, isSuccess: false,
      } })
      return { suspend: false, emissions }
    }
    const formula = weapon.effective_formula.replace(/\s/g, '')

    // 2. Portée (helper partagé)
    console.log(`[DBG] resolveExoAssaultAction — avant resolveRangedDistance`)
    const range = await resolveRangedDistance({ action, character, refRange: weapon.ref_range, emissions })
    console.log(`[DBG] resolveExoAssaultAction — après resolveRangedDistance, ok:${range.ok}`)
    if (!range.ok) return { suspend: false, emissions }
    const authoritativeRangeBand = range.band

    // 3. LOS (helper partagé) — le rappel récursif reste local (identité de fonction propre).
    if (!options.skipLos) {
      console.log(`[DBG] resolveExoAssaultAction — avant resolveAttackLOS`)
      const losResult = await resolveAttackLOS({ io, campaignId, action, character })
      console.log(`[DBG] resolveExoAssaultAction — après resolveAttackLOS, blocked:${losResult.blocked} intercepted:${losResult.intercepted}`)
      if (losResult.blocked) return { suspend: false, emissions }
      if (losResult.intercepted) {
        return resolveExoAssaultAction(io, campaignId,
          { ...action, target_token_id: losResult.newTargetTokenId },
          confirmedModifiers, character, pendingMaps, { skipLos: true })
      }
      options.coverageModifier = losResult.coverageModifier
    }

    const [rosterTireur, settings] = await Promise.all([
      db('combat_roster').where({ campaign_id: campaignId, token_id: action.token_id }).first(),
      getCampaignSettings(db, campaignId),
    ])

    const userRow = character.user_id
      ? await db('users').where({ id: character.user_id }).select('color', 'username').first()
      : null
    const tireurColor    = userRow?.color    ?? '#808080'
    const tireurUsername = userRow?.username ?? character.name ?? 'Exo-armure'

    // 4. Compétence associée à l'arme (§16.2.4) — même autorité que resolveAssaultAction, jamais un
    // skillId codé en dur. Chaîne vide si absente (force le palier complet plutôt que le palier NA
    // seul — même convention que resolveAssaultAction).
    const skillAssoc = weapon.equipment_id
      ? await db('ref_equipment_skill_assoc').where({ item_id: weapon.equipment_id }).first()
      : null

    // 5. Contexte de Test du pilote — resolveCombatantTestContext dispatche déjà vers
    // resolveExoTestContext pour character.type==='exo' (pilote + Exo-Force + plafond Manœuvre
    // d'armure inconditionnel, §16.2.1/16.2.2). null si pas de pilote/armure non configurée/Test de
    // Manœuvre impossible (hybride sans choix posé, §16.2.5) — jamais un crash, un jet à Seuil 0.
    const ctxTireur = await resolveCombatantTestContext(db, character, skillAssoc?.skill_id ?? '')
    if (!ctxTireur) {
      emissions.push({ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
        username: character.name,
        message: 'Tir impossible — aucun pilote assigné, armure non configurée, ou Test de Manœuvre impossible (milieu hybride sans choix posé)',
      } })
      return { suspend: false, emissions }
    }
    // WNDMORT — défense en profondeur (garde principal à la Déclaration, ceci couvre le cas rare
    // d'un pilote mortellement blessé entre Annonce et Résolution). ctxTireur.sheetId = celle du
    // pilote (resolveExoTestContext), jamais celle de l'exo (qui n'en a pas).
    const woundsTireur = await db('character_wounds').where({ char_sheet_id: ctxTireur.sheetId })
    if (isTestBlockingWound(woundsTireur)) {
      emissions.push({ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
        username: character.name, message: 'Blessure mortelle (pilote) — aucune action de Test possible',
      } })
      return { suspend: false, emissions }
    }

    // DEF5 — cible sans défense, même règle que le Tir humanoïde (target-side, indépendant du tireur).
    const targetDefenseless = await isTargetDefenseless(campaignId, action.target_token_id, settings)
    const sansDefenseBonus = targetDefenseless ? 5 : 0

    const porteeModComp    = PORTEE_MOD_COMP[authoritativeRangeBand]?.mod ?? 0
    const situationModComp = sumRangedSituationMods(confirmedModifiers?.situation ?? [])
    const tailleModComp    = TAILLE_MODS[confirmedModifiers?.taille]?.mod ?? 0
    const isRushedMod      = rosterTireur?.state_vitesse === 'rushed' ? -5 : 0
    const coverageModifier = options.coverageModifier ?? 0

    const { total: rollAttaque, rolls: attackRolls, seed: attackSeed } = await parseDice('1d20')
    const assaultOutcome0 = computeAttackRoll({
      skillLabel: 'Compétence', skillTotal: ctxTireur.skillTotal, totalLabel: 'Seuil', rollAttaque,
      contributions: [
        { label: PORTEE_LABELS[authoritativeRangeBand] ?? authoritativeRangeBand, value: porteeModComp, type: porteeModComp > 0 ? 'bonus' : 'malus' },
        { label: 'Cible sans défense', value: sansDefenseBonus, type: 'bonus' },
        ...((confirmedModifiers?.situation ?? []).map(k => {
          const v = RANGED_SITUATION_MODS[k]?.mod ?? 0
          return { label: SITUATION_LABELS[k] ?? k, value: v, type: v > 0 ? 'bonus' : 'malus' }
        })),
        { label: TAILLE_LABELS[confirmedModifiers?.taille] ?? confirmedModifiers?.taille, value: tailleModComp, type: tailleModComp > 0 ? 'bonus' : 'malus' },
        { label: 'Précipitation', value: isRushedMod, type: 'malus' },
        { label: 'Malus santé / encombrement (pilote)', value: ctxTireur.effectiveMalus, type: 'malus' },
        { label: 'Couverture cible', value: coverageModifier, type: 'malus' },
      ],
    })
    const assaultOutcomeCrit = applyCriticalSuccessBonus(assaultOutcome0, getCriticalSuccessBonus({ masteryLevel: ctxTireur.mastery }))
    const { seuil: chancesDeReussite, breakdown, isSuccess, mr } = assaultOutcomeCrit
    const assaultOutcome = await resolveCriticalFailReroll(assaultOutcomeCrit)
    console.log(`[WS] resolveExoAssaultAction — roll:${rollAttaque} Seuil:${chancesDeReussite} → ${isSuccess ? 'TOUCHE' : 'RATÉ'} MR:${mr}`)
    emissions.push({ to: 'room', event: WS.DICE_RESULT, data: {
      userId: character.user_id ?? null, username: tireurUsername, color: tireurColor,
      formula: '1d20', rolls: attackRolls, total: rollAttaque,
      isCriticalSuccess: assaultOutcome.isCriticalSuccess, isCriticalFail: assaultOutcome.isCriticalFail,
      catastropheRisk: assaultOutcome.catastropheRisk,
      seed: attackSeed, timestamp: new Date().toISOString(),
      skillLabel: `${weapon.display_name ?? 'Armement'} — Exo-armure`,
      mechanicalTotal: ctxTireur.skillTotal,
      diffLabel: chancesDeReussite - ctxTireur.skillTotal >= 0 ? `+${chancesDeReussite - ctxTireur.skillTotal}` : `${chancesDeReussite - ctxTireur.skillTotal}`,
      chancesDeReussite, isSuccess, mr, breakdown,
    } })
    await maybeTriggerCatastrophe(io, campaignId, action.token_id, assaultOutcome.catastropheRisk, {
      site: 'exo_assault', actorTokenId: action.token_id, targetTokenId: action.target_token_id,
    })

    // Décompte munitions (§16.2.3) — quel que soit le résultat (touché ou raté), même convention que
    // le Tir humanoïde. Skip si ammo_remaining NULL (tracking désactivé — toute arme exo aujourd'hui,
    // aucun mécanisme d'init/rechargement construit).
    if (weapon.ammo_remaining !== null && weapon.ammo_remaining !== undefined) {
      const bulletsFired = action.bullet_count ?? 1
      const newRemaining = Math.max(0, weapon.ammo_remaining - bulletsFired)
      await db('exo_weapons').where({ id: action.exo_weapon_inv_id }).update({ ammo_remaining: newRemaining })
    }

    if (!isSuccess) {
      emissions.push({ to: 'room', event: WS.COMBAT_ATTACK_RESULT, data: {
        tireurId: action.token_id, cibleId: action.target_token_id,
        localisation: null, degautsBruts: 0, degatsNets: 0,
        severity: null, is_lethal: false, isSuccess: false, shockResult: null,
      } })
      return { suspend: false, emissions }
    }

    // 6. Identifier la cible + dispatch dégâts — entièrement réutilisé, aucune réécriture.
    const cibleToken     = await db('tokens').where({ id: action.target_token_id }).first()
    const cibleCharacter = cibleToken?.character_id
      ? await db('characters').where({ id: cibleToken.character_id }).first()
      : null
    const now = new Date().toISOString()
    const ctx = { action, cibleCharacter, formula, mr, portee: authoritativeRangeBand, tireurUsername, tireurColor, userId: character.user_id ?? null, now }
    if (cibleCharacter?.type === 'drone') return await resolveAttackHitDrone(io, campaignId, ctx, emissions)
    if (cibleCharacter?.type === 'exo')   return await resolveAttackHitExo(io, campaignId, ctx, emissions)
    if (!cibleCharacter || cibleCharacter.type === 'pnj') return await resolveAttackHitPnj(io, campaignId, ctx, emissions)
    return await resolveAttackHitPj(io, campaignId, ctx, emissions)

  } catch (err) {
    console.error('[WS] resolveExoAssaultAction error:', err.message)
    return { suspend: false, emissions: [] }
  }
}

// ─── resolveExoMeleeAction — résolution CaC exo-armure ─────────────────────────────────────────────
// Appelée depuis socketCombatResolution.js quand action.type==='melee' && character.type==='exo'.
// Décision Saar (2026-08-26, "Option B") : une exo-armure au corps à corps affronte une VRAIE défense
// active de la cible (jet opposé), exactement comme un humain — jamais l'auto-résolution simplifiée
// du CaC drone. Le branchement défenseur (sans-défense/PNJ/drone/PJ) est donc réutilisé tel quel
// depuis resolveMeleeAction (resolveDefenselessTarget/resolveMeleeDefensePnj/resolveMeleeDefenseDrone/
// resolveMeleeDefensePj, déjà génériques sur `commonPending`, jamais réécrits ici) — seule la moitié
// ATTAQUANT (arme exo, Seuil du pilote, contributions) est propre à ce module.
//
// Simplifications documentées (pas un oubli silencieux, CLAUDE.md §1.9) — à reprendre si un combat
// exo réel en CaC les rend nécessaires (voir docs/ROADMAP.md §5) :
// - Malus multi-adversaires (attaquant ET défenseur) omis — nécessite countAdversaires/rosterTokens
//   (resolveMeleeAction), jamais vérifié compatible avec un token exo sans un vrai cas de jeu.
// - Terrain instable / Acrobatie-Équilibre omis — mécanique secondaire, dépend de measurement.
//   sourceEffectRegions, non repris ici pour garder ce premier jet borné.
// - Bonus de mode de combat (Charge/Offensif +3, Défensif) omis — aucune UI exo ne pose encore
//   state.combat_mode autrement qu'à 'normal' (Étape A ne couvre que le déplacement simple).
// - Deux armes au contact : structurellement N/A (RAW, une exo n'a qu'une seule Attaque/Tour, déjà
//   exclu à la Déclaration).
export async function resolveExoMeleeAction(io, campaignId, action, character, confirmedModifiers, pendingMaps) {
  console.log(`[DBG] resolveExoMeleeAction — début token:${action.token_id} exo_weapon:${action.exo_weapon_inv_id} target:${action.target_token_id}`)
  try {
    const emissions = []
    const targetTokenId = action.target_token_id
    if (!action.exo_weapon_inv_id || !targetTokenId) return { suspend: false, emissions }

    // 1. Arme exo — re-vérifiée à la Résolution. category !== 'Arme de contact' couvre aussi bien une
    // arme désinstallée qu'une arme "maison" sans ref_equipment_id (LEFT JOIN → category null) — même
    // garde que la Déclaration (socketCombatAnnouncement.js), jamais un second critère divergent.
    const weapon = await db('exo_weapons')
      .leftJoin('ref_equipment', 'exo_weapons.ref_equipment_id', 'ref_equipment.id')
      .where({ 'exo_weapons.id': action.exo_weapon_inv_id, 'exo_weapons.character_id': character.id })
      .select(
        'exo_weapons.ref_equipment_id as equipment_id',
        'ref_equipment.range as ref_range',
        'ref_equipment.damage_h as damage_formula',
        'ref_equipment.category',
        db.raw(`COALESCE(exo_weapons.label_override, ref_equipment.name) as display_name`),
      )
      .first()
    if (!weapon || weapon.category !== 'Arme de contact') {
      console.warn(`[WS] resolveExoMeleeAction — arme introuvable ou pas une arme de contact. exo_weapon_inv_id:${action.exo_weapon_inv_id}`)
      return { suspend: false, emissions }
    }

    // 2. Portée (allonge, helper partagé)
    const reach = await checkMeleeReach({ action, character, refRange: weapon.ref_range, emissions })
    if (!reach.ok) return { suspend: false, emissions }

    // 3. Compétence associée à l'arme (§16.2.4)
    const skillAssoc = weapon.equipment_id
      ? await db('ref_equipment_skill_assoc').where({ item_id: weapon.equipment_id }).first()
      : null

    // 4. Contexte de Test du pilote (Seuil, malus, Manœuvre d'armure déjà plafonnée)
    const ctx = await resolveCombatantTestContext(db, character, skillAssoc?.skill_id ?? '')
    if (!ctx) {
      emissions.push({ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
        username: character.name,
        message: 'Corps à corps impossible — aucun pilote assigné, armure non configurée, ou Test de Manœuvre impossible (milieu hybride sans choix posé)',
      } })
      return { suspend: false, emissions }
    }
    // WNDMORT — défense en profondeur, même raison que resolveExoAssaultAction.
    const woundsAttaquant = await db('character_wounds').where({ char_sheet_id: ctx.sheetId })
    if (isTestBlockingWound(woundsAttaquant)) {
      emissions.push({ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
        username: character.name, message: 'Blessure mortelle (pilote) — aucune action de Test possible',
      } })
      return { suspend: false, emissions }
    }
    const attackerSkillTotal      = ctx.skillTotal
    const effectiveMalusAttaquant = ctx.effectiveMalus
    const modDom                  = ctx.modDom

    const [rosterAttaquant, settings, targetShield] = await Promise.all([
      db('combat_roster').where({ campaign_id: campaignId, token_id: action.token_id }).first(),
      getCampaignSettings(db, campaignId),
      // Bouclier de la CIBLE — malus au Test d'attaque, jamais gaté par catégorie d'arme au contact
      // (contrairement au Tir, qui ne l'applique qu'aux armes de jet/trait) — même règle que
      // resolveMeleeAction.
      db('char_inventory_slots as cis')
        .join('char_inventory', 'char_inventory.id', 'cis.char_inventory_id')
        .join('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
        .join('tokens', 'tokens.character_id', 'char_inventory.character_id')
        .where('tokens.id', targetTokenId)
        .whereIn('cis.slot_code', ['MG', 'MD'])
        .where('ref_equipment.category', 'Bouclier')
        .select('ref_equipment.shield_atk_malus as malus')
        .first(),
    ])
    const shieldAtkMalus = targetShield?.malus ?? 0
    const targetDefenseless = await isTargetDefenseless(campaignId, targetTokenId, settings)
    const sansDefenseBonus  = targetDefenseless ? 5 : 0
    const isRushedMod       = rosterAttaquant?.state_vitesse === 'rushed' ? -5 : 0

    const situationMods    = confirmedModifiers?.situation ?? []
    const situationModComp = situationMods.reduce((sum, k) => sum + (CAC_SITUATION_MODS[k]?.mod ?? 0), 0)
    const tailleMod         = TAILLE_MODS[confirmedModifiers?.taille ?? 'moyenne']?.mod ?? 0

    const userRow = character.user_id
      ? await db('users').where({ id: character.user_id }).select('color', 'username').first()
      : null
    const attackerColor    = userRow?.color    ?? '#808080'
    const attackerUsername = userRow?.username ?? character.name ?? 'Exo-armure'

    const { total: rollAttaque, rolls: attackRolls, seed: attackSeed } = await parseDice('1d20')
    const attaqueOutcome0 = computeAttackRoll({
      skillLabel: 'Compétence', skillTotal: attackerSkillTotal, totalLabel: 'Seuil', rollAttaque,
      contributions: [
        { label: 'Précipitation', value: isRushedMod, type: 'malus' },
        { label: 'Malus santé / encombrement (pilote)', value: effectiveMalusAttaquant, type: 'malus' },
        { label: 'Mods situation', value: situationModComp, type: situationModComp > 0 ? 'bonus' : 'malus' },
        { label: 'Taille cible', value: tailleMod, type: tailleMod > 0 ? 'bonus' : 'malus' },
        { label: 'Bouclier adverse', value: shieldAtkMalus, type: 'malus' },
        { label: 'Cible sans défense', value: sansDefenseBonus, type: 'bonus' },
      ],
    })
    const { seuil: chancesAttaque, breakdown: breakdownAtk } = attaqueOutcome0
    const attaqueOutcomeCrit = applyCriticalSuccessBonus(attaqueOutcome0, getCriticalSuccessBonus({ masteryLevel: ctx.mastery }))
    const attaqueOutcome = await resolveCriticalFailReroll(attaqueOutcomeCrit)
    console.log(`[WS] resolveExoMeleeAction — roll:${rollAttaque} Seuil:${chancesAttaque} token:${action.token_id}`)
    emissions.push({ to: 'room', event: WS.DICE_RESULT, data: {
      userId: character.user_id ?? null, username: attackerUsername, color: attackerColor,
      formula: '1d20', rolls: attackRolls, total: rollAttaque,
      isCriticalSuccess: attaqueOutcome.isCriticalSuccess, isCriticalFail: attaqueOutcome.isCriticalFail,
      catastropheRisk: attaqueOutcome.catastropheRisk,
      seed: attackSeed, timestamp: new Date().toISOString(),
      skillLabel: `${weapon.display_name ?? 'Armement'} — Exo-armure`,
      mechanicalTotal: attackerSkillTotal,
      diffLabel: chancesAttaque - attackerSkillTotal >= 0 ? `+${chancesAttaque - attackerSkillTotal}` : `${chancesAttaque - attackerSkillTotal}`,
      chancesDeReussite: chancesAttaque, isSuccess: attaqueOutcome.isSuccess, mr: attaqueOutcome.mr, breakdown: breakdownAtk,
    } })
    await maybeTriggerCatastrophe(io, campaignId, action.token_id, attaqueOutcome.catastropheRisk, {
      site: 'exo_melee', actorTokenId: action.token_id, targetTokenId,
    })

    // ── Cible ────────────────────────────────────────────────────────────────
    const targetToken = await db('tokens').where({ id: targetTokenId }).first()
    if (!targetToken?.character_id) {
      emissions.push({ to: 'room', event: WS.COMBAT_MELEE_RESULT, data: {
        attaquantId: action.token_id, defenseurId: targetTokenId,
        rollAttaque, chancesAttaque, rollDefense: null, chanceDefense: null, hit: false,
      } })
      return { suspend: false, emissions }
    }
    const defenderCharacter = await db('characters').where({ id: targetToken.character_id }).first()
    if (!defenderCharacter) return { suspend: false, emissions }
    const targetName = defenderCharacter.name ?? targetToken.label ?? 'Cible'

    // Identité EFFECTIVE du défenseur (pilote si exo) — copie exacte du bloc resolveMeleeAction, non
    // spécifique à l'attaquant : le routage de la confirmation de défense doit suivre le pilote du
    // défenseur qu'il soit attaqué par un humain, un drone ou une exo (PLAN_EXOARMURE.md Lot 2 §7.7).
    const { sheetId: sheetIdCible, userId: defenderEffectiveUserId, effectiveType: defenderEffectiveType } =
      await resolveCombatantIdentity(db, defenderCharacter)
    let defenderSkillTotal = 0, defenderEffectiveMalus = 0, defenderMastery = 0
    let for_na_cible = 8, con_na_cible = 8, vol_na_cible = 8
    let char_sheet_id_cible = null

    if (sheetIdCible) {
      const [identityCible, defContactWeapons] = await Promise.all([
        db('char_identity').where({ char_sheet_id: sheetIdCible }).first(),
        db('char_inventory_slots as cis')
          .join('char_inventory', 'char_inventory.id', 'cis.char_inventory_id')
          .join('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
          .where({ 'char_inventory.character_id': defenderCharacter.id })
          .whereIn('cis.slot_code', ['MD', 'MG', '2M'])
          .where('ref_equipment.category', 'Arme de contact')
          .select('cis.slot_code as slot', 'char_inventory.equipment_id'),
      ])
      const slotPriority = (identityCible?.hand_pref ?? 'R') === 'L' ? ['MG', 'MD', '2M'] : ['MD', 'MG', '2M']
      const defWeapon = slotPriority.map(s => defContactWeapons.find(w => w.slot === s)).find(w => w != null) ?? null
      let defSkillId = 'COMBAT_A_MAINS_NUES'
      if (defWeapon?.equipment_id) {
        const assoc = await db('ref_equipment_skill_assoc').where({ item_id: defWeapon.equipment_id }).first()
        if (assoc) defSkillId = assoc.skill_id
      }
      const ctxCible = await resolveCombatantTestContext(db, defenderCharacter, defSkillId)
      if (ctxCible) {
        defenderSkillTotal     = ctxCible.skillTotal
        defenderEffectiveMalus = ctxCible.effectiveMalus
        defenderMastery        = ctxCible.mastery
        // Jamais dérivés du pilote pour un défenseur exo — même garde que resolveMeleeAction, l'armure
        // a son propre pipeline de dégâts (exoAvarieService.resolveExoDamage), pas celui de son pilote.
        if (defenderCharacter.type !== 'exo') {
          for_na_cible = ctxCible.for_na
          con_na_cible = ctxCible.con_na
          vol_na_cible = ctxCible.vol_na
          char_sheet_id_cible = ctxCible.sheetId
        }
      }
    }

    // commonPending — même contrat que resolveMeleeAction (§2.4.b), consommé tel quel par les 4
    // fonctions de branchement défenseur déjà génériques. weaponInvId/naturalWeaponCharMutationId
    // toujours null (armes exo hors char_inventory, aucune mutation) : getEffectiveMeleeDamage
    // retombe alors correctement sur damageFormula (fallbackFormula), vérifié dans damageService.js.
    const commonPending = {
      campaignId,
      attackerTokenId: action.token_id,
      attackerCharacter: character,
      attackerUsername, attackerColor,
      rollAttaque, chancesAttaque,
      mrAttaque: attaqueOutcome.mr,
      defenderSkillTotal, defenderEffectiveMalus, defenderMastery,
      multiMalusAttaquant: 0, multiMalusDefenseur: 0,
      damageFormula: weapon.damage_formula ?? null,
      weaponInvId: null,
      modDom,
      combatModeBonus: 0,
      characterIdCible: defenderCharacter.id,
      cibleType: defenderCharacter.type,
      char_sheet_id_cible, for_na_cible, con_na_cible, vol_na_cible,
      targetName,
      userId: character.user_id ?? null,
      defenderUserId: defenderEffectiveUserId,
      confirmedModifiers,
      situationDef: confirmedModifiers?.situationDef ?? [],
      targetTokenId,
      attackerSheetId: ctx.sheetId,
      naturalWeaponCharMutationId: null,
      defenderCharacterName: defenderCharacter.name,
      attackerCharacterName: character.name ?? 'Exo-armure',
    }

    // ── Branchement défenseur — ordre invariant, sans-défense d'abord (même raison que
    // resolveMeleeAction : sinon un PNJ/PJ étourdi relancerait un jet de défense actif, contraire au
    // RAW). defenderEffectiveType (pas defenderCharacter.type) pour la branche pnj/pj — un défenseur
    // exo piloté par un PNJ s'auto-résout, piloté par un PJ prompte CE pilote.
    if (targetDefenseless) return await resolveDefenselessTarget(io, campaignId, commonPending, emissions)
    if (defenderEffectiveType === 'pnj') return await resolveMeleeDefensePnj(io, campaignId, commonPending, emissions)
    if (defenderCharacter.type === 'drone') return await resolveMeleeDefenseDrone(io, campaignId, commonPending, emissions)
    return await resolveMeleeDefensePj(io, campaignId, commonPending, emissions)

  } catch (err) {
    console.error('[WS] resolveExoMeleeAction error:', err.message)
    return { suspend: false, emissions: [] }
  }
}
