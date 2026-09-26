// server/src/lib/woundReviewService.js — Enrichissement des échéances Blessures pour un écran
// humain (docs/PLAN_BLESSURES_GUERISON.md §6.1). Le Lot 2 générique (`echeanceService.js`) reste
// agnostique du métier — `payload` n'y est qu'un identifiant opaque (`{ woundId }`). Cet
// enrichissement (jointure vers character_wounds/characters) est une responsabilité du domaine
// Blessures, jamais celle du moteur générique. Lecture seule via `db` (comme `previewDueEcheances`,
// même raison : hors transaction, jamais utilisée pour une décision serveur).
import db from '../db/knex.js'
import { WS } from '../../../shared/events.js'
import { getWorstWoundSeverity, improvedSeverity } from './woundUtils.js'
import { calcWoundPenalty } from './charStats.js'
import { reviewTrace, shortId } from './reviewTrace.js'
import {
  WOUND_SEVERITIES, WOUND_LOCATIONS, isTestBlockingWound, getHealingTotalTests, isFirstHealingTest,
  getCareKits, defaultCareKits, sumCareKits, findInfectionTarget,
} from '../../../shared/woundConstants.js'

const WOUND_CONDITION_TYPES = ['wound_healing_check', 'wound_infection_check']

// Une échéance d'INFECTION est celle d'une localisation (Lot B1) : on la décrit par sa localisation et la pire blessure susceptible de s'infecter qui s'y trouve
// (`severity`, null si la localisation n'en a plus).
async function enrichWoundEcheances(rows) {
  if (!rows.length) return []

  const characterIds = [...new Set(rows.map(r => r.character_id))]
  const [characters, sheets] = await Promise.all([
    db('characters').whereIn('id', characterIds),
    db('char_sheet').whereIn('character_id', characterIds).select('id', 'character_id'),
  ])
  const charactersById = Object.fromEntries(characters.map(c => [c.id, c]))
  const sheetByCharacter = Object.fromEntries(sheets.map(s => [s.character_id, s.id]))
  const wounds = sheets.length ? await db('character_wounds').whereIn('char_sheet_id', sheets.map(s => s.id)).select('char_sheet_id', 'location', 'severity') : []

  return rows.map(r => {
    const location = r.payload?.location ?? null
    const sheetId = sheetByCharacter[r.character_id]
    const target = location ? findInfectionTarget(wounds.filter(w => w.char_sheet_id === sheetId && w.location === location)) : null
    return {
      id: r.id,
      conditionType: r.condition_type,
      status: r.status,
      payload: r.payload,
      nextDueMinutes: r.next_due_minutes,
      intervalMinutes: r.interval_minutes,
      occurrencesRemaining: r.occurrences_remaining,
      characterId: r.character_id,
      characterName: charactersById[r.character_id]?.name ?? null,
      location,
      severity: target?.severity ?? null,
    }
  })
}

// Écran de revue MJ (§6) — pending_mj_review ET awaiting_player_roll (le MJ voit tout le lot, même
// les lignes en attente d'un jet joueur : il peut aussi les lancer en automatique pour débloquer un joueur absent).
// **Correction 2026-07-30 (analyse à charge du chantier, trouvée en traçant Guérison→Infection de
// bout en bout)** : inclut aussi les échéances encore `active` mais déjà dues (`next_due_minutes <=
// game_time_resolved_minutes`) — un Échec/Catastrophe de Guérison fait naître un `wound_infection_check`
// déjà dû, mais celui-ci ne devient `pending_mj_review` qu'au *prochain* essai de
// `confirmPendingAdvance` (gameTimeService.js, vérification "newlyDue"), jamais avant. Sans cette
// union, la ligne reste invisible dans cet écran tant que le MJ n'a pas tenté de confirmer — même
// après un rafraîchissement manuel. `game_time_resolved_minutes` reste interne au serveur, jamais
// renvoyé par `enrichWoundEcheances` (invariant de non-fuite du Lot 1, toujours respecté ici).
// État de la revue d'une campagne : l'avance de temps en attente (`campaigns.pending_advance_delta_minutes`, jusqu'ici inconnue du client)
// et les échéances que l'écran de revue MJ doit montrer. `game_time_resolved_minutes` reste interne au serveur, jamais renvoyé.
//
// Horizon des échéances « déjà dues » (prochaine ronde) : EXACTEMENT celui de `confirmPendingAdvance` (gameTimeService.js) — la fin de l'avance en attente,
// `max(résolu, affiché + avance)` — et non le seul repère résolu actuel. Constaté sur les traces de la revue (2026-09-26) : les infections nées d'un Échec
// sont dues à la date de leur guérison, APRÈS le repère résolu (qui n'avance qu'à la confirmation) : avec l'ancien horizon la vue annonçait « 0 à la ronde
// suivante » puis « Confirmer » ouvrait 4 échéances en refus 409. La vue doit prédire ce que « Confirmer » va faire, pas le découvrir après coup.
async function loadReviewState(campaignId) {
  const campaign = await db('campaigns').where({ id: campaignId })
    .select('game_time_minutes', 'game_time_resolved_minutes', 'pending_advance_delta_minutes').first()
  if (!campaign) return { advance: { pending: false, deltaMinutes: null }, rows: [] }

  const deltaMinutes = campaign.pending_advance_delta_minutes ?? null
  const dueHorizon = deltaMinutes === null
    ? campaign.game_time_resolved_minutes
    : Math.max(campaign.game_time_resolved_minutes, campaign.game_time_minutes + deltaMinutes)
  const rows = await db('game_echeances')
    .where({ campaign_id: campaignId })
    .whereIn('condition_type', WOUND_CONDITION_TYPES)
    .where((builder) => {
      builder
        .whereIn('status', ['pending_mj_review', 'awaiting_player_roll'])
        .orWhere((sub) => {
          sub.where({ status: 'active', interactive: true })
            .where('next_due_minutes', '<=', dueHorizon)
        })
    })
    .select('*')
  return { advance: { pending: deltaMinutes !== null, deltaMinutes }, rows }
}

// ─── Vue groupée par personnage (PLAN_REVUE_GUERISON.md §10, §12) ─────────────────────────────────────────────────────────────────────────
// Le SERVEUR construit la vue ; le client l'affiche et n'invente aucune règle. Requêtes groupées (`whereIn`), jamais une par personnage.
// Source unique de l'écran de revue : la liste plate `getPendingReviewForGm` a disparu avec l'ancien écran (Lot 2a).

const severityRank = (severity) => WOUND_SEVERITIES.indexOf(severity)
const locationRank = (location) => WOUND_LOCATIONS.indexOf(location)
const byWorstFirst = (a, b) => severityRank(b.severity) - severityRank(a.severity) || locationRank(a.location) - locationRank(b.location)

// Un Test n'est répondable que dans un état de revue ; une échéance `active` déjà due attend que « Confirmer » l'ouvre (prochaine ronde).
const REVIEW_ANSWERABLE_STATUSES = ['pending_mj_review', 'awaiting_player_roll']
const isAnswerable = (echeance) => REVIEW_ANSWERABLE_STATUSES.includes(echeance.status)

function buildHealingItem(row, wound) {
  const total = getHealingTotalTests(wound.severity, wound.location)
  const occurrences = row.occurrences_remaining
  return {
    echeanceId: row.id,
    answerable: isAnswerable(row),
    // « semaine n/N » d'une échéance à soins constants ; une échéance unique (Moyenne/Grave) n'a pas d'étape.
    step: total === null ? null : { n: total - occurrences + 1, total },
    isLastStep: occurrences === null || occurrences <= 1,
    isFirstTest: isFirstHealingTest(wound.severity, wound.location, occurrences),
    occurrences,
  }
}

// Une ligne du compteur = UN Test (RAW « Localisation par Localisation », REGLEBLESSURES.md:386-392), donc un seul jeu de kits : celui du Test
// le plus exigeant parmi ses cases échues (le premier Test d'une blessure, s'il y en a un).
function buildLine(location, severity, items, casesOnLine) {
  const answerableItems = items.filter(item => item.answerable)
  const reference = answerableItems.find(item => item.isFirstTest) ?? answerableItems[0] ?? null
  const alternatives = reference ? getCareKits(severity, location, reference.occurrences) : null
  return {
    key: `${location}:${severity}`,
    location,
    severity,
    cases: casesOnLine,
    dueCases: answerableItems.length,
    queuedCases: items.length - answerableItems.length,
    answerable: answerableItems.length > 0,
    dueEcheanceIds: answerableItems.map(item => item.echeanceId),
    targetSeverity: improvedSeverity(severity),
    kits: alternatives ? { alternatives, defaultKits: defaultCareKits(alternatives) } : null,
    items: items.map(({ occurrences, ...item }) => item),
  }
}

// Compteurs de l'écran : `answerableCount` = échéances auxquelles le MJ peut répondre maintenant (ce sont elles qui bloquent « Confirmer ») ;
// `awaitingPlayerCount` = sous-ensemble en attente d'un jet joueur (le MJ peut quand même les lancer en automatique) ; `queuedCount` = déjà dues
// mais pas encore ouvertes (prochaine ronde).
function summarize(rows) {
  const answerableCount = rows.filter(isAnswerable).length
  return {
    answerableCount,
    awaitingPlayerCount: rows.filter(r => r.status === 'awaiting_player_roll').length,
    queuedCount: rows.length - answerableCount,
  }
}

// `advance` = l'avance de temps en attente (le client ne pouvait pas la connaître : l'ancien écran, caché quand la liste était vide, emportait
// « Confirmer » / « Annuler » — PLAN_REVUE_GUERISON.md §12.1). Une vue sans échéance renvoie donc quand même `advance`.
export async function getReviewCardsForGm(campaignId) {
  const started = Date.now()
  const view = await buildReviewView(campaignId)
  reviewTrace(() => {
    const { advance, cards, summary } = view
    const lines = cards.reduce((n, c) => n + c.lines.length, 0)
    const infections = cards.reduce((n, c) => n + c.infections.length, 0)
    const orphans = cards.reduce((n, c) => n + c.orphans.length, 0)
    const advanceText = advance.pending ? `avance en attente de ${advance.deltaMinutes} min` : "aucune avance en attente"
    return `vue de la revue lue (campagne ${shortId(campaignId)}, ${Date.now() - started} ms) : ${advanceText} ; ${cards.length} personnage(s) (${cards.filter(c => c.isPlayer).length} PJ), ${lines} ligne(s), ${infections} infection(s), ${orphans} anomalie(s) ; ${summary.answerableCount} réponse(s) à donner dont ${summary.awaitingPlayerCount} jet(s) de joueur, ${summary.queuedCount} à la ronde suivante${orphans > 0 ? ' ⚠ ANOMALIE : échéance sans blessure' : ''}`
  })
  return view
}

async function buildReviewView(campaignId) {
  const { advance, rows } = await loadReviewState(campaignId)
  if (rows.length === 0) return { advance, cards: [], summary: summarize(rows) }

  const characterIds = [...new Set(rows.map(r => r.character_id))]
  const [characters, sheets, statusRows] = await Promise.all([
    db('characters').whereIn('id', characterIds).select('id', 'name', 'type'),
    db('char_sheet').whereIn('character_id', characterIds).select('id', 'character_id'),
    db('token_statuses as ts')
      .join('tokens as t', 't.id', 'ts.token_id')
      .join('battlemaps as bm', 'bm.id', 't.battlemap_id')
      .whereIn('t.character_id', characterIds)
      .where('bm.campaign_id', campaignId)
      .select('t.character_id', 'ts.status_code'),
  ])
  const sheetIds = sheets.map(s => s.id)
  const wounds = sheetIds.length ? await db('character_wounds').whereIn('char_sheet_id', sheetIds).select('*') : []

  const characterBySheet = Object.fromEntries(sheets.map(s => [s.id, s.character_id]))
  const woundsByCharacter = new Map(characterIds.map(id => [id, []]))
  for (const wound of wounds) woundsByCharacter.get(characterBySheet[wound.char_sheet_id])?.push(wound)
  const woundById = Object.fromEntries(wounds.map(w => [w.id, w]))
  const statusesByCharacter = new Map(characterIds.map(id => [id, new Set()]))
  for (const { character_id, status_code } of statusRows) statusesByCharacter.get(character_id)?.add(status_code)

  const cards = characters.map((character) => {
    const characterWounds = woundsByCharacter.get(character.id) ?? []
    const characterRows = rows.filter(r => r.character_id === character.id)

    const casesByLine = new Map()
    for (const wound of characterWounds) {
      const key = `${wound.location}:${wound.severity}`
      casesByLine.set(key, (casesByLine.get(key) ?? 0) + 1)
    }

    const itemsByLine = new Map()
    const infections = []
    const orphans = []
    for (const row of characterRows) {
      // Une guérison appartient à une CASE ; une infection à une LOCALISATION, décrite par sa pire blessure susceptible de s'infecter.
      const isHealing = row.condition_type === 'wound_healing_check'
      const wound = isHealing ? woundById[row.payload?.woundId] : null
      const infectionTarget = isHealing ? null : findInfectionTarget(characterWounds.filter(w => w.location === row.payload?.location))
      if (isHealing ? !wound : !infectionTarget) { // ne devrait plus exister depuis le Lot 0 : montré, jamais masqué (il bloquerait « Confirmer » en silence)
        orphans.push({ echeanceId: row.id, conditionType: row.condition_type, status: row.status, answerable: isAnswerable(row) })
      } else if (isHealing) {
        const key = `${wound.location}:${wound.severity}`
        if (!itemsByLine.has(key)) itemsByLine.set(key, { location: wound.location, severity: wound.severity, items: [] })
        itemsByLine.get(key).items.push(buildHealingItem(row, wound))
      } else {
        infections.push({
          echeanceId: row.id, location: row.payload.location, severity: infectionTarget.severity,
          rollsNeeded: row.occurrences_remaining ?? 1, status: row.status, answerable: isAnswerable(row),
        })
      }
    }

    const lines = [...itemsByLine.entries()]
      .map(([key, { location, severity, items }]) => buildLine(location, severity, items, casesByLine.get(key) ?? 0))
      .sort(byWorstFirst)

    const stateWounds = [...casesByLine.entries()]
      .map(([key, cases]) => { const [location, severity] = key.split(':'); return { location, severity, cases } })
      .sort(byWorstFirst)

    return {
      characterId: character.id,
      name: character.name,
      type: character.type,
      isPlayer: character.type === 'pj',
      state: {
        wounds: stateWounds,
        woundPenalty: calcWoundPenalty(characterWounds),
        testBlocked: isTestBlockingWound(characterWounds),
        statuses: [...(statusesByCharacter.get(character.id) ?? [])].sort(),
      },
      lines,
      infections: infections.sort(byWorstFirst),
      orphans,
      kitTotals: sumCareKits(lines.filter(l => l.answerable && l.kits).map(l => l.kits.defaultKits)),
    }
  })
  // Joueurs d'abord, puis PNJ ; par nom (le RAW réserve le système détaillé aux PJ et aux adversaires marquants).
  cards.sort((a, b) => Number(b.isPlayer) - Number(a.isPlayer) || a.name.localeCompare(b.name, 'fr'))

  return { advance, cards, summary: summarize(rows) }
}


// Panneau joueur "Jets en attente" (§6) — uniquement les échéances awaiting_player_roll dont le
// personnage appartient à l'appelant. `isGm` : un MJ voit tous les jets en attente de la campagne
// (utile pour relancer/suivre pour le compte d'un PNJ ou un joueur absent).
export async function getPendingRollsForPlayer(campaignId, userId, { isGm = false } = {}) {
  let query = db('game_echeances')
    .join('characters', 'characters.id', 'game_echeances.character_id')
    .where({ 'game_echeances.campaign_id': campaignId, 'game_echeances.status': 'awaiting_player_roll' })
    .where({ 'game_echeances.condition_type': 'wound_infection_check' })

  if (!isGm) query = query.where({ 'characters.user_id': userId })

  const rows = await query.select('game_echeances.*')
  return enrichWoundEcheances(rows)
}

// Diffuse WOUND_UPDATED (événement déjà existant, `shared/events.js:64`, consommateur client déjà
// générique — voir docs/PLAN_BLESSURES_GUERISON.md §6.1) après la résolution d'une échéance
// Guérison/Infection. `charSheetIdForWorst` : capturé par l'appelant *avant* la résolution (une
// Amélioration/Infection peut supprimer la ligne de blessure ciblée, `getWorstWoundSeverity` a
// toujours besoin d'un char_sheet_id valable même si `woundId` a disparu entre-temps).
export async function broadcastWoundUpdate(io, campaignId, { characterId, charSheetIdForWorst, woundId }) {
  const [wound, worst_wound_severity] = await Promise.all([
    db('character_wounds').where({ id: woundId }).first(),
    getWorstWoundSeverity(db, charSheetIdForWorst),
  ])
  io.to(campaignId).emit(WS.WOUND_UPDATED, { characterId, wound: wound ?? null, worst_wound_severity })
}
