process.env.REVIEW_TRACE = '0' // les traces du serveur ne noient pas la sortie des tests (elles sont vérifiées dans reviewTrace.test.mjs)
import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { getPendingRollsForPlayer, getReviewCardsForGm } from './woundReviewService.js'
import { resolveWoundInsertion } from './woundUtils.js'
import './echeanceHandlerRegistrations.js' // effet de bord : peuple le registre (écrire une blessure programme son échéance de guérison)

// Lancement manuel : node --env-file=../.env --test server/src/lib/woundReviewService.test.mjs
// getReviewCardsForGm/getPendingRollsForPlayer utilisent `db` (pas `trx`, même raison que
// previewDueEcheances) — patron "committe réellement puis nettoie explicitement", pas le rollback
// habituel (une connexion séparée ne verrait pas des écritures non commitées).
const skip = !process.env.DATABASE_URL

async function createRealFixture() {
  const [gm] = await db('users')
    .insert({ email: `wrs-gm-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'wrs-gm' })
    .returning('*')
  const [player] = await db('users')
    .insert({ email: `wrs-player-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'wrs-player' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test revue', invite_code: `WRS-${Date.now()}-${Math.random()}` })
    .returning('*')
  await db('campaign_members').insert([
    { campaign_id: campaign.id, user_id: gm.id, role: 'gm' },
    { campaign_id: campaign.id, user_id: player.id, role: 'player' },
  ])
  const [character] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: player.id, name: 'Perso test revue' })
    .returning('*')
  const [charSheet] = await db('char_sheet').insert({ character_id: character.id }).returning('*')
  const [wound] = await db('character_wounds')
    .insert({ char_sheet_id: charSheet.id, location: 'corps', severity: 'grave', occurred_at_game_minutes: 0 })
    .returning('*')
  return { gm, player, campaign, character, wound }
}

async function cleanup({ campaign, gm, player }) {
  if (campaign) await db('campaigns').where({ id: campaign.id }).del()
  if (gm) await db('users').where({ id: gm.id }).del()
  if (player) await db('users').where({ id: player.id }).del()
}

test('getPendingRollsForPlayer : un joueur ne voit que les jets de son propre personnage', { skip }, async () => {
  const fixture = await createRealFixture()
  let autre
  try {
    const { campaign, character, wound, player } = fixture
    const [autreUser] = await db('users')
      .insert({ email: `wrs-other-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'wrs-other' })
      .returning('*')
    autre = autreUser

    await db('campaign_members').insert({ campaign_id: campaign.id, user_id: autre.id, role: 'player' })
    const [autreCharacter] = await db('characters')
      .insert({ campaign_id: campaign.id, user_id: autre.id, name: 'Autre perso' })
      .returning('*')

    await db('game_echeances').insert({
      campaign_id: campaign.id, character_id: character.id, condition_type: 'wound_infection_check',
      interactive: true, payload: { location: wound.location }, next_due_minutes: 100, status: 'awaiting_player_roll',
    })
    await db('game_echeances').insert({
      campaign_id: campaign.id, character_id: autreCharacter.id, condition_type: 'wound_infection_check',
      interactive: true, payload: { location: wound.location }, next_due_minutes: 100, status: 'awaiting_player_roll',
    })

    const rows = await getPendingRollsForPlayer(campaign.id, player.id, { isGm: false })
    assert.equal(rows.length, 1)
    assert.equal(rows[0].characterId, character.id)
    // Une infection est décrite par sa LOCALISATION et la pire blessure susceptible de s'infecter qui s'y trouve (jamais une case).
    assert.equal(rows[0].location, wound.location)
    assert.equal(rows[0].severity, wound.severity)
  } finally {
    // ordre important : la campagne (et son cascade campaign_members/characters) doit partir avant
    // l'utilisateur "autre", sinon la FK campaign_members_user_id_foreign bloque la suppression.
    await cleanup(fixture)
    if (autre) await db('users').where({ id: autre.id }).del()
  }
})

test('getPendingRollsForPlayer : un MJ voit tous les jets en attente de la campagne', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    const { campaign, character, wound, gm } = fixture
    await db('game_echeances').insert({
      campaign_id: campaign.id, character_id: character.id, condition_type: 'wound_infection_check',
      interactive: true, payload: { location: wound.location }, next_due_minutes: 100, status: 'awaiting_player_roll',
    })
    const rows = await getPendingRollsForPlayer(campaign.id, gm.id, { isGm: true })
    assert.equal(rows.length, 1)
  } finally {
    await cleanup(fixture)
  }
})

test('getPendingRollsForPlayer : ne retourne jamais un wound_healing_check (jamais de jet)', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    const { campaign, character, wound, player } = fixture
    await db('game_echeances').insert({
      campaign_id: campaign.id, character_id: character.id, condition_type: 'wound_healing_check',
      interactive: true, payload: { woundId: wound.id }, next_due_minutes: 100, status: 'awaiting_player_roll',
    })
    const rows = await getPendingRollsForPlayer(campaign.id, player.id, { isGm: false })
    assert.equal(rows.length, 0)
  } finally {
    await cleanup(fixture)
  }
})


// ─── Vue groupée par personnage (PLAN_REVUE_GUERISON.md §10) ────────────────────────────────────────────────────────────────────────────

async function createCardsFixture() {
  const [gm] = await db('users').insert({ email: `wrc-gm-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'wrc-gm' }).returning('*')
  const [player] = await db('users').insert({ email: `wrc-pl-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'wrc-player' }).returning('*')
  const [campaign] = await db('campaigns').insert({ gm_id: gm.id, name: 'Campagne test cartes', invite_code: `WRC-${Date.now()}-${Math.random()}` }).returning('*')
  const [other] = await db('campaigns').insert({ gm_id: gm.id, name: 'Autre campagne test cartes', invite_code: `WRC2-${Date.now()}-${Math.random()}` }).returning('*')
  const makeCharacter = async (inCampaign, name, type, userId = null) => {
    const [character] = await db('characters').insert({ campaign_id: inCampaign.id, user_id: userId, name, type }).returning('*')
    const [sheet] = await db('char_sheet').insert({ character_id: character.id }).returning('*')
    return { character, sheet, schedule: { campaignId: inCampaign.id, characterId: character.id } }
  }
  const pj = await makeCharacter(campaign, 'Zed le PJ', 'pj', player.id)
  const pnj = await makeCharacter(campaign, 'Aaron le PNJ', 'pnj')
  const foreign = await makeCharacter(other, 'Étranger', 'pj', player.id)
  return { gm, player, campaign, other, pj, pnj, foreign }
}

async function cleanupCards({ gm, player, campaign, other }) {
  for (const c of [campaign, other]) if (c) await db('campaigns').where({ id: c.id }).del()
  for (const u of [gm, player]) if (u) await db('users').where({ id: u.id }).del()
}

// Une blessure écrite par le seul écrivain (avec son échéance de guérison), échéance ouverte en revue (comme le fait requestGameTimeAdvance).
async function woundInReview(who, location, severity, { open = true } = {}) {
  const inserted = await db.transaction(trx => resolveWoundInsertion(trx, who.sheet.id, location, severity, who.schedule))
  if (open) await db('game_echeances').where({ id: inserted.echeance.id }).update({ status: 'pending_mj_review' })
  return inserted
}

test('getReviewCardsForGm : une carte par personnage, joueurs avant PNJ, lignes du compteur (une par localisation+gravité) de la pire à la plus légère', { skip }, async () => {
  const f = await createCardsFixture()
  try {
    await woundInReview(f.pj, 'corps', 'moyenne')
    await woundInReview(f.pj, 'corps', 'moyenne') // 2 cases sur la même ligne
    await woundInReview(f.pj, 'jambe_gauche', 'critique')
    await woundInReview(f.pj, 'tete', 'mortelle')
    await woundInReview(f.pnj, 'bras_droit', 'grave')
    await woundInReview(f.foreign, 'corps', 'grave') // autre campagne : jamais dans cette vue

    const { cards, summary } = await getReviewCardsForGm(f.campaign.id)
    assert.deepEqual(cards.map(c => c.name), ['Zed le PJ', 'Aaron le PNJ'], 'joueurs d\'abord, puis PNJ')
    assert.deepEqual(cards.map(c => c.isPlayer), [true, false])
    assert.equal(summary.answerableCount, 5)
    assert.equal(summary.queuedCount, 0)

    const [pjCard] = cards
    assert.deepEqual(pjCard.lines.map(l => l.key), ['tete:mortelle', 'jambe_gauche:critique', 'corps:moyenne'])

    const moyenne = pjCard.lines.find(l => l.key === 'corps:moyenne')
    assert.equal(moyenne.cases, 2)
    assert.equal(moyenne.dueCases, 2)
    assert.equal(moyenne.queuedCases, 0)
    assert.equal(moyenne.answerable, true)
    assert.equal(moyenne.dueEcheanceIds.length, 2)
    assert.equal(moyenne.targetSeverity, 'legere')
    assert.deepEqual(moyenne.kits, { alternatives: [['premiersSoins'], ['medecine']], defaultKits: ['premiersSoins'] })
    assert.equal(moyenne.items.every(i => i.step === null && i.isLastStep === true), true, 'échéance unique : pas d\'étape')

    const critique = pjCard.lines.find(l => l.key === 'jambe_gauche:critique')
    assert.equal(critique.items[0].step.n, 1)
    assert.equal(critique.items[0].step.total, 3)
    assert.equal(critique.items[0].isLastStep, false)
    assert.equal(critique.targetSeverity, 'grave')
    assert.deepEqual(critique.kits.alternatives, [['medecine']])

    const mortelle = pjCard.lines.find(l => l.key === 'tete:mortelle')
    assert.deepEqual(mortelle.kits.alternatives, [['chirurgie', 'medecine']], 'premier Test : l\'opération')
    assert.deepEqual([mortelle.items[0].step.n, mortelle.items[0].step.total], [1, 5])

    // Un jeu de kits par LIGNE (une Moyenne à 2 cases = un seul kit) : premiersSoins 1, médecine 1 (Critique) + 1 (Mortelle), chirurgie 1.
    assert.deepEqual(pjCard.kitTotals, { premiersSoins: 1, medecine: 2, chirurgie: 1 })

    // État du personnage : compteur groupé, malus, Test bloqué (Mortelle).
    assert.deepEqual(pjCard.state.wounds.map(w => [w.location, w.severity, w.cases]),
      [['tete', 'mortelle', 1], ['jambe_gauche', 'critique', 1], ['corps', 'moyenne', 2]])
    assert.equal(pjCard.state.woundPenalty, -10)
    assert.equal(pjCard.state.testBlocked, true)
  } finally {
    await cleanupCards(f)
  }
})

test('getReviewCardsForGm : cases échues ≠ cases de la ligne ; une échéance `active` (prochaine ronde) n\'est pas répondable ; kits seulement si répondable', { skip }, async () => {
  const f = await createCardsFixture()
  try {
    await woundInReview(f.pj, 'corps', 'moyenne')                      // ouverte
    await woundInReview(f.pj, 'corps', 'moyenne', { open: false })     // pas encore ouverte (active)
    await woundInReview(f.pj, 'tete', 'grave', { open: false })        // ligne entièrement en attente de la prochaine ronde

    // Une échéance `active` n'apparaît que si elle est DÉJÀ due : on avance l'horloge résolue de la campagne.
    await db('campaigns').where({ id: f.campaign.id }).update({ game_time_resolved_minutes: 1000000 })

    const { cards, summary } = await getReviewCardsForGm(f.campaign.id)
    const [card] = cards
    const partial = card.lines.find(l => l.key === 'corps:moyenne')
    assert.equal(partial.cases, 2)
    assert.equal(partial.dueCases, 1)
    assert.equal(partial.queuedCases, 1)
    assert.equal(partial.answerable, true)
    assert.equal(partial.dueEcheanceIds.length, 1)

    const queued = card.lines.find(l => l.key === 'tete:grave')
    assert.equal(queued.answerable, false)
    assert.deepEqual(queued.dueEcheanceIds, [])
    assert.equal(queued.kits, null)
    assert.equal(summary.answerableCount, 1)
    assert.equal(summary.queuedCount, 2)
    assert.deepEqual(card.kitTotals, { premiersSoins: 1, medecine: 0, chirurgie: 0 }, 'seule la ligne répondable compte')
  } finally {
    await cleanupCards(f)
  }
})

test('getReviewCardsForGm : infections décrites (jets nécessaires) ; échéance sans blessure montrée, jamais masquée ; statuts de token ; campagne vide', { skip }, async () => {
  const f = await createCardsFixture()
  try {
    const empty = await getReviewCardsForGm(f.campaign.id)
    assert.deepEqual(empty, { advance: { pending: false, deltaMinutes: null }, cards: [], summary: { answerableCount: 0, awaitingPlayerCount: 0, queuedCount: 0 } })

    const moyenne = await woundInReview(f.pj, 'bras_droit', 'moyenne')
    const [infection] = await db('game_echeances').insert({
      campaign_id: f.campaign.id, character_id: f.pj.character.id, condition_type: 'wound_infection_check', interactive: true,
      payload: { location: 'bras_droit', periodesSansSoin: 0 }, next_due_minutes: 100,
      interval_minutes: 2880, occurrences_remaining: 3, status: 'pending_mj_review',
    }).returning('*')
    const [orphan] = await db('game_echeances').insert({
      campaign_id: f.campaign.id, character_id: f.pj.character.id, condition_type: 'wound_healing_check', interactive: true,
      payload: { woundId: '00000000-0000-0000-0000-000000000000' }, next_due_minutes: 100, status: 'pending_mj_review',
    }).returning('*')

    const [battlemap] = await db('battlemaps').insert({ campaign_id: f.campaign.id, name: 'BM test cartes' }).returning('*')
    const [token] = await db('tokens').insert({ battlemap_id: battlemap.id, character_id: f.pj.character.id, label: 'T' }).returning('*')
    await db('token_statuses').insert([{ token_id: token.id, status_code: 'stunned' }, { token_id: token.id, status_code: 'off_balance' }])

    const { cards } = await getReviewCardsForGm(f.campaign.id)
    const [card] = cards
    assert.deepEqual(card.infections.map(i => [i.echeanceId, i.location, i.severity, i.rollsNeeded, i.answerable]), [[infection.id, 'bras_droit', 'moyenne', 3, true]])
    assert.deepEqual(card.orphans.map(o => [o.echeanceId, o.conditionType, o.answerable]), [[orphan.id, 'wound_healing_check', true]])
    assert.deepEqual(card.state.statuses, ['off_balance', 'stunned'])
  } finally {
    await cleanupCards(f)
  }
})

test('getReviewCardsForGm : forme du payload FIGÉE (contrat lu par l\'écran du Lot 2a)', { skip }, async () => {
  const f = await createCardsFixture()
  try {
    await woundInReview(f.pj, 'corps', 'critique')
    const result = await getReviewCardsForGm(f.campaign.id)
    assert.deepEqual(Object.keys(result).sort(), ['advance', 'cards', 'summary'])
    assert.deepEqual(Object.keys(result.summary).sort(), ['answerableCount', 'awaitingPlayerCount', 'queuedCount'])
    assert.deepEqual(Object.keys(result.advance).sort(), ['deltaMinutes', 'pending'])
    const [card] = result.cards
    assert.deepEqual(Object.keys(card).sort(), ['characterId', 'infections', 'isPlayer', 'kitTotals', 'lines', 'name', 'orphans', 'state', 'type'])
    assert.deepEqual(Object.keys(card.state).sort(), ['statuses', 'testBlocked', 'woundPenalty', 'wounds'])
    const [line] = card.lines
    assert.deepEqual(Object.keys(line).sort(),
      ['answerable', 'cases', 'dueCases', 'dueEcheanceIds', 'items', 'key', 'kits', 'location', 'queuedCases', 'severity', 'targetSeverity'])
    assert.deepEqual(Object.keys(line.kits).sort(), ['alternatives', 'defaultKits'])
    assert.deepEqual(Object.keys(line.items[0]).sort(), ['answerable', 'echeanceId', 'isFirstTest', 'isLastStep', 'step'])
    assert.deepEqual(Object.keys(line.items[0].step).sort(), ['n', 'total'])
  } finally {
    await cleanupCards(f)
  }
})

test("getReviewCardsForGm : l'avance en attente est exposée même quand plus aucune échéance n'attend de réponse (l'écran garde alors Confirmer / Annuler)", { skip }, async () => {
  const f = await createCardsFixture()
  try {
    await db('campaigns').where({ id: f.campaign.id }).update({ pending_advance_delta_minutes: 10080 })
    const view = await getReviewCardsForGm(f.campaign.id)
    assert.deepEqual(view, { advance: { pending: true, deltaMinutes: 10080 }, cards: [], summary: { answerableCount: 0, awaitingPlayerCount: 0, queuedCount: 0 } })

    // Une avance sans échéance visible n'est pas un état à cacher ; une campagne sans avance ne prétend pas en avoir une.
    await db('campaigns').where({ id: f.campaign.id }).update({ pending_advance_delta_minutes: null })
    assert.deepEqual((await getReviewCardsForGm(f.campaign.id)).advance, { pending: false, deltaMinutes: null })
  } finally {
    await cleanupCards(f)
  }
})

test('getReviewCardsForGm : `awaitingPlayerCount` compte les jets de joueurs attendus (sous-ensemble des réponses possibles), `queuedCount` les échéances pas encore ouvertes', { skip }, async () => {
  const f = await createCardsFixture()
  try {
    await woundInReview(f.pj, 'bras_droit', 'moyenne')
    // Une infection par LOCALISATION (index unique) : trois autres localisations portent une Moyenne (écrite à la main, sans échéance de guérison).
    for (const location of ['bras_gauche', 'jambe_droite', 'jambe_gauche']) {
      await db('character_wounds').insert({ char_sheet_id: f.pj.sheet.id, location, severity: 'moyenne', occurred_at_game_minutes: 0 })
    }
    const insertInfection = (location, status, nextDue) => db('game_echeances').insert({
      campaign_id: f.campaign.id, character_id: f.pj.character.id, condition_type: 'wound_infection_check', interactive: true,
      payload: { location, periodesSansSoin: 0 }, next_due_minutes: nextDue, status,
    }).returning('*')
    const [awaiting] = await insertInfection('bras_droit', 'awaiting_player_roll', 100)
    await insertInfection('bras_gauche', 'pending_mj_review', 100)
    await db('campaigns').where({ id: f.campaign.id }).update({ game_time_resolved_minutes: 5000 })
    await insertInfection('jambe_droite', 'active', 4000) // déjà due, pas encore ouverte : prochaine ronde
    await insertInfection('jambe_gauche', 'active', 9000) // future : jamais montrée

    const { cards, summary } = await getReviewCardsForGm(f.campaign.id)
    // guérison (1) + infection en attente du MJ (1) + infection en attente d'un joueur (1)
    assert.deepEqual(summary, { answerableCount: 3, awaitingPlayerCount: 1, queuedCount: 1 })
    const waiting = cards[0].infections.find(i => i.echeanceId === awaiting.id)
    assert.equal(waiting.status, 'awaiting_player_roll')
    assert.equal(waiting.answerable, true, 'le MJ peut lancer en automatique pour débloquer un joueur absent')
  } finally {
    await cleanupCards(f)
  }
})

test("getReviewCardsForGm : la « ronde suivante » est jugée sur la FIN de l'avance en attente (comme « Confirmer »), pas sur le repère résolu actuel — les infections d'un Échec y figurent", { skip }, async () => {
  const f = await createCardsFixture()
  try {
    await woundInReview(f.pj, 'bras_droit', 'moyenne')
    await db('character_wounds').insert({ char_sheet_id: f.pj.sheet.id, location: 'jambe_gauche', severity: 'moyenne', occurred_at_game_minutes: 0 })
    // Le repère résolu (1000) n'avance qu'à la confirmation ; l'avance en attente (10080) en fait 11080 : une infection due à 5000 y sera ouverte par « Confirmer ».
    await db('campaigns').where({ id: f.campaign.id }).update({ game_time_minutes: 1000, game_time_resolved_minutes: 1000 })
    await db('game_echeances').insert({
      campaign_id: f.campaign.id, character_id: f.pj.character.id, condition_type: 'wound_infection_check', interactive: true,
      payload: { location: 'bras_droit', periodesSansSoin: 0 }, next_due_minutes: 5000, status: 'active',
    })

    let view = await getReviewCardsForGm(f.campaign.id)
    assert.equal(view.summary.queuedCount, 0, "sans avance en attente, l'horizon reste le repère résolu : l'échéance future n'est pas montrée")

    await db('campaigns').where({ id: f.campaign.id }).update({ pending_advance_delta_minutes: 10080 })
    view = await getReviewCardsForGm(f.campaign.id)
    assert.equal(view.summary.queuedCount, 1, "avec l'avance en attente, l'infection due avant sa fin est annoncée à la ronde suivante")
    assert.equal(view.summary.answerableCount, 1, 'la guérison ouverte reste la seule réponse possible')
    assert.equal(view.cards[0].infections[0].answerable, false)

    // Horizon strictement borné : une échéance due APRÈS la fin de l'avance n'est pas annoncée.
    await db('game_echeances').insert({
      campaign_id: f.campaign.id, character_id: f.pj.character.id, condition_type: 'wound_infection_check', interactive: true,
      payload: { location: 'jambe_gauche', periodesSansSoin: 0 }, next_due_minutes: 11081, status: 'active',
    })
    assert.equal((await getReviewCardsForGm(f.campaign.id)).summary.queuedCount, 1)
  } finally {
    await cleanupCards(f)
  }
})

test('getReviewCardsForGm : une infection est décrite par la PIRE blessure susceptible de sa localisation ; sans blessure susceptible, elle est montrée comme anomalie (jamais masquée)', { skip }, async () => {
  const f = await createCardsFixture()
  try {
    await db('character_wounds').insert([
      { char_sheet_id: f.pj.sheet.id, location: 'jambe_gauche', severity: 'moyenne', occurred_at_game_minutes: 0 },
      { char_sheet_id: f.pj.sheet.id, location: 'jambe_gauche', severity: 'critique', occurred_at_game_minutes: 0 },
      { char_sheet_id: f.pj.sheet.id, location: 'bras_droit', severity: 'legere', occurred_at_game_minutes: 0 }, // une Légère n'est pas susceptible
    ])
    const insertInfection = (location) => db('game_echeances').insert({
      campaign_id: f.campaign.id, character_id: f.pj.character.id, condition_type: 'wound_infection_check', interactive: true,
      payload: { location, periodesSansSoin: 0 }, next_due_minutes: 100, status: 'pending_mj_review',
    }).returning('*')
    const [jambe] = await insertInfection('jambe_gauche')
    const [bras] = await insertInfection('bras_droit')

    const { cards } = await getReviewCardsForGm(f.campaign.id)
    const [card] = cards
    assert.deepEqual(card.infections.map(i => [i.echeanceId, i.location, i.severity]), [[jambe.id, 'jambe_gauche', 'critique']])
    assert.deepEqual(card.orphans.map(o => [o.echeanceId, o.conditionType]), [[bras.id, 'wound_infection_check']])
  } finally {
    await cleanupCards(f)
  }
})

test.after(async () => { await db.destroy() })
