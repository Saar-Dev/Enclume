// server/src/lib/campaignActivityService.js — suivi d'activité de campagne (Lot C, docs/JOURNAL8.md
// 2026-09-03). Autorité unique pour les deux tables append-only (migration 319) : présence des
// utilisateurs (connexions session/wizard) et journal des combats. Agrégats dérivés par requête,
// jamais un compteur muté.
//
// Alimenté par le socket : SESSION_JOIN → startPresence, disconnect → endPresence (socket/index.js) ;
// COMBAT_START → logCombatStart, COMBAT_END → logCombatEnd (socket/socketCombatState.js).
// Entretien : sweepStalePresence() + startPresenceHeartbeat() appelés au boot (server/src/index.js).
import db from '../db/knex.js'

const HEARTBEAT_MS = 5 * 60 * 1000        // bump last_seen_at des lignes ouvertes
const VISIT_GAP_MS = 10 * 60 * 1000       // deux connexions à moins de 10 min = une seule « visite »
const ONLINE_STALE_MS = 11 * 60 * 1000    // garde-fou en plus de ended_at IS NULL pour le drapeau « en ligne »

// ─── Présence ────────────────────────────────────────────────────────────────

// Renvoie l'id de la ligne créée (à stocker sur le socket pour endPresence). context ∈ session|wizard.
export async function startPresence(campaignId, userId, context = 'session') {
  const [row] = await db('campaign_presence_sessions')
    .insert({ campaign_id: campaignId, user_id: userId, context })
    .returning('id')
  return row.id
}

export async function endPresence(presenceRowId) {
  if (!presenceRowId) return
  await db('campaign_presence_sessions')
    .where({ id: presenceRowId })
    .whereNull('ended_at')
    .update({ ended_at: db.fn.now() })
}

// Ferme les lignes restées ouvertes d'avant un crash — un serveur qui démarre n'a aucun socket
// vivant, donc toute ligne ended_at IS NULL est morte. ended_at = last_seen_at (le heartbeat garantit
// une perte ≤ HEARTBEAT_MS). Renvoie le nombre de lignes fermées.
export async function sweepStalePresence() {
  const closed = await db('campaign_presence_sessions')
    .whereNull('ended_at')
    .update({ ended_at: db.raw('last_seen_at') })
  return closed
}

let heartbeatHandle = null

// setInterval unref() : n'empêche pas le process de se terminer. Idempotent (un seul intervalle).
export function startPresenceHeartbeat() {
  if (heartbeatHandle) return heartbeatHandle
  heartbeatHandle = setInterval(() => {
    db('campaign_presence_sessions')
      .whereNull('ended_at')
      .update({ last_seen_at: db.fn.now() })
      .catch(err => console.error('[presence] heartbeat error:', err.message))
  }, HEARTBEAT_MS)
  heartbeatHandle.unref?.()
  return heartbeatHandle
}

export function stopPresenceHeartbeat() {
  if (heartbeatHandle) { clearInterval(heartbeatHandle); heartbeatHandle = null }
}

// ─── Combat ──────────────────────────────────────────────────────────────────

export async function logCombatStart(campaignId, battlemapId = null) {
  await db('campaign_combat_log').insert({ campaign_id: campaignId, battlemap_id: battlemapId })
}

// Le garde FSM (combatFSM.js) interdit un 2ᵉ COMBAT_START sans END → au plus une ligne ouverte.
export async function logCombatEnd(campaignId) {
  await db('campaign_combat_log')
    .where({ campaign_id: campaignId })
    .whereNull('ended_at')
    .update({ ended_at: db.fn.now() })
}

// ─── Agrégats (consommés par campaignRosterService en C2) ─────────────────────

function toMs(v) { return v instanceof Date ? v.getTime() : new Date(v).getTime() }

// Fusion d'intervalles triés : gère le multi-onglets (chevauchement) et, avec gapMs > 0, regroupe
// les reconnexions rapprochées en une seule « visite ».
function mergeIntervals(intervals, gapMs = 0) {
  if (!intervals.length) return []
  const sorted = [...intervals].sort((a, b) => a.start - b.start)
  const merged = [{ ...sorted[0] }]
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1]
    if (sorted[i].start <= last.end + gapMs) {
      if (sorted[i].end > last.end) last.end = sorted[i].end
    } else {
      merged.push({ ...sorted[i] })
    }
  }
  return merged
}

const sumSeconds = (intervals) =>
  Math.round(intervals.reduce((s, iv) => s + (iv.end - iv.start), 0) / 1000)

export async function getCampaignActivity(campaignId) {
  const presenceRows = await db('campaign_presence_sessions')
    .where({ campaign_id: campaignId })
    .select('user_id', 'context', 'started_at', 'last_seen_at', 'ended_at')

  const now = Date.now()
  const byUser = {}
  for (const r of presenceRows) {
    if (!byUser[r.user_id]) byUser[r.user_id] = { session: [], wizard: [], lastConnectedAt: null, online: false }
    const u = byUser[r.user_id]
    const start = toMs(r.started_at)
    // Ligne ouverte encore vivante (last_seen_at récent : le heartbeat n'a que 5 min de granularité)
    // → fin = maintenant, la durée d'une session en cours monte en temps réel. Ligne ouverte
    // périmée (crash serveur) → fin = last_seen_at, on ne compte pas le temps mort.
    const isLive = r.ended_at == null && (now - toMs(r.last_seen_at)) < ONLINE_STALE_MS
    const end = r.ended_at != null ? toMs(r.ended_at) : (isLive ? now : toMs(r.last_seen_at))
    if (r.context === 'wizard') u.wizard.push({ start, end })
    else u.session.push({ start, end })
    if (u.lastConnectedAt == null || start > u.lastConnectedAt) u.lastConnectedAt = start
    if (isLive) u.online = true
  }

  const presenceByUser = {}
  for (const [userId, u] of Object.entries(byUser)) {
    presenceByUser[userId] = {
      sessionSeconds: sumSeconds(mergeIntervals(u.session)),
      wizardSeconds: sumSeconds(mergeIntervals(u.wizard)),
      visitCount: mergeIntervals(u.session, VISIT_GAP_MS).length,
      lastConnectedAt: u.lastConnectedAt != null ? new Date(u.lastConnectedAt).toISOString() : null,
      online: u.online,
    }
  }

  const combatRows = await db('campaign_combat_log')
    .where({ campaign_id: campaignId })
    .select('started_at', 'ended_at')
  const combatSeconds = combatRows.reduce((s, r) => {
    if (r.ended_at == null) return s
    return s + Math.max(0, toMs(r.ended_at) - toMs(r.started_at))
  }, 0)

  return {
    presenceByUser,
    combat: {
      combatCount: combatRows.length,
      combatSeconds: Math.round(combatSeconds / 1000),
    },
  }
}
