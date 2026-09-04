import { resolveWoundInsertion, isShockTestRequired, getWorstWoundSeverity } from './woundUtils.js'
import { initializeWoundHealingEcheance } from './woundEvolutionService.js'
import { emitTokenStatusUpdated } from './statusService.js'
import { WS } from '../../../shared/events.js'

// Centralise l'insertion de blessure + broadcast WOUND_ADDED (6 call sites WS → 1).
// Retourne { finalSeverity, wound, promoted, shock_test_required, worst_wound_severity } — finalSeverity
// (post-promotion, P49) pour que le caller puisse appeler resolveShockTest, le reste pour les callers
// qui ont besoin de la blessure complète (ex. réponse HTTP d'une route d'ajout manuel).
// Retourne null si severity ou charSheetId absents, ou si AppError (ligne pleine — comportement normal en jeu).
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
    console.error('[woundService] applyWound — insertion échouée :', charSheetId, localisation, severity, err.message)
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
