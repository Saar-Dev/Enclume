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

// persistChanceChoice — écrit la ligne en attente (`pending_chance_choices`), SANS rien émettre ni armer de minuteur.
// `dbOrTrx` : la connexion globale, ou la transaction de la CAUSE quand la réaction doit naître atomiquement avec elle (une
// blessure et sa réaction de Chance : `woundService.applyWound`). Une réaction persistée dans la transaction est visible de
// tout ce qui décide dans la même transaction (ex. `reconcileWoundDeath`, qui ne tue pas tant qu'une réaction est ouverte).
//
// actionId/targetTokenId (PLAN_CHANCE.md L4, migration 341) — corrélation Aggregator/Scatter-Gather :
// plusieurs lignes ouvertes avec le même actionId (une par cible éligible d'un même tir AOE) forment
// un groupe que le site appelant (aoe_avoidance) rassemble à la dernière résolution. `targetTokenId`
// est le token à retirer de la résolution, distinct de `characterId` (le destinataire du choix, qui
// est le PILOTE si la cible est une exo — même distinguo que les sites L3e). Les deux restent `null`
// pour tout site à cible unique (L3e) : colonnes additives, jamais consultées hors L4.
//
// `options` (PLAN_CHANCE.md L5) : boutons dynamiques (nombre/libellé variable selon la capacité du palier visé, contrairement
// aux 2 boutons fixes de L3e/L4), embarqués dans `context` (colonne déjà persistée) plutôt qu'une nouvelle colonne — c'est de la
// métadonnée d'affichage, relue telle quelle par le resync SESSION_JOIN, jamais consultée par un handler de résolution.
export async function persistChanceChoice(dbOrTrx, campaignId, characterId, { testLabel, site, context = {}, timeoutMs = DEFAULT_TIMEOUT_MS, linkedCatastropheId = null, actionId = null, targetTokenId = null, options = null } = {}) {
  const [pending] = await dbOrTrx('pending_chance_choices')
    .insert({
      campaign_id: campaignId,
      character_id: characterId,
      site,
      test_label: testLabel ?? null,
      context: JSON.stringify({ ...context, site, options }),
      linked_catastrophe_id: linkedCatastropheId,
      timeout_ms: timeoutMs,
      action_id: actionId,
      target_token_id: targetTokenId,
    })
    .returning('*')
  return pending
}

// chanceChoicePendingPayload — LE payload de CHANCE_CHOICE_PENDING, construit depuis la ligne en base : autorité unique de sa
// forme, partagée par l'émission en direct (publishChanceChoice) et le resync de SESSION_JOIN (socket/index.js) — les deux
// divergeaient dès qu'un champ s'ajoutait à l'un.
// linkedCatastropheId — id de la ligne pending_catastrophes ouverte par le même jet (retour Saar 2026-09-11 : une seule carte MJ
// unifiée) ; timeoutMs/rolledAt : décompte visible côté client ; actionId : affichage groupé (liste MJ multi-cibles, L4e) ;
// woundId/chcAvailable/fatal/woundSeverity/woundLocation/subjectLabel : extraits de `context` (jamais renvoyé en entier, ce n'est
// pas une API générique) parce qu'un consommateur précis (le composant de réaction de blessure) en a besoin — chcAvailable =
// Chance au moment de l'ouverture, fatal = la blessure est une Mort (libellé « Accepter la mort »), le reste = résumé affiché.
export function chanceChoicePendingPayload(pending) {
  const context = typeof pending.context === 'string' ? JSON.parse(pending.context) : (pending.context ?? {})
  return {
    id: pending.id,
    characterId: pending.character_id,
    testLabel: pending.test_label,
    site: pending.site,
    rolledAt: pending.rolled_at,
    linkedCatastropheId: pending.linked_catastrophe_id,
    timeoutMs: pending.timeout_ms,
    actionId: pending.action_id,
    options: context.options ?? null,
    woundId: context.woundId ?? null,
    chcAvailable: context.chcAvailable ?? null,
    fatal: context.fatal === true,
    woundSeverity: context.severity ?? null,
    woundLocation: context.location ?? null,
    subjectLabel: context.label ?? null,
  }
}

// publishChanceChoice — à appeler APRÈS la validation de la transaction qui a persisté la ligne : émet CHANCE_CHOICE_PENDING et
// arme le timeout par défaut (RAW : pas de forçage silencieux, "Test normal" = ni point ni relance).
export function publishChanceChoice(io, campaignId, pending) {
  io.to(campaignId).emit(WS.CHANCE_CHOICE_PENDING, chanceChoicePendingPayload(pending))

  // .unref() — ce timer ne doit jamais empêcher le process de s'arrêter (arrêt serveur normal,
  // fin du process de test) : c'est un fallback best-effort, pas une obligation de résolution ;
  // même tradeoff déjà assumé plus haut (un redémarrage perd le timer, jamais la ligne en DB).
  const timeoutHandle = setTimeout(() => {
    timeoutHandles.delete(pending.id)
    resolveChanceChoice(io, campaignId, pending.id, { choice: null, resolvedByUserId: null })
      .catch(err => console.error('[WS] chanceCatastropheChoiceService — timeout resolve échoué:', err.message))
  }, pending.timeout_ms).unref()
  timeoutHandles.set(pending.id, timeoutHandle)
}

// openChanceChoice — pose la ligne en attente puis la publie (persistChanceChoice + publishChanceChoice, hors transaction
// appelante). Ne bloque jamais l'appelant — retourne dès l'insertion, la suite arrive via resolveChanceChoice. Façade conservée
// telle quelle pour les sites historiques (catastrophes, AOE, exo…) : seule la réaction de blessure a besoin des deux moitiés.
export async function openChanceChoice(io, campaignId, characterId, params = {}) {
  const pending = await persistChanceChoice(db, campaignId, characterId, params)
  publishChanceChoice(io, campaignId, pending)
  return pending
}

// withdrawWoundReactions — retire SANS l'appliquer toutes les réactions de blessure encore ouvertes d'un personnage : la ligne est
// close (choix nul, aucun handler, aucune dépense) et CHANCE_CHOICE_RESOLVED fait disparaître la carte chez ses clients. Appelée
// quand le personnage MEURT : un cadavre n'a plus de fenêtre de Chance (Lot 1e), une autre réaction ouverte n'a plus d'objet.
// Patron `withdrawPendingCatastrophe`. Retourne le nombre de réactions retirées.
export async function withdrawWoundReactions(io, campaignId, characterId) {
  const rows = await db('pending_chance_choices')
    .where({ campaign_id: campaignId, site: 'wound_severity' })
    .whereNull('resolved_at')
    .whereRaw(`context->>'characterId' = ?`, [characterId])
    .update({ resolved_at: db.fn.now(), choice: null })
    .returning(['id', 'character_id'])
  for (const row of rows) {
    const handle = timeoutHandles.get(row.id)
    if (handle) { clearTimeout(handle); timeoutHandles.delete(row.id) }
    io.to(campaignId).emit(WS.CHANCE_CHOICE_RESOLVED, { id: row.id, characterId: row.character_id, choice: null })
  }
  return rows.length
}

// listOpenWoundReactionWoundIds — parmi ces blessures, lesquelles ont une réaction de Chance (`wound_severity`) OUVERTE ?
// Lecture seule, `dbOrTrx` : sert `reconcileWoundDeath` (un personnage ne meurt pas tant que sa blessure mortelle attend
// une décision). SANS DANGER si une ligne devient périmée : on ne regarde que les blessures passées en paramètre, une ligne
// dont la blessure a disparu n'exclut donc rien.
export async function listOpenWoundReactionWoundIds(dbOrTrx, woundIds) {
  if (!woundIds?.length) return new Set()
  const rows = await dbOrTrx('pending_chance_choices')
    .where({ site: 'wound_severity' })
    .whereNull('resolved_at')
    .whereRaw(`context->>'woundId' = ANY(?::text[])`, [woundIds])
    .select(dbOrTrx.raw(`context->>'woundId' as wound_id`))
  return new Set(rows.map(row => row.wound_id))
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
// - Réduction de gravité de Blessure (L5, site `wound_severity`) : `reduce_N` où N est un nombre de
//   degrés calculé dynamiquement à l'ouverture (`computeAvailableSeverityReductions`, woundUtils.js —
//   jamais figé à {1,2}, RAW prévoit un palier au-delà en cas de "palier plein"). AUCUN effet
//   central non plus, même raisonnement que aoe_avoidance : un 3e vocabulaire de choix, propre à un
//   unique consommateur.
//
// Validation générique plutôt qu'une énumération figée (décision 2026-09-12, "règle des trois
// occurrences" : 3 vocabulaires de choix distincts pour 3 mécaniques RAW, chacun avec son propre
// handler qui ignore déjà silencieusement une valeur qu'il ne reconnaît pas — geler une liste
// blanche ici recouplerait à tort le moteur générique à chaque mécanique concrète, jamais
// extensible sans y revenir à chaque nouveau site). Le format reste contraint (identifiants courts,
// alphanumériques) pour rejeter un envoi manifestement corrompu, sans connaître le vocabulaire.
export async function resolveChanceChoice(io, campaignId, pendingId, { choice = null, resolvedByUserId } = {}) {
  if (choice !== null && !/^[a-z][a-z0-9_]{0,29}$/.test(choice)) {
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
