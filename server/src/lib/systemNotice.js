// server/src/lib/systemNotice.js — une ligne système dans le chat de la campagne (module FEUILLE).
//
// Règle i18n du projet (`.claude/rules/i18n.md`) : le serveur n'émet jamais de texte figé, seulement `{ i18nKey, params }`
// résolu côté client via `t()` (useSessionSocket.js, `onCombatSystemNotice` — malgré son nom, sans lien avec le mode combat).
// Une clé d'un namespace autre que le défaut s'écrit `combat:chance.notice.…` (précédent : `combat:integrityPanne.*`).
import { WS } from '../../../shared/events.js'

export function emitSystemNotice(io, campaignId, i18nKey, params = {}) {
  io.to(campaignId).emit(WS.COMBAT_SYSTEM_NOTICE, { i18nKey, params, timestamp: new Date().toISOString() })
}
