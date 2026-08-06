// server/src/socket/socketCatastrophe.js — Catastrophe automatique en combat, Lot 1
// (docs/PLANS/PLAN_CATASTROPHE_RISK.md §4). Le jet 1D10 et la file d'attente sont gérés par
// catastropheService.js (createPendingCatastrophe/purge, déclenchés depuis les 7 sites
// catastropheRisk) — ce fichier n'expose que la validation MJ, jamais l'application directe.
import { WS } from '../../../shared/events.js'
import { resolvePendingCatastrophe } from '../lib/catastropheService.js'

export function registerCatastropheHandlers(io, socket, { campaignId, user, isGm }) {
  // ─── CATASTROPHE:RESOLVE ────────────────────────────────────────────────────
  // MJ uniquement (§4 : "un joueur ne peut jamais confirmer/override sa propre Catastrophe").
  // Payload : { pendingId, override? } — override = numéro d'entrée 1-10 alternatif, absent = le MJ
  // confirme le jet tel quel. Idempotent côté service (WHERE resolved_at IS NULL) : un second appel
  // sur la même entrée (double-clic, deux onglets MJ) est rejeté silencieusement, jamais appliqué
  // deux fois.
  socket.on(WS.CATASTROPHE_RESOLVE, async ({ pendingId, override = null }) => {
    if (!isGm) return
    if (!campaignId || !pendingId) return
    try {
      await resolvePendingCatastrophe(io, campaignId, pendingId, { override, resolvedByUserId: user.id })
    } catch (err) {
      console.error(`[WS] catastrophe:resolve error (${user.username}) : ${err.message}`)
    }
  })
}
