import {
  resolveWoundInsertion, resolveWoundImprovement, computeAvailableSeverityReductions, affordableReductions, hasSeverityRoom,
  isShockTestRequired, getWorstWoundSeverity, WoundLineFullError,
} from './woundUtils.js'
import { initializeWoundHealingEcheance } from './woundEvolutionService.js'
import { emitTokenStatusUpdated, reconcileWoundDeath, announceWoundDeath } from './statusService.js'
// Import DIRECT depuis exoPilotService.js, jamais combatantContextService.js (qui importe
// damageService.js -> woundService.js : un import inverse ici boucherait le cycle).
import { resolveChanceRecipientCharacterId } from './exoPilotService.js'
import { persistChanceChoice, publishChanceChoice, resolveChanceChoice, SITE_HANDLERS } from './chanceCatastropheChoiceService.js'
import { spendChancePoints, ChanceInsufficientError } from '../services/chanceService.js'
import { emitSystemNotice } from './systemNotice.js'
import { computeCharacterBaseIni } from './reactionService.js'
import { calcWoundPenalty } from './charStats.js'
import { buildBroadcastRoster } from './combatRosterBroadcast.js'
import { WS } from '../../../shared/events.js'
import { isFatalWound, isSuddenDeathLocation } from '../../../shared/woundConstants.js'
import db from '../db/knex.js'

// RAW (REGLE_CHANCE.md:112-131) : la réduction de gravité par Chance ne s'ouvre qu'à partir d'une
// Blessure grave — jamais légère/moyenne ; la 6ᵉ ligne (Mort subite / Membre détruit) s'y rachète (REGLE_CHANCE.md:121-123).
const CHANCE_ELIGIBLE_SEVERITIES = ['grave', 'critique', 'mortelle', 'mort_subite']

const NOTICE = 'combat:chance.notice.'

async function characterLabel(characterId) {
  const character = await db('characters').where({ id: characterId }).select('name').first()
  return character?.name ?? '?'
}

// openWoundReaction — décide si la blessure qui vient d'être écrite ouvre une RÉACTION de Chance et, si oui, la PERSISTE (la
// publication vient après la validation de la transaction). Appelée dans la transaction de la blessure (SOUS-transaction, voir
// applyWound) : la réaction naît atomiquement avec sa cause, et `reconcileWoundDeath` la voit.
//
// Retourne `{ pending, notice }` — `pending` : la ligne persistée (ou null), `notice` : la ligne de chat à poster si une
// décision de règle mérite d'être racontée sans réaction (Chat 2026-09-25 : chaque branche a sa ligne).
// Pas de réaction si :
//  - gravité non éligible (Légère, Moyenne) ;
//  - 6ᵉ ligne venue d'un DÉBORDEMENT (`promoted`) : jamais rachetable (décision Saar 2026-09-25, Mort et Membre détruit) ;
//  - aucun destinataire (drone, cadavre, exo sans pilote…) ;
//  - aucune réduction possible ou PAYABLE (RAW : il doit rester 3 points de Chance) — pas de carte inutile, pour AUCUNE
//    gravité. Pour une Mort, cette absence est racontée (la mort est posée tout de suite).
async function openWoundReaction(trx, { campaignId, charSheetId, characterId, insertion }) {
  const { wound, promoted } = insertion
  const none = { pending: null, notice: null }
  if (!CHANCE_ELIGIBLE_SEVERITIES.includes(wound.severity)) return none

  const fatal = isFatalWound(wound)
  const character = await trx('characters').where({ id: characterId }).first()
  const label = character?.name ?? '?'

  if (wound.severity === 'mort_subite' && promoted) {
    return { pending: null, notice: { i18nKey: `${NOTICE}overflowNoRescue`, params: { label } } }
  }

  const recipientCharacterId = character
    ? await resolveChanceRecipientCharacterId(trx, campaignId, characterId, character.type)
    : null
  if (!recipientCharacterId) return none

  const sheet = await trx('char_sheet').where({ id: charSheetId }).first()
  const possible = await computeAvailableSeverityReductions(trx, charSheetId, wound.location, wound.severity)
  const reductions = affordableReductions(possible, sheet?.chc)
  if (reductions.length === 0) {
    const noChance = fatal && possible.length > 0
    return { pending: null, notice: noChance ? { i18nKey: `${NOTICE}deathNoChance`, params: { label } } : null }
  }

  const testLabel = wound.severity === 'mort_subite'
    ? (fatal ? 'Éviter la mort' : `Éviter le Membre détruit (${wound.location})`)
    : `Réduire la gravité — Blessure ${wound.severity} (${wound.location})`
  const pending = await persistChanceChoice(trx, campaignId, recipientCharacterId, {
    // Libellé provisoire de la carte actuelle (remplacée par le composant de réaction, PLAN_CHANCE.md §8, lot 6c).
    testLabel,
    site: 'wound_severity',
    // chcAvailable — valeur de Chance au moment de l'ouverture (aucun store client ne porte `char_sheet.chc`).
    // fatal — la blessure tue (Mort en Tête/Corps) : `reconcileWoundDeath` la tranchera à la fermeture de la réaction.
    // severity/location/label — le RÉSUMÉ de la blessure affiché par le composant de réaction (maquette : gravité, localisation,
    // nom du blessé) ; le client compose les textes via t(), jamais un libellé ici.
    context: {
      woundId: wound.id, charSheetId, characterId, reductions, chcAvailable: sheet?.chc ?? null, fatal,
      severity: wound.severity, location: wound.location, label,
    },
    // Données structurées, jamais un libellé FR construit ici (règle i18n du projet : le serveur n'émet jamais de texte
    // utilisateur figé) — le client compose le texte via t() à partir de `degree`/`cost`/`targetSeverity`.
    options: reductions.map(r => ({ choice: `reduce_${r.degree}`, degree: r.degree, cost: r.cost, targetSeverity: r.targetSeverity })),
  })
  return { pending, notice: null }
}

// settleFatalWound — appelée à la FERMETURE d'une réaction sur une Mort, quelle qu'en soit l'issue : la mort est posée si une
// blessure mortelle subsiste sans réaction ouverte (`reconcileWoundDeath` porte la règle), sinon rien. Ne lève jamais : elle
// s'exécute dans un `finally`.
async function settleFatalWound(io, campaignId, { characterId, charSheetId }) {
  try {
    const change = await db.transaction(trx => reconcileWoundDeath(trx, campaignId, { characterId, charSheetId }))
    await announceWoundDeath(io, db, campaignId, characterId, change)
  } catch (err) {
    console.error('[woundService] settleFatalWound — mort non tranchée :', characterId, err.message)
  }
}

// Centralise l'insertion de blessure + broadcast WOUND_ADDED (6 call sites WS → 1).
// Retourne { finalSeverity, wound, promoted, shock_test_required, worst_wound_severity } — finalSeverity
// (post-promotion, P49) pour que le caller puisse appeler resolveShockTest, le reste pour les callers
// qui ont besoin de la blessure complète (ex. réponse HTTP d'une route d'ajout manuel).
// Retourne null si severity ou charSheetId absents, ou si AppError (ligne pleine : seule la 6ᵉ ligne peut l'être — attendu).
export async function applyWound(io, db, campaignId, {
  charSheetId,
  characterId,
  localisation,
  severity,
}) {
  if (!severity || !charSheetId) return null

  let result
  let deathChange = null
  let reaction = { pending: null, notice: null }
  try {
    result = await db.transaction(async (trx) => {
      const insertion = await resolveWoundInsertion(trx, charSheetId, localisation, severity)
      // Guérison/Infection (Lot 2, docs/PLAN_BLESSURES_GUERISON.md §5) — sur la blessure finale
      // (post-promotion) uniquement ; les échéances d'éventuelles cases supprimées par la cascade
      // de promotion se terminent d'elles-mêmes sans effet (woundId introuvable, voir
      // woundEvolutionService.js).
      await initializeWoundHealingEcheance(trx, { campaignId, characterId, wound: insertion.wound })
      // Réaction de Chance (PLAN_CHANCE.md §8) — persistée DANS la transaction de la blessure, pour que `reconcileWoundDeath`
      // (juste dessous) la voie et ne tue pas avant la décision du joueur. En SOUS-transaction (SAVEPOINT, vérifié Knex 3.3 /
      // PostgreSQL par une sonde : une panne SQL ou JS n'y défait que la sous-transaction) : cette fonctionnalité annexe ne
      // doit JAMAIS faire échouer la blessure elle-même — sans réaction, une Mort est simplement posée tout de suite.
      try {
        reaction = await trx.transaction(sp => openWoundReaction(sp, { campaignId, charSheetId, characterId, insertion }))
      } catch (err) {
        console.error('[woundService] applyWound — réaction de Chance non ouverte :', charSheetId, localisation, severity, err.message)
      }
      // Lot 2b — une blessure « Mort » (Tête/Corps) pose `dead` sur les tokens du personnage, dans la MÊME transaction
      // (conséquence persistante écrite avec sa cause) — sauf si sa réaction de Chance est ouverte (voir reconcileWoundDeath).
      // Annoncée plus bas, après la validation.
      if (isFatalWound(insertion.wound)) {
        deathChange = await reconcileWoundDeath(trx, campaignId, { characterId, charSheetId })
      }
      return insertion
    })
  } catch (err) {
    // « Ligne pleine » : seule la 6ᵉ ligne (une case) peut l'être — une localisation déjà au maximum (Mort/Membre
    // détruit) ne reçoit rien de plus (le cadavre continue de prendre des blessures AILLEURS). Fait attendu, pas un échec.
    if (err instanceof WoundLineFullError) {
      console.log(`[DBG] applyWound — rien de plus à écrire (${err.message}) : fiche ${charSheetId}, ${localisation}, ${severity}`)
    } else {
      console.error('[woundService] applyWound — insertion échouée :', charSheetId, localisation, severity, err.message)
    }
    return null
  }

  const finalSeverity = result.wound.severity  // P49 : post-promotion
  const worst_wound_severity = await getWorstWoundSeverity(db, charSheetId)
  const shock_test_required = isShockTestRequired(finalSeverity, result.wound.location)

  io.to(campaignId).emit(WS.WOUND_ADDED, {
    characterId,
    wound:    result.wound,
    promoted: result.promoted,
    shock_test_required,
    worst_wound_severity,
  })
  if (reaction.notice) emitSystemNotice(io, campaignId, reaction.notice.i18nKey, reaction.notice.params)
  if (reaction.pending) {
    try {
      publishChanceChoice(io, campaignId, reaction.pending)
    } catch (err) {
      // La réaction est écrite mais ne peut être annoncée (ni minuteur ni carte) : la fermer tout de suite comme un refus, pour
      // qu'une Mort soit tranchée plutôt que de rester suspendue sans issue.
      console.error('[woundService] applyWound — réaction de Chance non publiée, refus appliqué :', err.message)
      await resolveChanceChoice(io, campaignId, reaction.pending.id, { choice: null, resolvedByUserId: null })
        .catch(e => console.error('[woundService] applyWound — refus non appliqué :', e.message))
    }
  }
  if (deathChange) await announceWoundDeath(io, db, campaignId, characterId, deathChange)

  // INI2 (RAW REGLESYSCOMBAT.md:111 — les malus de blessure « affectent le niveau de Réaction du
  // personnage et donc son Initiative de base ») : recalcule base_ini pour tout token actif de ce
  // personnage dans un combat en cours — l'existence d'une ligne combat_roster suffit à détecter un
  // combat actif (COMBAT_END supprime la table entièrement, pas de flag séparé à vérifier). Seul
  // base_ini est retouché ici, jamais `initiative` en direct : une entrée combat_timeline_entries déjà
  // construite ce Tour encode phase_position = initiative × 100 — l'écraser à chaud désynchroniserait
  // une Résolution en cours. Le nouveau base_ini prend effet sur l'Initiative réelle au Tour suivant
  // via le reset déjà existant d'endTurn() (initiative: base_ini) — même latence que la récupération
  // après Surprise ratée (RAW : « au Tour suivant, il retrouve son score d'Initiative habituel »),
  // pas une improvisation locale. No-op silencieux hors combat (aucune ligne combat_roster trouvée).
  try {
    const activeTokenIds = await db('combat_roster as cr')
      .join('tokens as t', 't.id', 'cr.token_id')
      .where({ 'cr.campaign_id': campaignId, 't.character_id': characterId, 'cr.status': 'active' })
      .pluck('cr.token_id')
    if (activeTokenIds.length > 0) {
      const cleanBaseIni = await computeCharacterBaseIni(db, characterId)
      if (cleanBaseIni != null) {
        const wounds = await db('character_wounds').where({ char_sheet_id: charSheetId })
        const newBaseIni = cleanBaseIni + calcWoundPenalty(wounds) // calcWoundPenalty ≤ 0
        await db('combat_roster')
          .whereIn('token_id', activeTokenIds)
          .update({ base_ini: newBaseIni, updated_at: db.fn.now() })
        const roster = await db('combat_roster').where({ campaign_id: campaignId })
        io.to(campaignId).emit(WS.COMBAT_ROSTER_UPDATED, { roster: await buildBroadcastRoster(db, roster) })
      }
    }
  } catch (err) {
    console.error('[woundService] applyWound — recalcul base_ini après blessure échoué :', err.message)
  }

  // La réaction de Chance (RAW REGLE_CHANCE.md:112-131, correction A POSTÉRIORI d'un fait déjà survenu — jamais un gate avant
  // l'écriture : applyWound reste le point d'entrée unique déjà atomique de 6 sites de dégât, analyse à charge 2026-09-12,
  // PLAN_CHANCE.md §7) est ouverte plus haut, dans la transaction de la blessure, et publiée juste après WOUND_ADDED.
  // Fire-and-forget : jamais un `await` bloquant sur la réponse du joueur, applyWound retourne normalement dans tous les cas.

  return {
    finalSeverity, worst_wound_severity, shock_test_required,
    wound: result.wound, promoted: result.promoted,
  }
}

// removeWound — suppression d'UNE blessure (route DELETE de la fiche). Si c'était une Mort (Tête/Corps), le `dead` qu'elle
// avait posé disparaît avec elle, dans la même transaction (statusService.js:reconcileWoundDeath) ; un `dead` posé à la
// main par le MJ reste. Les droits (6ᵉ ligne = MJ seul) sont vérifiés par l'appelant. Retourne la blessure supprimée, ou
// null si elle n'existe plus (suppression concurrente).
export async function removeWound(io, db, campaignId, { charSheetId, characterId, woundId }) {
  const removal = await db.transaction(async (trx) => {
    const wound = await trx('character_wounds').where({ id: woundId, char_sheet_id: charSheetId }).first()
    if (!wound) return null
    await trx('character_wounds').where({ id: woundId }).del()
    const deathChange = isFatalWound(wound)
      ? await reconcileWoundDeath(trx, campaignId, { characterId, charSheetId })
      : null
    return { wound, deathChange }
  })
  if (!removal) return null

  const worst_wound_severity = await getWorstWoundSeverity(db, charSheetId)
  io.to(campaignId).emit(WS.WOUND_REMOVED, { characterId, woundId, worst_wound_severity })
  if (removal.deathChange) await announceWoundDeath(io, db, campaignId, characterId, removal.deathChange)
  return removal.wound
}

// clearCharacterWoundsAndStatuses — vide toutes les blessures et tous les statuts d'un personnage
// (docs/PLANS/PLAN_CHAT_COMMANDES.md §4, /heal). Un character_id peut avoir plusieurs tokens
// (229_character_states.js : « un GM peut poser plusieurs tokens partageant le même character_id,
// chacun avec son propre état physique ») — les statuts sont donc nettoyés sur TOUS les tokens du
// personnage, jamais un seul. Retourne false si le personnage n'a pas de fiche (rien à soigner), true
// sinon — jamais un throw, appelé en boucle par healCampaignCharacters qui ne doit pas s'arrêter sur un
// personnage sans fiche.
export async function clearCharacterWoundsAndStatuses(io, db, campaignId, characterId) {
  const sheet = await db('char_sheet').where({ character_id: characterId }).first()
  if (!sheet) return false

  const tokenRows = await db('tokens').where({ character_id: characterId }).select('id')
  const tokenIds = tokenRows.map((t) => t.id)

  const removedWounds = await db.transaction(async (trx) => {
    const wounds = await trx('character_wounds').where({ char_sheet_id: sheet.id }).select('id')
    if (wounds.length > 0) {
      await trx('character_wounds').where({ char_sheet_id: sheet.id }).delete()
    }
    if (tokenIds.length > 0) {
      await trx('token_statuses').whereIn('token_id', tokenIds).delete()
    }
    return wounds
  })

  // worst_wound_severity constant après suppression complète (null) — calculé une fois, pas par
  // blessure. Aucune échéance orpheline en erreur : woundHealingCheckHandler/woundInfectionCheckHandler
  // gèrent déjà une blessure disparue en no-op (woundEvolutionService.js:81-87,179-183, vérifié).
  const worst_wound_severity = await getWorstWoundSeverity(db, sheet.id)
  for (const wound of removedWounds) {
    io.to(campaignId).emit(WS.WOUND_REMOVED, { characterId, woundId: wound.id, worst_wound_severity })
  }
  for (const tokenId of tokenIds) {
    await emitTokenStatusUpdated(io, db, campaignId, tokenId)
  }

  return true
}

// healCampaignCharacters — résout la portée d'un /heal puis nettoie chaque personnage trouvé, une
// transaction par personnage (un échec sur l'un n'annule pas ce qui a réussi sur les autres — commande
// ré-exécutable sans risque).
// scope === 'map' : tous les personnages avec un token sur la carte actuelle de la campagne
// (current_battlemap_id, repli default_battlemap_id — migration 324). Retourne { count: 0, noMap: true }
// si aucune carte n'est résolvable (campagne jamais ouverte sur une carte) — distinct de « 0 personnage
// à soigner sur une carte réelle », pour que l'appelant puisse répondre différemment.
// scope === 'campaign' (« /heal all ») : tous les personnages de la campagne, toute carte confondue —
// portée volontairement large (PJ + PNJ + exo + drone, décision Saar 2026-09-04).
export async function healCampaignCharacters(io, db, campaignId, scope) {
  let characterIds

  if (scope === 'campaign') {
    const rows = await db('characters').where({ campaign_id: campaignId }).select('id')
    characterIds = rows.map((r) => r.id)
  } else {
    const campaign = await db('campaigns')
      .where({ id: campaignId })
      .select('current_battlemap_id', 'default_battlemap_id')
      .first()
    const battlemapId = campaign?.current_battlemap_id ?? campaign?.default_battlemap_id
    if (!battlemapId) return { count: 0, noMap: true }

    const rows = await db('tokens')
      .where({ battlemap_id: battlemapId })
      .whereNotNull('character_id')
      .distinct('character_id')
    characterIds = rows.map((r) => r.character_id)
  }

  let count = 0
  for (const characterId of characterIds) {
    const healed = await clearCharacterWoundsAndStatuses(io, db, campaignId, characterId)
    if (healed) count += 1
  }
  return { count }
}

// finishWoundSeverityChoice — SITE_HANDLERS.wound_severity (PLAN_CHANCE.md L5, §8). Appelé à la fermeture de la réaction, quelle
// qu'en soit la cause : choix du joueur (`reduce_N`), refus explicite (« Accepter », `choice: null` posé par un utilisateur) ou
// délai écoulé (`choice: null`, `resolved_by` nul). `choice` est `reduce_N` où N doit être l'un des degrés PRÉ-VALIDÉS à
// l'ouverture (context.reductions, computeAvailableSeverityReductions) — jamais recalculé ici en aveugle : si l'état a changé
// entre l'ouverture et la réponse, le choix ne correspond plus à une entrée connue et n'a simplement aucun effet.
//
// Sur une MORT (`context.fatal`), la réaction ne se ferme jamais sans trancher : le `finally` appelle settleFatalWound après
// TOUTE issue — dépense réussie (plus de blessure mortelle : rien à poser), refus, délai, Chance devenue insuffisante, place
// disparue, ou panne — ainsi le personnage ne reste jamais « ni mort ni vivant » (resterait l'arrêt brutal du serveur entre la
// fermeture de la ligne et cet appel, rattrapé au démarrage, PLAN_CHANCE.md §8 lot 6a-2).
async function finishWoundSeverityChoice(io, campaignId, resolved, { choice, context }) {
  const { charSheetId, characterId, fatal } = context
  try {
    await applyWoundChoice(io, campaignId, { choice, context, explicit: resolved.resolved_by != null })
  } finally {
    if (fatal) await settleFatalWound(io, campaignId, { characterId, charSheetId })
  }
}

// applyWoundChoice — l'effet du choix et sa ligne de chat (une par branche, jamais en silence).
async function applyWoundChoice(io, campaignId, { choice, context, explicit }) {
  const { woundId, charSheetId, characterId, reductions, fatal } = context
  const label = await characterLabel(characterId)

  if (!choice) { // « Accepter » explicite, ou délai écoulé
    if (explicit) emitSystemNotice(io, campaignId, `${NOTICE}woundAccepted`, { label })
    else if (fatal) emitSystemNotice(io, campaignId, `${NOTICE}noAnswer`, { label }) // rien ne change pour une blessure ordinaire
    return
  }
  const match = (reductions ?? []).find(r => `reduce_${r.degree}` === choice)
  if (!match) return
  const cost = match.cost ?? match.degree // `cost` absent : réaction ouverte avant l'ajout du coût distinct (1 point par degré)

  const sheet = await db('char_sheet').where({ id: charSheetId }).first()
  if (!sheet) return

  // Dépense + réduction dans UNE SEULE transaction (spendChancePoints prend un trxOpt) — atomique : soit les deux réussissent,
  // soit aucun des deux (jamais des points débités sans effet, ni une blessure réduite sans dépense). La blessure et la place
  // du palier visé sont REVÉRIFIÉES ici : ce qui était vrai à l'ouverture peut ne plus l'être (MJ qui la retire, 2ᵉ blessure
  // arrivée entre-temps) — refuser proprement plutôt que payer pour rien ou dépasser la capacité d'une ligne.
  let outcome
  try {
    outcome = await db.transaction(async (trx) => {
      const wound = await trx('character_wounds').where({ id: woundId }).first()
      if (!wound) return { status: 'gone' }
      if (!(await hasSeverityRoom(trx, sheet.id, wound.location, match.targetSeverity))) return { status: 'noRoom' }
      await spendChancePoints(sheet.id, cost, { reason: 'Réduction de gravité de Blessure' }, trx)
      let currentWoundId = woundId
      for (let i = 0; i < match.degree; i += 1) {
        const result = await resolveWoundImprovement(trx, currentWoundId)
        if (!result.wound) return { status: 'reduced', woundId: null, from: wound } // guérie entièrement avant d'avoir consommé tous les degrés
        currentWoundId = result.wound.id
      }
      return { status: 'reduced', woundId: currentWoundId, from: wound }
    })
  } catch (err) {
    // Jamais un throw qui remonterait jusqu'au handler socket générique (CHANCE_CHOICE_RESOLVE) : la blessure reste telle quelle.
    if (err instanceof ChanceInsufficientError) {
      // Chance descendue entre l'ouverture et la réponse (dépense concurrente) — RAW ne permet jamais une réduction non payée.
      emitSystemNotice(io, campaignId, `${NOTICE}cannotSpend`, { label, cost })
    } else {
      console.error(`[woundService] finishWoundSeverityChoice — réduction échouée (${err.message}), blessure inchangée.`)
    }
    return
  }

  if (outcome.status === 'gone') return // blessure retirée entre-temps (MJ, /heal) : rien à réduire, rien à raconter
  if (outcome.status === 'noRoom') {
    emitSystemNotice(io, campaignId, `${NOTICE}noRoom`, { label })
    return
  }

  const finalWound = outcome.woundId ? await db('character_wounds').where({ id: outcome.woundId }).first() : null
  const worst_wound_severity = await getWorstWoundSeverity(db, sheet.id)
  io.to(campaignId).emit(WS.WOUND_UPDATED, { characterId, wound: finalWound, worst_wound_severity })

  const chcNow = (await db('char_sheet').where({ id: sheet.id }).select('chc').first())?.chc
  const from = outcome.from
  const noticeKey = from.severity !== 'mort_subite' ? 'woundReduced'
    : isSuddenDeathLocation(from.location) ? 'deathAvoided' : 'limbSaved'
  emitSystemNotice(io, campaignId, `${NOTICE}${noticeKey}`, { label, cost, chc: chcNow })
}

SITE_HANDLERS.wound_severity = finishWoundSeverityChoice
