// server/src/lib/chanceCatastropheChoiceService.js — Régénération de Chance sur Catastrophe
// (docs/PLANS/PLAN_CHANCE.md L3e-1). Même patron que `catastropheService.js` (voisin de ce
// fichier) : ligne `pending_*` en DB + événement à la room + résolution idempotente
// (`UPDATE ... WHERE resolved_at IS NULL`) — AUCUN `await` bloquant sur une réponse socket future
// (vérifié : ce patron n'existe nulle part dans le projet, cf. PLAN_CHANCE.md §5 L3d/L3e). Le
// site appelant pose la ligne en attente et retourne immédiatement ; la suite arrive plus tard
// dans le handler `CHANCE_CHOICE_RESOLVE` (un site par entrée dans SITE_HANDLERS).
//
// Portée : système entier, PAS combat-only (contrairement à `catastropheService.js`, gardé
// `isCombatActive`) — décision Saar 2026-09-11, PLAN_CHANCE.md §5.
//
// Routage du choix (décision Saar 2026-09-11) : PJ → carte affichée uniquement à son propriétaire
// (filtre client par possession, patron `repair_request`, pas de ciblage serveur par socket — même
// diffusion room que CATASTROPHE_PENDING). PNJ → une file unique pour le MJ (patron
// `CatastropheReviewQueue.jsx`, pas une carte par PNJ).
import db from '../db/knex.js'
import { AppError } from './AppError.js'
import { WS } from '../../../shared/events.js'
import { handleCatastropheRegen } from '../services/chanceService.js'
import { withdrawPendingCatastrophe } from './catastropheService.js'

const DEFAULT_TIMEOUT_MS = 45_000

// Registre en mémoire des SEULS handles de timeout (patron `pendingEntityActions`,
// `socketEntity.js`) — aucun état métier ici, juste de quoi `clearTimeout` un timer devenu inutile
// quand le choix arrive avant l'échéance. L'état réel reste entièrement en DB (pending_chance_
// choices) : un redémarrage serveur perd le timer (pas de relance automatique après coup), mais
// jamais la ligne elle-même — résolvable normalement par le prochain choix joueur/MJ. Sans ce
// nettoyage, un timer déjà résolu se redéclenche quand même 45s plus tard (no-op grâce à
// l'idempotence de resolveChanceChoice, mais un round-trip DB et un timer qui traîne pour rien).
const timeoutHandles = new Map()

// SITE_HANDLERS — dispatch par `context.site`, peuplé lot par lot (L3e-2/3/4) exactement comme
// `EFFECT_HANDLERS` de `catastropheService.js`. Vide en L3e-1 : aucun site réel n'est encore
// câblé, ce fichier seul ne change le comportement d'aucune résolution existante.
const SITE_HANDLERS = {}

// openChanceChoice — pose la ligne en attente, émet CHANCE_CHOICE_PENDING, arme le timeout par
// défaut (RAW : pas de forçage silencieux, "Test normal" = ni point ni relance). Ne bloque jamais
// l'appelant — retourne dès l'insertion, la suite arrive via resolveChanceChoice.
//
// actionId/targetTokenId (PLAN_CHANCE.md L4, migration 341) — corrélation Aggregator/Scatter-Gather :
// plusieurs lignes ouvertes avec le même actionId (une par cible éligible d'un même tir AOE) forment
// un groupe que le site appelant (aoe_avoidance) rassemble à la dernière résolution. `targetTokenId`
// est le token à retirer de la résolution, distinct de `characterId` (le destinataire du choix, qui
// est le PILOTE si la cible est une exo — même distinguo que les sites L3e). Les deux restent `null`
// pour tout site à cible unique (L3e) : colonnes additives, jamais consultées hors L4.
export async function openChanceChoice(io, campaignId, characterId, { testLabel, site, context = {}, timeoutMs = DEFAULT_TIMEOUT_MS, linkedCatastropheId = null, actionId = null, targetTokenId = null } = {}) {
  const [pending] = await db('pending_chance_choices')
    .insert({
      campaign_id: campaignId,
      character_id: characterId,
      site,
      test_label: testLabel ?? null,
      context: JSON.stringify({ ...context, site }),
      linked_catastrophe_id: linkedCatastropheId,
      timeout_ms: timeoutMs,
      action_id: actionId,
      target_token_id: targetTokenId,
    })
    .returning('*')

  // linkedCatastropheId — id de la ligne pending_catastrophes ouverte par le même jet (retour Saar
  // 2026-09-11 : une seule carte MJ unifiée, pas deux fenêtres "Catastrophe" séparées). Transmis au
  // client pour qu'il apparie les deux flux (CATASTROPHE_PENDING / CHANCE_CHOICE_PENDING).
  // timeoutMs/rolledAt : décompte visible côté client (retour Saar : le délai semblait arbitraire).
  // actionId : transmis pour qu'un futur affichage groupé (liste MJ multi-cibles, L4e) puisse
  // reconnaître les entrées d'un même tir sans requête supplémentaire.
  io.to(campaignId).emit(WS.CHANCE_CHOICE_PENDING, {
    id: pending.id,
    characterId,
    testLabel: pending.test_label,
    site,
    rolledAt: pending.rolled_at,
    linkedCatastropheId: pending.linked_catastrophe_id,
    timeoutMs: pending.timeout_ms,
    actionId: pending.action_id,
  })

  // .unref() — ce timer ne doit jamais empêcher le process de s'arrêter (arrêt serveur normal,
  // fin du process de test) : c'est un fallback best-effort, pas une obligation de résolution ;
  // même tradeoff déjà assumé plus haut (un redémarrage perd le timer, jamais la ligne en DB).
  const timeoutHandle = setTimeout(() => {
    timeoutHandles.delete(pending.id)
    resolveChanceChoice(io, campaignId, pending.id, { choice: null, resolvedByUserId: null })
      .catch(err => console.error('[WS] chanceCatastropheChoiceService — timeout resolve échoué:', err.message))
  }, timeoutMs).unref()
  timeoutHandles.set(pending.id, timeoutHandle)

  return pending
}

// resolveChanceChoice — idempotent (patron resolvePendingCatastrophe) : UPDATE ... WHERE
// resolved_at IS NULL, 0 ligne retournée = déjà résolue (choix joueur arrivé avant le timeout, ou
// double-clic) — rejeté silencieusement, jamais appliqué deux fois.
//
// Deux vocabulaires de choix pour deux mécaniques RAW distinctes (PLAN_CHANCE.md §12, décision
// 2026-09-12 : ne PAS les fusionner en un concept indifférencié) :
// - Régénération sur Catastrophe (L3e, 6 sites) : 'gain_point' (RAW "regagne 1 point de Chance") |
//   'reroll' (RAW "refaire son Test") | null (timeout — Test normal). Effet CENTRALISÉ ci-dessous
//   (handleCatastropheRegen/withdrawPendingCatastrophe) — les 6 sites le partagent à l'identique,
//   la centralisation reste la bonne pratique DRY, ne pas la déplacer dans chaque handler.
// - Forçage AOE longue/extrême portée (L4, site `aoe_avoidance`) : 'force' (RAW "Événement
//   favorable") | 'attempt' (Test de Chance) | null (timeout — reste touché normalement). AUCUN
//   effet central pour ces valeurs : contrairement à la régénération, cette mécanique n'est
//   partagée par aucun autre site aujourd'hui — son unique handler (`SITE_HANDLERS.aoe_avoidance`)
//   en porte l'intégralité (dépense/Test/jonction Aggregator), pas de duplication à éviter ici.
export async function resolveChanceChoice(io, campaignId, pendingId, { choice = null, resolvedByUserId } = {}) {
  const KNOWN_CHOICES = ['gain_point', 'reroll', 'force', 'attempt']
  if (choice !== null && !KNOWN_CHOICES.includes(choice)) {
    throw new AppError(400, `choice invalide : ${choice}`)
  }

  const [resolved] = await db('pending_chance_choices')
    .where({ id: pendingId, campaign_id: campaignId })
    .whereNull('resolved_at')
    .update({
      resolved_at: db.fn.now(),
      resolved_by: resolvedByUserId ?? null,
      choice,
    })
    .returning('*')

  if (!resolved) return null // déjà résolue — pas d'application en double

  // Choix arrivé avant l'échéance (joueur/MJ a répondu) — le timer devenu inutile est annulé pour
  // ne pas se redéclencher pour rien 45s plus tard (le timeout lui-même a déjà retiré son entrée
  // avant d'appeler ici, donc rien à faire dans ce cas précis).
  const pendingTimeout = timeoutHandles.get(pendingId)
  if (pendingTimeout) {
    clearTimeout(pendingTimeout)
    timeoutHandles.delete(pendingId)
  }

  const context = typeof resolved.context === 'string' ? JSON.parse(resolved.context) : resolved.context

  if (choice === 'gain_point') {
    const sheet = await db('char_sheet').where({ character_id: resolved.character_id }).first()
    if (sheet) await handleCatastropheRegen(sheet.id, { testLabel: resolved.test_label })
  }

  // 'reroll' remplace intégralement le Test d'origine (RAW "refaire son Test") — la Catastrophe
  // combat ouverte par CE MÊME jet (linked_catastrophe_id) ne tient plus, jamais laissée en attente
  // de validation MJ pour un Test qui n'a plus eu lieu (trouvaille Saar 2026-09-11, testée en jeu réel).
  if (choice === 'reroll' && resolved.linked_catastrophe_id) {
    await withdrawPendingCatastrophe(io, campaignId, resolved.linked_catastrophe_id)
  }

  const handler = SITE_HANDLERS[resolved.site]
  if (handler) await handler(io, campaignId, resolved, { choice, context })

  io.to(campaignId).emit(WS.CHANCE_CHOICE_RESOLVED, {
    id: resolved.id,
    characterId: resolved.character_id,
    choice,
  })

  return resolved
}

// listPendingChanceChoices — resync (montage client, reconnexion), patron listPendingCatastrophes.
export async function listPendingChanceChoices(campaignId) {
  return db('pending_chance_choices')
    .where({ campaign_id: campaignId })
    .whereNull('resolved_at')
    .orderBy('rolled_at', 'asc')
}

export { SITE_HANDLERS }
