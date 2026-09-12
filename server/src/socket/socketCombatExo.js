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
import { buildWeaponShockDsl } from '../lib/damageService.js'
import { resolveCombatantTestContext, resolveCombatantIdentity } from '../lib/combatantContextService.js'
import { resolveAttackTargetSize } from '../lib/characterSizeService.js'
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
  flushDeferredEmissions, finalizeAssaultOutcome,
} from './socketCombatHelpers.js'
import { advanceTimeline, combatTimers, combatPreviews } from './combatTurnEngine.js'
import { openChanceChoice, SITE_HANDLERS } from '../lib/chanceCatastropheChoiceService.js'

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
//   ET aucun Choc catalogue (chocDsl null aussi, ref_equipment absent) — bail-out gracieux ci-dessous,
//   jamais un crash. Gap de schéma pré-existant (Lot C), pas introduit ici.
// - Arme catalogue à Choc pur (CHOC1, ex. Fusil sonique incap. sirène — damage_h null, shock_mechanism
//   'pure') : `effective_formula` est null mais chocDsl ne l'est pas — la garde ci-dessous ne bail-out
//   plus dans ce cas (correctif EXO-CHOC-PUR-TIR-BLOQUE), `formula` devient '' et rollDamageFormula
//   (diceParser.js) la traite comme 0 dégât physique, jamais un throw. Même convention déjà éprouvée
//   côté CaC exo (getEffectiveMeleeDamage, damageService.js — cite déjà ce cas de figure).
// fetchExoWeapon — arme exo re-vérifiée à la Résolution (combat.md : seule la Résolution vérifie ce
// qui est réellement possible), jamais confiance au fetch de la Déclaration (arme a pu être retirée
// du loadout entre-temps, ownership rescopée sur character.id). Extrait de resolveExoAssaultAction
// (Segment 2 AOE, PLAN_ARMES_SPECIALES.md §1.4bis) pour être partagé avec le tronc AOE
// (server/src/lib/aoeShooterAdapter.js) — une seule requête, jamais une 2ᵉ copie de cette jointure.
// `ref_aoe_profile`/`ref_name` : colonnes ajoutées pour l'AOE (getAoeMechanic + messages d'erreur),
// jamais lues par resolveExoAssaultAction ci-dessous — additif, aucun changement de comportement Tir
// CaC exo existant. `ref_shock`/`ref_shock_mechanism`/`ref_shock_reduced_by_armor` (docs/PLANS/
// PLAN_CHOC_EXO_DRONE.md Palier B) : même raison — le Choc d'arme (LdB p.243, CHOC1) n'était jamais
// sélectionné pour un tireur exo, silencieusement absent du Tir ET de l'AOE (tous deux partagent ce
// fetch) — additif, comportement Tir/CaC existant inchangé pour tout le reste.
export async function fetchExoWeapon(exoWeaponInvId, characterId) {
  return db('exo_weapons')
    .leftJoin('ref_equipment', 'exo_weapons.ref_equipment_id', 'ref_equipment.id')
    .where({ 'exo_weapons.id': exoWeaponInvId, 'exo_weapons.character_id': characterId })
    .select(
      'exo_weapons.ref_equipment_id as equipment_id',
      'exo_weapons.ammo_remaining',
      'ref_equipment.range as ref_range',
      'ref_equipment.damage_h as effective_formula',
      'ref_equipment.name as ref_name',
      'ref_equipment.aoe_profile as ref_aoe_profile',
      'ref_equipment.shock as ref_shock',
      'ref_equipment.shock_mechanism as ref_shock_mechanism',
      'ref_equipment.shock_reduced_by_armor as ref_shock_reduced_by_armor',
      db.raw(`COALESCE(exo_weapons.label_override, ref_equipment.name) as display_name`),
    )
    .first()
}

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

    // 1. Arme exo (fetchExoWeapon ci-dessus).
    const weapon = await fetchExoWeapon(action.exo_weapon_inv_id, character.id)
    // Choc d'arme (docs/PLANS/PLAN_CHOC_EXO_DRONE.md Palier B) — dérivé ici, une seule fois, transmis
    // à ctx plus bas (§6) ; seule resolveAttackHitPnj/Pj (cible humanoïde) le consomme, cohérent avec
    // resolveTargetHit qui ignore déjà chocDsl pour une cible drone/exo.
    const chocDsl = weapon ? buildWeaponShockDsl({
      shock: weapon.ref_shock, shockMechanism: weapon.ref_shock_mechanism, reducedByArmor: weapon.ref_shock_reduced_by_armor,
    }) : null

    // Bail-out seulement si NI dégât physique NI Choc — une arme catalogue à Choc pur (chocDsl non
    // null) doit continuer jusqu'au jet (§ correctif ci-dessus), formula devient '' dans ce cas.
    if (!weapon?.effective_formula && !chocDsl) {
      console.warn(`[WS] resolveExoAssaultAction — arme sans formule ni Choc. exo_weapon_inv_id:${action.exo_weapon_inv_id}`)
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
    const formula = weapon.effective_formula ? weapon.effective_formula.replace(/\s/g, '') : ''

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
    // Taille de la cible : override MJ (confirmedModifiers.taille, déjà filtré MJ-only en amont)
    // sinon dérivée de la fiche de la cible (docs/PLANS/PLAN_TAILLE.md).
    const cibleCharacterIdForSize = (await db('tokens').where({ id: action.target_token_id }).select('character_id').first())?.character_id ?? null
    const tailleCategory   = await resolveAttackTargetSize(db, cibleCharacterIdForSize, confirmedModifiers)
    const tailleModComp    = TAILLE_MODS[tailleCategory]?.mod ?? 0
    const isRushedMod      = rosterTireur?.state_vitesse === 'rushed' ? -5 : 0
    const coverageModifier = options.coverageModifier ?? 0

    const contributions = [
      { label: PORTEE_LABELS[authoritativeRangeBand] ?? authoritativeRangeBand, value: porteeModComp, type: porteeModComp > 0 ? 'bonus' : 'malus' },
      { label: 'Cible sans défense', value: sansDefenseBonus, type: 'bonus' },
      ...((confirmedModifiers?.situation ?? []).map(k => {
        const v = RANGED_SITUATION_MODS[k]?.mod ?? 0
        return { label: SITUATION_LABELS[k] ?? k, value: v, type: v > 0 ? 'bonus' : 'malus' }
      })),
      { label: TAILLE_LABELS[tailleCategory] ?? tailleCategory, value: tailleModComp, type: tailleModComp > 0 ? 'bonus' : 'malus' },
      { label: 'Précipitation', value: isRushedMod, type: 'malus' },
      { label: 'Malus santé / encombrement (pilote)', value: ctxTireur.effectiveMalus, type: 'malus' },
      { label: 'Couverture cible', value: coverageModifier, type: 'malus' },
    ]
    const { total: rollAttaque, rolls: attackRolls, seed: attackSeed } = await parseDice('1d20')
    const assaultOutcome0 = computeAttackRoll({
      skillLabel: 'Compétence', skillTotal: ctxTireur.skillTotal, totalLabel: 'Seuil', rollAttaque, contributions,
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
    const pendingCatastrophe = await maybeTriggerCatastrophe(io, campaignId, action.token_id, assaultOutcome.catastropheRisk, {
      site: 'exo_assault', actorTokenId: action.token_id, targetTokenId: action.target_token_id,
    })

    // Décompte munitions (§16.2.3) — quel que soit le résultat (touché, raté, ou Catastrophe menant
    // à un choix Chance), même convention que le Tir humanoïde et que "avant, comme DICE_RESULT"
    // (décision Saar 2026-09-11, PLAN_CHANCE.md L3e-4) : conséquence du jet lui-même, pas de l'issue
    // optionnelle du choix. Skip si ammo_remaining NULL (tracking désactivé).
    if (weapon.ammo_remaining !== null && weapon.ammo_remaining !== undefined) {
      const bulletsFired = action.bullet_count ?? 1
      const newRemaining = Math.max(0, weapon.ammo_remaining - bulletsFired)
      await db('exo_weapons').where({ id: action.exo_weapon_inv_id }).update({ ammo_remaining: newRemaining })
    }

    // Choix Chance posé AVANT la résolution de l'issue (PLAN_CHANCE.md L3e-4, décision Saar
    // 2026-09-11) — DICE_RESULT/maybeTriggerCatastrophe/munitions restent immédiats (ci-dessus),
    // seul le dispatch échec/dégâts est différé. `suspend:true` bloque advanceTimeline() côté
    // appelant, pas de sous-phase FSM neuve (le choix a déjà son propre timeout, L3e-1).
    if (assaultOutcome.catastropheRisk) {
      // La Chance appartient au PILOTE (char_sheet du pilote, ctxTireur.sheetId — resolveExoTestContext
      // délègue à resolveHumanoidTestContext(db, pilot, ...), combatantContextService.js:280), jamais
      // à l'exo elle-même (aucun char_sheet propre, seulement exo_sheet) — trouvaille en auto-relecture,
      // même bug qu'aurait pu avoir exo_stand_up si elle n'utilisait pas déjà pilot.id.
      const pilotCharacterId = (await db('char_sheet').where({ id: ctxTireur.sheetId }).first('character_id'))?.character_id ?? null
      await openChanceChoice(io, campaignId, pilotCharacterId, {
        testLabel: `${weapon.display_name ?? 'Armement'} — Exo-armure`,
        site: 'exo_assault',
        linkedCatastropheId: pendingCatastrophe?.id ?? null,
        context: {
          action, formula, portee: authoritativeRangeBand, tireurUsername, tireurColor,
          userId: character.user_id ?? null, chocDsl,
          skillTotal: ctxTireur.skillTotal, mastery: ctxTireur.mastery, contributions,
          weaponDisplayName: weapon.display_name ?? 'Armement',
        },
      })
      return { suspend: true, emissions }
    }

    const finalized = await finalizeAssaultOutcome(io, campaignId, { action, formula, mr, portee: authoritativeRangeBand, tireurUsername, tireurColor, userId: character.user_id ?? null, chocDsl, isSuccess, emissions })
    return finalized

  } catch (err) {
    console.error('[WS] resolveExoAssaultAction error:', err.message)
    return { suspend: false, emissions: [] }
  }
}

// finalizeExoAssault a été généralisée en finalizeAssaultOutcome (socketCombatHelpers.js) —
// structure identique à celle qu'exigeait resolveDroneAssaultAction (PLAN_CHANCE.md L3e-4c),
// jamais une deuxième copie (invariant #3). Importée ci-dessus.

// finishExoAssaultChoice — SITE_HANDLERS.exo_assault (PLAN_CHANCE.md L3e-4b). RAW : 'gain_point' et
// le timeout (choice=null) gardent le jet original — toujours un échec ici (catastropheRisk ne se
// déclenche que sur échec). Seul 'reroll' relance réellement le D20 ("refaire son Test") avec les
// MÊMES contributions situationnelles (déjà figées au moment du jet original, non rejouées) et émet
// un nouveau DICE_RESULT. Pas de récursivité assumée (reroll lui-même catastrophique = résultat
// final, pas de second choix). `flushDeferredEmissions` cible le joueur par recherche de socket
// (userId), aucun `socket` vivant dans ce contexte différé.
async function finishExoAssaultChoice(io, campaignId, resolved, { choice, context }) {
  const { action, formula, portee, tireurUsername, tireurColor, userId, chocDsl, skillTotal, mastery, contributions, weaponDisplayName } = context
  let isSuccess = false
  let mr = null
  const emissions = []

  if (choice === 'reroll') {
    const { total: rollAttaque, rolls: attackRolls, seed: attackSeed } = await parseDice('1d20')
    const outcome0 = computeAttackRoll({ skillLabel: 'Compétence', skillTotal, totalLabel: 'Seuil', rollAttaque, contributions })
    const outcomeCrit = applyCriticalSuccessBonus(outcome0, getCriticalSuccessBonus({ masteryLevel: mastery }))
    const { seuil: chancesDeReussite, breakdown } = outcomeCrit
    isSuccess = outcomeCrit.isSuccess
    mr = outcomeCrit.mr
    const outcome = await resolveCriticalFailReroll(outcomeCrit)

    emissions.push({ to: 'room', event: WS.DICE_RESULT, data: {
      userId, username: tireurUsername, color: tireurColor,
      formula: '1d20', rolls: attackRolls, total: rollAttaque,
      isCriticalSuccess: outcome.isCriticalSuccess, isCriticalFail: outcome.isCriticalFail,
      catastropheRisk: outcome.catastropheRisk,
      seed: attackSeed, timestamp: new Date().toISOString(),
      skillLabel: `${weaponDisplayName} — Exo-armure — Chance : relance`,
      mechanicalTotal: skillTotal,
      diffLabel: chancesDeReussite - skillTotal >= 0 ? `+${chancesDeReussite - skillTotal}` : `${chancesDeReussite - skillTotal}`,
      chancesDeReussite, isSuccess, mr, breakdown,
    } })

    await maybeTriggerCatastrophe(io, campaignId, action.token_id, outcome.catastropheRisk, {
      site: 'exo_assault', actorTokenId: action.token_id, targetTokenId: action.target_token_id,
    })
  }

  const { suspend: finalSuspend, emissions: finalEmissions } = await finalizeAssaultOutcome(io, campaignId, { action, formula, mr, portee, tireurUsername, tireurColor, userId, chocDsl, isSuccess, emissions })
  await flushDeferredEmissions(io, campaignId, userId, finalEmissions)
  // Ne pas avancer l'échelle si la finalisation a elle-même armé une attente (ex. AWAITING_DAMAGE
  // sur une cible PJ touchée, resolveAttackHitPj) — même garde que le chemin immédiat
  // (socketCombatResolution.js:531-533, resolutionSuspended), sinon advanceTimeline() écraserait
  // la sous-phase juste posée.
  if (!finalSuspend) await advanceTimeline(io, campaignId, { combatTimers, combatPreviews })
}

SITE_HANDLERS.exo_assault = finishExoAssaultChoice

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
    // Taille de la cible : override MJ (confirmedModifiers.taille, déjà filtré MJ-only en amont)
    // sinon dérivée de la fiche de la cible (docs/PLANS/PLAN_TAILLE.md).
    const cibleCharacterIdForSize = (await db('tokens').where({ id: targetTokenId }).select('character_id').first())?.character_id ?? null
    const tailleCategory    = await resolveAttackTargetSize(db, cibleCharacterIdForSize, confirmedModifiers)
    const tailleMod         = TAILLE_MODS[tailleCategory]?.mod ?? 0

    const userRow = character.user_id
      ? await db('users').where({ id: character.user_id }).select('color', 'username').first()
      : null
    const attackerColor    = userRow?.color    ?? '#808080'
    const attackerUsername = userRow?.username ?? character.name ?? 'Exo-armure'

    const attaqueContributions = [
      { label: 'Précipitation', value: isRushedMod, type: 'malus' },
      { label: 'Malus santé / encombrement (pilote)', value: effectiveMalusAttaquant, type: 'malus' },
      { label: 'Mods situation', value: situationModComp, type: situationModComp > 0 ? 'bonus' : 'malus' },
      { label: 'Taille cible', value: tailleMod, type: tailleMod > 0 ? 'bonus' : 'malus' },
      { label: 'Bouclier adverse', value: shieldAtkMalus, type: 'malus' },
      { label: 'Cible sans défense', value: sansDefenseBonus, type: 'bonus' },
    ]
    const { total: rollAttaque, rolls: attackRolls, seed: attackSeed } = await parseDice('1d20')
    const attaqueOutcome0 = computeAttackRoll({
      skillLabel: 'Compétence', skillTotal: attackerSkillTotal, totalLabel: 'Seuil', rollAttaque,
      contributions: attaqueContributions,
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
    const pendingCatastrophe = await maybeTriggerCatastrophe(io, campaignId, action.token_id, attaqueOutcome.catastropheRisk, {
      site: 'exo_melee', actorTokenId: action.token_id, targetTokenId,
    })

    const finalizeCtx = {
      action, character, targetTokenId,
      weaponEquipmentId: weapon.equipment_id ?? null, weaponDamageFormula: weapon.damage_formula ?? null,
      weaponDisplayName: weapon.display_name ?? 'Armement',
      attackerSkillTotal, attackerMastery: ctx.mastery, attackerColor, attackerUsername,
      attackerSheetId: ctx.sheetId, modDom, attaqueContributions, confirmedModifiers,
      rollAttaque, chancesAttaque, mr: attaqueOutcome.mr,
    }

    // Choix Chance posé AVANT la résolution du défenseur (PLAN_CHANCE.md L3e-4, décision Saar
    // 2026-09-11) — DICE_RESULT/maybeTriggerCatastrophe restent immédiats (ci-dessus), toute la
    // résolution du défenseur (identité, dispatch sans-défense/PNJ/drone/PJ) est différée.
    if (attaqueOutcome.catastropheRisk) {
      // La Chance appartient au pilote, pas à l'exo (même correctif qu'exo_assault ci-dessus) —
      // ctx.sheetId est déjà celui du pilote (resolveCombatantTestContext → resolveExoTestContext).
      const pilotCharacterId = (await db('char_sheet').where({ id: ctx.sheetId }).first('character_id'))?.character_id ?? null
      await openChanceChoice(io, campaignId, pilotCharacterId, {
        testLabel: `${weapon.display_name ?? 'Armement'} — Exo-armure`,
        site: 'exo_melee',
        linkedCatastropheId: pendingCatastrophe?.id ?? null,
        context: finalizeCtx,
      })
      return { suspend: true, emissions }
    }

    return await finalizeExoMelee(io, campaignId, { ...finalizeCtx, emissions })

  } catch (err) {
    console.error('[WS] resolveExoMeleeAction error:', err.message)
    return { suspend: false, emissions: [] }
  }
}

// finalizeExoMelee — identité/stats du défenseur + dispatch (sans-défense/PNJ/drone/PJ), autorité
// unique appelée immédiate ou depuis SITE_HANDLERS.exo_melee (PLAN_CHANCE.md L3e-4b-bis). Re-fetch
// la cible fraîche en DB (état à jour, robuste au temps écoulé pendant l'attente du choix) —
// jamais depuis un instantané mis en cache, même principe que finalizeAssaultOutcome/
// finalizeEntityDisplacement.
async function finalizeExoMelee(io, campaignId, {
  action, character, targetTokenId, weaponEquipmentId, weaponDamageFormula, weaponDisplayName,
  attackerSkillTotal, attackerColor, attackerUsername, attackerSheetId, modDom, confirmedModifiers,
  rollAttaque, chancesAttaque, mr, emissions,
}) {
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
      if (defenderCharacter.type !== 'exo') {
        for_na_cible = ctxCible.for_na
        con_na_cible = ctxCible.con_na
        vol_na_cible = ctxCible.vol_na
        char_sheet_id_cible = ctxCible.sheetId
      }
    }
  }

  const settings = await getCampaignSettings(db, campaignId)
  const targetDefenseless = await isTargetDefenseless(campaignId, targetTokenId, settings)

  const commonPending = {
    campaignId,
    attackerTokenId: action.token_id,
    attackerCharacter: character,
    attackerUsername, attackerColor,
    rollAttaque, chancesAttaque,
    mrAttaque: mr,
    defenderSkillTotal, defenderEffectiveMalus, defenderMastery,
    multiMalusAttaquant: 0, multiMalusDefenseur: 0,
    damageFormula: weaponDamageFormula,
    weaponInvId: null,
    weaponRefId: weaponEquipmentId,
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
    attackerSheetId,
    naturalWeaponCharMutationId: null,
    defenderCharacterName: defenderCharacter.name,
    attackerCharacterName: character.name ?? 'Exo-armure',
  }

  if (targetDefenseless) return await resolveDefenselessTarget(io, campaignId, commonPending, emissions)
  if (defenderEffectiveType === 'pnj') return await resolveMeleeDefensePnj(io, campaignId, commonPending, emissions)
  if (defenderCharacter.type === 'drone') return await resolveMeleeDefenseDrone(io, campaignId, commonPending, emissions)
  return await resolveMeleeDefensePj(io, campaignId, commonPending, emissions)
}

// finishExoMeleeChoice — SITE_HANDLERS.exo_melee (PLAN_CHANCE.md L3e-4b-bis). Même règle que
// exo_assault : 'gain_point'/timeout gardent le jet original, seul 'reroll' relance (mêmes
// `attaqueContributions`, déjà figées — pas rejouées).
async function finishExoMeleeChoice(io, campaignId, resolved, { choice, context }) {
  const {
    action, character, targetTokenId, weaponEquipmentId, weaponDamageFormula, weaponDisplayName,
    attackerSkillTotal, attackerMastery, attackerColor, attackerUsername, attackerSheetId, modDom,
    attaqueContributions, confirmedModifiers,
  } = context
  let { rollAttaque, chancesAttaque, mr } = context
  const emissions = []

  if (choice === 'reroll') {
    const { total: newRoll, rolls: attackRolls, seed: attackSeed } = await parseDice('1d20')
    const outcome0 = computeAttackRoll({
      skillLabel: 'Compétence', skillTotal: attackerSkillTotal, totalLabel: 'Seuil', rollAttaque: newRoll,
      contributions: attaqueContributions,
    })
    const { seuil: newChancesAttaque, breakdown } = outcome0
    const outcomeCrit = applyCriticalSuccessBonus(outcome0, getCriticalSuccessBonus({ masteryLevel: attackerMastery }))
    const outcome = await resolveCriticalFailReroll(outcomeCrit)
    rollAttaque = newRoll
    chancesAttaque = newChancesAttaque
    mr = outcomeCrit.mr

    emissions.push({ to: 'room', event: WS.DICE_RESULT, data: {
      userId: character.user_id ?? null, username: attackerUsername, color: attackerColor,
      formula: '1d20', rolls: attackRolls, total: rollAttaque,
      isCriticalSuccess: outcome.isCriticalSuccess, isCriticalFail: outcome.isCriticalFail,
      catastropheRisk: outcome.catastropheRisk,
      seed: attackSeed, timestamp: new Date().toISOString(),
      skillLabel: `${weaponDisplayName} — Exo-armure — Chance : relance`,
      mechanicalTotal: attackerSkillTotal,
      diffLabel: chancesAttaque - attackerSkillTotal >= 0 ? `+${chancesAttaque - attackerSkillTotal}` : `${chancesAttaque - attackerSkillTotal}`,
      chancesDeReussite: chancesAttaque, isSuccess: outcomeCrit.isSuccess, mr, breakdown,
    } })

    await maybeTriggerCatastrophe(io, campaignId, action.token_id, outcome.catastropheRisk, {
      site: 'exo_melee', actorTokenId: action.token_id, targetTokenId,
    })
  }

  const finalized = await finalizeExoMelee(io, campaignId, {
    action, character, targetTokenId, weaponEquipmentId, weaponDamageFormula, weaponDisplayName,
    attackerSkillTotal, attackerColor, attackerUsername, attackerSheetId, modDom, confirmedModifiers,
    rollAttaque, chancesAttaque, mr, emissions,
  })
  await flushDeferredEmissions(io, campaignId, character.user_id ?? null, finalized.emissions)
  // Ne pas avancer l'échelle si la finalisation a elle-même armé une attente (défense active PJ,
  // AWAITING_DAMAGE...) — même garde que exo_assault ci-dessus et que le chemin immédiat.
  if (!finalized.suspend) await advanceTimeline(io, campaignId, { combatTimers, combatPreviews })
}

SITE_HANDLERS.exo_melee = finishExoMeleeChoice
