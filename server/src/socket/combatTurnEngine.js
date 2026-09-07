// server/src/socket/combatTurnEngine.js
//
// Moteur du CYCLE DE TOUR de combat : timers d'annonce, transition ANNONCE→RÉSOLUTION, construction et
// parcours de l'échelle de phases (`combat_timeline_entries`), tour obligatoire des retardataires,
// clôture de Tour. Extrait de `socketCombatHelpers.js` (docs/PLANS/PLAN_KIWI_BASCULE… → PLAN_GRENADES.md
// §10.3 « moteur de tour » M1) — la god-file mêlait ce cycle aux résolveurs CaC/Tir/dégâts.
//
// Module FEUILLE : les résolveurs (`socketCombatHelpers.js`) et la couche socket
// (`socketCombatResolution.js` / `socketCombatAnnouncement.js` / `socketCombatState.js` / `index.js`)
// importent d'ici ; ce fichier n'importe RIEN d'eux (vérifié — aucun appel de résolveur, aucun cycle
// au chargement des modules). `forceAdvanceResolution` reste côté résolveurs : il appelle
// `confirmMeleeDefense`/`confirmDamage`.
//
// M1 = déplacement PUR, zéro changement de logique — corps identiques byte-à-byte à l'original
// (`git show` faisant foi). Déviations, sans effet runtime : `export` ajouté à des fonctions jadis
// internes à la god-file — 3 pour un appel depuis du code qui y reste (`computeMultiAttackMalus`,
// `pickNextObligatoryDelayed`, `broadcastCurrentSubPhase`), 3 pour la couverture de test M2a
// (`computeSeriesPositions`, `computeActNowPosition`, `buildTimelineEntries`).
// Les évolutions inter-tours (`resolve_on_turn`, report d'Initiative ≤ 0) = M2b/M3.
//
// `crypto` : global Node (Web Crypto), utilisé sans import — exactement comme dans la god-file
// d'origine (match de comportement, pas un ajout).

import { WS } from '../../../shared/events.js'
import db from '../db/knex.js'
import { setFSMSubPhase } from '../lib/combatFSM.js'
import { buildBroadcastRoster } from '../lib/combatRosterBroadcast.js'
import { resolveModHooks, getAllCombatMods } from '../services/weaponModService.js'
import { resolveEnvironmentalHazardTicks, getAllHazardCodes } from '../lib/environmentalHazardService.js'
import * as statusService from '../lib/statusService.js'

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

    await buildTimelineEntries(io, campaignId, currentTurn, pendingActions, announcedRoster)

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
export function computeSeriesPositions(basePosition, count) {
  return Array.from({ length: count }, (_, idx) => basePosition - idx * 500)
}

// Malus « Attaques multiples » (LdB p.218) : −5 pour 2 attaques, −7 pour 3+. Partagé entre CaC
// (resolveMeleeAction) et Tir Multi (resolveAssaultAction, docs/PLAN_TIRMULTI.md) — même RAW, même
// mécanique d'échelle de phases, une seule implémentation. Recalculé sur le nombre réel de sœurs non
// perdues à CET instant (pas figé à la déclaration) : une sœur déjà 'lost' (décalage au-delà de la
// phase 1, cible invalide, étourdissement) ou 'skipped' ne compte plus.
export async function computeMultiAttackMalus(actionId) {
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
export async function buildTimelineEntries(io, campaignId, turnNumber, pendingActions, roster) {
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

  // Alerte chat Initiative insuffisante (retour Saar, 2026-08-27 — testé pour la première fois sur
  // une exo-armure, mais générique à tout personnage, comme le reste de cette fonction) : une entrée
  // 'lost' ci-dessus est silencieuse pour tout le monde tant qu'elle n'est jamais retentée
  // (pickNextTimelineStep ne lit que 'scheduled') — sans ce message, l'action perdue est
  // indiscernable d'un bug côté client. Un seul message par token (pas par entrée) même si sa série
  // entière (Tir Multi/CaC multiple) est perdue d'un coup — même position de base pour toute la
  // série, donc soit toutes perdues ensemble, soit aucune. COMBAT_SYSTEM_NOTICE (déjà utilisé pour
  // dualWieldAmmoOutOffhand/Primary, session.json) — pas CHAT_MESSAGE, pas de texte figé.
  const lostTokenIds = [...new Set(rows.filter(r => r.status === 'lost').map(r => r.token_id))]
  if (lostTokenIds.length > 0) {
    const lostTokens = await db('tokens').whereIn('id', lostTokenIds).select('id', 'label')
    const timestamp = new Date().toISOString()
    for (const { id, label } of lostTokens) {
      io.to(campaignId).emit(WS.COMBAT_SYSTEM_NOTICE, {
        i18nKey: 'session.initiativeLost',
        params: { label: label ?? '?' },
        timestamp,
      })
    }
  }

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
export async function pickNextObligatoryDelayed(campaignId, turnNumber) {
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
export function computeActNowPosition(referencePosition, initiative) {
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
export async function broadcastCurrentSubPhase(io, campaignId) {
  const state = await db('combat_state').where({ campaign_id: campaignId }).first()
  if (!state) return
  const turnNumber = state.current_turn
  const step = await pickNextTimelineStep(campaignId, turnNumber)
  await broadcastTimelineState(io, campaignId, turnNumber, step)
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
