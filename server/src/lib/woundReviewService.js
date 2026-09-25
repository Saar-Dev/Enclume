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
import {
  WOUND_SEVERITIES, WOUND_LOCATIONS, isTestBlockingWound, getHealingTotalTests, isFirstHealingTest,
  getCareKits, defaultCareKits, sumCareKits,
} from '../../../shared/woundConstants.js'

const WOUND_CONDITION_TYPES = ['wound_healing_check', 'wound_infection_check']

async function enrichWoundEcheances(rows) {
  if (!rows.length) return []

  const woundIds = [...new Set(rows.map(r => r.payload?.woundId).filter(Boolean))]
  const wounds = woundIds.length ? await db('character_wounds').whereIn('id', woundIds) : []
  const woundsById = Object.fromEntries(wounds.map(w => [w.id, w]))

  const characterIds = [...new Set(rows.map(r => r.character_id))]
  const characters = characterIds.length ? await db('characters').whereIn('id', characterIds) : []
  const charactersById = Object.fromEntries(characters.map(c => [c.id, c]))

  return rows.map(r => {
    const wound = woundsById[r.payload?.woundId] ?? null
    const character = charactersById[r.character_id] ?? null
    return {
      id: r.id,
      conditionType: r.condition_type,
      status: r.status,
      payload: r.payload,
      nextDueMinutes: r.next_due_minutes,
      intervalMinutes: r.interval_minutes,
      occurrencesRemaining: r.occurrences_remaining,
      characterId: r.character_id,
      characterName: character?.name ?? null,
      wound: wound ? {
        id: wound.id, location: wound.location, severity: wound.severity, isStabilized: wound.is_stabilized,
      } : null,
    }
  })
}

// Écran de revue MJ (§6) — pending_mj_review ET awaiting_player_roll (le MJ voit tout le lot, même
// les lignes en attente d'un jet joueur, pour suivre l'avancement — seul le joueur peut agir dessus).
// **Correction 2026-07-30 (analyse à charge du chantier, trouvée en traçant Guérison→Infection de
// bout en bout)** : inclut aussi les échéances encore `active` mais déjà dues (`next_due_minutes <=
// game_time_resolved_minutes`) — un Échec/Catastrophe de Guérison fait naître un `wound_infection_check`
// déjà dû, mais celui-ci ne devient `pending_mj_review` qu'au *prochain* essai de
// `confirmPendingAdvance` (gameTimeService.js, vérification "newlyDue"), jamais avant. Sans cette
// union, la ligne reste invisible dans cet écran tant que le MJ n'a pas tenté de confirmer — même
// après un rafraîchissement manuel. `game_time_resolved_minutes` reste interne au serveur, jamais
// renvoyé par `enrichWoundEcheances` (invariant de non-fuite du Lot 1, toujours respecté ici).
// Échéances que l'écran de revue MJ doit montrer — source unique de l'ancienne liste plate (getPendingReviewForGm) et de la vue groupée
// par personnage (getReviewCardsForGm).
async function findReviewEcheances(campaignId) {
  const campaign = await db('campaigns').where({ id: campaignId }).select('game_time_resolved_minutes').first()
  if (!campaign) return []

  return db('game_echeances')
    .where({ campaign_id: campaignId })
    .whereIn('condition_type', WOUND_CONDITION_TYPES)
    .where((builder) => {
      builder
        .whereIn('status', ['pending_mj_review', 'awaiting_player_roll'])
        .orWhere((sub) => {
          sub.where({ status: 'active', interactive: true })
            .where('next_due_minutes', '<=', campaign.game_time_resolved_minutes)
        })
    })
    .select('*')
}

export async function getPendingReviewForGm(campaignId) {
  return enrichWoundEcheances(await findReviewEcheances(campaignId))
}

// ─── Vue groupée par personnage (PLAN_REVUE_GUERISON.md §10) ──────────────────────────────────────────────────────────────────────────────
// Le SERVEUR construit la vue ; le client l'affiche et n'invente aucune règle. Requêtes groupées (`whereIn`), jamais une par personnage.
// Elle remplace, au Lot 2a, la liste plate `getPendingReviewForGm` (qui disparaît avec son écran).

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

export async function getReviewCardsForGm(campaignId) {
  const rows = await findReviewEcheances(campaignId)
  if (rows.length === 0) return { cards: [], summary: { answerableCount: 0, queuedCount: 0 } }

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
      const wound = woundById[row.payload?.woundId]
      if (!wound) { // ne devrait plus exister depuis le Lot 0 : montré, jamais masqué (il bloquerait « Confirmer » en silence)
        orphans.push({ echeanceId: row.id, conditionType: row.condition_type, status: row.status, answerable: isAnswerable(row) })
      } else if (row.condition_type === 'wound_healing_check') {
        const key = `${wound.location}:${wound.severity}`
        if (!itemsByLine.has(key)) itemsByLine.set(key, { location: wound.location, severity: wound.severity, items: [] })
        itemsByLine.get(key).items.push(buildHealingItem(row, wound))
      } else {
        infections.push({
          echeanceId: row.id, location: wound.location, severity: wound.severity,
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

  const answerableCount = rows.filter(isAnswerable).length
  return { cards, summary: { answerableCount, queuedCount: rows.length - answerableCount } }
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
