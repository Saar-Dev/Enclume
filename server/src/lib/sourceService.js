/**
 * sourceService.js — Vérification de source active (PLAN_SUPPLEMENTS.md §2/§2.5)
 *
 * Autorité unique pour l'invariant « une entité de catalogue (ref_exo_templates, ref_equipment)
 * n'est utilisable dans une campagne que si sa source est le Livre de Base (toujours actif,
 * `is_core`) ou a été explicitement activée pour cette campagne (`campaign_enabled_sources`) ».
 * Extrait du Lot A (`exoTemplateService.js`) au moment du Lot B pour éviter de dupliquer la même
 * vérification à 8 nouveaux points d'écriture (`ref_equipment`) — un seul endroit, jamais une
 * logique métier recopiée (.claude/rules/core.md).
 */

import { AppError } from './AppError.js'

/**
 * @param {import('knex').Knex | import('knex').Knex.Transaction} trx
 * @param {string} campaignId
 * @param {string} sourceId
 * @throws {AppError} 403 si la source n'est ni core ni activée pour cette campagne
 */
export async function assertSourceActive(trx, campaignId, sourceId) {
  const source = await trx('ref_sources').where({ id: sourceId }).first()
  if (!source) return // FK garantit l'existence en usage normal ; rien à bloquer ici si absente

  if (source.is_core) return

  const enabled = await trx('campaign_enabled_sources')
    .where({ campaign_id: campaignId, source_id: sourceId })
    .first()
  if (!enabled) {
    throw new AppError(403, `La source « ${source.name} » n'est pas active dans cette campagne`)
  }
}
