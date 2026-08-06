// server/src/lib/catastropheService.js — Catastrophe automatique en combat, Lot 1
// (docs/PLANS/PLAN_CATASTROPHE_RISK.md §4/§8/§9). Jet 1D10 automatique sur la table RAW
// "CATASTROPHES EN COMBAT" (REGLESYSCOMBAT.md:714-743), toujours filtré par une validation MJ avant
// application réelle (décision 2 du plan) — jamais un effet qui s'applique tout seul.
//
// Portée : combat uniquement. "Combat actif" = une ligne combat_state existe pour la campagne (vérifié
// contre le vrai handler COMBAT_END, socketCombatState.js:173-252, qui supprime cette ligne
// entièrement — pas une valeur de `phase` précise à tester). Aucun appelant ne doit émettre de
// Catastrophe sans passer par isCombatActive/maybeTriggerCatastrophe ci-dessous.
import db from '../db/knex.js'
import { parseDice } from './diceParser.js'
import { WS } from '../../../shared/events.js'
import { AppError } from './AppError.js'
import { CATASTROPHE_EFFECT_TABLE, findCatastropheEntry } from '../../../shared/catastropheEffectTable.js'

export async function isCombatActive(campaignId, database = db) {
  const row = await database('combat_state').where({ campaign_id: campaignId }).first()
  return !!row
}

// rollCatastropheEffect — jet 1D10 pur (server-autoritaire, même parseDice que le reste du projet,
// pas de Math.random direct) + lookup table. Jamais undefined : la table couvre 1-10 en entier.
export async function rollCatastropheEffect() {
  const { total } = await parseDice('1d10')
  return findCatastropheEntry(total)
}

// applyCatastropheEffect — dispatch par clé (§9 Lot 2). Aucune entrée n'est mécanisée en Lot 1
// (CATASTROPHE_EFFECT_TABLE, mechanized:false partout) : retourne toujours un descripteur neutre,
// jamais un no-op silencieux déguisé en automatisation — le MJ voit l'entrée telle quelle dans la
// file de validation (client) et applique l'effet lui-même tant qu'aucun handler n'existe ici.
const EFFECT_HANDLERS = {
  // Peuplé lot par lot (PLAN_CATASTROPHE_RISK.md §9) — vide en Lot 1.
}

export async function applyCatastropheEffect(entry, context, database = db) {
  // Défense en profondeur : resolvePendingCatastrophe valide déjà `override` avant d'arriver ici,
  // mais cette fonction est exportée — un futur appelant (Lot 2+) qui lui passerait une entrée
  // invalide ne doit jamais planter sur `entry.key`, juste être neutre.
  if (!entry) return { mechanized: false, key: null }
  const handler = EFFECT_HANDLERS[entry.key]
  if (!handler) return { mechanized: false, key: entry.key }
  return handler(entry, context, database)
}

// createPendingCatastrophe — persiste le jet + émet CATASTROPHE_PENDING (jamais l'application
// directe, décision 2 du plan). `context` : forme minimale requise (§4) { site, actorTokenId,
// targetTokenId }.
export async function createPendingCatastrophe(io, campaignId, tokenId, context, database = db) {
  const entry = await rollCatastropheEffect()
  const [pending] = await database('pending_catastrophes')
    .insert({
      campaign_id: campaignId,
      token_id: tokenId,
      table_entry: entry.index,
      context: JSON.stringify(context ?? {}),
    })
    .returning('*')

  io.to(campaignId).emit(WS.CATASTROPHE_PENDING, {
    id: pending.id,
    tokenId,
    tableEntry: pending.table_entry,
    context: pending.context,
    rolledAt: pending.rolled_at,
  })

  return pending
}

// maybeTriggerCatastrophe — point d'accroche unique appelé par les 7 sites catastropheRisk
// (docs/PLANS/PLAN_CATASTROPHE_RISK.md §3). Centralise la garde combat actif (décision 1 : hors
// combat = narratif, hors scope) — aucun appelant ne doit dupliquer ce test lui-même.
export async function maybeTriggerCatastrophe(io, campaignId, tokenId, catastropheRisk, context, database = db) {
  if (!catastropheRisk) return null
  if (!(await isCombatActive(campaignId, database))) return null
  return createPendingCatastrophe(io, campaignId, tokenId, context, database)
}

// resolvePendingCatastrophe — MJ confirme (override absent) ou reprend la main (override = numéro
// d'entrée 1-10 alternatif, §4). Idempotent : UPDATE ... WHERE resolved_at IS NULL, aucune ligne
// retournée = déjà résolue par un autre onglet/co-MJ, rejeté silencieusement plutôt qu'appliqué deux
// fois (même garde que les corrections de concurrence de PLAN_FATIGUE_DOMMAGES.md Lots 1/2).
export async function resolvePendingCatastrophe(io, campaignId, pendingId, { override = null, resolvedByUserId } = {}, database = db) {
  // Corrigé (analyse à charge post-implémentation, 2026-08-06) : override n'était jamais validé —
  // une valeur hors 1-10 committait l'UPDATE avant de planter sur findCatastropheEntry(undefined),
  // laissant la ligne résolue avec un applied_entry invalide, irrécupérable. Validé AVANT toute
  // écriture, jamais après (core.md : le serveur valide avant toute mutation).
  if (override !== null && !findCatastropheEntry(override)) {
    throw new AppError(400, `override "${override}" hors de la table Catastrophe (1-10)`)
  }

  const [resolved] = await database('pending_catastrophes')
    .where({ id: pendingId, campaign_id: campaignId })
    .whereNull('resolved_at')
    .update({
      resolved_at: database.fn.now(),
      resolved_by: resolvedByUserId ?? null,
      applied_entry: database.raw('COALESCE(?, table_entry)', [override]),
    })
    .returning('*')

  if (!resolved) return null // déjà résolue — pas d'application en double

  const entry = findCatastropheEntry(resolved.applied_entry)
  const context = typeof resolved.context === 'string' ? JSON.parse(resolved.context) : resolved.context
  await applyCatastropheEffect(entry, { ...context, tokenId: resolved.token_id }, database)

  io.to(campaignId).emit(WS.CATASTROPHE_APPLIED, {
    id: resolved.id,
    tokenId: resolved.token_id,
    appliedEntry: resolved.applied_entry,
  })

  return resolved
}

// listPendingCatastrophes — resync (montage client, reconnexion MJ via SESSION_JOIN,
// server/src/socket/index.js). Ordonné par ancienneté, même patron que combat_pending.
export async function listPendingCatastrophes(campaignId, database = db) {
  return database('pending_catastrophes')
    .where({ campaign_id: campaignId })
    .whereNull('resolved_at')
    .orderBy('rolled_at', 'asc')
}

// purgePendingCatastrophes — appelée depuis COMBAT_END (socketCombatState.js:248-250), même patron
// que combat_pending/combat_roster : aucune Catastrophe combat ne traverse la fin du combat, décision
// assumée (§4, différente du Lot 3 environnemental).
export async function purgePendingCatastrophes(campaignId, database = db) {
  await database('pending_catastrophes').where({ campaign_id: campaignId }).delete()
}

export { CATASTROPHE_EFFECT_TABLE }
