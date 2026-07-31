// server/src/lib/echeanceService.js — Moteur générique d'échéances de jeu (Lot 2,
// docs/PLAN_FATIGUE_DOMMAGES.md §8). Ne connaît aucune règle métier : condition_type, payload,
// table/rowId des undoEntries restent opaques à ce fichier — toute la logique vit dans les handlers
// de shared/echeanceTypeRegistry.js.
import { AppError } from './AppError.js'
import db from '../db/knex.js'
import { findEcheanceRegistryEntry } from '../../../shared/echeanceTypeRegistry.js'

// interactive toujours résolu depuis le registre à la création — jamais fourni par l'appelant
// (source unique, voir shared/echeanceTypeRegistry.js).
export async function createEcheance(trx, {
  campaignId, characterId, conditionType, payload = {},
  nextDueMinutes, intervalMinutes = null, occurrencesRemaining = null,
}) {
  const registryEntry = findEcheanceRegistryEntry(conditionType)
  if (!registryEntry) {
    throw new AppError(500, `condition_type "${conditionType}" absent de shared/echeanceTypeRegistry.js`)
  }
  const [echeance] = await trx('game_echeances')
    .insert({
      campaign_id: campaignId,
      character_id: characterId,
      condition_type: conditionType,
      interactive: registryEntry.interactive,
      payload,
      next_due_minutes: nextDueMinutes,
      interval_minutes: intervalMinutes,
      occurrences_remaining: occurrencesRemaining,
    })
    .returning('*')
  return echeance
}

// Invoque le handler d'une échéance dans un savepoint isolé (trx.transaction() sur un trx déjà
// ouvert = SAVEPOINT, knex 3.3.0, server/node_modules/knex/lib/execution/transaction.js:208-210) —
// un handler qui plante ne fait jamais perdre le reste d'un balayage (analyse à charge Lot 2 point 5).
// Persiste reschedule/spawn dans le même savepoint que le handler (tout ou rien). Retourne le résultat
// brut du handler, ou null si le handler (ou le condition_type lui-même) a échoué — l'échéance est
// alors déjà passée en status='error' sur le trx appelant.
async function resolveEcheanceHandler(trx, echeance, context) {
  const registryEntry = findEcheanceRegistryEntry(echeance.condition_type)
  if (!registryEntry) {
    await trx('game_echeances').where({ id: echeance.id }).update({ status: 'error', updated_at: trx.fn.now() })
    return null
  }

  try {
    let handlerResult
    await trx.transaction(async (sp) => {
      handlerResult = await registryEntry.handler(sp, echeance, context)

      if (handlerResult.resolved === false) {
        if (!echeance.interactive) {
          // contrat violé (docs/PLAN_FATIGUE_DOMMAGES.md §8) : un handler automatique doit toujours
          // résoudre — traité comme un handler en échec, pas silencieusement ignoré.
          throw new Error(
            `handler "${echeance.condition_type}" a retourné resolved:false pour une échéance non interactive`,
          )
        }
        return // interactive : attend une réponse externe, rien à persister pour l'instant
      }

      const { reschedule, spawn = [] } = handlerResult

      // L'engine trace aussi sa propre mutation de la ligne game_echeances dans undoEntries — même
      // patron générique { table, rowId, previousValues } que le handler, `echeance` étant déjà
      // l'état de la ligne avant toute modification (fetchée par l'appelant avant cet appel).
      // Nécessaire pour que cancelPendingAdvance restaure le statut ET next_due_minutes/
      // occurrences_remaining d'origine, pas seulement un statut générique (correction 2026-07-30,
      // trouvée en testant : sans ça, annuler une échéance déjà `completed` ne la ramenait nulle
      // part, le reset générique `WHERE status IN (pending_mj_review, awaiting_player_roll)` de
      // cancelPendingAdvance ne la retrouvait plus).
      handlerResult.undoEntries = [
        ...(handlerResult.undoEntries ?? []),
        { table: 'game_echeances', rowId: echeance.id, previousValues: echeance },
      ]

      if (!reschedule || (reschedule.occurrencesRemaining !== null && reschedule.occurrencesRemaining <= 0)) {
        await sp('game_echeances').where({ id: echeance.id })
          .update({ status: 'completed', updated_at: sp.fn.now() })
      } else if (!Number.isInteger(reschedule.intervalMinutes) || reschedule.intervalMinutes <= 0) {
        // garde-fou anti-boucle infinie (analyse à charge Lot 2 point 3) — un reschedule qui ne fait
        // pas avancer next_due_minutes ne doit jamais être persisté tel quel.
        await sp('game_echeances').where({ id: echeance.id })
          .update({ status: 'error', updated_at: sp.fn.now() })
      } else {
        await sp('game_echeances').where({ id: echeance.id })
          .update({
            next_due_minutes: echeance.next_due_minutes + reschedule.intervalMinutes,
            interval_minutes: reschedule.intervalMinutes,
            occurrences_remaining: reschedule.occurrencesRemaining,
            status: 'active',
            updated_at: sp.fn.now(),
          })
      }

      for (const spawnEntry of spawn) {
        await createEcheance(sp, {
          campaignId: echeance.campaign_id,
          characterId: echeance.character_id,
          conditionType: spawnEntry.conditionType,
          payload: spawnEntry.payload,
          nextDueMinutes: spawnEntry.nextDueMinutes,
          intervalMinutes: spawnEntry.intervalMinutes ?? null,
          occurrencesRemaining: spawnEntry.occurrencesRemaining ?? null,
        })
      }
    })
    return handlerResult
  } catch {
    await trx('game_echeances').where({ id: echeance.id }).update({ status: 'error', updated_at: trx.fn.now() })
    return null
  }
}

// Patron automatique uniquement (interactive: false) — appelée depuis l'intérieur de la transaction
// d'adjustGameTime (jamais après coup depuis la route). Boucle inspirée pseudoClockUpdate
// (about-time, module Foundry VTT).
// Retourne les `effects` accumulés de chaque échéance résolue (docs/PLAN_FATIGUE_DOMMAGES.md §11,
// Trou A) — le contrat handler `{ resolved:true, effects, reschedule, spawn, undoEntries }` déclarait
// déjà `effects` sans que rien ne le lise ; ce balayage tourne dans une transaction pas encore
// committée, il ne peut pas émettre lui-même un WS (émission uniquement après commit, patron déjà en
// place pour resolveFatigueTest) — l'appelant (gameTimeService.js) doit donc récupérer ce tableau et
// émettre/appliquer après coup. `effects` reste opaque ici — forme `{kind, ...}` propre à chaque
// consommateur (ex. coldExposureService.js : `kind:'fatigueTestResult'` ou `kind:'coldDamageHits'`).
export async function sweepDueEcheances(trx, campaignId, resolvedAfter) {
  const dueEcheances = await trx('game_echeances')
    .where({ campaign_id: campaignId, status: 'active', interactive: false })
    .where('next_due_minutes', '<=', resolvedAfter)
    .forUpdate()

  const effects = []
  for (const echeance of dueEcheances) {
    const handlerResult = await resolveEcheanceHandler(trx, echeance, { resolvedAfter })
    if (handlerResult?.effects) effects.push(handlerResult.effects)
  }
  return effects
}

// Lecture seule, aucune écriture — utilisée par requestGameTimeAdvance pour savoir si une revue
// MJ est nécessaire. Ne prend jamais trx : les échéances interactives dues n'appellent jamais
// sweepDueEcheances (filtre interactive=true ici, interactive=false là-bas — jamais la même requête).
export async function previewDueEcheances(campaignId, resolvedAfter) {
  return db('game_echeances')
    .where({ campaign_id: campaignId, status: 'active', interactive: true })
    .where('next_due_minutes', '<=', resolvedAfter)
    .select('*')
}

// Résolution immédiate d'une échéance interactive unique, dès que sa réponse est connue (MJ répond
// dans l'écran de revue, joueur lance son dé) — le caller doit avoir déjà fusionné cette réponse dans
// echeance.payload avant d'appeler cette fonction (payload reste opaque à ce fichier). N'avance
// jamais le compteur d'horloge — seule la confirmation finale (Lot 2 orchestration) le fait.
export async function resolveEcheanceNow(trx, echeanceId) {
  const echeance = await trx('game_echeances').where({ id: echeanceId }).forUpdate().first()
  if (!echeance) throw new AppError(404, `Échéance "${echeanceId}" introuvable`)
  if (!['pending_mj_review', 'awaiting_player_roll'].includes(echeance.status)) {
    throw new AppError(409, `Échéance "${echeanceId}" n'est pas en attente de résolution (status: ${echeance.status})`)
  }

  const handlerResult = await resolveEcheanceHandler(trx, echeance, {})
  if (!handlerResult) return { resolved: false, error: true }
  if (handlerResult.resolved === false) return { resolved: false }

  const undoEntries = handlerResult.undoEntries ?? []
  if (undoEntries.length > 0) {
    // Append atomique en une seule instruction SQL — jamais lire-puis-écrire en JS (analyse à charge
    // combinée des deux plans, 2026-07-30, point 10) : plusieurs joueurs peuvent répondre à des
    // échéances distinctes à quelques millisecondes d'écart, un lire-puis-écrire séparé perdrait
    // silencieusement une entrée (lost update). COALESCE nécessaire : pending_advance_undo_log est
    // nullable sans défaut (contrairement à campaigns.settings, notNullable defaultTo('{}')) — sans
    // lui, NULL || jsonb vaut NULL et le premier append de l'avance en attente serait perdu.
    await trx('campaigns')
      .where({ id: echeance.campaign_id })
      .update({
        pending_advance_undo_log: trx.raw(
          "COALESCE(pending_advance_undo_log, '[]'::jsonb) || ?::jsonb",
          [JSON.stringify(undoEntries)],
        ),
      })
  }

  return { resolved: true }
}
