import {
  resolveWoundInsertion, resolveWoundImprovement, computeAvailableSeverityReductions,
  isShockTestRequired, getWorstWoundSeverity, WoundLineFullError,
} from './woundUtils.js'
import { initializeWoundHealingEcheance } from './woundEvolutionService.js'
import { emitTokenStatusUpdated } from './statusService.js'
// Import DIRECT depuis exoPilotService.js, jamais combatantContextService.js (qui importe
// damageService.js -> woundService.js : un import inverse ici boucherait le cycle).
import { resolveChanceRecipientCharacterId } from './exoPilotService.js'
import { openChanceChoice, SITE_HANDLERS } from './chanceCatastropheChoiceService.js'
import { spendChancePoints } from '../services/chanceService.js'
import { computeCharacterBaseIni } from './reactionService.js'
import { calcWoundPenalty } from './charStats.js'
import { buildBroadcastRoster } from './combatRosterBroadcast.js'
import { WS } from '../../../shared/events.js'
import db from '../db/knex.js'

// RAW (REGLE_CHANCE.md:112-131) : la réduction de gravité par Chance ne s'ouvre qu'à partir d'une
// Blessure grave — jamais légère/moyenne.
const CHANCE_ELIGIBLE_SEVERITIES = ['grave', 'critique', 'mortelle']

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
  try {
    result = await db.transaction(async (trx) => {
      const insertion = await resolveWoundInsertion(trx, charSheetId, localisation, severity)
      // Guérison/Infection (Lot 2, docs/PLAN_BLESSURES_GUERISON.md §5) — sur la blessure finale
      // (post-promotion) uniquement ; les échéances d'éventuelles cases supprimées par la cascade
      // de promotion se terminent d'elles-mêmes sans effet (woundId introuvable, voir
      // woundEvolutionService.js).
      await initializeWoundHealingEcheance(trx, { campaignId, characterId, wound: insertion.wound })
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

  // Réduction de gravité par Chance (PLAN_CHANCE.md L5, REGLE_CHANCE.md:112-131) — correction A
  // POSTÉRIORI, jamais un gate avant l'écriture ci-dessus (analyse à charge 2026-09-12, PLAN §7) :
  // applyWound reste le point d'entrée unique déjà atomique (insertion + broadcast) de 6 sites de
  // dégât ; faire remonter une suspension à travers chacun aurait été un refactor bien plus large
  // que ce que RAW demande réellement ("dès que le personnage SUBIT une Blessure..." — une réaction
  // à un fait déjà survenu, pas une clause suspensive). Fire-and-forget : jamais un `await` bloquant
  // sur la réponse du joueur, `applyWound` retourne normalement dans tous les cas ci-dessous.
  if (CHANCE_ELIGIBLE_SEVERITIES.includes(finalSeverity)) {
    try {
      const character = await db('characters').where({ id: characterId }).first()
      const recipientCharacterId = character
        ? await resolveChanceRecipientCharacterId(db, campaignId, characterId, character.type)
        : null
      if (recipientCharacterId) {
        const reductions = await computeAvailableSeverityReductions(
          db, charSheetId, result.wound.location, finalSeverity,
        )
        if (reductions.length > 0) {
          // chcAvailable — valeur de Chance au moment de l'ouverture, jamais recalculée/devinée côté
          // client (aucun store client ne porte `char_sheet.chc` aujourd'hui) : le texte explicatif de
          // la carte affiche cette valeur telle quelle (retour Saar 2026-09-12, item 1).
          const sheet = await db('char_sheet').where({ id: charSheetId }).first()
          await openChanceChoice(io, campaignId, recipientCharacterId, {
            testLabel: `Réduire la gravité — Blessure ${finalSeverity} (${result.wound.location})`,
            site: 'wound_severity',
            context: { woundId: result.wound.id, charSheetId, characterId, reductions, chcAvailable: sheet?.chc ?? null },
            // Données structurées, jamais un libellé FR construit ici (règle i18n du projet : le
            // serveur n'émet jamais de texte utilisateur figé) — le client compose le texte via
            // t() à partir de `degree`/`targetSeverity`.
            options: reductions.map(r => ({ choice: `reduce_${r.degree}`, degree: r.degree, targetSeverity: r.targetSeverity })),
          })
        }
      }
    } catch (err) {
      // Jamais laisser un problème sur cette fonctionnalité annexe faire échouer l'application de
      // la blessure elle-même (déjà commitée et diffusée ci-dessus) — juste logué.
      console.error('[woundService] applyWound — ouverture du choix Chance échouée :', err.message)
    }
  }

  return {
    finalSeverity, worst_wound_severity, shock_test_required,
    wound: result.wound, promoted: result.promoted,
  }
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

// finishWoundSeverityChoice — SITE_HANDLERS.wound_severity (PLAN_CHANCE.md L5). `choice` est
// `reduce_N` où N doit être l'un des degrés PRÉ-VALIDÉS à l'ouverture (context.reductions,
// computeAvailableSeverityReductions) — jamais recalculé ici en aveugle : si l'état a changé entre
// l'ouverture et la réponse (ex. une autre blessure a rempli le palier visé entre-temps), le choix
// ne correspond plus à une entrée connue et n'a simplement aucun effet, plutôt que d'appliquer une
// réduction qui ne serait plus correcte.
//
// Dépense + réduction dans UNE SEULE transaction (spendChancePoints prend un trxOpt) — atomique :
// soit les deux réussissent, soit aucun des deux (jamais des points débités sans effet, ni une
// blessure réduite sans dépense).
async function finishWoundSeverityChoice(io, campaignId, resolved, { choice, context }) {
  if (!choice) return // timeout/déclin — RAW : la blessure reste telle quelle
  const { woundId, charSheetId, characterId, reductions } = context
  const match = reductions.find(r => `reduce_${r.degree}` === choice)
  if (!match) return

  const sheet = await db('char_sheet').where({ id: charSheetId }).first()
  if (!sheet) return

  let finalWoundId
  try {
    finalWoundId = await db.transaction(async (trx) => {
      await spendChancePoints(sheet.id, match.degree, { reason: 'Réduction de gravité de Blessure' }, trx)
      let currentWoundId = woundId
      for (let i = 0; i < match.degree; i += 1) {
        const result = await resolveWoundImprovement(trx, currentWoundId)
        if (!result.wound) return null // guérie entièrement avant d'avoir consommé tous les degrés
        currentWoundId = result.wound.id
      }
      return currentWoundId
    })
  } catch (err) {
    // Chance insuffisante entre l'ouverture du choix et sa résolution (rare, concurrence d'une
    // autre dépense entre-temps) — RAW ne permet jamais une réduction non payée ; jamais un throw
    // qui remonterait jusqu'au handler socket générique (CHANCE_CHOICE_RESOLVE), la blessure reste
    // telle quelle.
    console.warn(`[woundService] finishWoundSeverityChoice — réduction refusée (${err.message}), blessure inchangée.`)
    return
  }

  const finalWound = finalWoundId ? await db('character_wounds').where({ id: finalWoundId }).first() : null
  const worst_wound_severity = await getWorstWoundSeverity(db, sheet.id)
  io.to(campaignId).emit(WS.WOUND_UPDATED, { characterId, wound: finalWound, worst_wound_severity })
}

SITE_HANDLERS.wound_severity = finishWoundSeverityChoice
