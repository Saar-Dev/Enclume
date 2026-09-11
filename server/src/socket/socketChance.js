// server/src/socket/socketChance.js — Choix RAW « gagner 1 Chance / relancer le Test » sur
// Catastrophe (docs/PLANS/PLAN_CHANCE.md L3e-1). La ligne en attente et le timeout sont gérés par
// chanceCatastropheChoiceService.js (openChanceChoice, déclenché depuis les sites câblés au fil
// des lots L3e-2/3/4) — ce fichier n'expose que la résolution du choix, jamais l'ouverture.
import db from '../db/knex.js'
import { WS } from '../../../shared/events.js'
import { resolveChanceChoice } from '../lib/chanceCatastropheChoiceService.js'

export function registerChanceHandlers(io, socket, { campaignId, user, isGm }) {
  // ─── CHANCE:CHOICE_RESOLVE ──────────────────────────────────────────────────
  // Le joueur propriétaire du personnage (PJ) ou le MJ (PNJ, patron ChanceGmChoiceQueue.jsx) —
  // jamais un autre joueur. Idempotent côté service (WHERE resolved_at IS NULL).
  socket.on(WS.CHANCE_CHOICE_RESOLVE, async ({ pendingId, choice }) => {
    if (!campaignId || !pendingId) return
    try {
      const pending = await db('pending_chance_choices').where({ id: pendingId, campaign_id: campaignId }).first()
      if (!pending) return
      if (!isGm) {
        const character = await db('characters').where({ id: pending.character_id }).first()
        if (!character || character.user_id !== user.id) return
      }
      await resolveChanceChoice(io, campaignId, pendingId, { choice, resolvedByUserId: user.id })
    } catch (err) {
      console.error(`[WS] chance:choice_resolve error (${user.username}) : ${err.message}`)
    }
  })
}
