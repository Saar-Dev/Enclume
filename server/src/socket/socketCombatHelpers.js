import { WS } from '../../../shared/events.js'
import db from '../db/knex.js'
import { parseDice } from '../lib/diceParser.js'
import { resolveTestOutcome, applyCriticalFailReroll, getCriticalSuccessBonus, applyCriticalSuccessBonus, getMrModifier } from '../../../shared/polarisTestResolution.js'
import * as woundService from '../lib/woundService.js'
import * as statusService from '../lib/statusService.js'
import * as damageService from '../lib/damageService.js'
import { canTransition, setFSMSubPhase } from '../lib/combatFSM.js'
import { computeAttackRoll, computeMeleeRawDamage, computeAssaultRawDamage } from '../lib/combatAttackRoll.js'
import { buildBroadcastRoster } from '../lib/combatRosterBroadcast.js'
import { checkCombatLOS } from '../lib/losService.js'
import { getCampaignSettings } from '../lib/campaignSettingsService.js'
import { getOwnedHandWeapon, WEAPON_SLOTS } from '../services/inventoryService.js'
import { calcWeaponModBonus } from '../services/modingService.js'
import { resolveModHooks, getAllCombatMods } from '../services/weaponModService.js'
import { resolveEnvironmentalHazardTicks, getAllHazardCodes } from '../lib/environmentalHazardService.js'
import { maybeTriggerCatastrophe } from '../lib/catastropheService.js'
import { measureBattlemapTokenDistance, tokenDistanceM } from '../services/worldSpatialQueryService.js'
import { getLunetteNiveau, getEffectiveAimBonus } from '../../../shared/combatExclusiveActions.js'
import { resolveWeaponRangeBand, resolveMeleeReachM } from '../../../shared/combatRange.js'
import { hasEnoughAmmo } from '../../../shared/ammoRules.js'
import { resolveDualWieldFire } from '../../../shared/dualWieldRules.js'
import { calcDroneDegatsNets } from '../lib/charStats.js'
import * as exoAvarieService from '../lib/exoAvarieService.js'
import {
  resolveCombatantTestContext, resolveCombatantIdentity,
  resolveExoContext, resolveManeuverSkillId, resolveHumanoidTestContext,
} from '../lib/combatantContextService.js'
import { computeExoStats } from '../../../shared/exoStats.js'
import { EXO_PRONE_RECOVERY_TABLE } from '../../../shared/exoConstants.js'
import { setCharacterState } from '../lib/characterStateService.js'
import { shadowCheckCharacterState } from '../lib/characterStateShadowCheck.js'
import { LOCATION_LABELS, LOCATION_TO_SLOT, AIMED_LOCATION_MALUS } from '../../../shared/armorConstants.js'
import { SEVERITY_COLORS, isTestBlockingWound } from '../../../shared/woundConstants.js'
import { getNaturalWeaponIneligibilityReasons } from '../../../shared/naturalWeapons.js'
import {
  RANGED_SITUATION_MODS, sumRangedSituationMods, isImpossibleRangedSituation,
  CAC_SITUATION_MODS, TAILLE_MODS, PORTEE_MOD_COMP,
} from '../../../shared/combatSituationMods.js'


// ─── Breakdown jets de dé — labels d'affichage (FR serveur, dette i18n séparée) ─
// Les tables de VALEURS (situation Tir + CaC, taille, portée) vivent dans
// shared/combatSituationMods.js — autorité unique client+serveur (TIRIMP Session 166 pour le Tir,
// PLAN_RW_SYSCOMBAT.md Lot 0 pour CaC/taille/portée). Ne jamais recréer une table de valeurs ici.
export const SITUATION_LABELS = {
  cible_immobile:        'Cible immobile',
  cible_allure_moyenne:  'Cible allure moyenne',
  cible_allure_rapide:   'Cible allure rapide',
  cible_allure_maximale: 'Cible allure maximale',
  tireur_allure_lente:   'Tireur allure lente',
  tireur_allure_moyenne: 'Tireur allure moyenne',
  tireur_allure_rapide:  'Tireur allure rapide',
  couverture_partielle:  'Couverture partielle (50%)',
  couverture_importante: 'Couverture importante (75%)',
  obscurite_legere:      'Obscurité légère',
  obscurite_importante:  'Obscurité importante',
}
export const PORTEE_LABELS = {
  bout_portant: 'À bout portant', courte: 'Portée courte',
  moyenne:      'Portée moyenne', longue: 'Portée longue', extreme: 'Portée extrême',
}
export const TAILLE_LABELS = {
  minuscule:    'Cible minuscule (~30cm)', tres_petite: 'Cible très petite (~50cm)',
  petite:       'Cible petite (~1m)',      moyenne:     'Cible taille humaine',
  grande:       'Cible grande (~3m)',      tres_grande: 'Cible très grande (~5m)',
  enorme:       'Cible énorme (~7m)',      gigantesque: 'Cible gigantesque (10m+)',
}
export const COMBAT_MODE_LABELS = {
  offensif: 'Mode offensif', charge:   'Mode charge',
  defensif: 'Mode défensif', retraite: 'Mode retraite',
}

// ─── Helper — retest d'Échec critique (RAW p.204, docs/PLAN_TEST_CRITIQUE.md) ─────────────────────
// computeAttackRoll (noyau pur) ne peut pas faire ce second jet lui-même (pas d'I/O dans le noyau,
// PLAN_RW_SYSCOMBAT.md §2.1.c) — chaque site qui appelle computeAttackRoll sur un jet frais (attaque
// ou défense, jamais une relecture depuis combat_pending) passe son résultat ici juste après.
// Sans effet si l'issue n'est pas un Échec critique.
export async function resolveCriticalFailReroll(outcome) {
  if (!outcome.isCriticalFail) return outcome
  const { total: reroll } = await parseDice('1d20')
  return applyCriticalFailReroll(outcome, reroll)
}

// ─── Helper — démarrer les timers auto-skip pour la phase ANNONCE ─────────────
// PC17 : skip uniquement si timerSec > 0. Exclut PNJs et tokens du GM (gmUserId).
export async function startAnnouncementTimers(io, campaignId, timerSec, gmUserId, pendingMaps) {
  if (!timerSec || timerSec <= 0) return
  const rosterEntries = await db('combat_roster')
    .where({ campaign_id: campaignId, has_announced: false, status: 'active' })
  if (!pendingMaps.combatTimers.has(campaignId)) pendingMaps.combatTimers.set(campaignId, new Map())
  const campaignTimersMap = pendingMaps.combatTimers.get(campaignId)
  for (const entry of rosterEntries) {
    const token = await db('tokens').where({ id: entry.token_id }).first()
    if (!token?.character_id) continue
    const character = await db('characters').where({ id: token.character_id }).first()
    if (!character || character.user_id === gmUserId) continue  // PNJ ou GM → pas de timer
    const timeoutId = setTimeout(async () => {
      await skipPlayer(io, campaignId, entry.token_id, pendingMaps)
    }, timerSec * 1000)
    campaignTimersMap.set(entry.token_id, timeoutId)
  }
}

// ─── Helper — skip d'un participant pendant la phase ANNONCE ──────────────────
// Appelé par COMBAT_SKIP_PLAYER (GM) et par le timer auto-skip (PC17).
// Race condition guard : re-vérifie has_announced avant d'agir.
export async function skipPlayer(io, campaignId, tokenId, pendingMaps) {
  try {
    const [entry, combatSt] = await Promise.all([
      db('combat_roster').where({ campaign_id: campaignId, token_id: tokenId }).first(),
      db('combat_state').where({ campaign_id: campaignId }).select('current_turn').first(),
    ])
    if (!entry || entry.has_announced) return

    await db('combat_roster')
      .where({ campaign_id: campaignId, token_id: tokenId })
      .update({ has_announced: true, updated_at: db.fn.now() })

    // Insérer action 'skip' en base
    await db('combat_actions').insert({
      campaign_id: campaignId,
      token_id: tokenId,
      type: 'skip',
      action_key: 'skip',
      sequence: 99,
      status: 'skipped',
      turn_number: combatSt?.current_turn ?? 1,
    })

    // Bug 2 fix : tokenLabel dans le payload — évite stale closure client
    const token = await db('tokens').where({ id: tokenId }).first()
    const tokenLabel = token?.label ?? 'Inconnu'

    // Bug 1 fix : émettre COMBAT_TURN_SKIPPED AVANT de vérifier PC13
    io.to(campaignId).emit(WS.COMBAT_TURN_SKIPPED, { tokenId, tokenLabel })

    // PC13 — tous annoncés → phase Résolution, sinon émettre le slot suivant (LdB p.212)
    const [{ count }] = await db('combat_roster')
      .where({ campaign_id: campaignId, has_announced: false })
      .count('* as count')
    if (parseInt(count) === 0) {
      await startResolutionPhase(io, campaignId, pendingMaps)
    } else {
      const nextAnnounceSlot = await db('combat_roster')
        .where({ campaign_id: campaignId, has_announced: false, status: 'active' })
        .orderBy('base_ini', 'asc').orderBy('token_id', 'asc')
        .first()
      if (nextAnnounceSlot) {
        io.to(campaignId).emit(WS.COMBAT_SLOT_ADVANCED, { activeSlotIdx: 0, tokenId: nextAnnounceSlot.token_id })
      }
    }
  } catch (err) {
    console.error('[WS] skipPlayer error:', err.message)
  }
}

// ─── Helper — transition vers la phase RÉSOLUTION ─────────────────────────────
// Appelé automatiquement quand tous les participants ont annoncé (PC13).
// Sprint 2 : stub — met à jour la phase et broadcast COMBAT_PHASE_CHANGED.
// Sprint 3/4 : résolution pas-à-pas par initiative_score DESC.
export async function startResolutionPhase(io, campaignId, pendingMaps) {
  try {
    const [updatedState] = await db('combat_state')
      .where({ campaign_id: campaignId })
      .update({ phase: 'RESOLUTION', updated_at: db.fn.now() })
      .returning('current_turn')
    const currentTurn = updatedState?.current_turn ?? 1
    await setFSMSubPhase(db, campaignId, 'SLOT_ACTIVE')

    const [announcedRoster, pendingActions, fullRoster] = await Promise.all([
      db('combat_roster')
        .where({ campaign_id: campaignId, status: 'active', has_announced: true })
        .orderBy('initiative', 'desc'),
      db('combat_actions')
        .where({ campaign_id: campaignId, status: 'pending', turn_number: currentTurn })
        .orderBy('sequence', 'asc'),
      db('combat_roster')
        .where({ campaign_id: campaignId })
        .orderBy('initiative', 'desc'),
    ])

    await buildTimelineEntries(campaignId, currentTurn, pendingActions, announcedRoster)

    // Groupe 4 (docs/PLAN_MODDING_REFONTE.md Phase 3) — tick de début de tour pour les mods à état
    // (ex. ATI : cumul de marge de réussite). Registre vide tant que Phase 4 n'est pas câblée :
    // getAllCombatMods/resolveModHooks renvoient un résultat neutre, cette boucle n'a aujourd'hui
    // aucun effet observable.
    const combatMods = await getAllCombatMods(campaignId)
    for (const { tokenId, mods } of combatMods) {
      const results = await resolveModHooks(mods, 'onTurnStart', { tokenId, campaignId, currentTurn })
      for (const { mod, updatedState, tokenEffects } of results) {
        await db('char_inventory_mods').where({ id: mod.id }).update({ state: updatedState })
        for (const effect of tokenEffects) {
          await statusService.applyModStatus(io, db, campaignId, tokenId, effect.statusCode, { expiresAtTurn: effect.expiresAtTurn ?? null })
        }
      }
    }

    // Lot 3 (docs/PLAN_FATIGUE_DOMMAGES.md §9 increment F) — tick de début de tour pour les dangers
    // environnementaux (Acide/Décompression/Feu), boucle indépendante de celle des mods ci-dessus :
    // deux registres séparés (équipement vs danger environnemental), jamais fusionnés. Un statut
    // environnemental n'est jamais balayé à COMBAT_END (§9 point ouvert 7, décision assumée) — un
    // token qui rentre dans un nouveau combat avec un badge encore actif retickera automatiquement ici.
    const hazardRows = await db('combat_roster as roster')
      .join('token_statuses as ts', 'roster.token_id', 'ts.token_id')
      .where({ 'roster.campaign_id': campaignId, 'roster.status': 'active' })
      .whereIn('ts.status_code', getAllHazardCodes())
      .select('roster.token_id', 'ts.status_code', 'ts.data')
    await resolveEnvironmentalHazardTicks(io, db, campaignId, hazardRows)

    const broadcastRoster = await buildBroadcastRoster(db, fullRoster)

    pendingMaps.combatPreviews.delete(campaignId)

    io.to(campaignId).emit(WS.COMBAT_PHASE_CHANGED, {
      phase: 'RESOLUTION',
      roster: broadcastRoster,
      actions: pendingActions,
    })

    await advanceTimeline(io, campaignId, pendingMaps)

    console.log(`[WS] startResolutionPhase — campagne ${campaignId}`)
  } catch (err) {
    console.error('[WS] startResolutionPhase error:', err.message)
  }
}

// ─── Construction de l'échelle de phases (docs/PLAN_COMBAT_TIMELINE.md Lot A §5, Lot B §5/§6bis) ──
// Une entrée par action complexe déclarée (CaC/Tir uniquement — décor/grenade pas encore des types
// réels) ; move/reload/micro/skip n'en génèrent pas (taxonomie RAW, §6 point 6 du plan). Espacement
// ×100 par rapport à l'Initiative brute (§6ter point 2, laisse la place aux insertions du Lot B).
// Décalage RAW -5 Initiative par attaque supplémentaire d'une série CaC ou Tir Multi (§0.1 point 6,
// docs/PLAN_TIRMULTI.md) : 2ᵉ attaque -500, 3ᵉ -1000 dans cette échelle ×100 — position ≤ 0 → 'lost'
// immédiat (§6bis point 7 / §6sexies point 1). Un token dont l'Allure déclarée (state_vitesse) vaut 'delayed' — Retarder son Action,
// §1/§0.1 point 4 — reçoit ses entrées sans position (delayed_waiting), positionnées plus tard par
// COMBAT_ACT_NOW (§6bis point 2 : Retarder porte sur le Tour entier de l'action, jamais une attaque
// isolée d'une série — la série entière bascule ensemble).
function computeSeriesPositions(basePosition, count) {
  return Array.from({ length: count }, (_, idx) => basePosition - idx * 500)
}

// Malus « Attaques multiples » (LdB p.218) : −5 pour 2 attaques, −7 pour 3+. Partagé entre CaC
// (resolveMeleeAction) et Tir Multi (resolveAssaultAction, docs/PLAN_TIRMULTI.md) — même RAW, même
// mécanique d'échelle de phases, une seule implémentation. Recalculé sur le nombre réel de sœurs non
// perdues à CET instant (pas figé à la déclaration) : une sœur déjà 'lost' (décalage au-delà de la
// phase 1, cible invalide, étourdissement) ou 'skipped' ne compte plus.
async function computeMultiAttackMalus(actionId) {
  const timelineEntry = await db('combat_timeline_entries').where({ combat_action_id: actionId }).first()
  let totalCount = 1
  if (timelineEntry?.declaration_group_id) {
    const [{ count: siblingCount }] = await db('combat_timeline_entries')
      .where({ declaration_group_id: timelineEntry.declaration_group_id })
      .whereNotIn('status', ['lost', 'skipped'])
      .count('* as count')
    totalCount = parseInt(siblingCount, 10) || 1
  }
  return { totalCount, malus: totalCount === 2 ? -5 : totalCount >= 3 ? -7 : 0 }
}

// Groupement par (token, type) — CaC et Tir Multi (docs/PLAN_TIRMULTI.md) partagent exactement le même
// traitement : une série d'attaques déclarées ensemble devient un groupe d'entrées d'échelle étalées
// de 500 en 500 (RAW -5 Initiative par attaque supplémentaire), avec un `declaration_group_id` commun
// utilisé à la résolution pour recompter les sœurs vivantes (computeMultiAttackMalus). Une seule
// implémentation pour les deux mécaniques — jamais deux copies divergentes du même calcul.
async function buildTimelineEntries(campaignId, turnNumber, pendingActions, roster) {
  const rosterByToken = new Map(roster.map(r => [r.token_id, r]))
  const rows = []

  const seriesByTokenAndType = new Map()
  for (const action of pendingActions) {
    // PLAN_EXOARMURE.md Lot 2bis §9.3 — 'exo_stand_up' rejoint 'melee'/'assault' ici (trouvaille
    // tardive : sans cette ligne, l'action n'aurait jamais reçu d'entrée d'échelle et n'aurait donc
    // jamais été résolue, malgré une ligne combat_actions correctement posée à l'Annonce). Toujours
    // une série de longueur 1 (exclusivité de la déclaration, §9.2 — jamais deux exo_stand_up le même
    // Tour pour le même token) : le regroupement par série ci-dessous n'a aucun effet particulier
    // pour ce cas, computeSeriesPositions(ini, 1) se comporte comme une entrée simple.
    if (action.type !== 'melee' && action.type !== 'assault' && action.type !== 'exo_stand_up') continue
    const key = `${action.token_id}:${action.type}`
    if (!seriesByTokenAndType.has(key)) seriesByTokenAndType.set(key, { tokenId: action.token_id, actions: [] })
    seriesByTokenAndType.get(key).actions.push(action)
  }
  for (const { tokenId, actions } of seriesByTokenAndType.values()) {
    const isDelayed = rosterByToken.get(tokenId)?.state_vitesse === 'delayed'
    const groupId = crypto.randomUUID()
    const positions = isDelayed ? null : computeSeriesPositions((rosterByToken.get(tokenId)?.initiative ?? 0) * 100, actions.length)
    actions.forEach((action, idx) => {
      rows.push({
        campaign_id: campaignId,
        turn_number: turnNumber,
        token_id: tokenId,
        combat_action_id: action.id,
        declaration_group_id: groupId,
        phase_position: isDelayed ? null : positions[idx],
        status: isDelayed ? 'delayed_waiting' : (positions[idx] <= 0 ? 'lost' : 'scheduled'),
      })
    })
  }

  if (rows.length > 0) await db('combat_timeline_entries').insert(rows)

  // [DBG] Session 159 (retour Saar, « Action retardée n'a pas fonctionné ») — Retarder ne porte
  // aucun effet visible sur un personnage sans action complexe (assault/melee) déclarée ce Tour :
  // move/reload/micro n'ont structurellement jamais d'entrée d'échelle (§5 « portée des entrées »,
  // conception d'origine du Lot B), donc rien à repositionner via Agir maintenant. Log explicite pour
  // distinguer ce cas RAW-conforme mais peu visible d'un bug.
  const delayedTokenIds = roster.filter(r => r.state_vitesse === 'delayed').map(r => r.token_id)
  for (const tokenId of delayedTokenIds) {
    const hasEntry = rows.some(r => r.token_id === tokenId)
    console.log(`[DBG] buildTimelineEntries — token:${tokenId} déclaré delayed, ${hasEntry ? 'a' : "N'A PAS"} d'entrée d'échelle (assault/melee)`)
  }
}

// ─── Moteur de résolution générique (Lot B §5/§6ter) ───────────────────────────────────────────────
// Remplace advanceSlot/active_slot_idx : pas de curseur dupliqué (§6ter point 1), le « pas » courant
// se relit en direct à chaque appel, fusion de deux sources triées par position DESC :
//   - entrées 'scheduled' de combat_timeline_entries (actions complexes) ;
//   - membres du roster annoncés sans AUCUNE entrée ce Tour et pas encore résolus (has_resolved=false,
//     colonne combat_roster existante depuis la migration 54, jamais câblée jusqu'ici) — leurs actions
//     simples (move/reload/micro) n'ont structurellement pas d'entrée (§5 « portée des entrées ») mais
//     doivent tout de même occuper leur propre phase dans l'échelle, à leur Initiative brute.
// Un token qui a AU MOINS une entrée ce Tour voit ses actions simples résolues avec sa première entrée
// (has_resolved coché à ce moment-là) — CaC et Tir sont mutuellement exclusifs à la déclaration
// (§6sexies point 5), donc un token n'a jamais qu'une seule « famille » d'entrées ce Tour.
export async function pickNextTimelineStep(campaignId, turnNumber) {
  const [nextEntry, tokensWithEntries] = await Promise.all([
    db('combat_timeline_entries')
      .where({ campaign_id: campaignId, turn_number: turnNumber, status: 'scheduled' })
      .whereNotNull('phase_position')
      .orderBy('phase_position', 'desc')
      .first(),
    db('combat_timeline_entries')
      .where({ campaign_id: campaignId, turn_number: turnNumber })
      .distinct('token_id').pluck('token_id'),
  ])
  const nextSimple = await db('combat_roster')
    .where({ campaign_id: campaignId, status: 'active', has_announced: true, has_resolved: false })
    .modify(qb => { if (tokensWithEntries.length > 0) qb.whereNotIn('token_id', tokensWithEntries) })
    .orderBy('initiative', 'desc')
    .first()

  if (!nextEntry && !nextSimple) return null
  if (!nextEntry) return { kind: 'simple', tokenId: nextSimple.token_id, position: nextSimple.initiative * 100 }
  if (!nextSimple) return { kind: 'entry', tokenId: nextEntry.token_id, entry: nextEntry, position: nextEntry.phase_position }
  const simplePosition = nextSimple.initiative * 100
  return simplePosition > nextEntry.phase_position
    ? { kind: 'simple', tokenId: nextSimple.token_id, position: simplePosition }
    : { kind: 'entry', tokenId: nextEntry.token_id, entry: nextEntry, position: nextEntry.phase_position }
}

// Groupe delayed_waiting suivant pour le tour obligatoire de fin de Tour (§6 point 2) : ordre croissant
// d'Initiative (le plus lent en premier), aucun minuteur — réponse explicite requise (Agir maintenant
// ou Passer, COMBAT_DELAYED_PASS). N'est consulté que lorsque pickNextTimelineStep ne renvoie plus rien.
async function pickNextObligatoryDelayed(campaignId, turnNumber) {
  const entry = await db('combat_timeline_entries as cte')
    .join('combat_roster as cr', function() {
      this.on('cr.campaign_id', '=', 'cte.campaign_id').andOn('cr.token_id', '=', 'cte.token_id')
    })
    .where({ 'cte.campaign_id': campaignId, 'cte.turn_number': turnNumber, 'cte.status': 'delayed_waiting' })
    .orderBy('cr.initiative', 'asc')
    .select('cte.token_id', 'cte.declaration_group_id')
    .first()
  return entry ?? null
}

// Position d'insertion d'un « Agir maintenant » (§6ter point 3 / §0.1 point 4-5 / §6 point 8) :
// strictement au-dessus de la référence (le pas qui allait résoudre ensuite) — priorité RAW sur une
// action normale à la même phase — avec l'Initiative du personnage en second départage pour deux
// déclenchements « Agir maintenant » quasi simultanés (le plus rapide gagne, cohérent avec le reste du
// moteur). +100 reste sous l'espacement ×100 entre deux Initiatives de base, jamais de collision avec
// une entrée existante plus haute (référence = pas le plus haut restant, par construction).
function computeActNowPosition(referencePosition, initiative) {
  return referencePosition + 100 + initiative
}

// [BUG RÉEL, Session 159, retour Saar — « Agir maintenant devrait apparaître immédiatement »] :
// `sub_phase` n'était jamais poussé au client normalement — seulement restauré à la reconnexion
// (`COMBAT_STATE_SYNC`, socket/index.js). `subPhase` restait donc figé à `null` côté client pendant
// toute une session de jeu normale, rendant systématiquement fausses toutes les conditions
// `subPhase === 'SLOT_ACTIVE'` ajoutées cette session (panneau Agir maintenant mi-Tour, retry precheck,
// panneau MJ Forcer) — jamais détecté car le flux principal (bouton Agir normal) ne dépend pas de
// `subPhase`. Corrigé à la source unique : `broadcastTimelineState` relit et inclut désormais toujours
// le `sub_phase` courant, pour tous ses appelants sans exception.
async function broadcastTimelineState(io, campaignId, turnNumber, currentStep) {
  const [entries, state] = await Promise.all([
    db('combat_timeline_entries')
      .where({ campaign_id: campaignId, turn_number: turnNumber })
      .orderBy('phase_position', 'desc'),
    db('combat_state').where({ campaign_id: campaignId }).first(),
  ])
  io.to(campaignId).emit(WS.COMBAT_TIMELINE_UPDATED, { turnNumber, entries, currentStep, subPhase: state?.sub_phase ?? null })
}

// Rediffuse l'état courant (même pas, nouveau sub_phase) après un `setFSMSubPhase(..., 'AWAITING_DEFENSE'
// | 'AWAITING_DAMAGE')` qui ne passe pas par `advanceTimeline` (résolution suspendue en attendant un
// joueur, pas un changement de pas) — sans quoi ce changement de sub_phase, bien qu'écrit en base,
// n'atteint jamais les autres clients (panneau MJ « Forcer », retry precheck).
async function broadcastCurrentSubPhase(io, campaignId) {
  const state = await db('combat_state').where({ campaign_id: campaignId }).first()
  if (!state) return
  const turnNumber = state.current_turn
  const step = await pickNextTimelineStep(campaignId, turnNumber)
  await broadcastTimelineState(io, campaignId, turnNumber, step)
}

// Arme l'attente de dégâts d'un token (PLAN_RW_SYSCOMBAT.md §2.5, Lot 3) — factorise l'insert
// combat_pending/setFSMSubPhase/broadcastCurrentSubPhase/comptage identique aux 3 sites qui la posent
// (confirmMeleeDefense, resolveDroneAssaultAction, resolveAssaultAction). L'émission du prompt reste à
// l'appelant : elle diffère réellement d'un site à l'autre (direct vs emissions[], §2.5.b) — ne pas la
// tirer dans ce helper harmoniserait un comportement d'émission au passage, hors périmètre du Lot 3.
async function armAwaitingDamage(io, campaignId, tokenId, payload) {
  await db('combat_pending').insert({ campaign_id: campaignId, token_id: tokenId, type: 'damage', payload })
  await setFSMSubPhase(db, campaignId, 'AWAITING_DAMAGE')
  await broadcastCurrentSubPhase(io, campaignId)
  const [{ count }] = await db('combat_pending')
    .where({ campaign_id: campaignId, token_id: tokenId, type: 'damage' })
    .count('* as count')
  return parseInt(count, 10)
}

// ─── advanceTimeline — remplace advanceSlot, seul point d'entrée « fais avancer la résolution » ────
// Pas de fenêtre de réaction temporisée (retirée Session 159, retour Saar — cf. commentaire en tête de
// `combatFSM.js`) : dès qu'un pas normal existe, on le présente directement en SLOT_ACTIVE.
// `triggerActNow` reste utilisable à tout moment pendant SLOT_ACTIVE pour un personnage en délai — le
// RAW ne prévoit aucun minuteur, seulement une priorité sur l'action normale à la même phase.
export async function advanceTimeline(io, campaignId, pendingMaps) {
  try {
    const state = await db('combat_state').where({ campaign_id: campaignId }).first()
    const turnNumber = state.current_turn

    const step = await pickNextTimelineStep(campaignId, turnNumber)
    if (step) {
      await setFSMSubPhase(db, campaignId, 'SLOT_ACTIVE')
      await broadcastTimelineState(io, campaignId, turnNumber, step)
      return
    }

    const obligatoryDelayed = await pickNextObligatoryDelayed(campaignId, turnNumber)
    if (obligatoryDelayed) {
      await setFSMSubPhase(db, campaignId, 'SLOT_ACTIVE')
      await broadcastTimelineState(io, campaignId, turnNumber,
        { kind: 'delayed_turn', tokenId: obligatoryDelayed.token_id, groupId: obligatoryDelayed.declaration_group_id })
      return
    }

    await endTurn(io, campaignId, pendingMaps)
  } catch (err) {
    console.error('[WS] advanceTimeline error:', err.message)
  }
}

// Force-résolution d'un token hors du parcours normal (étourdissement — STUN2) : ses actions et
// entrées encore en jeu ce Tour sont clôturées (resolved/lost), jamais laissées 'scheduled'/
// 'delayed_waiting' orphelines — sinon pickNextTimelineStep les resélectionnerait indéfiniment.
export async function forfeitToken(campaignId, tokenId, turnNumber) {
  await db('combat_actions')
    .where({ campaign_id: campaignId, token_id: tokenId, status: 'pending', turn_number: turnNumber })
    .update({ status: 'resolved', updated_at: db.fn.now() })
  await db('combat_timeline_entries')
    .where({ campaign_id: campaignId, token_id: tokenId, turn_number: turnNumber })
    .whereIn('status', ['scheduled', 'delayed_waiting'])
    .update({ status: 'lost', updated_at: db.fn.now() })
  await db('combat_roster')
    .where({ campaign_id: campaignId, token_id: tokenId })
    .update({ has_resolved: true, updated_at: db.fn.now() })
}

// ─── « Agir maintenant » (docs/PLAN_COMBAT_TIMELINE.md §1, refonte Session 159) ────────────────────
// Repositionne TOUTE la série delayed_waiting d'un token (§6bis point 2 : Retarder porte sur le Tour
// entier de l'action, jamais une attaque isolée) au-dessus du prochain pas normal restant — priorité
// RAW sur une action normale à la même phase (§0.1 points 4-5) — ou, s'il n'en reste plus (tour
// obligatoire de fin de Tour, §6 point 2), juste sous la dernière entrée résolue ce Tour.
export async function triggerActNow(io, campaignId, tokenId, pendingMaps) {
  const state = await db('combat_state').where({ campaign_id: campaignId }).first()
  const turnNumber = state.current_turn
  const entries = await db('combat_timeline_entries')
    .where({ campaign_id: campaignId, token_id: tokenId, turn_number: turnNumber, status: 'delayed_waiting' })
    .orderBy('created_at', 'asc')
  if (entries.length === 0) return

  const rosterEntry = await db('combat_roster').where({ campaign_id: campaignId, token_id: tokenId }).first()

  // Guard RAW (REGLESYSCOMBAT.md:554-567) : « agir à n'importe quelle phase d'Action » — mais « plus
  // tard dans le Tour » que sa propre Initiative (retour Saar, Session 159 : Retarder décale l'Action
  // vers plus tard, jamais plus tôt — sinon ce serait Précipiter). Actif seulement une fois que le pas
  // normal à résoudre a atteint (ou dépassé) sa propre phase d'origine (`initiative × 100`, même unité
  // que `buildTimelineEntries`) — jamais avant, quel que soit le sous-état. Reste actif ensuite jusqu'à
  // la fin du Tour. Bloqué aussi si ce pas est déjà en cours de résolution (AWAITING_DEFENSE/
  // AWAITING_DAMAGE, dés déjà lancés — §6ter point 3, « explicitement écarté »), ou si c'est le tour
  // obligatoire d'un AUTRE personnage en délai (§6 point 2, ordre croissant d'Initiative — pas de resquille).
  const ownPosition = (rosterEntry?.initiative ?? 0) * 100
  const referenceStep = await pickNextTimelineStep(campaignId, turnNumber)
  if (referenceStep) {
    if (state.sub_phase !== 'SLOT_ACTIVE') return 'busy'
    if (referenceStep.position > ownPosition) return 'too_early'
  } else {
    const obligatoryDelayed = await pickNextObligatoryDelayed(campaignId, turnNumber)
    if (obligatoryDelayed?.token_id !== tokenId) return 'not_your_turn'
  }

  let base
  if (referenceStep) {
    base = computeActNowPosition(referenceStep.position, rosterEntry?.initiative ?? 0)
  } else {
    // Tour obligatoire (§6 point 2) : plus de pas normal en référence — la position n'a alors qu'une
    // valeur d'audit/affichage (l'ordre réel de ce cas vient de pickNextObligatoryDelayed, pas de
    // phase_position, §6ter point 1 étendu). Ancrée sur la dernière entrée résolue chronologiquement
    // (resolved_at, pas la plus haute position — sinon une série d'attaques multiples déjà résolue
    // plus tôt dans le Tour redeviendrait la référence au lieu de ce qui vient de se passer).
    const lastResolved = await db('combat_timeline_entries')
      .where({ campaign_id: campaignId, turn_number: turnNumber, status: 'resolved' })
      .orderBy('resolved_at', 'desc')
      .first()
    base = (lastResolved?.phase_position ?? 0) - 1
  }

  const positions = computeSeriesPositions(base, entries.length)
  for (let idx = 0; idx < entries.length; idx++) {
    await db('combat_timeline_entries').where({ id: entries[idx].id }).update({
      phase_position: positions[idx],
      status: positions[idx] <= 0 ? 'lost' : 'scheduled',
      updated_at: db.fn.now(),
    })
  }

  await advanceTimeline(io, campaignId, pendingMaps)
  return 'ok'
}

// ─── « Passer » consciemment au tour obligatoire de fin de Tour (§6 point 2) ────────────────────────
// Distinct d'une action perdue (cible invalide/étourdissement, statut 'lost') : ici le joueur choisit
// délibérément de ne rien faire — statut 'skipped', cohérent avec le CHECK de combat_timeline_entries.
export async function triggerDelayedPass(io, campaignId, tokenId, pendingMaps) {
  const state = await db('combat_state').where({ campaign_id: campaignId }).first()
  const turnNumber = state.current_turn

  // Guard — uniquement au tour obligatoire de ce token précis (§6 point 2), jamais pendant une simple
  // fenêtre de réaction (Passer n'a de sens que quand c'est effectivement son tour, pas avant).
  const referenceStep = await pickNextTimelineStep(campaignId, turnNumber)
  if (referenceStep) return
  const obligatoryDelayed = await pickNextObligatoryDelayed(campaignId, turnNumber)
  if (obligatoryDelayed?.token_id !== tokenId) return

  const updated = await db('combat_timeline_entries')
    .where({ campaign_id: campaignId, token_id: tokenId, turn_number: turnNumber, status: 'delayed_waiting' })
    .update({ status: 'skipped', updated_at: db.fn.now() })
  if (updated === 0) return
  await db('combat_roster')
    .where({ campaign_id: campaignId, token_id: tokenId })
    .update({ has_resolved: true, updated_at: db.fn.now() })
  await advanceTimeline(io, campaignId, pendingMaps)
}

// ─── confirmMeleeDefense / confirmDamage (docs/PLAN_COMBAT_TIMELINE.md Lot D) ──────────────────────
// Extraits des handlers socket COMBAT_MELEE_DEFENSE_CONFIRM/COMBAT_DAMAGE_CONFIRM (socketCombatResolution.js)
// — même code exact, appelable aussi depuis le déclenchement générique MJ (COMBAT_SKIP_PLAYER, « le
// serveur lance les dés à sa place — il devient PNJ pour le Tour ») sans dupliquer le moindre calcul.
// `forced=true` : pas de vérification de propriétaire (déjà vérifiée en amont — c'est le MJ qui
// déclenche), jet affiché sous l'identité du personnage plutôt que celle du MJ (même patron que les
// PNJ ailleurs dans ce fichier).
export async function confirmMeleeDefense(io, campaignId, tokenId, pendingMaps, socket, { requesterUserId, requesterUsername, isGm, forced = false } = {}) {
  const row = await db('combat_pending').where({ campaign_id: campaignId, token_id: tokenId, type: 'melee_defense' }).first()
  if (!row) {
    console.warn(`[WS] confirmMeleeDefense — pas de pending pour defender:${tokenId}`)
    return
  }
  const pending = row.payload
  if (!forced && pending.defenderUserId !== requesterUserId && !isGm) return
  await db('combat_pending').where({ campaign_id: campaignId, token_id: tokenId, type: 'melee_defense' }).delete()
  await setFSMSubPhase(db, campaignId, 'SLOT_ACTIVE')
  // Bug réel jumeau de celui trouvé côté Tir Multi (Saar, 2026-07-19, même cause racine — voir
  // resolveAssaultAction) : un attaquant PJ qui touche pose AWAITING_DAMAGE plus bas (sous-état FSM
  // bloquant) pour qu'il lance ses dégâts — appeler advanceTimeline juste après l'écraserait en
  // SLOT_ACTIVE dès qu'un autre combattant a un pas suivant, rendant COMBAT_DAMAGE_CONFIRM rejeté par
  // le garde FSM.
  let suspendForDamage = false

  const {
    campaignId: meleeCampaignId,
    attackerTokenId, attackerCharacter,
    attackerUsername, attackerColor,
    rollAttaque, chancesAttaque, mrAttaque,
    defenderSkillTotal, defenderEffectiveMalus, defenderMastery,
    multiMalusDefenseur,
    damageFormula, weaponInvId, modDom, combatModeBonus,
    characterIdCible, cibleType, char_sheet_id_cible,
    for_na_cible, con_na_cible, vol_na_cible,
    targetName, userId,
    situationDef: pendingSituationDef = [],
  } = pending

  try {
    // 1. Roll défense D20 (serveur)
    const { total: rollDefense, rolls: defRolls, seed: defSeed } = await parseDice('1d20')
    // Mode combat du défenseur PJ — Offensif/Charge → pénalité, Défensif/Retraite → bonus (CaC3)
    const rosterDef = await db('combat_roster').where({ campaign_id: meleeCampaignId, token_id: tokenId }).first()
    const defCombatMode = rosterDef?.state_combat_mode ?? 'normal'
    const modeCombatDefPj = defCombatMode === 'offensif' ? -5 : defCombatMode === 'charge' ? -7 : defCombatMode === 'defensif' ? 3 : defCombatMode === 'retraite' ? 5 : 0

    // Terrain instable défenseur PJ — compétence limitative ACROBATIE_EQUILIBRE
    // PLAN_COMBATANT_CONTEXT.md Lot C — objet minimal { id, campaign_id } reconstruit, même patron
    // que resolveMeleeDefensePnj (ni l'un ni l'autre ne reçoit la ligne characters complète). Sans
    // `.type`, sans conséquence : gardé par `char_sheet_id_cible` (Lot G, toujours null pour un
    // défenseur exo), jamais atteint pour un exo.
    let terrainInstableModDef = 0, acrobatieDefTotal = defenderSkillTotal
    if (pendingSituationDef.includes('cac_terrain_instable') && char_sheet_id_cible) {
      // Repli sur defenderSkillTotal préservé tel quel si ACROBATIE_EQUILIBRE est absente du catalogue
      // (garde défensive héritée de l'ancien code, même patron que resolveMeleeAction Lot B).
      const acrobatieRefDef = await db('ref_skills').where({ id: 'ACROBATIE_EQUILIBRE' }).first()
      if (acrobatieRefDef) {
        const ctxAcrobatieDef = await resolveCombatantTestContext(db, { id: characterIdCible, campaign_id: meleeCampaignId }, 'ACROBATIE_EQUILIBRE')
        acrobatieDefTotal = ctxAcrobatieDef?.skillTotal ?? defenderSkillTotal
      }
      terrainInstableModDef = Math.min(0, acrobatieDefTotal - defenderSkillTotal)
    }

    // Seuil de défense + breakdown — noyau pur du Lot 1 réutilisé ici (Lot 2, RV6, PLAN_RW_SYSCOMBAT.md
    // §2.4.h) au lieu d'un tableau assemblé à la main (miroir de resolveMeleeDefensePnj).
    const defenseOutcome0 = computeAttackRoll({
      skillLabel: 'Compétence', skillTotal: defenderSkillTotal, totalLabel: 'Seuil', rollAttaque: rollDefense,
      contributions: [
        { label: COMBAT_MODE_LABELS[defCombatMode] ?? defCombatMode, value: modeCombatDefPj, type: modeCombatDefPj > 0 ? 'bonus' : 'malus' },
        { label: 'Multi-adversaires', value: multiMalusDefenseur ?? 0, type: 'malus' },
        { label: 'Malus santé / encombrement', value: defenderEffectiveMalus, type: 'malus' },
        { label: `Terrain instable (Acrobatie/Équilibre: ${acrobatieDefTotal})`, value: terrainInstableModDef, type: 'malus' },
      ],
    })
    // Réussite critique défenseur (p.204, Lot 2) — même geste que resolveMeleeDefensePnj.
    const defenseOutcomeCrit = applyCriticalSuccessBonus(defenseOutcome0, getCriticalSuccessBonus({ masteryLevel: defenderMastery }))
    const { seuil: chanceDefense, breakdown: breakdownDefPj, isSuccess: defenseSuccess, mr: mrDefense } = defenseOutcomeCrit
    const defenseOutcome = await resolveCriticalFailReroll(defenseOutcomeCrit)

    // 2. Résolution Polaris §6.2 : les deux réussissent → meilleure MR l'emporte, égalité = rien
    // mrAttaque déjà résolu (bonus Réussite critique inclus) par resolveMeleeAction — jamais recalculé ici.
    const attackSuccess = rollAttaque <= chancesAttaque
    const hit = attackSuccess && (!defenseSuccess || mrAttaque > mrDefense)

    console.log(`[WS] melee défense — rollAtk:${rollAttaque}/${chancesAttaque} rollDef:${rollDefense}/${chanceDefense} → ${hit ? 'TOUCHÉ' : 'ESQUIVÉ/RATÉ'}`)

    // Broadcast roll défense au chat — identité du défenseur si forcé par le MJ (§ « devient PNJ
    // pour le Tour », docs/PLAN_COMBAT_TIMELINE.md Lot D), sinon celle du joueur qui a cliqué.
    const now = new Date().toISOString()
    io.to(meleeCampaignId).emit(WS.DICE_RESULT, {
      userId: forced ? null : requesterUserId,
      username: forced ? (targetName ?? 'PNJ') : requesterUsername,
      color: forced ? '#808080' : '#6060c0',
      formula: '1d20', rolls: defRolls, total: rollDefense,
      isCriticalSuccess: defenseOutcome.isCriticalSuccess, isCriticalFail: defenseOutcome.isCriticalFail,
      catastropheRisk:   defenseOutcome.catastropheRisk,
      seed: defSeed, timestamp: now,
      skillLabel:        'Jet pour défendre (contact)',
      mechanicalTotal:   defenderSkillTotal,
      diffLabel:         chanceDefense - defenderSkillTotal >= 0 ? `+${chanceDefense - defenderSkillTotal}` : `${chanceDefense - defenderSkillTotal}`,
      chancesDeReussite: chanceDefense,
      isSuccess:         defenseSuccess,
      mr:                mrDefense,
      breakdown:         breakdownDefPj,
    })
    // Catastrophe automatique (docs/PLANS/PLAN_CATASTROPHE_RISK.md Lot 1) — no-op hors combat/sans
    // risque, garde centralisée dans maybeTriggerCatastrophe, jamais dupliquée ici.
    await maybeTriggerCatastrophe(io, meleeCampaignId, tokenId, defenseOutcome.catastropheRisk, {
      site: 'melee_defense', actorTokenId: tokenId, targetTokenId: attackerTokenId,
    })

    // 3. Résultat opposition → room
    io.to(meleeCampaignId).emit(WS.COMBAT_MELEE_RESULT, {
      attaquantId: attackerTokenId,
      defenseurId: tokenId,
      rollAttaque, chancesAttaque,
      rollDefense, chanceDefense,
      hit,
      multiMalusAttaquant: pending.multiMalusAttaquant ?? 0,
      multiMalusDefenseur: pending.multiMalusDefenseur ?? 0,
    })

    // 4. Dégâts si touche — branchement post-hit sur le type de l'attaquant (PLAN_RW_SYSCOMBAT.md §2.9).
    if (hit) {
      const ctx = {
        attackerTokenId, attackerCharacter, attackerUsername, attackerColor,
        rollAttaque, chancesAttaque, mrAttaque,
        damageFormula, weaponInvId, modDom, combatModeBonus,
        characterIdCible, cibleType, char_sheet_id_cible,
        for_na_cible, con_na_cible, vol_na_cible,
        targetName, userId, tokenId, socket,
      }
      if (attackerCharacter.type === 'pj') {
        const result = await resolveMeleeDefenseHitAttackerPj(io, meleeCampaignId, ctx)
        suspendForDamage = result.suspendForDamage
      } else {
        await resolveMeleeDefenseHitAttackerPnj(io, meleeCampaignId, ctx)
      }
    }

    // 5. Pas suivant de l'échelle — l'entrée elle-même est déjà marquée 'resolved' (COMBAT_ACTION_CONFIRM,
    // avant l'appel à resolveMeleeAction) ; une éventuelle attaque suivante de la même série est une
    // entrée distincte, reprise plus tard par advanceTimeline() (§5 Lot B, plus de récursion ici).
    // Sauf si l'attaquant PJ vient de poser AWAITING_DAMAGE ci-dessus (suspendForDamage) — le pas
    // courant reste dû jusqu'à COMBAT_DAMAGE_CONFIRM, comme AWAITING_DEFENSE le fait déjà ailleurs.
    if (!suspendForDamage) {
      await advanceTimeline(io, meleeCampaignId, pendingMaps)
    }
  } catch (err) {
    console.error('[WS] confirmMeleeDefense error:', err.message)
  }
}

// Attaquant PJ après un hit confirmé en défense CaC — invite à lancer les dégâts (CombatDamageWindow
// existant), même primitive que les Lots 2/4/6 (armAwaitingDamage). Ne fait pas partie de la file
// emissions[] de resolveMeleeAction : confirmMeleeDefense émet en direct (PLAN_RW_SYSCOMBAT.md §2.4.l),
// ce Lot ne l'harmonise pas au passage (§2.9.b).
async function resolveMeleeDefenseHitAttackerPj(io, campaignId, ctx) {
  const {
    attackerTokenId, attackerCharacter, attackerUsername, attackerColor,
    damageFormula, weaponInvId, modDom, mrAttaque, combatModeBonus,
    characterIdCible, cibleType, char_sheet_id_cible, for_na_cible, con_na_cible, vol_na_cible,
    targetName, userId, tokenId, socket,
  } = ctx
  // Plusieurs entrées peuvent désormais coexister pour le même attaquant (attaques multiples CaC
  // touchant chacune un défenseur PJ distinct, docs/PLAN_COMBAT_ACTION_QUEUE.md §3) — consommées FIFO
  // par COMBAT_DAMAGE_CONFIRM ; le prompt n'est émis ici que si aucune autre entrée n'attendait
  // déjà (sinon le joueur perdrait de vue le prompt encore non résolu de la précédente).
  // cibleType (PLAN_EXOARMURE.md §11.4, catégorie B) — absent de ce payload jusqu'ici (repli implicite
  // sur `undefined` côté confirmDamage, jamais un bug visible tant qu'aucun branchement `cibleType`
  // n'existait pour un défenseur exo) : ajouté pour que confirmDamage puisse router correctement.
  const pendingDamageCount = await armAwaitingDamage(io, campaignId, attackerTokenId, {
    type: 'melee',
    campaignId,
    targetTokenId: tokenId,
    characterIdCible,
    cibleType,
    char_sheet_id_cible,
    modDom,
    mr: mrAttaque,
    combatModeBonus,
    formula: damageFormula,
    weaponInvId,
    for_na_cible,
    con_na_cible,
    vol_na_cible,
    tireurUsername: attackerUsername,
    tireurColor: attackerColor,
    userId,
    targetName,
  })
  if (pendingDamageCount === 1) {
    // Trouver le socket de l'attaquant PJ
    const sockets = await io.fetchSockets()
    const attackerSocket = sockets.find(s =>
      s.campaignId === campaignId && s.user?.id === attackerCharacter.user_id
    )
    const prompt = { tokenId: attackerTokenId, formula: damageFormula, targetName }
    if (attackerSocket) {
      attackerSocket.emit(WS.COMBAT_DAMAGE_PROMPT, prompt)
    } else if (socket) {
      socket.emit(WS.COMBAT_DAMAGE_PROMPT, prompt)  // fallback : même socket (rare)
    }
  }
  return { suspendForDamage: true }
}

// Attaquant PNJ après un hit confirmé en défense CaC — résolution auto des dégâts, même primitives que
// resolveMeleeDefensePnj (Lot 2/5). Atteint pour un défenseur `cibleType` 'pj' (humanoïde réel) ou
// 'exo' (exo pilotée par un PJ, defenderEffectiveType suit le pilote) — jamais 'pnj' (routé plus tôt
// vers resolveMeleeDefensePnj). cibleType venait d'un littéral codé en dur `'pj'` avant
// PLAN_EXOARMURE.md §11.4 (catégorie B, point 10) : sans conséquence tant qu'aucun branchement exo
// n'existait, mais aurait fait disparaître silencieusement les dégâts d'un défenseur exo — corrigé.
async function resolveMeleeDefenseHitAttackerPnj(io, campaignId, ctx) {
  const {
    attackerTokenId, attackerUsername, attackerColor,
    damageFormula, weaponInvId, modDom, mrAttaque, combatModeBonus,
    characterIdCible, cibleType, char_sheet_id_cible, for_na_cible, con_na_cible, vol_na_cible,
    rollAttaque, chancesAttaque, userId, tokenId,
  } = ctx
  // CHOC1 : point de résolution unique (voir getEffectiveMeleeDamage, docs/JOURNALTEMP.md Étape 6) —
  // pas de re-fetch arme naturelle ici (appel différé, formule mutation déjà résolue et stable dans
  // damageFormula), seule l'arme équipée est re-fetchée (fenêtre de péremption réelle : désequipée
  // entre Déclaration et confirmation de défense).
  const { total: rawDice, choc: effectiveChocDsl } = await damageService.getEffectiveMeleeDamage(db, {
    weaponInvId, fallbackFormula: damageFormula,
  })
  // MELEE-MR — Dommages_Bruts = Arme + MR + ModDom(FOR) (docs/BUGIDENTIFIE.md, MANUELSYSCOMBAT §6.2).
  const degautsBruts = computeMeleeRawDamage({ rawDice, mr: mrAttaque, modDom, combatModeBonus })

  if (cibleType === 'exo') {
    // PLAN_EXOARMURE.md §11.4 — resolveExoDamage gère déjà l'émission EXO_AVARIE_UPDATED ; ici, même
    // rôle que le bloc COMBAT_ATTACK_RESULT du chemin humain juste en dessous, format propre à l'exo
    // (pas de localisation/is_lethal — concepts humains, EXO_AVARIE_UPDATED porte déjà destroyed/itgLoss).
    const exoResult = await exoAvarieService.resolveExoDamage(io, db, campaignId, { characterId: characterIdCible, degautsBruts })
    if (exoResult) {
      io.to(campaignId).emit(WS.COMBAT_ATTACK_RESULT, {
        tireurId: attackerTokenId, cibleId: tokenId,
        localisation: null, degautsBruts, degatsNets: exoResult.degatsNets,
        severity: exoResult.severity, is_lethal: false, isSuccess: true, isPnj: true,
        roll: rollAttaque, chancesDeReussite: chancesAttaque, shockResult: null,
      })
    }
    return
  }

  const hitResult = await damageService.resolveTargetHit(io, db, campaignId, {
    degautsBruts, characterIdCible, cibleType,
    char_sheet_id_cible,
    for_na_cible, con_na_cible, vol_na_cible,
    chocDsl: effectiveChocDsl,
    treatAsContact: true,
  })
  if (hitResult === null) return
  const { localisation, degatsNets, is_lethal, finalSeverity, shockResult } = hitResult

  if (shockResult) {
    statusService.emitShockDiceResult(io, campaignId, shockResult, userId, attackerUsername, attackerColor)
  }

  io.to(campaignId).emit(WS.COMBAT_ATTACK_RESULT, {
    tireurId:    attackerTokenId,
    cibleId:     tokenId,
    localisation,
    degautsBruts,
    degatsNets,
    severity:    finalSeverity,
    is_lethal,
    isSuccess:   true,
    isPnj:       true,
    roll:        rollAttaque,
    chancesDeReussite: chancesAttaque,
    shockResult,
  })
  if (shockResult?.outcome && shockResult.outcome !== 'ok') {
    statusService.applyStun(io, db, campaignId, {
      targetTokenId: tokenId, outcome: shockResult.outcome,
      userId, username: attackerUsername, color: attackerColor,
    }).catch(err => console.error('[WS] applyStun error:', err.message))
  }
}

// Extrait de COMBAT_DAMAGE_CONFIRM (docs/PLAN_COMBAT_TIMELINE.md Lot D) — même code exact. Aucune
// identité à substituer ici : les broadcasts DICE_RESULT utilisent déjà `tireurUsername`/`tireurColor`
// (figés dans `pending` au moment de l'attaque), jamais l'identité de qui clique confirmer — seule la
// vérification de propriétaire a besoin du contournement `forced` (MJ déclenche pour un tireur PJ
// injoignable, § « devient PNJ pour le Tour »). Appelle `advanceTimeline()` une fois sa file vidée
// (correctif Session 165, voir plus bas) — la confirmation de dégâts suspend la Résolution le temps du
// jet (comme AWAITING_DEFENSE côté CaC), elle ne l'esquive plus.
export async function confirmDamage(io, campaignId, tokenId, pendingMaps, socket, { requesterUserId, isGm, forced = false } = {}) {
  // FIFO — plusieurs dégâts peuvent être en attente pour le même token (docs/PLAN_COMBAT_ACTION_QUEUE.md
  // §3, correctif combat_pending) : la plus ancienne entrée d'abord, supprimée par son id propre
  // (jamais par le filtre composite — supprimerait aussi les entrées plus récentes du même type).
  const row = await db('combat_pending')
    .where({ campaign_id: campaignId, token_id: tokenId, type: 'damage' })
    .orderBy('created_at', 'asc')
    .first()
  if (!row) {
    console.warn(`[WS] confirmDamage — pas de pending pour token:${tokenId}`)
    return
  }
  const pending = row.payload
  if (!forced && pending.userId !== requesterUserId && pending.targetUserId !== requesterUserId && !isGm) return
  await db('combat_pending').where({ id: row.id }).delete()
  const nextRow = await db('combat_pending')
    .where({ campaign_id: campaignId, token_id: tokenId, type: 'damage' })
    .orderBy('created_at', 'asc')
    .first()
  if (nextRow) {
    // File non vide — attaques multiples ayant chacune touché un défenseur distinct : sub_phase
    // reste AWAITING_DAMAGE, nouveau prompt émis pour la suivante (§3 du plan cité ci-dessus).
    await setFSMSubPhase(db, campaignId, 'AWAITING_DAMAGE')
    await broadcastCurrentSubPhase(io, campaignId)
    if (socket) socket.emit(WS.COMBAT_DAMAGE_PROMPT, { tokenId, formula: nextRow.payload.formula, targetName: nextRow.payload.targetName })
  } else {
    // File vide — la résolution était suspendue (AWAITING_DAMAGE) le temps de ce jet, exactement comme
    // AWAITING_DEFENSE (confirmMeleeDefense). advanceTimeline() ici, pas un simple
    // setFSMSubPhase+broadcastCurrentSubPhase : sans lui, si ce jet de dégâts était la toute dernière
    // action à résoudre du Tour, plus rien n'appelle jamais endTurn() (bug jumeau trouvé en corrigeant
    // le suspend manquant, Saar 2026-07-19).
    await advanceTimeline(io, campaignId, pendingMaps)
  }

  const {
    campaignId: pendingCampaignId, targetTokenId, characterIdCible, cibleType = null, char_sheet_id_cible,
    mr, portee, fire_mode_bonus_dmg, formula, weaponInvId,
    for_na_cible, con_na_cible, vol_na_cible,
    tireurUsername, tireurColor, userId, targetName,
    type: pendingType, modDom, combatModeBonus,
    aimedLocation, treatAsContact,
  } = pending

  try {
    // Calcul dégâts (branche melee vs assault). Assault : DSL munition (Chantier 11 Étape 2 Lot A,
    // docs/PLAN_ARMES_DSL.md) résolu ici, au moment du jet réel — jamais précalculé à la
    // Déclaration (un ADD munition peut nécessiter 2 jets de dés de types différents, parseDice
    // n'accepte qu'un seul type par formule).
    let degautsBruts, dmgRolls, dmgSeed, rawDice, resolvedFormula, effectiveChocDsl = null, effectiveAmmoFx = null
    if (pendingType === 'melee') {
      // CHOC1 : point de résolution unique (voir getEffectiveMeleeDamage, docs/JOURNALTEMP.md
      // Étape 6) — pas de re-fetch arme naturelle ici (appel différé, formule mutation déjà résolue
      // et stable dans `formula`), seule l'arme équipée est re-fetchée (fenêtre de péremption réelle :
      // désequipée entre la Déclaration et cette Confirmation, côté PJ différé).
      const meleeRolled = await damageService.getEffectiveMeleeDamage(db, { weaponInvId, fallbackFormula: formula })
      dmgRolls = meleeRolled.rolls; dmgSeed = meleeRolled.seed; rawDice = meleeRolled.total
      resolvedFormula = meleeRolled.formula
      // CHOC1 Palier 1 : jamais câblé jusqu'ici côté CaC (contrairement à la branche assault ci-dessous,
      // effectiveChocDsl restait toujours null pour 'melee' — voir docs/PLAN_CHOC1.md §4).
      effectiveChocDsl = meleeRolled.choc
      // MELEE-MR — Dommages_Bruts = Arme + MR + ModDom(FOR) (docs/BUGIDENTIFIE.md, MANUELSYSCOMBAT §6.2) :
      // même table que le pipeline Assaut, jamais câblée côté CaC jusqu'ici.
      degautsBruts = computeMeleeRawDamage({ rawDice, mr, modDom, combatModeBonus })
    } else {
      // getEffectiveWeaponDamage peut renvoyer null si l'arme a été désequipée/transférée entre la
      // Déclaration et cette Confirmation (fenêtre réelle côté PJ, contrairement au PNJ immédiat) —
      // repli sur la formule brute stockée à la Déclaration plutôt qu'un échec muet (le combat_pending
      // est déjà supprimé et la FSM déjà repassée à SLOT_ACTIVE avant ce bloc, cf. plus haut).
      const effectiveDamage = await damageService.getEffectiveWeaponDamage(db, weaponInvId, { rangeBand: portee })
      if (!effectiveDamage) {
        console.warn(`[WS] confirmDamage — arme introuvable pour weaponInvId:${weaponInvId}, repli sur formule stockée à la Déclaration`)
      }
      const rolled = effectiveDamage ? null : await parseDice(formula.replace(/\s/g, ''))
      dmgRolls = effectiveDamage ? effectiveDamage.rolls : rolled.rolls
      dmgSeed  = effectiveDamage ? dmgRolls.reduce((a, b) => a ^ b, 0) : rolled.seed
      rawDice  = effectiveDamage ? effectiveDamage.total : rolled.total
      resolvedFormula = effectiveDamage ? effectiveDamage.formula : rolled.formula
      // effectiveDamage null (repli formule stockée) → chocDsl null aussi : jamais reconstruire un
      // Choc depuis une donnée partielle (docs/PLAN_ARMES_DSL.md Lot B, §4). Même garde pour l'armure
      // (Lot C1) : ammoFx reste null dans ce repli, jamais reconstruit depuis une donnée partielle.
      effectiveChocDsl = effectiveDamage ? effectiveDamage.choc : null
      effectiveAmmoFx  = effectiveDamage ? effectiveDamage.tags?.FX ?? null : null
      // PLAN_RW_SYSCOMBAT.md §2.10 (Lot 8a) — noyau pur, même formule que resolveAssaultAction.
      degautsBruts = computeAssaultRawDamage({ rawDice, mr, portee, fireModeBonusDmg: fire_mode_bonus_dmg })
    }
    // PLAN_RW_SYSCOMBAT.md §2.10 (Lot 8c) — ctx assemblé une fois, dispatch guard-clause vers les
    // fonctions sœurs cible (drone/normal), même patron que Lots 2/4/6/7. treatAsContact résolu ici
    // (Bouclier, docs/PLAN_BOUCLIER.md Lot B — CaC toujours "au contact", Tir dérivé de la nature de
    // l'arme, calculé côté resolveAssaultAction et transporté).
    const ctx = {
      degautsBruts, dmgRolls, dmgSeed, rawDice, resolvedFormula, effectiveChocDsl, effectiveAmmoFx,
      characterIdCible, cibleType, char_sheet_id_cible, for_na_cible, con_na_cible, vol_na_cible,
      tireurUsername, tireurColor, userId, targetName, targetTokenId, tokenId, aimedLocation,
      treatAsContact: pendingType === 'melee' ? true : (treatAsContact ?? false),
    }
    // Branche drone — cible sans char_sheet, résistance = blindage + intégrité×2 (§7.6). Atteignable
    // uniquement via pendingType 'assault' (le payload melee différé n'inclut jamais cibleType, §2.10.i-bis).
    if (cibleType === 'drone' && characterIdCible) {
      await resolveDamageConfirmDroneTarget(io, pendingCampaignId, ctx, socket)
      return
    }
    // Branche exo — cible sans char_sheet, résistance = BLD/RD dérivés du template (PLAN_EXOARMURE.md
    // §11.4, catégorie A, site 4). Contrairement au drone (§2.10.i-bis ci-dessus), le payload melee
    // différé inclut désormais `cibleType` (catégorie B, resolveMeleeDefenseHitAttackerPj) — atteignable
    // par CaC ET Tir.
    if (cibleType === 'exo' && characterIdCible) {
      await resolveDamageConfirmExoTarget(io, pendingCampaignId, ctx, socket)
      return
    }
    await resolveDamageConfirmNormalTarget(io, pendingCampaignId, ctx, socket)
  } catch (err) {
    console.error('[WS] confirmDamage error:', err.message)
  }
}

// ─── Branches cible de confirmDamage (PLAN_RW_SYSCOMBAT.md §2.10, Lot 8c) ────────────────────────────
// Extraites de confirmDamage — ctx assemblé par la coquille juste après le calcul de dégât (Lot 8a).
// Aucune de ces fonctions n'a son propre try/catch : toute exception remonte au catch unique de
// confirmDamage. Émission directe (pas emissions[]) — même style que confirmMeleeDefense (§2.4.l).

async function resolveDamageConfirmDroneTarget(io, campaignId, ctx, socket) {
  const {
    degautsBruts, characterIdCible, targetTokenId, tokenId,
    tireurColor, tireurUsername, userId, dmgRolls, resolvedFormula, rawDice, dmgSeed,
  } = ctx
  const droneSheet = await db('drone_sheet').where({ character_id: characterIdCible }).first()
  if (!droneSheet) return
  const { etqDrone, rdDrone, degatsNets: degatsNetsDrone } = calcDroneDegatsNets(droneSheet, degautsBruts)
  await resolveDroneIntegrityLoss(io, campaignId, characterIdCible, targetTokenId, droneSheet, degatsNetsDrone)
  if (socket) socket.emit(WS.COMBAT_DAMAGE_RESULT, {
    rollLoc: null, locLabel: null,
    degautsBruts, degatsNets: degatsNetsDrone,
    dmgRolls, severity: null, severityColor: tireurColor, shockResult: null,
  })
  const now = new Date().toISOString()
  io.to(campaignId).emit(WS.DICE_RESULT, {
    userId, username: tireurUsername, color: tireurColor,
    formula: resolvedFormula, rolls: dmgRolls, total: degautsBruts,
    isCriticalSuccess: false, isCriticalFail: false,
    seed: dmgSeed, timestamp: now,
    skillLabel: `Dégâts — drone`,
    mechanicalTotal: rawDice,
    diffLabel: `Blindage:${etqDrone} RD:${rdDrone}`,
    chancesDeReussite: degatsNetsDrone,
    isSuccess: degatsNetsDrone > 0,
  })
  io.to(campaignId).emit(WS.COMBAT_ATTACK_RESULT, {
    tireurId: tokenId, cibleId: targetTokenId,
    localisation: null,
    degautsBruts, degatsNets: degatsNetsDrone,
    severity: null, is_lethal: false, isSuccess: true, shockResult: null,
  })
}

// Cible exo — PLAN_EXOARMURE.md §11.4 (catégorie A, site 4), miroir de resolveDamageConfirmDroneTarget
// ci-dessus. resolveExoDamage gère déjà l'émission EXO_AVARIE_UPDATED (exoAvarieService.js) ; ici,
// même rôle que le bloc DICE_RESULT/COMBAT_ATTACK_RESULT du drone, format propre à l'exo.
async function resolveDamageConfirmExoTarget(io, campaignId, ctx, socket) {
  const {
    degautsBruts, characterIdCible, targetTokenId, tokenId,
    tireurColor, tireurUsername, userId, dmgRolls, resolvedFormula, rawDice, dmgSeed,
  } = ctx
  const exoResult = await exoAvarieService.resolveExoDamage(io, db, campaignId, { characterId: characterIdCible, degautsBruts })
  if (!exoResult) return
  if (socket) socket.emit(WS.COMBAT_DAMAGE_RESULT, {
    rollLoc: null, locLabel: null,
    degautsBruts, degatsNets: exoResult.degatsNets,
    dmgRolls, severity: exoResult.severity, severityColor: tireurColor, shockResult: null,
  })
  const now = new Date().toISOString()
  io.to(campaignId).emit(WS.DICE_RESULT, {
    userId, username: tireurUsername, color: tireurColor,
    formula: resolvedFormula, rolls: dmgRolls, total: degautsBruts,
    isCriticalSuccess: false, isCriticalFail: false,
    seed: dmgSeed, timestamp: now,
    skillLabel: `Dégâts — exo-armure`,
    mechanicalTotal: rawDice,
    diffLabel: `Blindage:${exoResult.bld} RD:${exoResult.rd}`,
    chancesDeReussite: exoResult.degatsNets,
    isSuccess: exoResult.degatsNets > 0,
  })
  io.to(campaignId).emit(WS.COMBAT_ATTACK_RESULT, {
    tireurId: tokenId, cibleId: targetTokenId,
    localisation: null,
    degautsBruts, degatsNets: exoResult.degatsNets,
    severity: exoResult.severity, is_lethal: false, isSuccess: true, shockResult: null,
  })
}

// Cible = PJ/PNJ/décor. `hitResult === null` structurellement inatteignable ici — le dispatch de la
// coquille garantit cibleType !== 'drone' et !== 'exo' (§2.10.i/§11.4, seuls cas où resolveTargetHit
// renvoie null, F4 docs/SYSTEME/SERVICES_COMBAT.md §8) — garde conservée telle quelle, pas retirée.
async function resolveDamageConfirmNormalTarget(io, campaignId, ctx, socket) {
  const {
    degautsBruts, characterIdCible, cibleType, char_sheet_id_cible,
    for_na_cible, con_na_cible, vol_na_cible, effectiveChocDsl, effectiveAmmoFx,
    aimedLocation, treatAsContact, tireurUsername, tireurColor, userId, targetName,
    targetTokenId, tokenId, dmgRolls, resolvedFormula, rawDice, dmgSeed,
  } = ctx
  const hitResult = await damageService.resolveTargetHit(io, db, campaignId, {
    degautsBruts, characterIdCible, cibleType, char_sheet_id_cible,
    for_na_cible, con_na_cible, vol_na_cible,
    chocDsl: effectiveChocDsl,
    ammoFx: effectiveAmmoFx,
    forcedSlotCode: aimedLocation ? LOCATION_TO_SLOT[aimedLocation] : null,
    treatAsContact,
  })
  if (hitResult === null) return
  const { rollLoc, locRolls, locSeed, localisation, etq, rd, degatsNets,
          is_lethal, finalSeverity, shockResult,
          rollChance, chanceRolls, chanceSeed, chanceSuccess, chanceThreshold } = hitResult

  if (shockResult) {
    statusService.emitShockDiceResult(io, campaignId, shockResult, userId, tireurUsername, tireurColor)
  }

  const severityColor = finalSeverity ? (SEVERITY_COLORS[finalSeverity] ?? tireurColor) : tireurColor

  // 6. COMBAT_DAMAGE_RESULT → socket tireur uniquement (affichage fenêtre)
  if (socket) socket.emit(WS.COMBAT_DAMAGE_RESULT, {
    rollLoc,
    locLabel: LOCATION_LABELS[localisation] ?? localisation,
    degautsBruts,
    degatsNets,
    dmgRolls,
    severity: finalSeverity,
    severityColor,
    shockResult,
  })

  // Stun — applyStun après l'émission pour ne pas bloquer l'affichage des dégâts
  if (shockResult?.outcome && shockResult.outcome !== 'ok') {
    statusService.applyStun(io, db, campaignId, {
      targetTokenId, outcome: shockResult.outcome,
      userId, username: tireurUsername, color: tireurColor,
    }).catch(err => console.error('[WS] applyStun error:', err.message))
  }

  // 7. DICE_RESULT broadcast chat
  const now = new Date().toISOString()
  // Localisation visée (COM9) — rollLoc/locRolls/locSeed sont null, pas de carte de jet à
  // afficher (aucun jet n'a eu lieu, jamais un jet gaspillé pour l'affichage).
  if (rollLoc !== null) {
    io.to(campaignId).emit(WS.DICE_RESULT, {
      userId, username: tireurUsername, color: tireurColor,
      formula: '1d20', rolls: locRolls, total: rollLoc,
      isCriticalSuccess: false, isCriticalFail: false,
      seed: locSeed, timestamp: now,
      skillLabel: 'Localisation — Distance',
      mechanicalTotal: rollLoc, diffLabel: '',
      chancesDeReussite: LOCATION_LABELS[localisation] ?? localisation,
      isSuccess: true,
    })
  }
  // Test de Chance du Petit bouclier (docs/PLAN_BOUCLIER.md Lot C) — même patron que rollLoc :
  // null quand non applicable (pas de Petit bouclier en jeu), rien à afficher.
  if (rollChance !== null) {
    io.to(campaignId).emit(WS.DICE_RESULT, {
      userId, username: tireurUsername, color: tireurColor,
      formula: '1d20', rolls: chanceRolls, total: rollChance,
      isCriticalSuccess: false, isCriticalFail: false,
      seed: chanceSeed, timestamp: now,
      skillLabel: `Test de Chance — Bouclier (${LOCATION_LABELS[localisation] ?? localisation})`,
      mechanicalTotal: rollChance, diffLabel: '',
      chancesDeReussite: chanceThreshold,
      isSuccess: chanceSuccess,
    })
  }
  io.to(campaignId).emit(WS.DICE_RESULT, {
    userId, username: tireurUsername, color: tireurColor,
    formula: resolvedFormula, rolls: dmgRolls, total: degautsBruts,
    isCriticalSuccess: false, isCriticalFail: false,
    seed: dmgSeed, timestamp: now,
    skillLabel: `Dégâts — ${LOCATION_LABELS[localisation] ?? localisation}`,
    mechanicalTotal: rawDice,
    diffLabel: `ETQ:${etq ?? 0} RD:${rd}`,
    chancesDeReussite: degatsNets,
    isSuccess: degatsNets > 0,
  })

  // 8. Message narratif combat_damage
  if (finalSeverity) {
    io.to(campaignId).emit(WS.DICE_RESULT, {
      userId, username: tireurUsername, color: severityColor,
      formula: '', rolls: [], total: degatsNets,
      isCriticalSuccess: false, isCriticalFail: false,
      seed: '', timestamp: now,
      interactionType: 'combat_damage',
      skillLabel: `${tireurUsername} inflige ${degatsNets} dégâts`,
      targetName,
      localisation: LOCATION_LABELS[localisation] ?? localisation,
      severity: finalSeverity,
      severityColor,
      isSuccess: true,
    })
  }

  io.to(campaignId).emit(WS.COMBAT_ATTACK_RESULT, {
    tireurId:    tokenId,
    cibleId:     targetTokenId,
    localisation,
    degautsBruts,
    degatsNets,
    severity:    finalSeverity,
    is_lethal,
    isSuccess:   true,
    shockResult: shockResult ?? null,
  })
}

// ─── forceAdvanceResolution — outil MJ générique (docs/PLAN_COMBAT_TIMELINE.md Lot D) ──────────────
// Généralise le bouton « Passer » (COMBAT_SKIP_PLAYER) à n'importe quel sous-état d'attente de la
// Résolution — un seul outil, un seul événement, une seule intention (« forcer la suite de l'étape en
// cours », §6quinquies point 4) ; le comportement exact dépend du sous-état, jamais un nouvel échec ou
// une nouvelle logique de résolution :
//   - AWAITING_DEFENSE/AWAITING_DAMAGE : le serveur lance les dés à la place du joueur injoignable
//     (« il devient PNJ pour le Tour ») — réutilise tel quel confirmMeleeDefense/confirmDamage,
//     même formule, même code, `forced:true` contourne uniquement la vérification de propriétaire.
//   - SLOT_ACTIVE, tour obligatoire d'un token en délai : équivalent à COMBAT_DELAYED_PASS.
//   - SLOT_ACTIVE, entrée normale ou pas simple bloqué : marqué 'skipped'/résolu de force, l'échelle avance.
export async function forceAdvanceResolution(io, campaignId, pendingMaps) {
  const state = await db('combat_state').where({ campaign_id: campaignId }).first()
  if (!state || state.phase !== 'RESOLUTION') return
  const turnNumber = state.current_turn

  if (state.sub_phase === 'AWAITING_DEFENSE') {
    const row = await db('combat_pending').where({ campaign_id: campaignId, type: 'melee_defense' }).first()
    if (!row) { await advanceTimeline(io, campaignId, pendingMaps); return }
    await confirmMeleeDefense(io, campaignId, row.token_id, pendingMaps, null, { forced: true })
    return
  }

  if (state.sub_phase === 'AWAITING_DAMAGE') {
    const row = await db('combat_pending').where({ campaign_id: campaignId, type: 'damage' }).orderBy('created_at', 'asc').first()
    if (!row) { await setFSMSubPhase(db, campaignId, 'SLOT_ACTIVE'); await advanceTimeline(io, campaignId, pendingMaps); return }
    await confirmDamage(io, campaignId, row.token_id, pendingMaps, null, { forced: true })
    return
  }

  if (state.sub_phase !== 'SLOT_ACTIVE') return

  const step = await pickNextTimelineStep(campaignId, turnNumber)
  if (step) {
    if (step.kind === 'entry') {
      await db('combat_timeline_entries').where({ id: step.entry.id }).update({ status: 'skipped', updated_at: db.fn.now() })
      await db('combat_actions').where({ id: step.entry.combat_action_id }).update({ status: 'skipped', updated_at: db.fn.now() })
    } else if (step.kind === 'simple') {
      await db('combat_roster').where({ campaign_id: campaignId, token_id: step.tokenId }).update({ has_resolved: true, updated_at: db.fn.now() })
    }
    await advanceTimeline(io, campaignId, pendingMaps)
    return
  }

  const obligatoryDelayed = await pickNextObligatoryDelayed(campaignId, turnNumber)
  if (obligatoryDelayed) {
    await triggerDelayedPass(io, campaignId, obligatoryDelayed.token_id, pendingMaps)
  }
}

// ─── Helper — fin de tour : reset roster, clôture actions, retour ANNOUNCEMENT ──────
// PC18 : 1 seul UPDATE bulk sur combat_roster.
// docs/PLAN_COMBAT_TIMELINE.md §6bis point 5 — combat_actions n'est plus vidée à chaque Tour (le
// DELETE inconditionnel PC28 est retiré) : l'historique reste en base jusqu'à COMBAT_START d'un
// nouveau combat, la file "en cours" se filtre par turn_number. Toute ligne encore 'pending' à la
// clôture du Tour est marquée 'skipped' explicitement (le joueur n'a pas confirmé son action à temps).
export async function endTurn(io, campaignId, pendingMaps) {
  try {
    // PC18 — reset announced/resolved + états per-tour (cover/vitesse)
    // INI4 (docs/BUGIDENTIFIE.md) — reset initiative=base_ini en fin de tour (REGLESYSCOMBAT p.213) :
    // sans ça, les modificateurs d'Initiative (Précipiter/Dégainer/S'accroupir...) s'accumulaient
    // tour après tour au lieu d'être réinitialisés.
    // state_position retiré de ce reset (docs/PLANS/PLAN_CHARACTER_STATES.md §0.2) : contrairement à
    // state_cover/state_vitesse, changer de position a un coût d'Initiative dédié (REGLESYSCOMBAT.md
    // §"Position du personnage") qui n'a de sens que si la position obtenue persiste — rien dans le
    // texte ne prévoit de reset automatique en fin de tour.
    await db('combat_roster')
      .where({ campaign_id: campaignId, status: 'active' })
      .update({
        has_announced:     false,
        has_resolved:      false,
        state_cover:       'exposed',
        state_vitesse:     'normal',
        state_combat_mode: 'normal',
        initiative:        db.raw('base_ini'),
        is_surprised:      false,
        updated_at:        db.fn.now(),
      })

    // Clôture explicite — seul le Tour en cours peut encore avoir des lignes 'pending' (invariant :
    // les Tours précédents sont déjà intégralement résolus/skippés avant qu'endTurn() soit rappelé).
    await db('combat_actions')
      .where({ campaign_id: campaignId, status: 'pending' })
      .update({ status: 'skipped', updated_at: db.fn.now() })

    // Filet de sécurité — advanceTimeline ne rappelle endTurn() que lorsque plus aucune entrée
    // 'scheduled'/'delayed_waiting' ne subsiste ce Tour ; ce cas ne devrait jamais matcher de ligne,
    // gardé pour ne jamais laisser une entrée orpheline survivre à la clôture du Tour (§6bis point 5).
    await db('combat_timeline_entries')
      .where({ campaign_id: campaignId })
      .whereIn('status', ['scheduled', 'delayed_waiting'])
      .update({ status: 'skipped', updated_at: db.fn.now() })

    // Incrémenter le tour, retour à ANNOUNCEMENT
    const [updatedState] = await db('combat_state')
      .where({ campaign_id: campaignId })
      .update({
        phase: 'ANNOUNCEMENT',
        current_turn: db.raw('current_turn + 1'),
        updated_at: db.fn.now(),
      })
      .returning(['action_timer_sec', 'current_turn'])

    // Purge universelle — statuts expirés ce tour (stunned, unconscious, surprised…)
    const newTurn = updatedState?.current_turn ?? 1
    const rosterTids = await db('combat_roster').where({ campaign_id: campaignId }).pluck('token_id')
    if (rosterTids.length > 0) {
      const expiredRows = await db('token_statuses')
        .whereIn('token_id', rosterTids)
        .whereNotNull('expires_at_turn')
        .where('expires_at_turn', '<=', newTurn)
        .select('token_id', 'status_code')
      if (expiredRows.length > 0) {
        const expiredStunIds = [...new Set(
          expiredRows.filter(r => r.status_code === 'stunned' || r.status_code === 'unconscious').map(r => r.token_id)
        )]
        const allExpiredIds = [...new Set(expiredRows.map(r => r.token_id))]
        await db('token_statuses')
          .whereIn('token_id', rosterTids)
          .whereNotNull('expires_at_turn')
          .where('expires_at_turn', '<=', newTurn)
          .delete()
        for (const token_id of allExpiredIds) {
          await statusService.emitTokenStatusUpdated(io, db, campaignId, token_id)
        }
        for (const token_id of expiredStunIds) {
          io.to(campaignId).emit(WS.COMBAT_STUN_EXPIRED, { tokenId: token_id })
          console.log(`[WS] endTurn — étourdissement expiré. token:${token_id} turn:${newTurn}`)
        }
      }
    }

    const roster = await db('combat_roster')
      .where({ campaign_id: campaignId })
      .orderBy('initiative', 'desc')
    const broadcastRoster = await buildBroadcastRoster(db, roster)

    await setFSMSubPhase(db, campaignId, null)
    io.to(campaignId).emit(WS.COMBAT_PHASE_CHANGED, { phase: 'ANNOUNCEMENT', roster: broadcastRoster })

    // LdB p.212 — émettre le premier slot d'annonce du nouveau tour (base_ini ASC)
    const firstAnnounceSlotNewTurn = await db('combat_roster')
      .where({ campaign_id: campaignId, has_announced: false, status: 'active' })
      .orderBy('base_ini', 'asc').orderBy('token_id', 'asc')
      .first()
    if (firstAnnounceSlotNewTurn) {
      io.to(campaignId).emit(WS.COMBAT_SLOT_ADVANCED, { activeSlotIdx: 0, tokenId: firstAnnounceSlotNewTurn.token_id })
    }

    // Relancer les timers pour le nouveau tour
    const gmMember = await db('campaign_members')
      .where({ campaign_id: campaignId, role: 'gm' })
      .select('user_id')
      .first()
    await startAnnouncementTimers(io, campaignId, updatedState?.action_timer_sec ?? 0, gmMember?.user_id, pendingMaps)

    console.log(`[WS] endTurn — campagne ${campaignId}`)
  } catch (err) {
    console.error('[WS] endTurn error:', err.message)
  }
}

// ─── MULTI-ADVERSAIRES — helpers ─────────────────────────────────────────────
// Malus LdB p.224 : confronté à N adversaires distincts en CaC.
// V1 : PNJ = ennemi du PJ, PJ = ennemi du PNJ. PNJ alliés non distingués.
export function multiAdversaryMalus(n) {
  return n >= 4 ? -10 : n === 3 ? -7 : n === 2 ? -5 : 0
}

// Compte les tokens ennemis actifs (enemyType) dans le roster à portée de tokenPos.
// Portée = 3m + allonge maximale de l'adversaire (arme de contact équipée).
// excludeId : token à exclure (soi-même).
export function countAdversaires(tokenPos, rosterTokens, excludeId, enemyType, metrics) {
  let count = 0
  for (const t of rosterTokens) {
    if (t.char_type !== enemyType || t.token_id === excludeId) continue
    if (t.position_space !== 'world-feet') continue
    const maxAllonge = parseInt(t.max_allonge) || 0
    if (tokenDistanceM(tokenPos, t, metrics) <= 3 + maxAllonge) count++
  }
  return count
}

// ─── DEF5 — Cible sans défense ───────────────────────────────────────────────
// REGLESYSCOMBAT.md:1052-1058 : « Si un personnage ne peut pas voir son assaillant, ou s'il n'a pas
// conscience de l'attaque, il ne peut pas se défendre de manière active. Inutile dans ce cas de
// recourir à un Test d'opposition : l'Attaquant doit réussir un Test simple, avec un bonus de +5. »
// Autorité unique tir + CaC — jamais dupliquée par type d'attaque (même principe que
// countAdversaires/multiAdversaryMalus ci-dessus). Décision Saar (2026-07-19) :
// - Signaux retenus : token_statuses unconscious/blinded/stunned (gaté par status_effects_mode
//   'enforced', même garde que le stun guard COMBAT_ACTION_DECLARE) + combat_roster.is_surprised
//   (Test de Réaction raté à COMBAT_START — existe déjà, sert seulement à l'Initiative aujourd'hui).
//   `is_surprised` est remis à false par endTurn() (SURPRISE1) — la surprise ne dure donc qu'un Tour
//   sans garde supplémentaire ici.
// - WNDMORT (2026-07-19) : une Blessure mortelle interdit aussi tout Test, donc tout jet de défense
//   actif — même effet que sans défense, ajouté ici plutôt que dans un second mécanisme parallèle.
export async function isTargetDefenseless(campaignId, targetTokenId, settings) {
  if (settings.status_effects_mode === 'enforced') {
    const statusRow = await db('token_statuses')
      .where({ token_id: targetTokenId })
      .whereIn('status_code', ['unconscious', 'blinded', 'stunned'])
      .first()
    if (statusRow) return true
  }
  const targetRoster = await db('combat_roster')
    .where({ campaign_id: campaignId, token_id: targetTokenId })
    .select('is_surprised').first()
  if (targetRoster?.is_surprised) return true
  const targetToken = await db('tokens').where({ id: targetTokenId }).select('character_id').first()
  if (targetToken?.character_id) {
    const sheet = await db('char_sheet').where({ character_id: targetToken.character_id }).first()
    if (sheet) {
      const wounds = await db('character_wounds').where({ char_sheet_id: sheet.id })
      if (isTestBlockingWound(wounds)) return true
    }
  }
  return false
}

// ─── RÉSOLUTION CORPS À CORPS ───────────────────────────────────────────────
// Appelée depuis COMBAT_ACTION_CONFIRM (une seule entrée de l'échelle à la fois, Lot B) quand
// action.type==='melee'. Retourne { suspend: true } si le défenseur est un PJ (attend
// COMBAT_MELEE_DEFENSE_CONFIRM) — l'attaque suivante de la même série, s'il y en a une, n'est plus
// résolue ici par récursion (§5 Lot B : « la récursion ad hoc disparaît ») : c'est une entrée séparée
// de combat_timeline_entries, reprise par advanceTimeline() à son tour, potentiellement entrelacée
// avec d'autres personnages entre-temps.
export async function resolveMeleeAction(io, campaignId, action, character, confirmedModifiers = null, pendingMaps) {
  try {
    const emissions = []
    const weaponInvId   = action.weapon_inv_id ?? null
    const targetTokenId = action.target_token_id
    if (!targetTokenId) return { suspend: false, emissions }

    // ── 1. Données attaquant ──────────────────────────────────────────────────
    // Arme + formule dégâts + allonge
    // CHOC1 (prérequis Palier 1, docs/PLAN_CHOC1.md) : damageFormula = null signifie "arme équipée
    // sans dégât physique" (catégorie Choc pur, ex. Dague neurale Brain) — à distinguer de '1D4'
    // (mains nues, aucune arme sélectionnée). Ne jamais tester weapon.ref_damage_h pour savoir si une
    // arme a été trouvée : une arme réelle peut légitimement avoir ref_damage_h vide.
    let weapon = null, damageFormula = '1D4'
    if (weaponInvId) {
      // MELEE-INHAND (docs/BUGIDENTIFIE.md) — getOwnedHandWeapon (inventoryService.js) est l'autorité
      // unique ownership + en-main + catégorie, réutilisée par toute la chaîne combat (Tir et CaC,
      // Déclaration et Résolution). Le garde de Déclaration (socketCombatAnnouncement.js) couvre le
      // cas normal ; ceci revérifie à la Résolution (l'arme a pu être transférée/rangée entre-temps),
      // jamais une confiance aveugle dans une donnée déjà stockée — même philosophie que l'arme
      // secondaire (COM24, plus bas).
      const ownedWeapon = await getOwnedHandWeapon(character.id, weaponInvId, { slotCodes: ['MG', 'MD', '2M'], category: 'Arme de contact' })
      if (ownedWeapon?.inHand && ownedWeapon.categoryOk) {
        weapon = ownedWeapon
        damageFormula = weapon.ref_damage_h ?? null
      }
    }

    // Skill associé à l'arme (via ref_equipment_skill_assoc) ou COMBAT_A_MAINS_NUES (mains nues) —
    // déterminé ici, avant tout accès à la fiche de l'attaquant (déplacé depuis plus bas dans la
    // fonction, PLAN_COMBATANT_CONTEXT.md Lot G) : ni l'arme naturelle ni la distance ci-dessous n'en
    // dépendent, alors que le contexte de Test qui suit en a besoin — un seul calcul, pas un fetch
    // d'identité séparé suivi d'un second calcul complet plus loin.
    let skillId = 'COMBAT_A_MAINS_NUES'
    if (weapon?.equipment_id) {
      const skillAssoc = await db('ref_equipment_skill_assoc').where({ item_id: weapon.equipment_id }).first()
      if (skillAssoc) skillId = skillAssoc.skill_id
    }

    // PLAN_COMBATANT_CONTEXT.md Lot G — point de couture unique pour le contexte de Test de
    // l'attaquant (Seuil, malus, ModDom, sheetId). Remplace l'ancien fetch inline `char_sheet` + garde
    // (bloquait silencieusement tout personnage sans char_sheet propre — notamment un pilote
    // d'exo-armure : l'exo est un personnage séparé du pilote, MANUEL_EXOARMURE.md §3.1, jamais de
    // char_sheet propre ; resolveCombatantTestContext va chercher celle du pilote et l'utilise, avec
    // l'Exo-Force à la place de la Force, §4.1 du manuel). `null` si l'attaquant n'a ni char_sheet
    // (humain) ni pilote résolvable (exo) — repli gracieux identique à l'ancien garde.
    // Plafond de Compétence par Manœuvre d'armure (armure exo) — désormais inconditionnel côté
    // `resolveExoTestContext` pour tout Test, plus un opt-in par appelant (PLAN_EXOARMURE.md §16.2.1,
    // 2026-08-23 : RAW ne distingue pas Tir/CaC) ; sans effet pour un attaquant pj/pnj.
    const ctx = await resolveCombatantTestContext(db, character, skillId)
    if (!ctx) return { suspend: false, emissions }

    // Arme naturelle (mutation) — docs/PLAN_MUTATION2.md Lot 4 sous-lot B. Exclusif avec weaponInvId
    // (radio unique côté client). Revalidation serveur complète : appartenance de la mutation au
    // personnage attaquant + éligibilité (statut `grappled` réel de la cible pour Crocs/Corne).
    const naturalWeaponCharMutationId = action.natural_weapon_char_mutation_id ?? null
    if (naturalWeaponCharMutationId) {
      const naturalWeaponMutation = await db('char_mutations as cm')
        .join('ref_mutations as rm', 'rm.mutation_id', 'cm.mutation_id')
        .where({ 'cm.id': naturalWeaponCharMutationId, 'cm.char_sheet_id': ctx.sheetId, 'cm.status': 'active' })
        .select('rm.natural_weapon_formula', 'rm.natural_weapon_requires_grapple')
        .first()
      if (naturalWeaponMutation?.natural_weapon_formula) {
        const targetGrappledStatus = await db('token_statuses')
          .where({ token_id: targetTokenId, status_code: 'grappled' })
          .first()
        const ineligibilityReasons = getNaturalWeaponIneligibilityReasons({
          mutation: naturalWeaponMutation, targetIsGrappled: !!targetGrappledStatus,
        })
        if (ineligibilityReasons.length) {
          emissions.push({ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
            username: character.name,
            message: `Action impossible car — ${ineligibilityReasons.join(', ')}`,
          } })
          return { suspend: false, emissions }
        }
        damageFormula = naturalWeaponMutation.natural_weapon_formula
      }
    }

    const meleeReachM = resolveMeleeReachM(weapon?.ref_range)

    // Validation distance Phase 2 — positions post-déplacement (PE14)
    const measurement = await measureBattlemapTokenDistance({
      sourceTokenId: action.token_id,
      targetTokenId,
    })
    if (measurement.status !== 'ok') {
      emissions.push({ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
        username: character.name,
        message: 'Corps a corps impossible - position incompatible avec le moteur de monde',
      } })
      return { suspend: false, emissions }
    }
    const myTokenPos = measurement.sourceToken
    const targetTokenPos = measurement.targetToken
    const distanceMChk = measurement.distanceM
    if (distanceMChk > meleeReachM) {
      console.warn(`[WS] resolveMeleeAction — hors portée: ${distanceMChk.toFixed(1)}m max:${meleeReachM}m token:${action.token_id}`)
      emissions.push({ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
        username: character.name,
        message: `Corps à corps impossible — distance : ${distanceMChk.toFixed(1)}m, portée max : ${meleeReachM}m`,
      } })
      return { suspend: false, emissions }
    }

    const [woundsAttaquant, rosterTokens, settings, targetShield] = await Promise.all([
      db('character_wounds').where({ char_sheet_id: ctx.sheetId }),
      // Tous les tokens actifs du roster avec leur type et leur allonge max (arme de contact équipée).
      // Utilisé pour le calcul multi-adversaires (positions post-déplacement garanties).
      db('tokens as t')
        .join('combat_roster as cr', 'cr.token_id', 't.id')
        .join('characters as c', 'c.id', 't.character_id')
        .leftJoin('char_inventory_slots as cis',
          db.raw(`cis.character_id = c.id AND cis.slot_code IN ('MG', 'MD', '2M')`))
        .leftJoin('char_inventory as ci', 'ci.id', 'cis.char_inventory_id')
        .leftJoin('ref_equipment as re',
          db.raw(`re.id = ci.equipment_id AND re.category = 'Arme de contact'`))
        .where('cr.campaign_id', campaignId)
        .where('cr.status', 'active')
        .groupBy('t.id', 't.pos_x', 't.pos_y', 't.pos_z', 't.position_space', 'c.type')
        .select(
          't.id as token_id',
          't.pos_x',
          't.pos_y',
          't.pos_z',
          't.position_space',
          'c.type as char_type',
          db.raw(`COALESCE(MAX(CASE WHEN re.range ~ '^[0-9]+$' THEN re.range::INTEGER ELSE 0 END), 0) as max_allonge`)
        ),
      getCampaignSettings(db, campaignId),
      // Bouclier de la CIBLE (docs/PLAN_BOUCLIER.md Lot B) — malus au Test d'attaque de l'attaquant,
      // dérivé automatiquement de l'équipement de la cible, jamais un choix MJ (§3.3). Doit être connu
      // AVANT le jet d'attaque (chancesAttaque ci-dessous) — remonté ici, pas avec les données cible
      // (§2) qui n'arrivent qu'après le jet.
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
    // DEF5 — doit être connu AVANT le jet d'attaque, même raison que shieldAtkMalus ci-dessus.
    const targetDefenseless = await isTargetDefenseless(campaignId, targetTokenId, settings)
    const sansDefenseBonus = targetDefenseless ? 5 : 0

    // WNDMORT — défense en profondeur : le garde principal est à la Déclaration
    // (socketCombatAnnouncement.js), ceci couvre seulement le cas rare où l'attaquant devient
    // mortellement blessé entre sa Déclaration et sa Résolution (même Tour, un adversaire plus
    // rapide résout avant lui). Pas de message dédié — le cas ne devrait normalement jamais survenir.
    if (isTestBlockingWound(woundsAttaquant)) {
      emissions.push({ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
        username: character.name, message: 'Blessure mortelle — aucune action de Test possible',
      } })
      return { suspend: false, emissions }
    }
    const attackerSkillTotal = ctx.skillTotal
    const effectiveMalusAttaquant = ctx.effectiveMalus
    const modDom = ctx.modDom

    const rosterAttaquant = await db('combat_roster').where({ campaign_id: campaignId, token_id: action.token_id }).first()
    if (rosterAttaquant?.state_combat_mode === 'charge' && distanceMChk <= 3) {
      emissions.push({ to: 'socket', event: WS.COMBAT_DECLARE_ERROR, data: { message: 'Charge impossible — distance ≤ 3m (élan insuffisant)' } })
      return { suspend: false, emissions }
    }
    const isRushedMod    = rosterAttaquant?.state_vitesse === 'rushed' ? -5 : 0
    const combatModeAtk  = rosterAttaquant?.state_combat_mode ?? 'normal'
    const attackModeBonus = (combatModeAtk === 'offensif' || combatModeAtk === 'charge') ? 3 : 0
    const combatModeBonus = combatModeAtk === 'charge' ? 3 : 0   // +3 dégâts Charge

    // Multi-adversaires : malus si l'attaquant est lui-même entouré d'ennemis
    const atkEnemyType = character.type === 'pj' ? 'pnj' : 'pj'
    const multiMalusAttaquant = multiAdversaryMalus(
      countAdversaires(myTokenPos, rosterTokens, action.token_id, atkEnemyType, measurement.metrics)
    )

    // CaC 4b — malus attaque multiple (LdB p.218), fonction partagée avec le Tir Multi (voir
    // computeMultiAttackMalus, docs/PLAN_TIRMULTI.md).
    const { malus: multiAttackMalus } = await computeMultiAttackMalus(action.id)

    // Combat à deux armes (COM24, docs/BUGIDENTIFIE.md) — revalidé à la résolution, jamais une
    // confiance aveugle dans `action.offhand_weapon_inv_id` stocké à la Déclaration (même principe
    // que le reste de cette fonction : l'arme principale, l'allonge, etc. sont toutes refetchées ici).
    // RAW (`REGLESYSCOMBAT.md:1044-1051`) : bonus lié au fait de combattre réellement avec les deux
    // armes pour cette attaque, jamais au seul fait d'en avoir deux équipées (COM24) — contrairement à
    // l'ancien scan d'inventaire, ne s'applique plus en mains nues/arme naturelle avec 2 armes rangées.
    let deuxArmesBonus = 0
    if (action.offhand_weapon_inv_id && action.offhand_weapon_inv_id !== weaponInvId) {
      const offhandWeapon = await getOwnedHandWeapon(character.id, action.offhand_weapon_inv_id, { slotCodes: ['MG', 'MD'], category: 'Arme de contact' })
      if (offhandWeapon?.inHand && offhandWeapon.categoryOk) {
        deuxArmesBonus = 3
      }
    }
    // Mods situation CaC (§6.2)
    const footingRequiresBalance = measurement.sourceEffectRegions.some(region => (
      region.hooks.some(hook => (
        hook.event === 'traverse' && hook.type === 'test' && hook.testKey === 'balance'
      ))
    ))
    const terrainInstable = footingRequiresBalance
      || (confirmedModifiers?.situation ?? []).includes('cac_terrain_instable')
    const situationMods = (confirmedModifiers?.situation ?? []).filter(k => k !== 'cac_terrain_instable')
    const situationModComp = situationMods.reduce((sum, k) => sum + (CAC_SITUATION_MODS[k]?.mod ?? 0), 0)
    const tailleMod = TAILLE_MODS[confirmedModifiers?.taille ?? 'moyenne']?.mod ?? 0
    let terrainInstableMod = 0, acrobatieTotal = attackerSkillTotal
    if (terrainInstable) {
      // Repli sur attackerSkillTotal préservé tel quel si ACROBATIE_EQUILIBRE est absente du
      // catalogue (ne devrait jamais survenir en pratique — garde défensive héritée de l'ancien code).
      const acrobatieRefSkill = await db('ref_skills').where({ id: 'ACROBATIE_EQUILIBRE' }).first()
      if (acrobatieRefSkill) {
        const ctxAcrobatie = await resolveCombatantTestContext(db, character, 'ACROBATIE_EQUILIBRE')
        acrobatieTotal = ctxAcrobatie?.skillTotal ?? attackerSkillTotal
      }
      terrainInstableMod = Math.min(0, acrobatieTotal - attackerSkillTotal)
    }

    // Roll attaquant — le jet reste en coquille, le noyau (combatAttackRoll.js) est pur et le
    // consomme en paramètre (PLAN_RW_SYSCOMBAT.md §2.1.c).
    const { total: rollAttaque, rolls: attackRolls, seed: attackSeed } = await parseDice('1d20')

    // Info affichage
    const userRow = character.user_id
      ? await db('users').where({ id: character.user_id }).select('color', 'username').first()
      : null
    const attackerColor    = userRow?.color    ?? '#c86030'
    const attackerUsername = userRow?.username ?? character.name ?? 'Inconnu'

    // Seuil + breakdown — noyau pur (PLAN_RW_SYSCOMBAT.md Lot 1, clos après session de jeu shadow
    // sans écart). La coquille assemble la liste ordonnée des contributions (l'ordre de la liste EST
    // l'ordre d'affichage client) ; le noyau somme, filtre les zéros et assemble le breakdown.
    // Ajouter un modificateur CaC = ajouter une entrée ici, jamais toucher au noyau.
    const attaqueOutcome0 = computeAttackRoll({
      skillLabel: 'Compétence', skillTotal: attackerSkillTotal, totalLabel: 'Seuil', rollAttaque,
      contributions: [
        { label: COMBAT_MODE_LABELS[combatModeAtk] ?? combatModeAtk, value: attackModeBonus, type: 'bonus' },
        { label: 'Précipitation', value: isRushedMod, type: 'malus' },
        { label: 'Multi-adversaires (attaquant)', value: multiMalusAttaquant, type: 'malus' },
        { label: 'Attaque multiple', value: multiAttackMalus, type: 'malus' },
        { label: 'Malus santé / encombrement', value: effectiveMalusAttaquant, type: 'malus' },
        { label: 'Mods situation', value: situationModComp, type: situationModComp > 0 ? 'bonus' : 'malus' },
        { label: 'Taille cible', value: tailleMod, type: tailleMod > 0 ? 'bonus' : 'malus' },
        { label: `Terrain instable (Acrobatie/Équilibre: ${acrobatieTotal})`, value: terrainInstableMod, type: 'malus' },
        { label: 'Deux armes au contact', value: deuxArmesBonus, type: 'bonus' },
        { label: 'Bouclier adverse', value: shieldAtkMalus, type: 'malus' },
        { label: 'Cible sans défense', value: sansDefenseBonus, type: 'bonus' },
      ],
    })
    const { seuil: chancesAttaque, breakdown: breakdownAtk } = attaqueOutcome0
    // Réussite critique (p.204, docs/PLAN_TEST_CRITIQUE.md Lot 2) : bonus = niveau de maîtrise de la
    // Compétence utilisée pour l'attaque (ctx.mastery, ci-dessus) — appliqué AVANT le reroll d'Échec
    // critique (mutuellement exclusifs, l'ordre entre les deux est sans effet). mrAttaque (post-bonus)
    // est ensuite threadé via commonPending pour que resolveDefenselessTarget/resolveMeleeDefensePnj/
    // resolveMeleeDefenseDrone/confirmMeleeDefense l'utilisent tel quel au lieu de recalculer un
    // resolveTestOutcome(rollAttaque, chancesAttaque) nu qui perdrait ce bonus (le bonus conditionne
    // aussi bien la comparaison mrAttaque>mrDefense que le ModDom des dégâts).
    const attaqueOutcomeCrit = applyCriticalSuccessBonus(attaqueOutcome0, getCriticalSuccessBonus({ masteryLevel: ctx.mastery }))
    const attaqueOutcome = await resolveCriticalFailReroll(attaqueOutcomeCrit)
    console.log(`[WS] melee attaque — roll:${rollAttaque} Seuil:${chancesAttaque} token:${action.token_id}`)
    console.log(`[DBG] melee seuil — skill:${attackerSkillTotal} eff:${effectiveMalusAttaquant} mode:${attackModeBonus} rush:${isRushedMod} multi:${multiMalusAttaquant} multiAtk:${multiAttackMalus} sit:${situationModComp} taille:${tailleMod} terrain:${terrainInstableMod} deuxArmes:${deuxArmesBonus} bouclier:${shieldAtkMalus} sansDefense:${sansDefenseBonus} → seuil:${chancesAttaque}`)
    emissions.push({ to: 'room', event: WS.DICE_RESULT, data: {
      userId: character.user_id, username: attackerUsername, color: attackerColor,
      formula: '1d20', rolls: attackRolls, total: rollAttaque,
      isCriticalSuccess: attaqueOutcome.isCriticalSuccess, isCriticalFail: attaqueOutcome.isCriticalFail,
      catastropheRisk:   attaqueOutcome.catastropheRisk,
      seed: attackSeed, timestamp: new Date().toISOString(),
      skillLabel:        'Jet pour toucher (contact)',
      mechanicalTotal:   attackerSkillTotal,
      diffLabel:         chancesAttaque - attackerSkillTotal >= 0 ? `+${chancesAttaque - attackerSkillTotal}` : `${chancesAttaque - attackerSkillTotal}`,
      chancesDeReussite: chancesAttaque,
      isSuccess:         attaqueOutcome.isSuccess,
      mr:                attaqueOutcome.mr,
      breakdown:         breakdownAtk,
    } })
    // Catastrophe automatique (docs/PLANS/PLAN_CATASTROPHE_RISK.md Lot 1).
    await maybeTriggerCatastrophe(io, campaignId, action.token_id, attaqueOutcome.catastropheRisk, {
      site: 'melee_attack', actorTokenId: action.token_id, targetTokenId,
    })

    // ── 2. Cible ──────────────────────────────────────────────────────────────
    const targetToken = await db('tokens').where({ id: targetTokenId }).first()
    if (!targetToken?.character_id) {
      // Entité de décor — pas de défense ni dégâts
      emissions.push({ to: 'room', event: WS.COMBAT_MELEE_RESULT, data: {
        attaquantId: action.token_id, defenseurId: targetTokenId,
        rollAttaque, chancesAttaque, rollDefense: null, chanceDefense: null, hit: false,
      } })
      return { suspend: false, emissions }
    }

    const defenderCharacter = await db('characters').where({ id: targetToken.character_id }).first()
    if (!defenderCharacter) return { suspend: false, emissions }

    const targetName = defenderCharacter.name ?? targetToken.label ?? 'Cible'

    // Multi-adversaires : malus si le défenseur est entouré d'ennemis (positions post-déplacement)
    const defEnemyType = defenderCharacter.type === 'pj' ? 'pnj' : 'pj'
    const multiMalusDefenseur = multiAdversaryMalus(
      countAdversaires(targetTokenPos, rosterTokens, targetTokenId, defEnemyType, measurement.metrics)
    )

    // ── 3. Données défenseur ──────────────────────────────────────────────────
    // Identité de l'acteur EFFECTIF derrière ce défenseur (pas encore le contexte de Test complet) :
    // pour un humain c'est le personnage lui-même, pour un exo-armure c'est son pilote — la main
    // directrice, le choix de l'arme équipée ET le routage de la confirmation de défense (branchement
    // plus bas, PLAN_EXOARMURE.md Lot 2 §7.7) doivent tous les trois suivre le pilote, jamais la fiche
    // exo brute. Connue AVANT de savoir quelle Compétence tester (choix de l'arme équipée), donc avant
    // de pouvoir appeler resolveCombatantTestContext avec un skillId réel — même coût qu'avant ce
    // chantier pour un défenseur humain (1 requête), résout aussi le pilote pour un défenseur exo (une
    // seule fois, PLAN_COMBATANT_CONTEXT.md Lot G, combatantContextService.js).
    const { sheetId: sheetIdCible, userId: defenderEffectiveUserId, effectiveType: defenderEffectiveType } =
      await resolveCombatantIdentity(db, defenderCharacter)
    let defenderSkillTotal = 0, defenderEffectiveMalus = 0, defenderMastery = 0
    let for_na_cible = 8, con_na_cible = 8, vol_na_cible = 8
    let char_sheet_id_cible = null

    if (sheetIdCible) {
      // Détermination de l'arme/compétence du défenseur (priorité main directrice) — reste local,
      // hors contrat de resolveCombatantTestContext, même principe que la résolution skillId côté
      // attaquant (Lot B).
      const [identityCible, defContactWeapons] = await Promise.all([
        db('char_identity').where({ char_sheet_id: sheetIdCible }).first(),
        // Lot B (docs/PLAN_INVENTORY_SLOTS.md) : lit char_inventory_slots au lieu d'une égalité
        // stricte sur char_inventory.slot — composite-safe.
        db('char_inventory_slots as cis')
          .join('char_inventory', 'char_inventory.id', 'cis.char_inventory_id')
          .join('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
          .where({ 'char_inventory.character_id': defenderCharacter.id })
          .whereIn('cis.slot_code', ['MD', 'MG', '2M'])
          .where('ref_equipment.category', 'Arme de contact')
          .select('cis.slot_code as slot', 'char_inventory.equipment_id'),
      ])

      // B1 — compétence défenseur selon arme équipée (priorité main directrice)
      const slotPriority = (identityCible?.hand_pref ?? 'R') === 'L' ? ['MG', 'MD', '2M'] : ['MD', 'MG', '2M']
      const defWeapon = slotPriority.map(s => defContactWeapons.find(w => w.slot === s)).find(w => w != null) ?? null
      let defSkillId = 'COMBAT_A_MAINS_NUES'
      if (defWeapon?.equipment_id) {
        const assoc = await db('ref_equipment_skill_assoc').where({ item_id: defWeapon.equipment_id }).first()
        if (assoc) defSkillId = assoc.skill_id
      }

      // PLAN_COMBATANT_CONTEXT.md Lot C/G — point de couture unique pour le contexte de Test du
      // défenseur (Seuil, malus, mastery), y compris la branche exo (pilote + EXF).
      // Plafond Manœuvre d'armure désormais inconditionnel côté resolveExoTestContext (§16.2.1),
      // même raison que le site attaquant ci-dessus.
      const ctxCible = await resolveCombatantTestContext(db, defenderCharacter, defSkillId)
      if (ctxCible) {
        defenderSkillTotal = ctxCible.skillTotal
        defenderEffectiveMalus = ctxCible.effectiveMalus
        defenderMastery = ctxCible.mastery
        // for_na_cible/con_na_cible/vol_na_cible/char_sheet_id_cible n'alimentent PAS le Test de
        // défense ci-dessus (déjà réglé) mais le pipeline de dégâts SI l'attaque touche
        // (resolveTargetHit plus loin : RD, armure, écriture de Blessure). Jamais dérivés du pilote
        // pour un défenseur exo : l'armure a son propre pipeline de dégâts (Intégrité/Avaries/RD fixe
        // par catégorie, PLAN_EXOARMURE.md §11, Lot 4 ✅ codé 2026-08-19). Ce pipeline dédié
        // (exoAvarieService.resolveExoDamage) résout tout depuis `characterIdCible` seul
        // (resolveExoContext) — il n'a jamais besoin de char_sheet_id_cible/for_na_cible/etc, qui
        // resteraient de toute façon ceux du PILOTE si on les laissait passer (appliquer la formule de
        // RD humaine avec l'EXF du pilote produirait un nombre faux, et char_sheet_id_cible=sheet du
        // pilote ferait écrire une Blessure humaine sur le pilote en contournant l'armure). Le repli
        // neutre (8/8/8/null) reste donc volontairement en place pour un défenseur exo — pas une dette
        // du Lot 4, une garde délibérée (`resolveTargetHit` retourne aussi `null` pour `cibleType ===
        // 'exo'`, damageService.js:310, filet de sécurité si un site venait à les lire quand même).
        if (defenderCharacter.type !== 'exo') {
          for_na_cible = ctxCible.for_na
          con_na_cible = ctxCible.con_na
          vol_na_cible = ctxCible.vol_na
          char_sheet_id_cible = ctxCible.sheetId
        }
      }
    }

    // Lot 2 (PLAN_RW_SYSCOMBAT.md §2.4.b) : commonPending sert désormais de contexte partagé aux 4
    // fonctions de branchement défenseur, pas seulement au payload persisté pour le défenseur PJ —
    // targetTokenId/attackerSheetId/naturalWeaponCharMutationId/defenderCharacterName ajoutés pour cet
    // usage (clés en plus, ignorées sans risque par confirmMeleeDefense qui ne lit que ce qu'elle
    // connaît par nom, §2.4.b).
    const commonPending = {
      campaignId,
      attackerTokenId: action.token_id,
      attackerCharacter: character,
      attackerUsername,
      attackerColor,
      rollAttaque,
      chancesAttaque,
      // mrAttaque : Marge de réussite déjà résolue (bonus Réussite critique + reroll Échec critique
      // inclus, cf. commentaire au-dessus de attaqueOutcomeCrit) — les branches défenseur/dégâts
      // l'utilisent tel quel, ne le recalculent jamais.
      mrAttaque: attaqueOutcome.mr,
      defenderSkillTotal,
      defenderEffectiveMalus,
      defenderMastery,
      multiMalusAttaquant,
      multiMalusDefenseur,
      damageFormula,
      weaponInvId,
      modDom,
      combatModeBonus,
      characterIdCible: defenderCharacter.id,
      cibleType: defenderCharacter.type,
      char_sheet_id_cible,
      for_na_cible,
      con_na_cible,
      vol_na_cible,
      targetName,
      userId: character.user_id,
      defenderUserId: defenderEffectiveUserId,
      confirmedModifiers,
      situationDef: confirmedModifiers?.situationDef ?? [],
      targetTokenId,
      attackerSheetId: ctx.sheetId,
      naturalWeaponCharMutationId,
      defenderCharacterName: defenderCharacter.name,
      // Distinct de attackerUsername (compte ayant lancé le dé, DICE_RESULT) — identité narrative du
      // personnage attaquant, consommée par resolveMeleeDefensePj pour le prompt de défense (MELEE-ATKNAME).
      attackerCharacterName: character.name ?? 'Inconnu',
    }

    // ── Branchement défenseur (PLAN_RW_SYSCOMBAT.md §2.4, Lot 2) ───────────────
    // Ordre invariant (§2.4.i) : sans-défense d'abord, quel que soit le type de défenseur — sinon un
    // PNJ/PJ étourdi relancerait un jet de défense actif, contraire au RAW (REGLESYSCOMBAT.md:1055-1057).
    // `defenderEffectiveType` (pas `defenderCharacter.type`) pour la branche pnj/pj — PLAN_EXOARMURE.md
    // Lot 2 §7.7 : un exo piloté par un PNJ doit s'auto-résoudre comme n'importe quel PNJ (le pilote ne
    // "clique" jamais un bouton de confirmation), un exo piloté par un PJ doit prompter CE pilote,
    // jamais le type brut de la fiche exo (toujours 'exo', jamais une branche exploitable ici). Les
    // drones restent sur leur propre type : jamais pilotés, aucune indirection à appliquer
    // (PLAN_COMBATANT_CONTEXT.md §3.5).
    if (targetDefenseless) {
      return await resolveDefenselessTarget(io, campaignId, commonPending, emissions)
    }
    if (defenderEffectiveType === 'pnj') {
      return await resolveMeleeDefensePnj(io, campaignId, commonPending, emissions)
    }
    if (defenderCharacter.type === 'drone') {
      return await resolveMeleeDefenseDrone(io, campaignId, commonPending, emissions)
    }
    return await resolveMeleeDefensePj(io, campaignId, commonPending, emissions)
  } catch (err) {
    console.error('[WS] resolveMeleeAction error:', err.message)
    return { suspend: false, emissions: [] }
  }
}

// ── Branches défenseur de resolveMeleeAction (PLAN_RW_SYSCOMBAT.md §2.4, Lot 2) ──────────────────
// Extraites de resolveMeleeAction — ctx = commonPending (contexte déjà assemblé par la coquille, §2.4.b).
// Aucune de ces fonctions n'a son propre try/catch (§2.4.k) : toute exception remonte au catch unique
// de resolveMeleeAction, qui vide alors `emissions` — comportement existant à préserver à l'identique.

// DEF5 — Cible sans défense : Test simple +5, aucune opposition. Généralise le pattern déjà utilisé
// pour le défenseur drone (§7.4, pas de jet de défense) à n'importe quel type de défenseur dès que la
// cible est sans défense — sinon un PNJ/PJ inconscient/étourdi relancerait quand même un jet de défense
// actif, contraire au RAW (REGLESYSCOMBAT.md:1055-1057). Auto-résolution complète, dégâts compris —
// décision Saar (2026-07-19), même principe qu'un défenseur non-actif.
export async function resolveDefenselessTarget(io, campaignId, ctx, emissions) {
  const {
    attackerTokenId, targetTokenId, chancesAttaque, rollAttaque, multiMalusAttaquant, mrAttaque,
    weaponInvId, naturalWeaponCharMutationId, attackerSheetId, damageFormula, modDom, combatModeBonus,
    characterIdCible, cibleType, char_sheet_id_cible, for_na_cible, con_na_cible, vol_na_cible,
    attackerUsername, attackerColor, userId,
  } = ctx
  const hit = rollAttaque <= chancesAttaque
  emissions.push({ to: 'room', event: WS.COMBAT_MELEE_RESULT, data: {
    attaquantId: attackerTokenId, defenseurId: targetTokenId,
    rollAttaque, chancesAttaque, rollDefense: null, chanceDefense: null, hit,
    multiMalusAttaquant,
  } })
  if (hit) {
    // CHOC1 : point de résolution unique, plus de parseDice direct sur damageFormula (voir
    // getEffectiveMeleeDamage, docs/JOURNALTEMP.md Étape 6).
    const { total: rawDice, choc: effectiveChocDsl } = await damageService.getEffectiveMeleeDamage(db, {
      weaponInvId, naturalWeaponCharMutationId, charSheetId: attackerSheetId, fallbackFormula: damageFormula,
    })
    // mrAttaque déjà résolu (bonus Réussite critique inclus) par resolveMeleeAction — jamais recalculé ici.
    const degautsBruts = computeMeleeRawDamage({ rawDice, mr: mrAttaque, modDom, combatModeBonus })
    if (cibleType === 'drone') {
      const droneSheet = await db('drone_sheet').where({ character_id: characterIdCible }).first()
      if (droneSheet) {
        const { etqDrone, rdDrone, degatsNets: degatsNetsDrone } = calcDroneDegatsNets(droneSheet, degautsBruts)
        await resolveDroneIntegrityLoss(io, campaignId, characterIdCible, targetTokenId, droneSheet, degatsNetsDrone)
        emissions.push({ to: 'room', event: WS.COMBAT_ATTACK_RESULT, data: {
          tireurId: attackerTokenId, cibleId: targetTokenId,
          localisation: null, degautsBruts, degatsNets: degatsNetsDrone,
          severity: null, is_lethal: false, isSuccess: true, isPnj: true,
          roll: rollAttaque, chancesDeReussite: chancesAttaque, shockResult: null,
        } })
      }
    } else if (cibleType === 'exo') {
      // PLAN_EXOARMURE.md §11.4 (catégorie A, site 2) — miroir de la branche drone ci-dessus.
      const exoResult = await exoAvarieService.resolveExoDamage(io, db, campaignId, { characterId: characterIdCible, degautsBruts })
      if (exoResult) {
        emissions.push({ to: 'room', event: WS.COMBAT_ATTACK_RESULT, data: {
          tireurId: attackerTokenId, cibleId: targetTokenId,
          localisation: null, degautsBruts, degatsNets: exoResult.degatsNets,
          severity: exoResult.severity, is_lethal: false, isSuccess: true, isPnj: true,
          roll: rollAttaque, chancesDeReussite: chancesAttaque, shockResult: null,
        } })
      }
    } else {
      const hitResult = await damageService.resolveTargetHit(io, db, campaignId, {
        degautsBruts,
        characterIdCible,
        cibleType,
        char_sheet_id_cible,
        for_na_cible, con_na_cible, vol_na_cible,
        chocDsl: effectiveChocDsl,
        treatAsContact: true,
      })
      if (hitResult) {
        const { localisation, degatsNets, is_lethal, finalSeverity, shockResult } = hitResult
        if (shockResult) {
          statusService.emitShockDiceResult(io, campaignId, shockResult, userId, attackerUsername, attackerColor)
        }
        emissions.push({ to: 'room', event: WS.COMBAT_ATTACK_RESULT, data: {
          tireurId:    attackerTokenId, cibleId: targetTokenId,
          localisation, degautsBruts, degatsNets,
          severity: finalSeverity, is_lethal, isSuccess: true, isPnj: true,
          roll: rollAttaque, chancesDeReussite: chancesAttaque, shockResult,
        } })
        if (shockResult?.outcome && shockResult.outcome !== 'ok') {
          statusService.applyStun(io, db, campaignId, {
            targetTokenId, outcome: shockResult.outcome,
            userId, username: attackerUsername, color: attackerColor,
          }).catch(err => console.error('[WS] applyStun error:', err.message))
        }
      }
    }
  }
  return { suspend: false, emissions }
}

// Défenseur PNJ : auto-résolution avec jet de défense opposé réel. Breakdown construit via
// computeAttackRoll (RV6, §2.4.d) au lieu d'un tableau assemblé à la main.
export async function resolveMeleeDefensePnj(io, campaignId, ctx, emissions) {
  const {
    attackerTokenId, targetTokenId, chancesAttaque, rollAttaque, multiMalusAttaquant, mrAttaque,
    weaponInvId, naturalWeaponCharMutationId, attackerSheetId, damageFormula, modDom, combatModeBonus,
    characterIdCible, cibleType, char_sheet_id_cible, for_na_cible, con_na_cible, vol_na_cible,
    attackerUsername, attackerColor, userId,
    defenderSkillTotal, defenderEffectiveMalus, defenderMastery, multiMalusDefenseur, confirmedModifiers,
    defenderCharacterName,
  } = ctx
  const { total: rollDefense, rolls: defRolls, seed: defSeed } = await parseDice('1d20')
  // Mode combat du défenseur — Offensif/Charge → pénalité défense
  const rosterDef = await db('combat_roster').where({ campaign_id: campaignId, token_id: targetTokenId }).first()
  const defCombatMode = rosterDef?.state_combat_mode ?? 'normal'
  const modeCombatDef = defCombatMode === 'offensif' ? -5 : defCombatMode === 'charge' ? -7 : defCombatMode === 'defensif' ? 3 : defCombatMode === 'retraite' ? 5 : 0
  // Terrain instable défenseur PNJ — compétence limitative ACROBATIE_EQUILIBRE
  // PLAN_COMBATANT_CONTEXT.md Lot C — objet minimal { id, campaign_id } reconstruit : cette fonction
  // ne reçoit que characterIdCible/char_sheet_id_cible via ctx, jamais la ligne characters complète.
  // Sans `.type`, donc toujours traité comme humanoïde par resolveCombatantTestContext — sans
  // conséquence : ce bloc est gardé par `char_sheet_id_cible` (Lot G, toujours null pour un défenseur
  // exo — voir resolveMeleeAction §3, pipeline de dégâts), jamais atteint pour un exo.
  let terrainInstableModDef = 0, acrobatieDefTotal = defenderSkillTotal
  if ((confirmedModifiers?.situationDef ?? []).includes('cac_terrain_instable') && char_sheet_id_cible) {
    // Repli sur defenderSkillTotal préservé tel quel si ACROBATIE_EQUILIBRE est absente du catalogue
    // (garde défensive héritée de l'ancien code, même patron que resolveMeleeAction Lot B).
    const acrobatieRefDef = await db('ref_skills').where({ id: 'ACROBATIE_EQUILIBRE' }).first()
    if (acrobatieRefDef) {
      const ctxAcrobatieDef = await resolveCombatantTestContext(db, { id: characterIdCible, campaign_id: campaignId }, 'ACROBATIE_EQUILIBRE')
      acrobatieDefTotal = ctxAcrobatieDef?.skillTotal ?? defenderSkillTotal
    }
    terrainInstableModDef = Math.min(0, acrobatieDefTotal - defenderSkillTotal)
  }

  // Seuil de défense + breakdown — noyau pur du Lot 1 réutilisé ici (Lot 2, RV6, §2.4.d) : un jet de
  // D20, peu importe qu'il s'agisse d'une attaque ou d'une défense.
  const defenseOutcome0 = computeAttackRoll({
    skillLabel: 'Compétence', skillTotal: defenderSkillTotal, totalLabel: 'Seuil', rollAttaque: rollDefense,
    contributions: [
      { label: COMBAT_MODE_LABELS[defCombatMode] ?? defCombatMode, value: modeCombatDef, type: modeCombatDef > 0 ? 'bonus' : 'malus' },
      { label: 'Multi-adversaires', value: multiMalusDefenseur, type: 'malus' },
      { label: 'Malus santé / encombrement', value: defenderEffectiveMalus, type: 'malus' },
      { label: `Terrain instable (Acrobatie/Équilibre: ${acrobatieDefTotal})`, value: terrainInstableModDef, type: 'malus' },
    ],
  })
  // Réussite critique défenseur (p.204, Lot 2) — même geste que l'attaquant (resolveMeleeAction),
  // appliqué avant le reroll d'Échec critique.
  const defenseOutcomeCrit = applyCriticalSuccessBonus(defenseOutcome0, getCriticalSuccessBonus({ masteryLevel: defenderMastery }))
  const { seuil: chanceDefense, breakdown: breakdownDef, isSuccess: defenseSuccess, mr: mrDefense } = defenseOutcomeCrit
  const defenseOutcome = await resolveCriticalFailReroll(defenseOutcomeCrit)
  // mrAttaque déjà résolu (bonus Réussite critique inclus) par resolveMeleeAction — jamais recalculé ici.
  const attackSuccess = rollAttaque <= chancesAttaque
  const hit = attackSuccess && (!defenseSuccess || mrAttaque > mrDefense)

  console.log(`[WS] melee défense PNJ — rollDef:${rollDefense}/${chanceDefense} → ${hit ? 'TOUCHÉ' : 'ESQUIVÉ/RATÉ'}`)

  emissions.push({ to: 'room', event: WS.DICE_RESULT, data: {
    userId: null, username: defenderCharacterName ?? 'PNJ', color: '#808080',
    formula: '1d20', rolls: defRolls, total: rollDefense,
    isCriticalSuccess: defenseOutcome.isCriticalSuccess, isCriticalFail: defenseOutcome.isCriticalFail,
    catastropheRisk:   defenseOutcome.catastropheRisk,
    seed: defSeed, timestamp: new Date().toISOString(),
    skillLabel:        'Jet pour défendre (contact)',
    mechanicalTotal:   defenderSkillTotal,
    diffLabel:         chanceDefense - defenderSkillTotal >= 0 ? `+${chanceDefense - defenderSkillTotal}` : `${chanceDefense - defenderSkillTotal}`,
    chancesDeReussite: chanceDefense,
    isSuccess:         defenseSuccess,
    mr:                mrDefense,
    breakdown:         breakdownDef,
  } })
  // Catastrophe automatique (docs/PLANS/PLAN_CATASTROPHE_RISK.md Lot 1).
  await maybeTriggerCatastrophe(io, campaignId, targetTokenId, defenseOutcome.catastropheRisk, {
    site: 'melee_defense_pnj', actorTokenId: targetTokenId, targetTokenId: attackerTokenId,
  })

  emissions.push({ to: 'room', event: WS.COMBAT_MELEE_RESULT, data: {
    attaquantId: attackerTokenId, defenseurId: targetTokenId,
    rollAttaque, chancesAttaque, rollDefense, chanceDefense, hit,
    multiMalusAttaquant, multiMalusDefenseur,
  } })

  if (hit) {
    // Dégâts auto (même logique que PNJ dans resolveAssaultAction) — délègue entièrement à
    // damageService.resolveTargetHit (localisation/armure/RD/sévérité/blessure/shock), qui
    // fetch désormais aussi mutations/avantages pour RD/Choc (docs/PLAN_MUTATION2.md Lot 3).
    // CHOC1 : point de résolution unique, plus de parseDice direct sur damageFormula (voir
    // getEffectiveMeleeDamage, docs/JOURNALTEMP.md Étape 6).
    const { total: rawDice, choc: effectiveChocDsl } = await damageService.getEffectiveMeleeDamage(db, {
      weaponInvId, naturalWeaponCharMutationId, charSheetId: attackerSheetId, fallbackFormula: damageFormula,
    })
    // MELEE-MR — Dommages_Bruts = Arme + MR + ModDom(FOR) (docs/BUGIDENTIFIE.md, MANUELSYSCOMBAT §6.2)
    const degautsBruts = computeMeleeRawDamage({ rawDice, mr: mrAttaque, modDom, combatModeBonus })

    if (cibleType === 'exo') {
      // PLAN_EXOARMURE.md §11.4 (catégorie A, site 3) — aucune branche drone n'existait ici (un drone
      // n'atteint jamais cette fonction, §7.4/resolveMeleeDefenseDrone), branche nouvelle pure.
      const exoResult = await exoAvarieService.resolveExoDamage(io, db, campaignId, { characterId: characterIdCible, degautsBruts })
      if (exoResult) {
        emissions.push({ to: 'room', event: WS.COMBAT_ATTACK_RESULT, data: {
          tireurId:    attackerTokenId, cibleId: targetTokenId,
          localisation: null, degautsBruts, degatsNets: exoResult.degatsNets,
          severity: exoResult.severity, is_lethal: false, isSuccess: true, isPnj: true,
          roll: rollAttaque, chancesDeReussite: chancesAttaque, shockResult: null,
        } })
      }
      return { suspend: false, emissions }
    }

    const hitResult = await damageService.resolveTargetHit(io, db, campaignId, {
      degautsBruts,
      characterIdCible,
      cibleType,
      char_sheet_id_cible,
      for_na_cible, con_na_cible, vol_na_cible,
      chocDsl: effectiveChocDsl,
      treatAsContact: true,
    })

    if (hitResult) {
      const { localisation, degatsNets, is_lethal, finalSeverity, shockResult } = hitResult

      if (shockResult) {
        statusService.emitShockDiceResult(io, campaignId, shockResult, userId, attackerUsername, attackerColor)
      }

      emissions.push({ to: 'room', event: WS.COMBAT_ATTACK_RESULT, data: {
        tireurId:    attackerTokenId, cibleId: targetTokenId,
        localisation, degautsBruts, degatsNets,
        severity: finalSeverity, is_lethal, isSuccess: true, isPnj: true,
        roll: rollAttaque, chancesDeReussite: chancesAttaque, shockResult,
      } })
      if (shockResult?.outcome && shockResult.outcome !== 'ok') {
        statusService.applyStun(io, db, campaignId, {
          targetTokenId, outcome: shockResult.outcome,
          userId, username: attackerUsername, color: attackerColor,
        }).catch(err => console.error('[WS] applyStun error:', err.message))
      }
    }
  }

  return { suspend: false, emissions }  // entrée résolue, advanceTimeline() enchaîne (§5 Lot B)
}

// Défenseur drone — §7.4 : sans programme esquive, le drone ne peut pas se défendre, test simple.
export async function resolveMeleeDefenseDrone(io, campaignId, ctx, emissions) {
  const {
    attackerTokenId, targetTokenId, chancesAttaque, rollAttaque, multiMalusAttaquant, mrAttaque,
    weaponInvId, naturalWeaponCharMutationId, attackerSheetId, damageFormula, modDom, combatModeBonus,
    characterIdCible,
  } = ctx
  const hit = rollAttaque <= chancesAttaque
  emissions.push({ to: 'room', event: WS.COMBAT_MELEE_RESULT, data: {
    attaquantId: attackerTokenId, defenseurId: targetTokenId,
    rollAttaque, chancesAttaque, rollDefense: null, chanceDefense: null, hit,
    multiMalusAttaquant,
  } })
  if (hit) {
    const droneSheet = await db('drone_sheet').where({ character_id: characterIdCible }).first()
    if (droneSheet) {
      // CHOC1 : point de résolution unique, plus de parseDice direct sur damageFormula (voir
      // getEffectiveMeleeDamage, docs/JOURNALTEMP.md Étape 6).
      const { total: rawDice } = await damageService.getEffectiveMeleeDamage(db, {
        weaponInvId, naturalWeaponCharMutationId, charSheetId: attackerSheetId, fallbackFormula: damageFormula,
      })
      // MELEE-MR — Dommages_Bruts = Arme + MR + ModDom(FOR) (docs/BUGIDENTIFIE.md, MANUELSYSCOMBAT §6.2).
      // Pas de jet de défense drone ici (§7.4, pas de programme esquive) : MR = marge de l'attaquant seul,
      // déjà résolu (bonus Réussite critique inclus) par resolveMeleeAction — jamais recalculé ici.
      const degautsBruts = computeMeleeRawDamage({ rawDice, mr: mrAttaque, modDom, combatModeBonus })
      const { etqDrone, rdDrone, degatsNets: degatsNetsDrone } = calcDroneDegatsNets(droneSheet, degautsBruts)
      await resolveDroneIntegrityLoss(io, campaignId, characterIdCible, targetTokenId, droneSheet, degatsNetsDrone)
      emissions.push({ to: 'room', event: WS.COMBAT_ATTACK_RESULT, data: {
        tireurId: attackerTokenId, cibleId: targetTokenId,
        localisation: null, degautsBruts, degatsNets: degatsNetsDrone,
        severity: null, is_lethal: false, isSuccess: true, isPnj: true,
        roll: rollAttaque, chancesDeReussite: chancesAttaque, shockResult: null,
      } })
    }
  }
  return { suspend: false, emissions }
}

// Défenseur PJ : bloquer le slot, émettre le prompt — la résolution réelle (jet de défense, dégâts) se
// fait plus tard dans confirmMeleeDefense, pas ici.
export async function resolveMeleeDefensePj(io, campaignId, ctx, emissions) {
  const {
    attackerTokenId, targetTokenId, attackerCharacterName, rollAttaque, chancesAttaque,
    defenderSkillTotal, defenderEffectiveMalus, multiMalusDefenseur, defenderUserId,
  } = ctx
  await db('combat_pending').insert({ campaign_id: campaignId, token_id: targetTokenId, type: 'melee_defense', payload: ctx })
  await setFSMSubPhase(db, campaignId, 'AWAITING_DEFENSE')
  await broadcastCurrentSubPhase(io, campaignId)

  // Cibler le socket du défenseur PJ
  const prompt = {
    attackerName:    attackerCharacterName,
    attackerTokenId,
    defenderTokenId: targetTokenId,
    rollAttaque,
    chancesAttaque,
    // Défenseur : Seuil de base (sans ajustement combat_mode, résolu au confirm) + malus encerclement
    chanceDefenseBase: defenderSkillTotal + defenderEffectiveMalus + multiMalusDefenseur,
    multiMalusDefenseur,
  }
  emissions.push({ to: 'user', userId: defenderUserId, event: WS.COMBAT_MELEE_DEFENSE_PROMPT, data: prompt, fallback: 'room' })

  return { suspend: true, emissions }  // slot bloqué jusqu'à COMBAT_MELEE_DEFENSE_CONFIRM
}

// Appelée depuis COMBAT_ACTION_CONFIRM quand action.type==='reload'.
// Utilise weapon_inv_id + modifiers.ammo_item_id (déclaration PJ) ou auto-sélection (PNJ).
// PNJ + pnj_unlimited_ammo : recharge sans consommer de munitions.
export async function resolveReloadAction(io, socket, campaignId, character, action) {
  const characterId = character.id
  console.log(`[DBG] resolveReload — début. characterId:${characterId} type:${character.type} campaignId:${campaignId}`)

  const settings = await getCampaignSettings(db, campaignId)
  const pnjUnlimited = settings.pnj_unlimited_ammo && character.type === 'pnj'
  const reloadMode   = settings.reload_mode
  console.log(`[DBG] resolveReload — pnj_unlimited_ammo:${settings.pnj_unlimited_ammo} pnjUnlimited:${pnjUnlimited} reloadMode:${reloadMode}`)

  const parseCount = (s) => { const m = String(s ?? '').match(/\d+/); return m ? parseInt(m[0], 10) : 0 }

  // Émet le résultat ciblé vers le socket du joueur (pas pour les PNJs)
  const emitResult = async (payload) => {
    if (!character.user_id) return
    if (socket.user?.id === character.user_id) {
      socket.emit(WS.COMBAT_RELOAD_RESULT, payload)
    } else {
      // GM a cliqué Agir pour le slot du joueur — trouver le socket du joueur
      const allSockets = await io.fetchSockets()
      const playerSock = allSockets.find(sock =>
        sock.campaignId === campaignId && sock.user?.id === character.user_id
      )
      if (playerSock) playerSock.emit(WS.COMBAT_RELOAD_RESULT, payload)
    }
  }

  // Identifier l'arme : weapon_inv_id stocké en Phase 1 (PJ) ou auto-détection MG/MD (PNJ)
  const weaponSelect = [
    'char_inventory.id',
    'char_inventory.equipment_id as weapon_equip_id',
    'char_inventory.current_ammo',
    'char_inventory.ammo_remaining',
    'ref_equipment.caliber as ref_caliber',
    'ref_equipment.ammo_count as ref_ammo_count',
  ]
  let weapons
  if (action?.weapon_inv_id) {
    const w = await db('char_inventory')
      .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
      .where({ 'char_inventory.id': action.weapon_inv_id, 'char_inventory.character_id': characterId })
      .whereNotNull('ref_equipment.caliber')
      .select(weaponSelect)
      .first()
    weapons = w ? [w] : []
  } else {
    // Lot B (docs/PLAN_INVENTORY_SLOTS.md) : composite-safe (voir _handSlotConflict, inventoryService.js).
    weapons = await db('char_inventory_slots as cis')
      .join('char_inventory', 'char_inventory.id', 'cis.char_inventory_id')
      .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
      .where({ 'char_inventory.character_id': characterId })
      .whereIn('cis.slot_code', ['MG', 'MD'])
      .whereNotNull('ref_equipment.caliber')
      .select(weaponSelect)
  }
  console.log(`[DBG] resolveReload — ${weapons.length} arme(s) à recharger`)

  for (const weapon of weapons) {
    const clipSize = parseCount(weapon.ref_ammo_count)
    console.log(`[DBG] resolveReload — arme:${weapon.id} caliber:${weapon.ref_caliber} clipSize:${clipSize}`)
    if (clipSize === 0) { console.log('[DBG] resolveReload — clipSize=0, ignorée'); continue }

    if (pnjUnlimited) {
      console.log(`[DBG] resolveReload — PNJ unlimited, rechargement direct à ${clipSize}`)
      await db('char_inventory').where({ id: weapon.id }).update({ ammo_remaining: clipSize, updated_at: db.fn.now() })
      io.to(campaignId).emit(WS.INVENTORY_UPDATED, { characterId, item: { id: weapon.id, ammo_remaining: clipSize } })
    } else {
      // Identifier la munition : sélectionnée en Phase 1 (ammo_item_id) ou auto-sélection
      const ammoItemId = action?.modifiers?.ammo_item_id ?? null
      let ammoItem = null

      if (ammoItemId) {
        ammoItem = await db('char_inventory')
          .where({ id: ammoItemId, character_id: characterId })
          .select('id', 'equipment_id', 'quantity')
          .first()
        if (!ammoItem || ammoItem.quantity <= 0) {
          console.log(`[DBG] resolveReload — munition sélectionnée introuvable ou épuisée : ${ammoItemId}`)
          await emitResult({ success: false, characterId, caliber: weapon.ref_caliber })
          continue
        }
      } else {
        // Fallback : première munition compatible hors Coffre
        const ammoItems = await db('char_inventory')
          .leftJoin('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
          .where({ 'char_inventory.character_id': characterId })
          .where(function() { this.whereNull('char_inventory.container').orWhereNot('char_inventory.container', 'Coffre') })
          .whereNot({ 'char_inventory.id': weapon.id })
          .where({ 'ref_equipment.caliber': weapon.ref_caliber })
          .select('char_inventory.id', 'char_inventory.equipment_id', 'char_inventory.quantity')
        console.log(`[DBG] resolveReload — fallback : ${ammoItems.length} munition(s) caliber:${weapon.ref_caliber}`)
        if (ammoItems.length === 0) {
          console.log(`[DBG] resolveReload — aucune munition disponible, tour consommé`)
          await emitResult({ success: false, characterId, caliber: weapon.ref_caliber })
          continue
        }
        const preferred = weapon.current_ammo ? ammoItems.find(a => a.equipment_id === weapon.current_ammo) : null
        ammoItem = preferred ?? ammoItems[0]
      }

      const currentAmmo = weapon.ammo_remaining ?? 0
      let roundsConsumed, newAmmo
      if (reloadMode === 'topup') {
        const needed   = clipSize - currentAmmo
        roundsConsumed = Math.min(needed, ammoItem.quantity)
        newAmmo        = currentAmmo + roundsConsumed
      } else {
        roundsConsumed = Math.min(clipSize, ammoItem.quantity)
        newAmmo        = roundsConsumed
      }
      console.log(`[DBG] resolveReload — mode:${reloadMode} consumed:${roundsConsumed} new_ammo:${newAmmo}`)

      await db.transaction(async (trx) => {
        await trx('char_inventory').where({ id: weapon.id }).update({
          current_ammo: ammoItem.equipment_id, ammo_remaining: newAmmo, updated_at: db.fn.now(),
        })
        if (ammoItem.quantity - roundsConsumed <= 0) {
          await trx('char_inventory').where({ id: ammoItem.id }).delete()
          io.to(campaignId).emit(WS.INVENTORY_REMOVED, { characterId, itemId: ammoItem.id })
        } else {
          const newQty = ammoItem.quantity - roundsConsumed
          await trx('char_inventory').where({ id: ammoItem.id }).update({ quantity: newQty, updated_at: db.fn.now() })
          io.to(campaignId).emit(WS.INVENTORY_UPDATED, { characterId, item: { id: ammoItem.id, quantity: newQty } })
        }
      })
      io.to(campaignId).emit(WS.INVENTORY_UPDATED, { characterId, item: { id: weapon.id, ammo_remaining: newAmmo } })
      await emitResult({ success: true, characterId, newAmmo, clipSize, caliber: weapon.ref_caliber })
    }
  }
  console.log(`[DBG] resolveReload — FIN. personnage ${characterId}`)
}

// ─── RÉSOLUTION "SE RELEVER" (EXO-ARMURE) ──────────────────────────────────
// PLAN_EXOARMURE.md Lot 2bis §9.2/9.3 — Test de Manœuvre d'armure pour se redresser depuis 'prone'
// (REGLEARMURE.md:381-395). Auto-résolu comme resolveMeleeDefensePnj/resolveDroneAssaultAction :
// aucune confirmation joueur requise, le jet et l'issue sont déterminés ici même, suspend toujours
// false. `exoCharacter` = le personnage exo lui-même (jamais son pilote — même convention que
// resolveMeleeAction : `character` est l'acteur qui a déclaré, résolu par le dispatcher appelant
// depuis token_id → characters).
export async function resolveExoStandUpAction(io, campaignId, action, exoCharacter, pendingMaps) {
  const emissions = []
  const tokenId = action.token_id
  const targetPosition = action.modifiers?.targetPosition

  // Garde défensive — pas un cas normal (la déclaration exigeait déjà un pilote/base configurée
  // pour que l'exo soit en combat), mais pilote/exoSheet peuvent changer entre Annonce et Résolution
  // (PUT /:characterId/exo reste ouvert pendant un combat). Repli gracieux, jamais un crash silencieux.
  const { pilot, exoSheet } = await resolveExoContext(db, exoCharacter)
  if (!pilot) {
    emissions.push({ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
      username: exoCharacter.name, message: 'Tentative de se relever annulée — aucun pilote assigné.',
    } })
    return { suspend: false, emissions }
  }
  const exoStats = computeExoStats(exoSheet)
  if (!exoStats) {
    emissions.push({ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
      username: exoCharacter.name, message: 'Tentative de se relever annulée — armure non configurée (aucun modèle assigné).',
    } })
    return { suspend: false, emissions }
  }

  // resolveManeuverSkillId peut lever (environment='industrial', décision Saar 2026-08-15 en
  // suspens) — laissé remonter volontairement : le try/catch englobant de socketCombatResolution.js
  // (même bloc que melee/assault) l'intercepte déjà proprement (message explicite, échelle non
  // bloquée), vérifié en analyse à charge PLAN_EXOARMURE.md §9.2, pas dupliqué ici.
  const maneuverSkillId = resolveManeuverSkillId(exoSheet)
  if (!(exoSheet.category in EXO_PRONE_RECOVERY_TABLE)) {
    throw new Error(`resolveExoStandUpAction : catégorie exo inconnue de EXO_PRONE_RECOVERY_TABLE : ${exoSheet.category}`)
  }
  const categoryMod = EXO_PRONE_RECOVERY_TABLE[exoSheet.category]

  const ctx = await resolveHumanoidTestContext(db, pilot, maneuverSkillId, { forNAOverride: exoStats.exf })

  // Noyau pur combatAttackRoll.js (même primitif que resolveMeleeDefensePnj) — PAS
  // polarisTestService.js/resolvePolarisTest (analyse à charge 2026-08-18, PLAN_EXOARMURE.md §9.2 :
  // ce dernier ne produit ni breakdown ni bonus de Réussite critique, inadapté à un jet visible en chat).
  const { total: roll, rolls, seed } = await parseDice('1d20')
  const outcome0 = computeAttackRoll({
    skillLabel: "Manœuvre d'armure", skillTotal: ctx.skillTotal, totalLabel: 'Seuil', rollAttaque: roll,
    contributions: [
      { label: `Catégorie ${exoSheet.category}`, value: categoryMod, type: categoryMod >= 0 ? 'bonus' : 'malus' },
    ],
  })
  const outcomeCrit = applyCriticalSuccessBonus(outcome0, getCriticalSuccessBonus({ masteryLevel: ctx.mastery }))
  const { seuil, breakdown, isSuccess, mr } = outcomeCrit
  const outcome = await resolveCriticalFailReroll(outcomeCrit)

  console.log(`[WS] exo se relever — token:${tokenId} roll:${roll}/${seuil} → ${isSuccess ? 'RÉUSSI' : 'ÉCHOUÉ (reste à terre)'}`)

  emissions.push({ to: 'room', event: WS.DICE_RESULT, data: {
    userId: null, username: exoCharacter.name ?? 'Exo-armure', color: '#808080',
    formula: '1d20', rolls, total: roll,
    isCriticalSuccess: outcome.isCriticalSuccess, isCriticalFail: outcome.isCriticalFail,
    catastropheRisk:   outcome.catastropheRisk,
    seed, timestamp: new Date().toISOString(),
    skillLabel:        "Tentative de se redresser (Manœuvre d'armure)",
    mechanicalTotal:   ctx.skillTotal,
    diffLabel:         seuil - ctx.skillTotal >= 0 ? `+${seuil - ctx.skillTotal}` : `${seuil - ctx.skillTotal}`,
    chancesDeReussite: seuil,
    isSuccess,
    mr,
    breakdown,
  } })

  // Catastrophe automatique (docs/PLANS/PLAN_CATASTROPHE_RISK.md Lot 1) — même règle que tout Test de
  // combat en Résolution (omis puis corrigé en analyse à charge, PLAN_EXOARMURE.md §9.2).
  // targetTokenId:null — Test sans adversaire, champ purement descriptif (vérifié catastropheService.js).
  await maybeTriggerCatastrophe(io, campaignId, tokenId, outcome.catastropheRisk, {
    site: 'exo_stand_up', actorTokenId: tokenId, targetTokenId: null,
  })

  // Échec : state_position reste 'prone' (déjà sa valeur) — aucune écriture. Rien d'autre ne
  // s'exécute ce Tour, garanti par l'exclusivité de la déclaration (Annonce, pas ici).
  if (isSuccess && targetPosition) {
    const rosterEntry = await db('combat_roster').where({ campaign_id: campaignId, token_id: tokenId }).first()
    await db.transaction(async (trx) => {
      await trx('combat_roster')
        .where({ campaign_id: campaignId, token_id: tokenId })
        .update({ state_position: targetPosition, updated_at: trx.fn.now() })
      // Lot 1 (shadow, docs/PLANS/PLAN_CHARACTER_STATES.md §3) — même patron que
      // socketCombatAnnouncement.js/socketCombatState.js, weapon inchangé mais transmis pour que le
      // contrôle de cohérence shadow reste exact (il compare position ET weapon ensemble).
      await setCharacterState(trx, tokenId, 'position', targetPosition)
      await shadowCheckCharacterState(trx, tokenId, { position: targetPosition, weapon: rosterEntry?.state_weapon })
    })
    // COMBAT_ROSTER_UPDATED (pas d'attente du prochain snapshot complet, endTurn) — même mécanisme
    // que COMBAT_INIT_STATE (socketCombatState.js) pour une transition de state_position hors du
    // flux d'Annonce standard : sans lui, les autres clients ne verraient la position à jour qu'à la
    // fin du Tour.
    const updatedRoster = await db('combat_roster').where({ campaign_id: campaignId })
    const broadcastRoster = await buildBroadcastRoster(db, updatedRoster)
    emissions.push({ to: 'room', event: WS.COMBAT_ROSTER_UPDATED, data: { roster: broadcastRoster } })
  }

  return { suspend: false, emissions }
}

// ─── RÉSOLUTION ASSAUT ──────────────────────────────────────────────────────
// Appelée depuis COMBAT_ACTION_CONFIRM quand action.type==='assault' + confirmedModifiers présents.
// Jets : attaque 1d20 / localisation 1d20 / dégâts selon ref_damage_h.
// Blessures : woundService.applyWound (résolution + WOUND_ADDED) + resolveShockTest caller.
// ─── resolveDroneAssaultAction — résolution attaque drone (Sprint 2c) ────────
// Appelé depuis resolveAssaultAction quand character.type === 'drone'.
// §7.3 MANUELSYSCOMBAT : D20 ≤ programme.level, modificateurs situationnels standard,
// pas de malus blessures/encombrement, pas de Test de Choc.
// ── Portée/LOS partagées entre résolveurs Tir/CaC (PLAN_EXOARMURE.md §16.6, DRY ciblé) ─────────────
// Extraites de resolveDroneAssaultAction (portée/reach y étaient déjà des recopies de
// resolveMeleeAction/resolveAssaultAction, cf. commentaires ci-dessous) pour que
// resolveExoAssaultAction/resolveExoMeleeAction (Étape B) ne les recopient pas une 3ᵉ fois. Ne
// touchent PAS resolveAssaultAction/resolveMeleeAction eux-mêmes — le pipeline humanoïde reste
// inchangé, trop testé/joué pour un risque disproportionné (§16.6, décision documentée dans le plan).

// Portée de corps à corps (allonge) — mesure + comparaison à resolveMeleeReachM. `emissions` reçoit
// directement l'erreur (même convention que le reste de ce fichier, pas de valeur de retour ambiguë).
export async function checkMeleeReach({ action, character, refRange, emissions }) {
  const meleeReachM = resolveMeleeReachM(refRange)
  const measurement = await measureBattlemapTokenDistance({
    sourceTokenId: action.token_id,
    targetTokenId: action.target_token_id,
  })
  if (measurement.status !== 'ok' || measurement.distanceM > meleeReachM) {
    emissions.push({ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
      username: character.name,
      message: measurement.status === 'ok'
        ? `Corps à corps impossible — distance : ${measurement.distanceM.toFixed(1)}m, portée max : ${meleeReachM}m`
        : 'Corps à corps impossible — position incompatible avec le moteur de monde',
    } })
    return { ok: false }
  }
  return { ok: true }
}

// Portée à distance (Tir) — mesure + résolution de bande (shared/combatRange.js, autorité déjà
// unique pour la bande elle-même — cette fonction ne fait qu'éviter de recopier la mesure+traduction
// d'erreur autour).
export async function resolveRangedDistance({ action, character, refRange, emissions }) {
  const measurement = await measureBattlemapTokenDistance({
    sourceTokenId: action.token_id,
    targetTokenId: action.target_token_id,
  })
  const range = measurement.status === 'ok'
    ? resolveWeaponRangeBand(measurement.distanceM, refRange)
    : { status: measurement.status, band: null }
  if (range.status !== 'ok') {
    emissions.push({ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
      username: character.name,
      message: range.status === 'out-of-range'
        ? `Tir impossible — cible hors de portée (${measurement.distanceM.toFixed(1)} m)`
        : 'Tir impossible — portée ou position incompatible avec le moteur de monde',
    } })
    return { ok: false }
  }
  return { ok: true, band: range.band }
}

// LOS — le rappel récursif (nouvelle cible interceptée) reste à la charge de chaque appelant : ils
// n'ont pas la même identité de fonction (resolveDroneAssaultAction/resolveExoAssaultAction doivent
// se rappeler EUX-MÊMES avec skipLos:true), extraire jusque-là ajouterait un callback pour un gain
// marginal — seule l'interprétation du résultat checkCombatLOS est partagée ici.
export async function resolveAttackLOS({ io, campaignId, action, character }) {
  const los = await checkCombatLOS(io, db, campaignId, action, character)
  if (los.result === 'blocked') return { blocked: true }
  if (los.result === 'intercepted') return { blocked: false, intercepted: true, newTargetTokenId: los.newTargetTokenId }
  return { blocked: false, intercepted: false, coverageModifier: los.coverageModifier ?? 0 }
}

export async function resolveDroneAssaultAction(io, campaignId, action, confirmedModifiers, character, pendingMaps, options = {}) {
  console.log(`[DBG] resolveDroneAssaultAction — début token:${action.token_id} drone_weapon:${action.drone_weapon_inv_id} target:${action.target_token_id}`)
  try {
    const emissions = []
    // TIRIMP (docs/BUGIDENTIFIE.md) — même garde que resolveAssaultAction, autoritaire côté serveur.
    if (isImpossibleRangedSituation(confirmedModifiers?.situation ?? [])) {
      emissions.push({ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
        username: character.name,
        message: 'Tir impossible — Allure maximale du tireur ou obscurité totale',
      } })
      return { suspend: false, emissions }
    }
    // 1. Arme drone
    const weapon = await db('drone_weapons')
      .leftJoin('ref_equipment', 'drone_weapons.equipment_id', 'ref_equipment.id')
      .where({ 'drone_weapons.id': action.drone_weapon_inv_id })
      .select(
        'drone_weapons.fire_mode as explicit_fire_mode',
        'ref_equipment.fire_mode as ref_fire_mode',
        'ref_equipment.range as ref_range',
        db.raw(`COALESCE(drone_weapons.damage_formula, ref_equipment.damage_h) as effective_formula`),
        db.raw(`COALESCE(drone_weapons.label_override, drone_weapons.name, ref_equipment.name) as display_name`),
      )
      .first()

    if (!weapon?.effective_formula) {
      console.warn(`[WS] resolveDroneAssaultAction — arme sans formule. drone_weapon_inv_id:${action.drone_weapon_inv_id}`)
      emissions.push({ to: 'room', event: WS.DICE_RESULT, data: {
        userId: null, username: character.name ?? 'Drone', color: '#30aaaa',
        formula: '—', rolls: [], total: 0,
        isCriticalSuccess: false, isCriticalFail: false, seed: null,
        timestamp: new Date().toISOString(),
        skillLabel: `Armement Drone — arme sans formule de dégâts`,
        mechanicalTotal: 0, diffLabel: '', chancesDeReussite: 0, isSuccess: false,
      } })
      return { suspend: false, emissions }
    }

    // 2. Programme armement — miroir humanoïde : !ref_fire_mode → contact, sinon distance
    const isCaCWeapon = weapon.explicit_fire_mode ? weapon.explicit_fire_mode === 'cc' : !weapon.ref_fire_mode
    let authoritativeRangeBand = null

    // ── Range check CaC drone (miroir resolveMeleeAction L.1674-1688, extrait en helper §16.6) ──
    if (isCaCWeapon) {
      const reach = await checkMeleeReach({ action, character, refRange: weapon?.ref_range, emissions })
      if (!reach.ok) return { suspend: false, emissions }
    }

    if (!isCaCWeapon) {
      console.log(`[DBG] resolveDroneAssaultAction — avant measureBattlemapTokenDistance (portée)`)
      const range = await resolveRangedDistance({ action, character, refRange: weapon.ref_range, emissions })
      console.log(`[DBG] resolveDroneAssaultAction — après measureBattlemapTokenDistance, ok:${range.ok}`)
      if (!range.ok) return { suspend: false, emissions }
      authoritativeRangeBand = range.band
    }

    // ── LOS check (distance uniquement) ────────────────────────────────────────
    if (!isCaCWeapon && !options.skipLos) {
      console.log(`[DBG] resolveDroneAssaultAction — avant checkCombatLOS`)
      const losResult = await resolveAttackLOS({ io, campaignId, action, character })
      console.log(`[DBG] resolveDroneAssaultAction — après checkCombatLOS, blocked:${losResult.blocked} intercepted:${losResult.intercepted}`)
      if (losResult.blocked) {
        return { suspend: false, emissions }
      }
      if (losResult.intercepted) {
        return resolveDroneAssaultAction(io, campaignId,
          { ...action, target_token_id: losResult.newTargetTokenId },
          confirmedModifiers, character, pendingMaps, { skipLos: true })
      }
      options.coverageModifier = losResult.coverageModifier
    }

    console.log(`[DBG] resolveDroneAssaultAction — avant fetch programme drone`)
    const category = isCaCWeapon ? 'armement_contact' : 'armement_distance'
    const programme = await db('drone_programs')
      .where({ character_id: character.id, category })
      .orderBy('level', 'desc')
      .first()
    console.log(`[DBG] resolveDroneAssaultAction — après fetch programme, trouvé:${!!programme}`)

    if (!programme) {
      console.warn(`[WS] resolveDroneAssaultAction — programme ${category} introuvable pour drone ${character.id}`)
      emissions.push({ to: 'room', event: WS.DICE_RESULT, data: {
        userId: null, username: character.name ?? 'Drone', color: '#30aaaa',
        formula: '—', rolls: [], total: 0,
        isCriticalSuccess: false, isCriticalFail: false, seed: null,
        timestamp: new Date().toISOString(),
        skillLabel: `Armement Drone — programme "${category}" manquant`,
        mechanicalTotal: 0, diffLabel: 'Configurer le programme dans la fiche drone', chancesDeReussite: 0, isSuccess: false,
      } })
      return { suspend: false, emissions }
    }

    // 3. Calcul chancesDeReussite (§7.3 — même modificateurs que humanoïdes)
    // armement_contact : portée = null → PORTEE_MOD_COMP[null]?.mod ?? 0 = 0 (contact physique, pas de modificateur portée)
    const portee = category !== 'armement_contact' ? authoritativeRangeBand : null
    let totalModComp = PORTEE_MOD_COMP[portee]?.mod ?? 0
    if (confirmedModifiers?.taille) totalModComp += TAILLE_MODS[confirmedModifiers.taille]?.mod ?? 0
    const situationMods = confirmedModifiers?.situation ?? []
    totalModComp += sumRangedSituationMods(situationMods)
    const coverageModifier  = options.coverageModifier ?? 0
    const chancesDeReussite = programme.level + totalModComp + coverageModifier

    // 4. Jet D20
    console.log(`[DBG] resolveDroneAssaultAction — avant parseDice`)
    const { total: roll, rolls: attRolls, seed: attSeed } = await parseDice('1d20')
    console.log(`[DBG] resolveDroneAssaultAction — après parseDice, roll:${roll}`)
    // Réussite critique (p.204, Lot 2) — le drone n'a ni Compétence ni Attribut au sens RAW,
    // `programme.level` fait déjà tout le seuil (base + « maîtrise » fusionnées) : décision Saar
    // 2026-07-31, docs/PLAN_TEST_CRITIQUE.md Lot 2, le programme tient lieu de niveau de maîtrise.
    const droneOutcomeCrit = applyCriticalSuccessBonus(resolveTestOutcome(roll, chancesDeReussite), getCriticalSuccessBonus({ masteryLevel: programme.level }))
    const droneOutcome = await resolveCriticalFailReroll(droneOutcomeCrit)
    const { isSuccess, mr } = droneOutcome

    // 5. Display data tireur
    const userRow        = character.user_id ? await db('users').where({ id: character.user_id }).select('color', 'username').first() : null
    const tireurColor    = userRow?.color    ?? '#888888'
    const tireurUsername = userRow?.username ?? character.name ?? 'Drone'
    const userId         = character.user_id ?? null
    const now            = new Date().toISOString()

    // 6. Broadcast jet programme
    const porteeModDrone = PORTEE_MOD_COMP[portee]?.mod ?? 0
    const tailleModDrone = confirmedModifiers?.taille ? (TAILLE_MODS[confirmedModifiers.taille]?.mod ?? 0) : 0
    const breakdownDrone = [
      { label: `Programme (niv. ${programme.level})`, value: programme.level, type: 'base' },
      ...(porteeModDrone !== 0 ? [{ label: PORTEE_LABELS[portee] ?? portee, value: porteeModDrone, type: porteeModDrone > 0 ? 'bonus' : 'malus' }] : []),
      ...situationMods.reduce((acc, k) => {
        const v = RANGED_SITUATION_MODS[k]?.mod
        if (v !== undefined && v !== 0) acc.push({ label: SITUATION_LABELS[k] ?? k, value: v, type: v > 0 ? 'bonus' : 'malus' })
        return acc
      }, []),
      ...(tailleModDrone !== 0 ? [{ label: TAILLE_LABELS[confirmedModifiers.taille] ?? confirmedModifiers.taille, value: tailleModDrone, type: tailleModDrone > 0 ? 'bonus' : 'malus' }] : []),
      ...(coverageModifier !== 0 ? [{ label: 'Couverture cible', value: coverageModifier, type: 'malus' }] : []),
      { label: 'Seuil', value: chancesDeReussite, type: 'total' },
    ]
    emissions.push({ to: 'room', event: WS.DICE_RESULT, data: {
      userId, username: tireurUsername, color: tireurColor,
      formula: '1d20', rolls: attRolls, total: roll,
      isCriticalSuccess: droneOutcome.isCriticalSuccess, isCriticalFail: droneOutcome.isCriticalFail,
      catastropheRisk: droneOutcome.catastropheRisk,
      seed: attSeed, timestamp: now,
      skillLabel: `${weapon.display_name ?? 'Armement'} — Drone`,
      mechanicalTotal: roll,
      diffLabel: `${chancesDeReussite} (Prog. niv. ${programme.level})`,
      chancesDeReussite, isSuccess,
      breakdown: breakdownDrone,
    } })
    // Catastrophe automatique (docs/PLANS/PLAN_CATASTROPHE_RISK.md Lot 1).
    await maybeTriggerCatastrophe(io, campaignId, action.token_id, droneOutcome.catastropheRisk, {
      site: 'drone_attack', actorTokenId: action.token_id, targetTokenId: action.target_token_id,
    })

    if (!isSuccess) {
      emissions.push({ to: 'room', event: WS.COMBAT_ATTACK_RESULT, data: {
        tireurId: action.token_id, cibleId: action.target_token_id,
        localisation: null, degautsBruts: 0, degatsNets: 0,
        severity: null, is_lethal: false, isSuccess: false, shockResult: null,
      } })
      return { suspend: false, emissions }
    }

    // 7. Identifier la cible
    const cibleToken     = await db('tokens').where({ id: action.target_token_id }).first()
    const cibleCharacter = cibleToken?.character_id
      ? await db('characters').where({ id: cibleToken.character_id }).first()
      : null
    const formula = weapon.effective_formula.replace(/\s/g, '')

    // Branchement cible (PLAN_RW_SYSCOMBAT.md §2.8, Lot 6) — guard clauses, même style que Lots 2/4.
    // Aucune des 3 fonctions sœurs n'a son propre try/catch : toute exception remonte à ce catch
    // unique, qui vide alors `emissions` — comportement existant préservé à l'identique.
    const ctx = { action, cibleCharacter, formula, mr, portee, tireurUsername, tireurColor, userId, now }
    if (cibleCharacter?.type === 'drone') return await resolveAttackHitDrone(io, campaignId, ctx, emissions)
    // PLAN_EXOARMURE.md §11.4 (catégorie A, site 6) — AVANT le test 'pnj' : sans cette branche, une exo
    // (type ni 'drone' ni 'pnj') tombait par erreur dans resolveAttackHitPj (`cibleType: null`
    // codé en dur, prompt adressé à cibleCharacter.user_id au lieu du pilote). Une exo n'a pas de
    // défense active contre un tir (même absence que le drone, RAW) — auto-résolution immédiate, jamais
    // de suspend/prompt.
    if (cibleCharacter?.type === 'exo') return await resolveAttackHitExo(io, campaignId, ctx, emissions)
    if (!cibleCharacter || cibleCharacter.type === 'pnj') return await resolveAttackHitPnj(io, campaignId, ctx, emissions)
    return await resolveAttackHitPj(io, campaignId, ctx, emissions)

  } catch (err) {
    console.error('[WS] resolveDroneAssaultAction error:', err.message)
    return { suspend: false, emissions: [] }
  }
}

// ── Branches cible de resolveDroneAssaultAction (PLAN_RW_SYSCOMBAT.md §2.8, Lot 6) ─────────────────
// Extraites de resolveDroneAssaultAction — ctx assemblé par la coquille juste avant le dispatch.
// Aucune de ces fonctions n'a son propre try/catch (même invariant que Lots 2/4) : toute exception
// remonte au catch unique de resolveDroneAssaultAction.

// 8a. Cible = drone (§7.6 — blindage + RD intégrité, auto-resolve)
// Renommée (PLAN_EXOARMURE.md §16.4/§16.6) — plus "drone"-spécifique : ctx est déjà assemblé par
// l'appelant (resolveDroneAssaultAction OU resolveExoAssaultAction), cette fonction ne dépend que du
// TYPE DE CIBLE, jamais de l'identité de l'attaquant. Un nom "Drone" prêtait à confusion dès qu'un
// second appelant existerait — renommage pur, aucun changement de comportement.
export async function resolveAttackHitDrone(io, campaignId, ctx, emissions) {
  const { action, cibleCharacter, formula, mr, tireurUsername, tireurColor, userId, now } = ctx
  const droneSheet = await db('drone_sheet').where({ character_id: cibleCharacter.id }).first()
  if (!droneSheet) return { suspend: false, emissions }
  const { total: rawDice, rolls: dmgRolls, seed: dmgSeed } = await parseDice(formula)
  const modDomAttaque = getMrModifier(mr)
  const degautsBruts  = rawDice + modDomAttaque
  const { etqDrone, rdDrone, degatsNets } = calcDroneDegatsNets(droneSheet, degautsBruts)
  await resolveDroneIntegrityLoss(io, campaignId, cibleCharacter.id, action.target_token_id, droneSheet, degatsNets)
  const newIntegrite = degatsNets >= 30 ? 0 : Math.max(0, droneSheet.integrite_actuelle - 1)
  emissions.push({ to: 'room', event: WS.DICE_RESULT, data: {
    userId, username: tireurUsername, color: tireurColor,
    formula, rolls: dmgRolls, total: degautsBruts,
    isCriticalSuccess: false, isCriticalFail: false,
    seed: dmgSeed, timestamp: now,
    skillLabel: `Dégâts — ${cibleCharacter.name} · Intégrité : ${droneSheet.integrite_actuelle} → ${newIntegrite}`,
    mechanicalTotal: rawDice,
    diffLabel: `+${modDomAttaque} MR · −${etqDrone} blindage · RD ${rdDrone}`,
    chancesDeReussite: degatsNets,
    isSuccess: degatsNets > 0,
    cardType: 'drone_damage',
  } })
  emissions.push({ to: 'room', event: WS.COMBAT_ATTACK_RESULT, data: {
    tireurId: action.token_id, cibleId: action.target_token_id,
    localisation: droneSheet.localisation_ref ?? 'corps', degautsBruts, degatsNets,
    severity: null, is_lethal: false, isSuccess: true, shockResult: null,
  } })
  return { suspend: false, emissions }
}

// 8a-bis. Cible = exo-armure (PLAN_EXOARMURE.md §11.4, catégorie A, site 6) — miroir de
// resolveAttackHitDrone : auto-resolve, aucune défense active (même absence RAW que le drone).
export async function resolveAttackHitExo(io, campaignId, ctx, emissions) {
  const { action, cibleCharacter, formula, mr, tireurUsername, tireurColor, userId, now } = ctx
  const { total: rawDice, rolls: dmgRolls, seed: dmgSeed } = await parseDice(formula)
  const modDomAttaque = getMrModifier(mr)
  const degautsBruts  = rawDice + modDomAttaque
  const exoResult = await exoAvarieService.resolveExoDamage(io, db, campaignId, { characterId: cibleCharacter.id, degautsBruts })
  if (!exoResult) return { suspend: false, emissions }
  emissions.push({ to: 'room', event: WS.DICE_RESULT, data: {
    userId, username: tireurUsername, color: tireurColor,
    formula, rolls: dmgRolls, total: degautsBruts,
    isCriticalSuccess: false, isCriticalFail: false,
    seed: dmgSeed, timestamp: now,
    skillLabel: `Dégâts — ${cibleCharacter.name}`,
    mechanicalTotal: rawDice,
    diffLabel: `+${modDomAttaque} MR · −${exoResult.bld} BLD · RD ${exoResult.rd}`,
    chancesDeReussite: exoResult.degatsNets,
    isSuccess: exoResult.degatsNets > 0,
  } })
  emissions.push({ to: 'room', event: WS.COMBAT_ATTACK_RESULT, data: {
    tireurId: action.token_id, cibleId: action.target_token_id,
    localisation: null, degautsBruts, degatsNets: exoResult.degatsNets,
    severity: exoResult.severity, is_lethal: false, isSuccess: true, shockResult: null,
  } })
  return { suspend: false, emissions }
}

// 8b. Cible = PNJ ou décor : auto-resolve
export async function resolveAttackHitPnj(io, campaignId, ctx, emissions) {
  const { action, cibleCharacter, formula, mr, tireurUsername, tireurColor, userId, now } = ctx
  const cibleSheet = cibleCharacter ? await db('char_sheet').where({ character_id: cibleCharacter.id }).first() : null
  // Attributs NA cible avec genotype + mutations — server/src/lib/damageService.js:fetchCibleNA
  // (extrait le 2026-07-30, docs/PLAN_FATIGUE_DOMMAGES.md §9 point structurel 2).
  const { for_na, con_na, vol_na } = cibleSheet
    ? await damageService.fetchCibleNA(db, cibleCharacter.id, cibleSheet.id)
    : { for_na: 8, con_na: 8, vol_na: 8 }

  const { total: rawDice, rolls: dmgRolls, seed: dmgSeed } = await parseDice(formula)
  const modDomAttaque = getMrModifier(mr)
  const degautsBruts  = rawDice + modDomAttaque
  const hitResult = await damageService.resolveTargetHit(io, db, campaignId, {
    degautsBruts,
    characterIdCible: cibleCharacter?.id ?? null,
    cibleType:        cibleCharacter?.type ?? null,
    char_sheet_id_cible: cibleSheet?.id ?? null,
    for_na_cible: for_na, con_na_cible: con_na, vol_na_cible: vol_na,
  })
  if (hitResult === null) return { suspend: false, emissions }
  const { rollLoc, locRolls, locSeed, localisation, etq, rd, degatsNets,
          is_lethal, finalSeverity, shockResult } = hitResult

  if (shockResult) {
    statusService.emitShockDiceResult(io, campaignId, shockResult, userId, tireurUsername, tireurColor)
  }

  emissions.push({ to: 'room', event: WS.DICE_RESULT, data: {
    userId, username: tireurUsername, color: tireurColor,
    formula: '1d20', rolls: locRolls, total: rollLoc,
    isCriticalSuccess: false, isCriticalFail: false,
    seed: locSeed, timestamp: now,
    skillLabel: 'Localisation — Drone', mechanicalTotal: rollLoc, diffLabel: '',
    chancesDeReussite: LOCATION_LABELS[localisation] ?? localisation, isSuccess: true,
  } })
  emissions.push({ to: 'room', event: WS.DICE_RESULT, data: {
    userId, username: tireurUsername, color: tireurColor,
    formula, rolls: dmgRolls, total: degautsBruts,
    isCriticalSuccess: false, isCriticalFail: false,
    seed: dmgSeed, timestamp: now,
    skillLabel: `Dégâts — ${LOCATION_LABELS[localisation] ?? localisation}`,
    mechanicalTotal: rawDice, diffLabel: `Armure:${etq ?? 0} RD:${rd}`,
    chancesDeReussite: degatsNets, isSuccess: degatsNets > 0,
  } })
  emissions.push({ to: 'room', event: WS.COMBAT_ATTACK_RESULT, data: {
    tireurId: action.token_id, cibleId: action.target_token_id,
    localisation, degautsBruts, degatsNets,
    severity: finalSeverity, is_lethal, isSuccess: true, shockResult: shockResult ?? null,
  } })
  if (shockResult?.outcome && shockResult.outcome !== 'ok') {
    statusService.applyStun(io, db, campaignId, {
      targetTokenId: action.target_token_id, outcome: shockResult.outcome,
      userId, username: tireurUsername, color: tireurColor,
    }).catch(err => console.error('[WS] applyStun error:', err.message))
  }
  return { suspend: false, emissions }
}

// 8c. Cible = PJ → COMBAT_DAMAGE_PROMPT (seule branche qui suspend)
export async function resolveAttackHitPj(io, campaignId, ctx, emissions) {
  const { action, cibleCharacter, formula, mr, portee, tireurUsername, tireurColor, userId } = ctx
  const cibleSheet = await db('char_sheet').where({ character_id: cibleCharacter.id }).first()
  const { for_na, con_na, vol_na } = cibleSheet
    ? await damageService.fetchCibleNA(db, cibleCharacter.id, cibleSheet.id)
    : { for_na: 8, con_na: 8, vol_na: 8 }
  const targetName = cibleCharacter.name ?? 'Cible'

  // Plusieurs entrées peuvent désormais coexister pour le même token (docs/PLAN_COMBAT_ACTION_QUEUE.md
  // §3) — consommées FIFO par COMBAT_DAMAGE_CONFIRM ; le prompt n'est émis ici que si aucune autre
  // entrée n'attendait déjà.
  const pendingDamageCount = await armAwaitingDamage(io, campaignId, action.token_id, {
    campaignId,
    targetTokenId:       action.target_token_id,
    characterIdCible:    cibleCharacter.id,
    cibleType:           null,
    char_sheet_id_cible: cibleSheet?.id ?? null,
    mr, portee,
    fire_mode_bonus_dmg: 0,
    formula,
    for_na_cible:  for_na,
    con_na_cible:  con_na,
    vol_na_cible:  vol_na,
    tireurUsername, tireurColor, userId, targetName,
    type: 'assault', modDom: null, combatModeBonus: null,
    targetUserId: cibleCharacter.user_id,
  })
  if (pendingDamageCount === 1) {
    const damagePayload = { tokenId: action.token_id, formula, targetName }
    emissions.push({ to: 'user', userId: cibleCharacter.user_id, event: WS.COMBAT_DAMAGE_PROMPT, data: damagePayload, fallback: 'socket' })
  }
  // Même correctif que resolveAssaultAction/confirmMeleeDefense (Saar, 2026-07-19) — AWAITING_DAMAGE
  // vient d'être posé juste au-dessus, sous-état FSM bloquant : ne jamais laisser advanceTimeline
  // s'exécuter juste après côté appelant.
  return { suspend: true, emissions }
}

// Fetch arme + mods installés pour un Assaut — factorisé (COM29 : main directrice ET non-directrice
// utilisent ce même fetch en Résolution, jamais deux copies divergentes des colonnes/jointures).
// ASSAULT-INHAND-RESOLUTION (docs/BUGIDENTIFIE.md, 2026-08-05) — ownership + en-main revérifiés via
// getOwnedHandWeapon (inventoryService.js), autorité unique déjà utilisée à la Déclaration
// (socketCombatAnnouncement.js) et pour le CaC (MELEE-INHAND) : avant ce correctif, cette fonction ne
// vérifiait ni l'un ni l'autre à la Résolution, malgré le commentaire ci-dessus affirmant "jamais deux
// Fetch arme + mods installés pour un Assaut — factorisé (COM29 : main directrice ET non-directrice
// utilisent ce même fetch en Résolution, jamais deux copies divergentes des colonnes/jointures).
// ASSAULT-INHAND-RESOLUTION (docs/BUGIDENTIFIE.md, 2026-08-05) — ownership + en-main revérifiés via
// getOwnedHandWeapon (inventoryService.js), autorité unique déjà utilisée à la Déclaration
// (socketCombatAnnouncement.js) et pour le CaC (MELEE-INHAND) : avant ce correctif, cette fonction ne
// copies divergentes" — cette copie-ci avait simplement perdu les deux contrôles en cours de route.
async function fetchAssaultWeaponAndMods(weaponInvId, characterId) {
  const [weapon, installedMods] = await Promise.all([
    getOwnedHandWeapon(characterId, weaponInvId, { slotCodes: WEAPON_SLOTS }).then(item => item?.inHand ? item : null),
    // Groupe 1 (docs/PLAN_MODING_PHASEB.md) — mods installés sur l'arme utilisée, jointure fraîche
    // ref_equipment (pas le mod_slot snapshotté sur char_inventory_mods, qui ne sert qu'à la
    // contrainte UNIQUE d'exclusivité). mod_key/state (docs/PLAN_MODDING_REFONTE.md Phase 1) :
    // routage vers weaponModService.resolveModHooks, inutilisés tant que Phase 2/4 ne sont pas
    // câblées (registre vide).
    db('char_inventory_mods as cim')
      .join('ref_equipment as re', 'cim.equipment_id', 're.id')
      .where({ 'cim.weapon_inv_id': weaponInvId })
      .select('re.name', 're.bonus', 're.mod_slot', 're.mod_requires_aim', 're.mod_key', 'cim.state'),
  ])
  return { weapon, installedMods }
}

export async function resolveAssaultAction(io, campaignId, action, confirmedModifiers, character, pendingMaps, options = {}) {
  console.log(`[DBG] resolveAssaultAction — début token:${action.token_id} type_perso:${character.type}`)
  try {
    const emissions = []
    // Branchement drone — avant le guard weapon_inv_id (§7 MANUELSYSCOMBAT). Exo (PLAN_EXOARMURE.md
    // §16.4) routé en amont, dans socketCombatResolution.js — resolveExoAssaultAction vit dans
    // socketCombatExo.js, qui importe déjà plusieurs helpers de CE fichier (portée/LOS, dispatch de
    // dégâts) : router l'exo ici créerait un import circulaire entre les deux modules pour un gain nul
    // (aucun autre appelant de resolveAssaultAction que socketCombatResolution.js, vérifié).
    if (character.type === 'drone') {
      return resolveDroneAssaultAction(io, campaignId, action, confirmedModifiers, character, pendingMaps, options)
    }
    if (!action.weapon_inv_id || !action.target_token_id) return { suspend: false, emissions }

    // TIRIMP (docs/BUGIDENTIFIE.md) — garde serveur autoritaire, jamais une confiance au bouton
    // désactivé côté client (CombatModifiersWindow.jsx). Vérifié avant tout effet de bord (LOS,
    // munitions) — un tir impossible ne doit consommer aucune ressource.
    if (isImpossibleRangedSituation(confirmedModifiers?.situation ?? [])) {
      emissions.push({ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
        username: character.name,
        message: 'Tir impossible — Allure maximale du tireur ou obscurité totale',
      } })
      return { suspend: false, emissions }
    }

    // ── LOS check ─────────────────────────────────────────────────────────────
    if (!options.skipLos) {
      console.log(`[DBG] resolveAssaultAction — avant checkCombatLOS`)
      const los = await checkCombatLOS(io, db, campaignId, action, character)
      console.log(`[DBG] resolveAssaultAction — après checkCombatLOS, result:${los.result}`)
      if (los.result === 'blocked') return { suspend: false, emissions }
      if (los.result === 'intercepted') {
        return resolveAssaultAction(io, campaignId,
          { ...action, target_token_id: los.newTargetTokenId },
          confirmedModifiers, character, pendingMaps, { skipLos: true })
      }
      options.coverageModifier = los.coverageModifier ?? 0
    }

    const [{ weapon: primaryWeapon, installedMods: primaryMods }, rosterTireur, settings] = await Promise.all([
      fetchAssaultWeaponAndMods(action.weapon_inv_id, character.id),
      db('combat_roster').where({ campaign_id: campaignId, token_id: action.token_id }).first(),
      // Options de campagne — fetch unique réutilisé pour l'encombrement, la décision dual-wield et
      // le décompte munitions PNJ plus bas dans cette fonction (un seul fetch, jamais trois).
      getCampaignSettings(db, campaignId),
    ])

    // CHOC1 : ne jamais tester ref_damage_h pour savoir si une arme a été trouvée — une arme réelle
    // (catégorie Choc pur, ex. Flex) peut légitimement avoir ref_damage_h vide. equipment_id est une
    // colonne propre de char_inventory, présente dès que la ligne existe, indépendamment du join.
    if (!primaryWeapon?.equipment_id) {
      console.warn(`[WS] resolveAssaultAction — arme introuvable. weapon_inv_id:${action.weapon_inv_id}`)
      return { suspend: false, emissions }
    }

    // Tir à deux armes (COM29, LdB p.226) — autorité Résolution : re-décidé ici avec l'état munitions
    // le plus frais (même principe que le re-check de munitions déjà en place, COM25), jamais confiance
    // à ce qui a été fail-fast validé à la Déclaration. Une main à sec ne bloque jamais tant que
    // l'autre peut tirer — dégrade en tir simple (shared/ammoRules.js::resolveDualWieldFire).
    const bulletCount = action.bullet_count ?? 1
    const isPnjChar = character.type === 'pnj'
    const primaryAmmoOk = hasEnoughAmmo(primaryWeapon.ammo_remaining, bulletCount, { isPnj: isPnjChar, pnjUnlimitedAmmo: settings.pnj_unlimited_ammo })

    let offhandWeapon = null, offhandMods = [], offhandAmmoOk = false
    if (action.offhand_weapon_inv_id) {
      const fetched = await fetchAssaultWeaponAndMods(action.offhand_weapon_inv_id, character.id)
      // CHOC1 : ne jamais tester ref_damage_h pour savoir si une arme a été trouvée — une arme Choc
      // pur (Flex...) en main secondaire est réelle et doit pouvoir tirer. equipment_id est présent
      // dès que la ligne char_inventory existe, indépendamment du join.
      if (fetched.weapon?.equipment_id) {
        offhandWeapon = fetched.weapon
        offhandMods = fetched.installedMods
        offhandAmmoOk = hasEnoughAmmo(offhandWeapon.ammo_remaining, bulletCount, { isPnj: isPnjChar, pnjUnlimitedAmmo: settings.pnj_unlimited_ammo })
      }
    }

    const { fires, dualWieldApplied, degraded } = resolveDualWieldFire({
      primaryAmmoOk, offhandAmmoOk,
      isDualWield: !!action.modifiers?.dual_wield && !!action.offhand_weapon_inv_id,
    })
    if (fires === null) {
      emissions.push({ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
        username: character.name,
        message: "Munitions insuffisantes — rechargez d'abord",
      } })
      return { suspend: false, emissions }
    }

    // Arme effective de cette Résolution — celle qui tire réellement (COM29 : peut être la main
    // non-directrice si la directrice est celle qui est à sec). Toute la suite de la fonction
    // (portée, dégâts, mods, malus Bouclier, compétence, décompte munitions) est paramétrée sur cette
    // seule arme + son inv_id — jamais un usage direct de action.weapon_inv_id après ce point.
    const weapon              = fires === 'offhand' ? offhandWeapon : primaryWeapon
    const installedMods       = fires === 'offhand' ? offhandMods   : primaryMods
    const effectiveWeaponInvId = fires === 'offhand' ? action.offhand_weapon_inv_id : action.weapon_inv_id

    // Bouclier (docs/PLAN_BOUCLIER.md Lot B, §3.9) — RAW traite les armes de jet/trait (arcs,
    // arbalètes, lances) comme le contact pour un Bouclier : malus à l'attaquant, jamais de
    // protection localisée à la cible. Armes à feu (tout le reste) : l'inverse (comportement
    // historique inchangé, treatAsContact reste false).
    const isJetOuTrait = weapon.ref_category === 'Armes de jet' || weapon.ref_category === 'Arme de trait'
    const targetShield = await db('char_inventory_slots as cis')
      .join('char_inventory', 'char_inventory.id', 'cis.char_inventory_id')
      .join('ref_equipment', 'char_inventory.equipment_id', 'ref_equipment.id')
      .join('tokens', 'tokens.character_id', 'char_inventory.character_id')
      .where('tokens.id', action.target_token_id)
      .whereIn('cis.slot_code', ['MG', 'MD'])
      .where('ref_equipment.category', 'Bouclier')
      .select('ref_equipment.shield_atk_malus as malus')
      .first()
    const shieldAtkMalus = isJetOuTrait ? (targetShield?.malus ?? 0) : 0
    // DEF5 — doit être connu AVANT le jet d'attaque, même raison que shieldAtkMalus ci-dessus.
    const targetDefenseless = await isTargetDefenseless(campaignId, action.target_token_id, settings)
    const sansDefenseBonus = targetDefenseless ? 5 : 0

    const measurement = await measureBattlemapTokenDistance({
      sourceTokenId: action.token_id,
      targetTokenId: action.target_token_id,
    })
    const range = measurement.status === 'ok'
      ? resolveWeaponRangeBand(measurement.distanceM, weapon.ref_range)
      : { status: measurement.status, band: null }
    if (range.status !== 'ok') {
      emissions.push({ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
        username: character.name,
        message: range.status === 'out-of-range'
          ? `Tir impossible — cible hors de portée (${measurement.distanceM.toFixed(1)} m)`
          : 'Tir impossible — portée ou position incompatible avec le moteur de monde',
      } })
      return { suspend: false, emissions }
    }
    const authoritativeRangeBand = range.band

    const userRow = character.user_id
      ? await db('users').where({ id: character.user_id }).select('color', 'username').first()
      : null
    const tireurColor    = userRow?.color    ?? '#c86030'
    const tireurUsername = userRow?.username ?? character.name ?? 'Inconnu'

    let skillTotal = 0, effectiveMalus = 0, skillMastery = 0

    // Munitions (COM25) et dual-wield (COM29) déjà résolus plus haut, avant sélection de l'arme
    // effective — `settings` (options de campagne) fetché à ce moment-là, réutilisé ici pour
    // l'encombrement et plus bas pour le décompte munitions PNJ (un seul fetch, jamais trois).
    // skillAssoc ne dépend d'aucune fiche (juste de l'arme déjà résolue) — calculé avant le contexte
    // de Test, pas gardé derrière un fetch `char_sheet` inline comme avant ce chantier
    // (PLAN_COMBATANT_CONTEXT.md Lot G) : ce garde bloquait un pilote d'exo-armure (l'exo est un
    // personnage séparé du pilote, sans char_sheet propre, MANUEL_EXOARMURE.md §3.1).
    const skillAssoc = await db('ref_equipment_skill_assoc').where({ item_id: weapon.equipment_id }).first()

    // PLAN_COMBATANT_CONTEXT.md Lot D/G — point de couture unique pour le contexte de Test du
    // tireur, y compris la branche exo (pilote + EXF). skillAssoc peut être absent (arme du catalogue
    // sans compétence associée — un vrai trou de catalogue, pas seulement une garde défensive) :
    // chaîne vide plutôt que null/undefined pour forcer le palier complet — effectiveMalus/for_na
    // restent nécessaires même sans Compétence identifiée, alors que null routerait vers le palier NA
    // seul (§3.3 du plan, pensé pour les cibles passives #4/#5/#7 qui ne testent jamais rien, pas pour
    // un tireur actif dont seule la Compétence est inconnue).
    const ctxTireur = await resolveCombatantTestContext(db, character, skillAssoc?.skill_id ?? '')
    if (ctxTireur) {
      // WNDMORT — défense en profondeur, même raison que resolveMeleeAction (garde principal à la
      // Déclaration, ceci couvre seulement le cas rare d'un tireur mortellement blessé entre sa
      // Déclaration et sa Résolution). ctxTireur.sheetId : celle du pilote pour un tireur exo — une
      // blessure mortelle du pilote doit bloquer le Test de l'armure, §0.2 PLAN_COMBATANT_CONTEXT.md.
      const woundsTireur = await db('character_wounds').where({ char_sheet_id: ctxTireur.sheetId })
      if (isTestBlockingWound(woundsTireur)) {
        emissions.push({ to: 'room', event: WS.COMBAT_DECLARE_ERROR, data: {
          username: character.name, message: 'Blessure mortelle — aucune action de Test possible',
        } })
        return { suspend: false, emissions }
      }

      skillTotal = ctxTireur.skillTotal
      skillMastery = ctxTireur.mastery
      effectiveMalus = ctxTireur.effectiveMalus
    }

    const porteeModComp    = PORTEE_MOD_COMP[authoritativeRangeBand]?.mod ?? 0
    const situationModComp = sumRangedSituationMods(confirmedModifiers.situation ?? [])
    const tailleModComp    = TAILLE_MODS[confirmedModifiers.taille]?.mod ?? 0
    const isRushedMod      = rosterTireur?.state_vitesse === 'rushed' ? -5 : 0
    // fire_mode_bonus_comp stocké à la Déclaration inclut déjà le bonus deux armes (client :
    // variant.bonusComp + dualWieldBonusComp) — si le tir a dégradé en tir simple (COM29,
    // dualWieldApplied=false), on le retire ici plutôt que de recalculer le bonus de base depuis
    // zéro, seule la portion "deux armes" doit disparaître.
    const storedDualWieldComp = action.modifiers?.dual_wield_bonus_comp ?? 0
    const dualWieldComp    = dualWieldApplied ? storedDualWieldComp : 0
    const fireModeComp     = (action.fire_mode_bonus_comp ?? 0) - (dualWieldApplied ? 0 : storedDualWieldComp)
    // Lunette de visée (docs/PLAN_MODING_PHASEB.md Groupe 2) — le bonus stocké à la Déclaration
    // (Phase 1, portee alors inconnue) est clampé ici selon la portée désormais confirmée
    // (Phase 2 Résolution). Réutilise installedMods déjà fetché pour Groupe 1 (même arme).
    const lunetteNiveau    = getLunetteNiveau(installedMods)
    const aimBonusComp     = getEffectiveAimBonus(action.aim_bonus_comp ?? 0, { lunetteNiveau, portee: authoritativeRangeBand })
    const { total: weaponModComp, breakdown: weaponModBreakdown } = calcWeaponModBonus(installedMods)
    // Viser une Localisation précise (LdB p.229-230, COM9, docs/PLAN_TIRVISE v2.md) — annoncé en
    // Phase 1 (action.aimed_location), malus appliqué ici comme Tir visé l'est pour son bonus.
    const aimedLocationKey   = action.aimed_location ?? null
    const aimedLocationMalus = AIMED_LOCATION_MALUS[aimedLocationKey] ?? 0
    // Tir Multi (docs/PLAN_TIRMULTI.md) — malus « Attaques multiples » (LdB p.218), fonction partagée
    // avec le CaC (computeMultiAttackMalus). Recalculé sur les sœurs vivantes à CET instant, pas figé
    // à la déclaration — même principe que le CaC.
    const { malus: multiAttackMalus } = await computeMultiAttackMalus(action.id)

    const coverageModifier   = options.coverageModifier ?? 0
    const { total: rollAttaque, rolls: attackRolls, seed: attackSeed } = await parseDice('1d20')
    // Seuil + breakdown — noyau pur (PLAN_RW_SYSCOMBAT.md Lot 1, clos après session de jeu shadow
    // sans écart), miroir du bloc CaC de resolveMeleeAction. La coquille assemble la liste ordonnée
    // des contributions ; le noyau somme, filtre les zéros et assemble le breakdown. Condition
    // agrégée weaponModComp !== 0 : masquer les mods d'arme en bloc quand leur total est nul est une
    // décision d'assemblage coquille, pas un filtre du noyau (RV2, PLAN_RW_SYSCOMBAT.md §7).
    // Ajouter un modificateur Tir = ajouter une entrée ici, jamais toucher au noyau.
    const assaultOutcome0 = computeAttackRoll({
      skillLabel: 'Compétence', skillTotal, totalLabel: 'Seuil', rollAttaque,
      contributions: [
        { label: PORTEE_LABELS[authoritativeRangeBand] ?? authoritativeRangeBand, value: porteeModComp, type: porteeModComp > 0 ? 'bonus' : 'malus' },
        { label: `Mode de tir (×${action.bullet_count ?? 1})`, value: fireModeComp - dualWieldComp, type: 'bonus' },
        { label: 'Deux armes', value: dualWieldComp, type: 'bonus' },
        { label: 'Tir visé', value: aimBonusComp, type: 'bonus' },
        { label: `Visée ${LOCATION_LABELS[aimedLocationKey] ?? aimedLocationKey}`, value: aimedLocationMalus, type: 'malus' },
        { label: 'Attaque multiple', value: multiAttackMalus, type: 'malus' },
        { label: 'Bouclier adverse', value: shieldAtkMalus, type: 'malus' },
        { label: 'Cible sans défense', value: sansDefenseBonus, type: 'bonus' },
        ...(weaponModComp !== 0 ? weaponModBreakdown.map(b => ({ label: b.name, value: b.value, type: 'bonus' })) : []),
        ...((confirmedModifiers.situation ?? []).map(k => {
          const v = RANGED_SITUATION_MODS[k]?.mod ?? 0
          return { label: SITUATION_LABELS[k] ?? k, value: v, type: v > 0 ? 'bonus' : 'malus' }
        })),
        { label: TAILLE_LABELS[confirmedModifiers.taille] ?? confirmedModifiers.taille, value: tailleModComp, type: tailleModComp > 0 ? 'bonus' : 'malus' },
        { label: 'Précipitation', value: isRushedMod, type: 'malus' },
        { label: 'Malus santé / encombrement', value: effectiveMalus, type: 'malus' },
        { label: 'Couverture cible', value: coverageModifier, type: 'malus' },
      ],
    })
    // Réussite critique (p.204, Lot 2) — même geste que le CaC (resolveMeleeAction), appliqué avant
    // le reroll d'Échec critique. Pas d'opposition en Tir (contrairement au CaC) : rien à threader en
    // aval, mr/isSuccess servent directement ici pour les dégâts.
    const assaultOutcomeCrit = applyCriticalSuccessBonus(assaultOutcome0, getCriticalSuccessBonus({ masteryLevel: skillMastery }))
    const { seuil: chancesDeReussite, breakdown, isSuccess, mr } = assaultOutcomeCrit
    const assaultOutcome = await resolveCriticalFailReroll(assaultOutcomeCrit)
    console.log(`[WS] assault — roll:${rollAttaque} Seuil:${chancesDeReussite} → ${isSuccess ? 'TOUCHE' : 'RATÉ'} MR:${mr}`)
    emissions.push({ to: 'room', event: WS.DICE_RESULT, data: {
      userId:            character.user_id,
      username:          tireurUsername,
      color:             tireurColor,
      formula:           '1d20',
      rolls:             attackRolls,
      total:             rollAttaque,
      isCriticalSuccess: assaultOutcome.isCriticalSuccess,
      isCriticalFail:    assaultOutcome.isCriticalFail,
      catastropheRisk:   assaultOutcome.catastropheRisk,
      seed:              attackSeed,
      timestamp:         new Date().toISOString(),
      skillLabel:        'Jet pour toucher (distance)',
      mechanicalTotal:   skillTotal,
      diffLabel:         chancesDeReussite - skillTotal >= 0 ? `+${chancesDeReussite - skillTotal}` : `${chancesDeReussite - skillTotal}`,
      chancesDeReussite,
      isSuccess,
      mr,
      breakdown,
    } })
    // Catastrophe automatique (docs/PLANS/PLAN_CATASTROPHE_RISK.md Lot 1).
    await maybeTriggerCatastrophe(io, campaignId, action.token_id, assaultOutcome.catastropheRisk, {
      site: 'assault', actorTokenId: action.token_id, targetTokenId: action.target_token_id,
    })

    // Tir à deux armes dégradé (COM29) — notice système privée, uniquement pour le propriétaire du
    // personnage (PJ : le joueur ; PNJ : pas de user_id, fallback vers le socket courant = le MJ qui
    // résout ce tour). Jamais de blocage (fires ne peut pas être null ici, déjà écarté plus haut) —
    // seulement une explication, cohérente avec le reste du fichier ("dès qu'un truc marche pas, le
    // système doit dire pourquoi"). i18n : clé résolue côté client (useSessionSocket.js), jamais de
    // texte figé envoyé par le serveur. Événement dédié (pas CHAT_MESSAGE) : ce n'est pas un message
    // de chat persistant, juste un retour éphémère à ce joueur (docs/PLANS/PLAN_CHAT.md).
    if (degraded) {
      emissions.push({
        to: 'user', userId: character.user_id ?? null, fallback: 'socket',
        event: WS.COMBAT_SYSTEM_NOTICE,
        data: {
          i18nKey: degraded === 'offhand' ? 'session.dualWieldAmmoOutOffhand' : 'session.dualWieldAmmoOutPrimary',
          timestamp: new Date().toISOString(),
        },
      })
    }

    // ── Décompte munitions ──────────────────────────────────────────────────────
    // Balles consommées quel que soit le résultat (touché ou raté), uniquement pour la ou les armes
    // qui ont effectivement tiré (COM29 : les deux en dual-wield complet, une seule sinon).
    // Skip par arme si ammo_remaining = NULL (arme non initialisée = pas encore suivie).
    // Skip pour les PNJ si pnj_unlimited_ammo = true (option campagne).
    {
      const isPnj = character.type === 'pnj'
      const skipDecrement = isPnj && settings.pnj_unlimited_ammo
      if (!skipDecrement) {
        const bulletsFired = action.bullet_count ?? 1
        const firedWeapons = fires === 'both'
          ? [[action.weapon_inv_id, primaryWeapon], [action.offhand_weapon_inv_id, offhandWeapon]]
          : fires === 'offhand'
            ? [[action.offhand_weapon_inv_id, offhandWeapon]]
            : [[action.weapon_inv_id, primaryWeapon]]
        for (const [invId, row] of firedWeapons) {
          if (row.ammo_remaining !== null && row.ammo_remaining !== undefined) {
            const newRemaining = Math.max(0, row.ammo_remaining - bulletsFired)
            await db('char_inventory').where({ id: invId }).update({ ammo_remaining: newRemaining })
          }
        }
      }
    }

    if (isSuccess) {
      // Fetch stats de la cible (commun PJ et PNJ)
      const cibleToken = await db('tokens').where({ id: action.target_token_id }).first()
      let char_sheet_id_cible = null
      let for_na_cible = 8, con_na_cible = 8, vol_na_cible = 8
      let cibleCharacter = null

      if (cibleToken?.character_id) {
        cibleCharacter = await db('characters').where({ id: cibleToken.character_id }).first()
        if (cibleCharacter) {
          const sheetCible = await db('char_sheet').where({ character_id: cibleCharacter.id }).first()
          if (sheetCible) {
            char_sheet_id_cible = sheetCible.id
            // Attributs NA cible avec genotype + mutations — server/src/lib/damageService.js:fetchCibleNA
            // (docs/PLAN_FATIGUE_DOMMAGES.md §9 point structurel 2, complété le 2026-07-30 : 2ᵉ copie
            // trouvée ici en plus de resolveDroneAssaultAction, dédupliquée à son tour).
            const naCible = await damageService.fetchCibleNA(db, cibleCharacter.id, sheetCible.id)
            for_na_cible = naCible.for_na
            con_na_cible = naCible.con_na
            vol_na_cible = naCible.vol_na
          }
        }
      }

      const targetName = cibleCharacter?.name ?? cibleToken?.label ?? 'Cible'

      // Contexte transporté aux fonctions-feuilles (PLAN_RW_SYSCOMBAT.md §2.6.c) — objet interne à ce
      // refactor, aucun lecteur externe (à distinguer du payload construit dans resolveAssaultHitPj
      // pour armAwaitingDamage, celui-là bien relu par nom dans confirmDamage, §2.6.c).
      const ctx = {
        action, character, tireurUsername, tireurColor, weapon, effectiveWeaponInvId,
        authoritativeRangeBand, aimedLocationKey, rollAttaque, chancesDeReussite, mr, isJetOuTrait,
        cibleToken, cibleCharacter, char_sheet_id_cible, for_na_cible, con_na_cible, vol_na_cible,
        targetName,
      }

      if (character.type === 'pj') {
        return await resolveAssaultHitPj(io, campaignId, ctx, emissions)
      }

      // PNJ — calcul complet immédiat, invisible aux joueurs. Dégâts bruts identiques que la cible
      // soit un drone ou non (`[VÉRIFIÉ]`, PLAN_RW_SYSCOMBAT.md §2.6.a) — calculés une seule fois ici,
      // avant le guard-clause vers la fonction-feuille adaptée (§2.6.b, aucune fonction-type qui
      // re-branche elle-même, même précédent que resolveMeleeDefenseDrone/Pnj au Lot 2).
      // Munition chargée (Chantier 11 Étape 2 Lot A, docs/PLAN_ARMES_DSL.md) — point de résolution
      // unique, repli automatique sur damage_h brut si aucune munition/DSL malformé. Repli
      // supplémentaire ici si getEffectiveWeaponDamage renvoie null (arme désequipée entre le fetch
      // ci-dessus et cet appel — fenêtre quasi nulle en pratique côté PNJ mais gardée par cohérence
      // avec la branche PJ différée où la fenêtre est réelle) : jamais un tour de combat silencieux.
      const effectiveDamage = await damageService.getEffectiveWeaponDamage(db, effectiveWeaponInvId, { rangeBand: authoritativeRangeBand })
      // CHOC1 : repli sur weapon.ref_damage_h (fetch initial) si l'arme a disparu entre-temps — peut
      // lui-même être vide (arme Choc pur) : ne jamais appeler parseDice sur une chaîne vide.
      const rawDice = effectiveDamage
        ? effectiveDamage.total
        : weapon.ref_damage_h
          ? (await parseDice(weapon.ref_damage_h.replace(/\s/g, ''))).total
          : 0
      // PLAN_RW_SYSCOMBAT.md §2.10 (Lot 8a) — noyau pur, même formule que confirmDamage (branche assault).
      const degautsBruts = computeAssaultRawDamage({ rawDice, mr, portee: authoritativeRangeBand, fireModeBonusDmg: action.fire_mode_bonus_dmg })

      if (cibleCharacter?.type === 'drone') {
        return await resolveAssaultHitPnjDrone(io, campaignId, { ...ctx, degautsBruts }, emissions)
      }
      return await resolveAssaultHitPnjNormal(io, campaignId, { ...ctx, degautsBruts, effectiveDamage }, emissions)
    } else if (character.type === 'pj') {
      emissions.push({ to: 'socket', event: WS.COMBAT_ATTACK_PLAYER_RESULT, data: {
        hit: false,
        roll: rollAttaque,
        seuil: chancesDeReussite,
        tireurTokenId: action.token_id,
        cibleTokenId: action.target_token_id,
      } })
    } else {
      emissions.push({ to: 'room', event: WS.COMBAT_ATTACK_RESULT, data: {
        tireurId:         action.token_id,
        cibleId:          action.target_token_id,
        isSuccess:        false,
        isPnj:            true,
        roll:             rollAttaque,
        chancesDeReussite,
        localisation:     null,
        degautsBruts:     null,
        degatsNets:       null,
        severity:         null,
        is_lethal:        false,
        shockResult:      null,
      } })
    }
    return { suspend: false, emissions }
  } catch (err) {
    console.error('[WS] resolveAssaultAction error:', err.message)
    return { suspend: false, emissions: [] }
  }
}

// ── Branches "touche" de resolveAssaultAction (PLAN_RW_SYSCOMBAT.md §2.6, Lot 4) ──────────────────
// Extraites de resolveAssaultAction — ctx assemblé par la coquille (§2.6.c). Contrat identique aux
// branches défenseur du Lot 2 : { suspend, emissions }, aucun try/catch propre (la propagation
// d'erreur remonte au catch unique de la coquille appelante, §2.6.d).

async function resolveAssaultHitPj(io, campaignId, ctx, emissions) {
  const {
    action, character, tireurUsername, tireurColor, weapon, effectiveWeaponInvId,
    authoritativeRangeBand, aimedLocationKey, rollAttaque, chancesDeReussite, mr, isJetOuTrait,
    cibleToken, cibleCharacter, char_sheet_id_cible, for_na_cible, con_na_cible, vol_na_cible, targetName,
  } = ctx
  // PJ — stocker paramètres bruts, le joueur lance les dés via CombatDamageWindow
  emissions.push({ to: 'socket', event: WS.COMBAT_ATTACK_PLAYER_RESULT, data: {
    hit: true,
    roll: rollAttaque,
    seuil: chancesDeReussite,
    tireurTokenId: action.token_id,
    cibleTokenId: action.target_token_id,
  } })
  // Plusieurs entrées peuvent désormais coexister pour le même tireur (attaques multiples,
  // docs/PLAN_COMBAT_ACTION_QUEUE.md §3) — consommées FIFO par COMBAT_DAMAGE_CONFIRM ; le prompt
  // n'est émis ici que si aucune autre entrée n'attendait déjà.
  // weaponInvId : résolution du dégât effectif (munition chargée) différée jusqu'au jet réel
  // côté COMBAT_DAMAGE_CONFIRM — jamais précalculée ici (Chantier 11 Étape 2 Lot A,
  // docs/PLAN_ARMES_DSL.md : un ADD munition peut nécessiter 2 jets de dés différents, parseDice
  // n'accepte qu'un seul type de dé par formule). Ce payload est relu par nom dans confirmDamage —
  // aucune clé à renommer ni à ajouter ici (PLAN_RW_SYSCOMBAT.md §2.6.c).
  const pendingDamageCount = await armAwaitingDamage(io, campaignId, action.token_id, {
    campaignId,
    targetTokenId: action.target_token_id,
    characterIdCible: cibleToken?.character_id ?? null,
    cibleType: cibleCharacter?.type ?? null,
    char_sheet_id_cible,
    mr,
    portee: authoritativeRangeBand,
    aimedLocation: aimedLocationKey,
    fire_mode_bonus_dmg: action.fire_mode_bonus_dmg ?? 0,
    formula: weapon.ref_damage_h,
    weaponInvId: effectiveWeaponInvId,
    for_na_cible,
    con_na_cible,
    vol_na_cible,
    tireurUsername,
    tireurColor,
    userId: character.user_id,
    targetName,
    treatAsContact: isJetOuTrait,
  })
  if (pendingDamageCount === 1) {
    // Aperçu formule effective (munition chargée) — Chantier 11 Étape 2 Lot A, correctif
    // affichage : montrait auparavant weapon.ref_damage_h brut, incohérent avec le jet réel
    // effectué à la confirmation dès qu'une munition modifie les dégâts.
    const formulaPreview = await damageService.getEffectiveWeaponFormulaPreview(db, effectiveWeaponInvId, { rangeBand: authoritativeRangeBand })
    emissions.push({ to: 'socket', event: WS.COMBAT_DAMAGE_PROMPT, data: {
      tokenId: action.token_id,
      formula: formulaPreview ?? weapon.ref_damage_h,
      targetName,
    } })
  }
  // Bug réel trouvé en testant Tir Multi (Saar, 2026-07-19) : AWAITING_DAMAGE est un sous-état
  // FSM bloquant (combatFSM.js, garde exclusive sur COMBAT_DAMAGE_CONFIRM), au même titre que
  // AWAITING_DEFENSE côté CaC (resolveMeleeDefensePj, `suspend:true`). Cette branche tombait
  // auparavant dans le `return { suspend: false, emissions }` générique de fin de fonction —
  // l'appelant (`socketCombatResolution.js`) appelait alors `advanceTimeline` juste après, qui
  // écrase sub_phase en 'SLOT_ACTIVE' dès qu'un autre combattant a un pas suivant dans l'échelle,
  // rendant `COMBAT_DAMAGE_CONFIRM` définitivement rejeté par le garde FSM (observé :
  // `[FSM] guard bloqué : RESOLUTION|SLOT_ACTIVE + COMBAT_DAMAGE_CONFIRM`). Corrigé en alignant
  // sur le même patron que le CaC : suspendre explicitement ici, jamais laisser le comportement
  // par défaut trancher pour une branche qui vient de poser un sous-état bloquant.
  return { suspend: true, emissions }
}

async function resolveAssaultHitPnjDrone(io, campaignId, ctx, emissions) {
  const { action, cibleCharacter, degautsBruts, rollAttaque, chancesDeReussite } = ctx
  // Branche drone — cible sans char_sheet, résistance = blindage + intégrité×2 (§7.6). Si aucune
  // ligne drone_sheet n'existe (edge case pré-existant, PLAN_RW_SYSCOMBAT.md §2.6.e) : aucune
  // émission de résultat, comportement à préserver identique, pas un bug de ce Lot.
  const droneSheet = await db('drone_sheet').where({ character_id: cibleCharacter.id }).first()
  if (droneSheet) {
    const { etqDrone, rdDrone, degatsNets: degatsNetsDrone } = calcDroneDegatsNets(droneSheet, degautsBruts)
    await resolveDroneIntegrityLoss(io, campaignId, cibleCharacter.id, action.target_token_id, droneSheet, degatsNetsDrone)
    emissions.push({ to: 'room', event: WS.COMBAT_ATTACK_RESULT, data: {
      tireurId: action.token_id, cibleId: action.target_token_id,
      localisation: null,
      degautsBruts, degatsNets: degatsNetsDrone,
      severity: null, is_lethal: false, isSuccess: true,
      isPnj: true, roll: rollAttaque, chancesDeReussite, shockResult: null,
    } })
  }
  return { suspend: false, emissions }
}

async function resolveAssaultHitPnjNormal(io, campaignId, ctx, emissions) {
  const {
    action, character, tireurUsername, tireurColor, aimedLocationKey, isJetOuTrait,
    cibleToken, cibleCharacter, char_sheet_id_cible, for_na_cible, con_na_cible, vol_na_cible,
    degautsBruts, effectiveDamage, rollAttaque, chancesDeReussite,
  } = ctx

  if (cibleCharacter?.type === 'exo') {
    // PLAN_EXOARMURE.md §11.4 (catégorie A, site 5) — Tir immédiat, tireur PNJ ou exo, cible exo.
    const exoResult = await exoAvarieService.resolveExoDamage(io, db, campaignId, { characterId: cibleToken.character_id, degautsBruts })
    if (exoResult) {
      emissions.push({ to: 'room', event: WS.COMBAT_ATTACK_RESULT, data: {
        tireurId: action.token_id, cibleId: action.target_token_id,
        localisation: null, degautsBruts, degatsNets: exoResult.degatsNets,
        severity: exoResult.severity, is_lethal: false, isSuccess: true,
        isPnj: true, roll: rollAttaque, chancesDeReussite, shockResult: null,
      } })
    }
    return { suspend: false, emissions }
  }

  const hitResult = await damageService.resolveTargetHit(io, db, campaignId, {
    degautsBruts,
    characterIdCible: cibleToken.character_id,
    cibleType:        cibleCharacter?.type ?? null,
    char_sheet_id_cible,
    for_na_cible, con_na_cible, vol_na_cible,
    chocDsl: effectiveDamage ? effectiveDamage.choc : null,
    ammoFx: effectiveDamage ? (effectiveDamage.tags?.FX ?? null) : null,
    forcedSlotCode: aimedLocationKey ? LOCATION_TO_SLOT[aimedLocationKey] : null,
    treatAsContact: isJetOuTrait,
  })
  if (hitResult === null) return { suspend: false, emissions }
  const { localisation, degatsNets, is_lethal, finalSeverity, shockResult } = hitResult

  if (shockResult) {
    statusService.emitShockDiceResult(io, campaignId, shockResult, character.user_id, tireurUsername, tireurColor)
  }

  emissions.push({ to: 'room', event: WS.COMBAT_ATTACK_RESULT, data: {
    tireurId:    action.token_id,
    cibleId:     action.target_token_id,
    localisation,
    degautsBruts,
    degatsNets,
    severity:    finalSeverity,
    is_lethal,
    isSuccess: true,
    isPnj:       true,
    roll:        rollAttaque,
    chancesDeReussite,
    shockResult,
  } })
  if (shockResult?.outcome && shockResult.outcome !== 'ok') {
    statusService.applyStun(io, db, campaignId, {
      targetTokenId: action.target_token_id, outcome: shockResult.outcome,
      userId: character.user_id, username: tireurUsername, color: tireurColor,
    }).catch(err => console.error('[WS] applyStun error:', err.message))
  }
  return { suspend: false, emissions }
}

// ─── Drones — fonctions de résolution ────────────────────────────────────────

// Décrémente l'intégrité du drone après un hit, met à jour damages JSONB, broadcast.
// tokenId requis : drone_sheet n'a pas de FK token_id (PD8).
export async function resolveDroneIntegrityLoss(io, campaignId, characterId, tokenId, droneSheet, degatsNets) {
  const damages = { ...droneSheet.damages }  // PD4 — copier avant mutation

  let severity = null
  if      (degatsNets >= 30) severity = 'detruit'
  else if (degatsNets >= 25) severity = 'mortelle'
  else if (degatsNets >= 20) severity = 'critique'
  else if (degatsNets >= 15) severity = 'grave'
  else if (degatsNets >= 10) severity = 'moyenne'
  else if (degatsNets >=  5) severity = 'legere'

  if (severity && severity !== 'detruit' && Array.isArray(damages[severity])) {
    const idx = damages[severity].indexOf(false)
    if (idx !== -1) {
      damages[severity] = [...damages[severity]]
      damages[severity][idx] = true
    }
    // B4 : si idx === -1 (toutes cases pleines pour ce niveau), décrémentation quand même — sprint futur
  }

  // LdB p.82-88 : 1 hit = 1 case = integrite -= 1. 'detruit' → integrite = 0 immédiatement.
  const newIntegrite = severity === 'detruit' ? 0 : Math.max(0, droneSheet.integrite_actuelle - 1)
  const detruit = newIntegrite <= 0

  if (detruit) damages.detruit = true

  await db('drone_sheet').where({ character_id: characterId }).update({
    damages: JSON.stringify(damages),
    integrite_actuelle: newIntegrite,
  })

  if (detruit) {
    await db('combat_roster').where({ campaign_id: campaignId, token_id: tokenId }).delete()
  }

  io.to(campaignId).emit(WS.DRONE_INTEGRITY_UPDATED, {
    characterId,
    integrite_actuelle: newIntegrite,
    damages,
    detruit,
  })
}
