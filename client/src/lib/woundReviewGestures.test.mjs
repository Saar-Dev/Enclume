import test from 'node:test'
import assert from 'node:assert/strict'

import {
  healingEntriesForLine, healingEntriesForCard, healingEntriesForCards, infectionEntriesForCard, infectionEntriesForCards, infectionEntryFor,
  orphanEntries, chunkEntries, sendInChunks, summarizeResults, cardAnswerableCount, cardDueCases, splitByPlayerType, successConsequence,
  lineStepLabels, isWindowVisible, confirmState, explainConfirmRefusal,
} from './woundReviewGestures.js'
import { REVIEW_BATCH_MAX_ENTRIES } from '../../../shared/woundConstants.js'

// Forme de la vue serveur : figée par server/src/lib/woundReviewService.test.mjs (« forme du payload FIGÉE »).
const item = (echeanceId, over = {}) => ({ echeanceId, answerable: true, step: null, isLastStep: true, isFirstTest: true, ...over })
const line = (location, severity, items, over = {}) => ({
  key: `${location}:${severity}`, location, severity, cases: items.length,
  dueCases: items.filter(i => i.answerable).length, queuedCases: items.filter(i => !i.answerable).length,
  answerable: items.some(i => i.answerable), dueEcheanceIds: items.filter(i => i.answerable).map(i => i.echeanceId),
  targetSeverity: 'grave', kits: null, items, ...over,
})
const card = (name, over = {}) => ({
  characterId: `c-${name}`, name, type: 'pj', isPlayer: true,
  state: { wounds: [], woundPenalty: 0, testBlocked: false, statuses: [] }, lines: [], infections: [], orphans: [], kitTotals: {}, ...over,
})
const view = (advance, summary, cards = []) => ({
  advance: { pending: advance, deltaMinutes: advance ? 10080 : null },
  cards, summary: { answerableCount: 0, awaitingPlayerCount: 0, queuedCount: 0, ...summary },
})

test('geste « toute la carte » : une entrée par échéance échue de chaque ligne répondable, la même issue partout', () => {
  const c = card('Zed', { lines: [
    line('corps', 'critique', [item('e1'), item('e2')]),
    line('tete', 'moyenne', [item('e3')]),
  ] })
  assert.deepEqual(healingEntriesForCard(c, 'amelioration'), [
    { echeanceId: 'e1', mjChoice: 'amelioration' }, { echeanceId: 'e2', mjChoice: 'amelioration' }, { echeanceId: 'e3', mjChoice: 'amelioration' },
  ])
  assert.deepEqual(healingEntriesForLine(c.lines[1], 'catastrophe'), [{ echeanceId: 'e3', mjChoice: 'catastrophe' }])
})

test('une ligne dont aucune case n\'est échue (prochaine ronde) n\'envoie rien ; une ligne mixte n\'envoie que ses cases échues', () => {
  const queued = line('corps', 'grave', [item('q1', { answerable: false })])
  const mixed = line('corps', 'critique', [item('m1'), item('m2', { answerable: false })])
  assert.deepEqual(healingEntriesForLine(queued, 'echec'), [])
  assert.deepEqual(healingEntriesForLine(mixed, 'echec'), [{ echeanceId: 'm1', mjChoice: 'echec' }])
})

test('geste « tous les PNJ » : les entrées de plusieurs cartes, dans l\'ordre des cartes', () => {
  const a = card('A', { lines: [line('corps', 'grave', [item('a1')])] })
  const b = card('B', { lines: [line('corps', 'grave', [item('b1')])] })
  assert.deepEqual(healingEntriesForCards([a, b], 'echec').map(e => e.echeanceId), ['a1', 'b1'])
})

test('infections : `auto` couvre aussi les jets en attente d\'un joueur (débloquer un absent) ; `player` ignore celles qui y sont déjà', () => {
  const c = card('Zed', { infections: [
    { echeanceId: 'i1', status: 'pending_mj_review', answerable: true },
    { echeanceId: 'i2', status: 'awaiting_player_roll', answerable: true },
    { echeanceId: 'i3', status: 'active', answerable: false },
  ] })
  assert.deepEqual(infectionEntriesForCard(c, 'auto').map(e => e.echeanceId), ['i1', 'i2'])
  assert.deepEqual(infectionEntriesForCard(c, 'player'), [{ echeanceId: 'i1', mode: 'player' }])
  assert.deepEqual(infectionEntriesForCards([c, c], 'player').length, 2)
  assert.deepEqual(infectionEntryFor(c.infections[1], 'auto'), { echeanceId: 'i2', mode: 'auto' })
})

test('anomalies (échéance sans blessure) : clôturées par la route de leur type, jamais masquées', () => {
  const c = card('Zed', { orphans: [
    { echeanceId: 'o1', conditionType: 'wound_healing_check', status: 'pending_mj_review', answerable: true },
    { echeanceId: 'o2', conditionType: 'wound_infection_check', status: 'pending_mj_review', answerable: true },
    { echeanceId: 'o3', conditionType: 'wound_healing_check', status: 'active', answerable: false },
  ] })
  assert.deepEqual(orphanEntries(c), {
    healing: [{ echeanceId: 'o1', mjChoice: 'amelioration' }],
    infection: [{ echeanceId: 'o2', mode: 'auto' }],
  })
})

test('découpage : jamais plus que la limite du serveur par lot, aucune entrée perdue ni dupliquée', () => {
  const entries = Array.from({ length: REVIEW_BATCH_MAX_ENTRIES * 2 + 5 }, (_, i) => ({ echeanceId: `e${i}` }))
  const chunks = chunkEntries(entries)
  assert.deepEqual(chunks.map(c => c.length), [REVIEW_BATCH_MAX_ENTRIES, REVIEW_BATCH_MAX_ENTRIES, 5])
  assert.deepEqual(chunks.flat(), entries)
  assert.deepEqual(chunkEntries([]), [])
  assert.deepEqual(chunkEntries([1, 2, 3], 2), [[1, 2], [3]])
})

test('envoi en lots : séquentiel, résultats réunis dans l\'ordre', async () => {
  const seen = []
  const send = async (chunk) => { seen.push(chunk.length); return { results: chunk.map(e => ({ echeanceId: e.echeanceId, resolved: true })) } }
  const outcome = await sendInChunks(['a', 'b', 'c'].map(echeanceId => ({ echeanceId })), send, 2)
  assert.deepEqual(seen, [2, 1])
  assert.deepEqual(outcome.results.map(r => r.echeanceId), ['a', 'b', 'c'])
  assert.equal(outcome.sent, 3)
  assert.equal(outcome.total, 3)
  assert.equal(outcome.failure, null)
})

test('envoi en lots : s\'arrête au premier échec de transport et dit ce qui a été appliqué', async () => {
  let calls = 0
  const boom = new Error('réseau')
  const send = async (chunk) => {
    calls += 1
    if (calls === 2) throw boom
    return { results: chunk.map(e => ({ echeanceId: e.echeanceId, resolved: true })) }
  }
  const outcome = await sendInChunks(['a', 'b', 'c', 'd', 'e'].map(echeanceId => ({ echeanceId })), send, 2)
  assert.equal(calls, 2, 'le troisième lot n\'est jamais envoyé')
  assert.equal(outcome.failure, boom)
  assert.equal(outcome.sent, 2)
  assert.equal(outcome.total, 5)
  assert.deepEqual(outcome.results.map(r => r.echeanceId), ['a', 'b'])
})

test('bilan des résultats : résolues, en attente d\'un joueur, périmées, annulées par le serveur', () => {
  assert.deepEqual(summarizeResults([
    { echeanceId: '1', resolved: true }, { echeanceId: '2', resolved: true },
    { echeanceId: '3', resolved: false, status: 'awaiting_player_roll' },
    { echeanceId: '4', resolved: false, stale: true },
    { echeanceId: '5', resolved: false, error: true },
  ]), { resolved: 2, waiting: 1, stale: 1, failed: 1 })
  assert.deepEqual(summarizeResults([]), { resolved: 0, waiting: 0, stale: 0, failed: 0 })
})

test('comptes d\'une carte : mêmes définitions que le serveur (échéances répondables, cases échues)', () => {
  const c = card('Zed', {
    lines: [line('corps', 'critique', [item('e1'), item('e2'), item('e3', { answerable: false })])],
    infections: [{ echeanceId: 'i1', answerable: true }, { echeanceId: 'i2', answerable: false }],
    orphans: [{ echeanceId: 'o1', answerable: true }],
  })
  assert.equal(cardAnswerableCount(c), 2 + 1 + 1)
  assert.equal(cardDueCases(c), 2)
  const { players, npcs } = splitByPlayerType([c, card('Bob', { isPlayer: false, type: 'pnj' })])
  assert.deepEqual([players.length, npcs.length], [1, 1])
})

test('conséquence de « Réussite » : dernière étape → gravité d\'arrivée ; étape intermédiaire → continue ; mélange → les deux', () => {
  const last = line('corps', 'moyenne', [item('e1')], { targetSeverity: 'legere' })
  assert.deepEqual(successConsequence(last), { kind: 'becomes', target: 'legere' })

  const middle = line('corps', 'critique', [item('e1', { step: { n: 2, total: 3 }, isLastStep: false })])
  assert.deepEqual(successConsequence(middle), { kind: 'continues', steps: ['2/3'] })
  assert.deepEqual(lineStepLabels(middle), ['2/3'])

  const mixed = line('corps', 'critique', [
    item('e1', { step: { n: 2, total: 3 }, isLastStep: false }), item('e2', { step: { n: 3, total: 3 }, isLastStep: true }),
  ], { targetSeverity: 'grave' })
  assert.deepEqual(successConsequence(mixed), { kind: 'mixed', target: 'grave', steps: ['2/3'] })

  const queuedOnly = line('corps', 'grave', [item('e1', { answerable: false })])
  assert.equal(successConsequence(queuedOnly), null, 'rien d\'échu : aucune conséquence à annoncer')
})

test('visibilité : l\'écran reste ouvert tant qu\'une avance est en attente, même sans aucune réponse à donner (B5)', () => {
  assert.equal(isWindowVisible(null), false, 'avant le premier chargement')
  assert.equal(isWindowVisible(view(false, {})), false)
  assert.equal(isWindowVisible(view(true, {})), true, 'avance en attente, tout est répondu : Confirmer doit rester accessible')
  assert.equal(isWindowVisible(view(false, { answerableCount: 2 })), true)
})

test('bouton « Confirmer » : actif seulement pour une avance en attente sans réponse restante ; la raison est un code', () => {
  assert.deepEqual(confirmState(view(false, {})), { canConfirm: false, reason: 'noAdvance', count: 0, awaitingPlayerCount: 0, nextRoundCount: 0 })
  assert.deepEqual(confirmState(null).reason, 'noAdvance')
  assert.deepEqual(confirmState(view(true, { answerableCount: 3, awaitingPlayerCount: 1 })),
    { canConfirm: false, reason: 'answersLeft', count: 3, awaitingPlayerCount: 1, nextRoundCount: 0 })
  assert.deepEqual(confirmState(view(true, {})), { canConfirm: true, reason: null, count: 0, awaitingPlayerCount: 0, nextRoundCount: 0 })
  assert.equal(confirmState(view(true, { queuedCount: 4 })).nextRoundCount, 4, 'des échéances déjà dues annoncent la ronde suivante')
})

test('refus de « Confirmer » : ronde suivante si des échéances déjà dues se sont ouvertes, sinon réponses restantes, sinon message du serveur', () => {
  const before = view(true, { queuedCount: 2 })
  assert.equal(explainConfirmRefusal(before, view(true, { answerableCount: 2 })), 'nextRound')
  assert.equal(explainConfirmRefusal(view(true, { answerableCount: 1 }), view(true, { answerableCount: 1 })), 'answersLeft')
  assert.equal(explainConfirmRefusal(before, view(true, {})), 'unknown')
  assert.equal(explainConfirmRefusal(null, null), 'unknown')
})
