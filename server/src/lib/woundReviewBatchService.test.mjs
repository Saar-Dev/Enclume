process.env.REVIEW_TRACE = '0' // les traces du serveur ne noient pas la sortie des tests (elles sont vérifiées dans reviewTrace.test.mjs)
import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { AppError } from './AppError.js'
import { WS } from '../../../shared/events.js'
import { findEcheanceRegistryEntry } from '../../../shared/echeanceTypeRegistry.js'
import { resolveWoundInsertion } from './woundUtils.js'
import { resolveHealingChoices, resolveInfectionModes } from './woundReviewBatchService.js'
import './echeanceHandlerRegistrations.js' // effet de bord : peuple le registre (guérison + infection)

// Lancement manuel : node --env-file=.env --test server/src/lib/woundReviewBatchService.test.mjs
// Patron « fixture réelle committée puis nettoyée » (les savepoints du service travaillent sur `db`, pas sur un trx de test).
const skip = !process.env.DATABASE_URL

const captureIo = () => {
  const emitted = []
  return { emitted, io: { to: (room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }) } }
}
const eventsOf = (emitted, event) => emitted.filter(e => e.event === event).map(e => e.payload)
const resolvedEvents = (emitted) => eventsOf(emitted, WS.GAME_ECHEANCE_RESOLVED).map(p => p.echeanceId)

async function createFixture() {
  const [gm] = await db('users').insert({ email: `wrb-gm-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'wrb-gm' }).returning('*')
  const [campaign] = await db('campaigns').insert({ gm_id: gm.id, name: 'Campagne test lot groupé', invite_code: `WRB-${Date.now()}-${Math.random()}` }).returning('*')
  const [other] = await db('campaigns').insert({ gm_id: gm.id, name: 'Autre campagne test lot groupé', invite_code: `WRB2-${Date.now()}-${Math.random()}` }).returning('*')
  const makeCharacter = async (inCampaign, name, type = 'pj') => {
    const [character] = await db('characters').insert({ campaign_id: inCampaign.id, name, type }).returning('*')
    const [sheet] = await db('char_sheet').insert({ character_id: character.id }).returning('*')
    return { character, sheet, schedule: { campaignId: inCampaign.id, characterId: character.id } }
  }
  return {
    gm, campaign, other,
    alice: await makeCharacter(campaign, 'Alice'),
    bob: await makeCharacter(campaign, 'Bob', 'pnj'),
    foreign: await makeCharacter(other, 'Étranger'),
    makeCharacter,
  }
}

async function cleanup({ gm, campaign, other }) {
  for (const c of [campaign, other]) if (c) await db('campaigns').where({ id: c.id }).del()
  if (gm) await db('users').where({ id: gm.id }).del()
}

// Une blessure (son échéance de guérison naît avec elle), échéance ouverte en revue comme le fait requestGameTimeAdvance.
async function woundInReview(who, location, severity, { open = true } = {}) {
  const inserted = await db.transaction(trx => resolveWoundInsertion(trx, who.sheet.id, location, severity, who.schedule))
  if (open) await db('game_echeances').where({ id: inserted.echeance.id }).update({ status: 'pending_mj_review' })
  return inserted
}

const severitiesOf = async (who) => (await db('character_wounds').where({ char_sheet_id: who.sheet.id })).map(w => w.severity).sort()
const echeanceRow = (id) => db('game_echeances').where({ id }).first()
const choicesOf = (ids, mjChoice) => ids.map(echeanceId => ({ echeanceId, mjChoice }))

test('résolution groupée : une même issue pour plusieurs échéances d\'un personnage — tout est résolu, une mise à jour de fiche, pas de ligne de chat sans `care`', { skip }, async () => {
  const f = await createFixture()
  const { io, emitted } = captureIo()
  try {
    const moyenne = await woundInReview(f.alice, 'corps', 'moyenne')
    const grave = await woundInReview(f.alice, 'bras_droit', 'grave')
    const ids = [moyenne.echeance.id, grave.echeance.id]

    const { results } = await resolveHealingChoices(io, f.campaign.id, { choices: choicesOf(ids, 'amelioration') })

    assert.deepEqual(results, ids.map(echeanceId => ({ echeanceId, resolved: true })))
    assert.deepEqual(await severitiesOf(f.alice), ['legere', 'moyenne'], 'Moyenne -> Légère, Grave -> Moyenne')
    assert.deepEqual(new Set(resolvedEvents(emitted)), new Set(ids))
    assert.equal(eventsOf(emitted, WS.WOUND_UPDATED).length, 1, 'une seule mise à jour de fiche pour ce personnage')
    assert.equal(eventsOf(emitted, WS.COMBAT_SYSTEM_NOTICE).length, 0, 'sans `care`, rien n\'est déclaré ni raconté')
    assert.ok(emitted.every(e => e.room === f.campaign.id))
  } finally {
    await cleanup(f)
  }
})

test('résolution groupée : issues différentes et plusieurs personnages dans un même lot', { skip }, async () => {
  const f = await createFixture()
  const { io, emitted } = captureIo()
  try {
    const a = await woundInReview(f.alice, 'corps', 'moyenne')
    const b = await woundInReview(f.bob, 'tete', 'grave')

    const { results } = await resolveHealingChoices(io, f.campaign.id, {
      choices: [{ echeanceId: a.echeance.id, mjChoice: 'amelioration' }, { echeanceId: b.echeance.id, mjChoice: 'echec' }],
    })
    assert.deepEqual(results.map(r => r.resolved), [true, true])
    assert.deepEqual(await severitiesOf(f.alice), ['legere'])
    assert.deepEqual(await severitiesOf(f.bob), ['grave'], 'l\'Échec ne fait pas guérir')
    // L'Échec ne termine pas l'échéance (Lot 0) : une nouvelle tentative est reprogrammée, et son infection est née.
    const retry = await echeanceRow(b.echeance.id)
    assert.deepEqual([retry.status, retry.occurrences_remaining], ['active', 1])
    assert.equal((await db('game_echeances').where({ campaign_id: f.campaign.id, condition_type: 'wound_infection_check' })).length, 1)
    assert.equal(eventsOf(emitted, WS.WOUND_UPDATED).length, 2, 'une mise à jour par personnage')
  } finally {
    await cleanup(f)
  }
})

test('résolution groupée : échéance périmée (déjà résolue) ou pas encore ouverte (active) -> `stale`, sans faire échouer le lot', { skip }, async () => {
  const f = await createFixture()
  const { io } = captureIo()
  try {
    const ok = await woundInReview(f.alice, 'corps', 'moyenne')
    const done = await woundInReview(f.alice, 'tete', 'moyenne')
    const queued = await woundInReview(f.alice, 'bras_droit', 'moyenne', { open: false })
    await db('game_echeances').where({ id: done.echeance.id }).update({ status: 'completed' })

    const { results } = await resolveHealingChoices(io, f.campaign.id, {
      choices: choicesOf([done.echeance.id, queued.echeance.id, ok.echeance.id], 'amelioration'),
    })
    assert.deepEqual(results, [
      { echeanceId: done.echeance.id, resolved: false, stale: true },
      { echeanceId: queued.echeance.id, resolved: false, stale: true },
      { echeanceId: ok.echeance.id, resolved: true },
    ])
    assert.equal((await echeanceRow(queued.echeance.id)).status, 'active', 'l\'échéance non ouverte n\'est pas touchée')
  } finally {
    await cleanup(f)
  }
})

test('résolution groupée : un ÉCHEC DE HANDLER annule l\'entrée (l\'échéance reste en attente, jamais `error`) sans empêcher les autres', { skip }, async () => {
  const f = await createFixture()
  const { io, emitted } = captureIo()
  const entry = findEcheanceRegistryEntry('wound_healing_check')
  const original = entry.handler
  try {
    const failing = await woundInReview(f.alice, 'corps', 'moyenne')
    const fine = await woundInReview(f.alice, 'tete', 'moyenne')
    entry.handler = async (trx, echeance, context) => {
      if (echeance.payload.woundId === failing.wound.id) throw new Error('handler en panne (test)')
      return original(trx, echeance, context)
    }

    const { results } = await resolveHealingChoices(io, f.campaign.id, {
      choices: choicesOf([failing.echeance.id, fine.echeance.id], 'amelioration'),
    })
    assert.deepEqual(results, [
      { echeanceId: failing.echeance.id, resolved: false, error: true },
      { echeanceId: fine.echeance.id, resolved: true },
    ])
    const stuck = await echeanceRow(failing.echeance.id)
    assert.equal(stuck.status, 'pending_mj_review', 'l\'échéance n\'est PAS passée en `error` : le MJ peut recommencer')
    assert.equal(stuck.payload.mjChoice, undefined, 'l\'issue n\'est pas restée écrite dans le payload')
    assert.ok(!resolvedEvents(emitted).includes(failing.echeance.id))
    assert.deepEqual(await severitiesOf(f.alice), ['legere', 'moyenne'], 'la blessure en panne est intacte, l\'autre a guéri')
  } finally {
    entry.handler = original
    await cleanup(f)
  }
})

test('résolution groupée : une échéance d\'une AUTRE campagne, ou d\'un autre type, refuse toute la demande — rien n\'est écrit', { skip }, async () => {
  const f = await createFixture()
  const { io, emitted } = captureIo()
  try {
    const mine = await woundInReview(f.alice, 'corps', 'moyenne')
    const foreign = await woundInReview(f.foreign, 'corps', 'moyenne')
    await assert.rejects(
      resolveHealingChoices(io, f.campaign.id, { choices: choicesOf([mine.echeance.id, foreign.echeance.id], 'amelioration') }),
      (err) => err instanceof AppError && err.statusCode === 404,
    )
    assert.equal((await echeanceRow(mine.echeance.id)).status, 'pending_mj_review')
    assert.equal((await echeanceRow(foreign.echeance.id)).status, 'pending_mj_review')
    assert.deepEqual(await severitiesOf(f.alice), ['moyenne'])
    assert.equal(emitted.length, 0)

    // Une échéance d'infection n'est pas une guérison.
    const [infection] = await db('game_echeances').insert({
      campaign_id: f.campaign.id, character_id: f.alice.character.id, condition_type: 'wound_infection_check', interactive: true,
      payload: { woundId: mine.wound.id }, next_due_minutes: 100, status: 'pending_mj_review',
    }).returning('*')
    await assert.rejects(
      resolveHealingChoices(io, f.campaign.id, { choices: choicesOf([infection.id], 'amelioration') }),
      (err) => err instanceof AppError && err.statusCode === 400,
    )
  } finally {
    await cleanup(f)
  }
})

test('résolution groupée : entrées invalides refusées (400) avant toute écriture', { skip }, async () => {
  const f = await createFixture()
  const { io } = captureIo()
  try {
    const wound = await woundInReview(f.alice, 'corps', 'moyenne')
    const id = wound.echeance.id
    const bad = (choices, care) => assert.rejects(
      resolveHealingChoices(io, f.campaign.id, { choices, care }),
      (err) => err instanceof AppError && err.statusCode === 400,
    )
    await bad(undefined)
    await bad([])
    await bad('nope')
    await bad(choicesOf([id, id], 'amelioration'))                                   // doublon
    await bad([{ echeanceId: id, mjChoice: 'soinsContinues' }])                      // issue inconnue
    await bad([{ echeanceId: 'pas-un-uuid', mjChoice: 'amelioration' }])
    await bad([{ mjChoice: 'amelioration' }])
    await bad(Array.from({ length: 201 }, (_, i) => ({ echeanceId: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`, mjChoice: 'echec' }))) // > 200
    assert.equal((await echeanceRow(id)).status, 'pending_mj_review')
  } finally {
    await cleanup(f)
  }
})

test('care : validé, jamais stocké, raconté dans le chat (une ligne par personnage et par issue) ; absent = rien de raconté', { skip }, async () => {
  const f = await createFixture()
  try {
    const doctor = await f.makeCharacter(f.campaign, 'Dr Vega')
    const foreignDoctor = await f.makeCharacter(f.other, 'Dr Étranger')
    const a1 = await woundInReview(f.alice, 'corps', 'moyenne')
    const a2 = await woundInReview(f.alice, 'tete', 'moyenne')
    const a3 = await woundInReview(f.alice, 'bras_droit', 'moyenne')
    const b1 = await woundInReview(f.bob, 'corps', 'moyenne')

    const { io, emitted } = captureIo()
    await resolveHealingChoices(io, f.campaign.id, {
      choices: [
        { echeanceId: a1.echeance.id, mjChoice: 'amelioration' }, { echeanceId: a2.echeance.id, mjChoice: 'amelioration' },
        { echeanceId: a3.echeance.id, mjChoice: 'echec' }, { echeanceId: b1.echeance.id, mjChoice: 'amelioration' },
      ],
      care: { provider: 'character', providerCharacterId: doctor.character.id, equipment: 'partial' },
    })
    const notices = eventsOf(emitted, WS.COMBAT_SYSTEM_NOTICE)
    assert.equal(notices.length, 3, 'Alice/réussite, Alice/échec, Bob/réussite')
    assert.ok(notices.every(n => n.i18nKey === 'combat:woundCare.notice'))
    const byKey = Object.fromEntries(notices.map(n => [`${n.params.label}|${n.params.outcome}`, n.params]))
    assert.deepEqual(byKey['Alice|amelioration'], { label: 'Alice', outcome: 'amelioration', cases: 2, provider: 'character', providerName: 'Dr Vega', equipment: 'partial' })
    assert.equal(byKey['Alice|echec'].cases, 1)
    assert.equal(byKey['Bob|amelioration'].cases, 1)
    assert.equal((await echeanceRow(a1.echeance.id)).payload.care, undefined, '`care` n\'est pas stocké')

    // Soignant PNJ : texte libre nettoyé (contrôles, sauts de ligne, espaces multiples, 60 caractères).
    const c1 = await woundInReview(f.alice, 'jambe_gauche', 'moyenne')
    const npcCapture = captureIo()
    await resolveHealingChoices(npcCapture.io, f.campaign.id, {
      choices: choicesOf([c1.echeance.id], 'amelioration'),
      care: { provider: 'npc', providerName: `  Infirmier\n\tLéo   ${'x'.repeat(100)}`, equipment: 'none' },
    })
    const [npcNotice] = eventsOf(npcCapture.emitted, WS.COMBAT_SYSTEM_NOTICE)
    assert.equal(npcNotice.params.providerName.startsWith('Infirmier Léo x'), true)
    assert.equal(npcNotice.params.providerName.length, 60)
    assert.ok(!/[\n\t]/.test(npcNotice.params.providerName))

    // Aucune ligne de chat si rien n'a été résolu (échéance périmée) : rien n'est déclaré pour rien.
    const staleCapture = captureIo()
    await resolveHealingChoices(staleCapture.io, f.campaign.id, {
      choices: choicesOf([a1.echeance.id], 'amelioration'), care: { provider: 'hospital', equipment: 'complete' },
    })
    assert.equal(eventsOf(staleCapture.emitted, WS.COMBAT_SYSTEM_NOTICE).length, 0)

    // `care` invalide : refusé (400) avant toute écriture.
    const d1 = await woundInReview(f.alice, 'corps', 'grave')
    for (const care of [
      { provider: 'sorcier', equipment: 'complete' },
      { provider: 'hospital', equipment: 'luxe' },
      { provider: 'hospital' },
      { provider: 'character', equipment: 'complete' },
      { provider: 'character', providerCharacterId: foreignDoctor.character.id, equipment: 'complete' }, // personnage d'une autre campagne
      { provider: 'npc', providerName: '   ', equipment: 'complete' },
      'oui',
    ]) {
      await assert.rejects(
        resolveHealingChoices(captureIo().io, f.campaign.id, { choices: choicesOf([d1.echeance.id], 'amelioration'), care }),
        (err) => err instanceof AppError && err.statusCode === 400, JSON.stringify(care),
      )
    }
    assert.equal((await echeanceRow(d1.echeance.id)).status, 'pending_mj_review')
  } finally {
    await cleanup(f)
  }
})

test('résolution groupée : une échéance annulée PENDANT le lot (l\'infection de la blessure guérie) est diffusée, ses lignes disparaissent de l\'écran ouvert', { skip }, async () => {
  const f = await createFixture()
  const { io, emitted } = captureIo()
  try {
    const wound = await woundInReview(f.alice, 'corps', 'moyenne')
    const [infection] = await db('game_echeances').insert({
      campaign_id: f.campaign.id, character_id: f.alice.character.id, condition_type: 'wound_infection_check', interactive: true,
      payload: { woundId: wound.wound.id, periodesSansSoin: 0 }, next_due_minutes: 100, status: 'pending_mj_review',
    }).returning('*')

    await resolveHealingChoices(io, f.campaign.id, { choices: choicesOf([wound.echeance.id], 'amelioration') })

    assert.equal((await echeanceRow(infection.id)).status, 'cancelled', 'la Moyenne a guéri : son infection n\'a plus d\'objet')
    assert.ok(resolvedEvents(emitted).includes(infection.id), 'sa ligne est retirée de l\'écran de revue ouvert')
    assert.ok(resolvedEvents(emitted).includes(wound.echeance.id))
  } finally {
    await cleanup(f)
  }
})

// ─── Infections groupées ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

async function infectionOf(who, wound, status = 'pending_mj_review') {
  const [row] = await db('game_echeances').insert({
    campaign_id: who.schedule.campaignId, character_id: who.character.id, condition_type: 'wound_infection_check', interactive: true,
    payload: { woundId: wound.id, periodesSansSoin: 0 }, next_due_minutes: 100, status,
  }).returning('*')
  return row
}

test('infections groupées : `auto` lance le jet serveur et résout ; `player` bascule en attente du joueur ; périmée -> stale', { skip }, async () => {
  const f = await createFixture()
  const { io, emitted } = captureIo()
  try {
    const w1 = await woundInReview(f.alice, 'corps', 'moyenne', { open: false })
    const w2 = await woundInReview(f.alice, 'tete', 'moyenne', { open: false })
    const w3 = await woundInReview(f.alice, 'bras_droit', 'moyenne', { open: false })
    const auto = await infectionOf(f.alice, w1.wound)
    const player = await infectionOf(f.alice, w2.wound)
    const stale = await infectionOf(f.alice, w3.wound, 'completed')

    const { results } = await resolveInfectionModes(io, f.campaign.id, {
      choices: [
        { echeanceId: auto.id, mode: 'auto' }, { echeanceId: player.id, mode: 'player' }, { echeanceId: stale.id, mode: 'auto' },
      ],
    })
    assert.deepEqual(results[0], { echeanceId: auto.id, resolved: true, status: 'resolved' })
    assert.deepEqual(results[1], { echeanceId: player.id, resolved: false, status: 'awaiting_player_roll' })
    assert.deepEqual(results[2], { echeanceId: stale.id, resolved: false, stale: true })
    assert.equal((await echeanceRow(auto.id)).status, 'completed')
    assert.equal((await echeanceRow(player.id)).status, 'awaiting_player_roll')
    assert.ok(resolvedEvents(emitted).includes(auto.id))
    assert.ok(!resolvedEvents(emitted).includes(player.id), 'le joueur n\'a pas encore lancé son jet')

    // Une guérison n'est pas une infection ; la validation est la même que pour les guérisons.
    const healing = await woundInReview(f.alice, 'jambe_droite', 'moyenne')
    await assert.rejects(
      resolveInfectionModes(io, f.campaign.id, { choices: [{ echeanceId: healing.echeance.id, mode: 'auto' }] }),
      (err) => err instanceof AppError && err.statusCode === 400,
    )
    await assert.rejects(
      resolveInfectionModes(io, f.campaign.id, { choices: [{ echeanceId: auto.id, mode: 'demain' }] }),
      (err) => err instanceof AppError && err.statusCode === 400,
    )
  } finally {
    await cleanup(f)
  }
})

// ─── Traces de la revue (reviewTrace.js) : écrites APRÈS la validation, sans jamais changer un résultat ──────────────────────────────────────

async function withTrace(value, run) {
  const previousEnv = process.env.REVIEW_TRACE
  const previousLog = console.log
  const logs = []
  process.env.REVIEW_TRACE = value
  console.log = (...args) => logs.push(args.join(' '))
  try { await run() } finally {
    console.log = previousLog
    process.env.REVIEW_TRACE = previousEnv
  }
  return logs
}

test('traces : le lot raconte chaque entrée (personnage, blessure avant → après, moteur) et le bilan des diffusions ; les résultats sont identiques traces coupées', { skip }, async () => {
  const f = await createFixture()
  const { io } = captureIo()
  try {
    const moyenne = await woundInReview(f.alice, 'corps', 'moyenne')
    const grave = await woundInReview(f.alice, 'bras_droit', 'grave')
    const ids = [moyenne.echeance.id, grave.echeance.id]
    let withResults
    const logs = await withTrace('1', async () => {
      withResults = (await resolveHealingChoices(io, f.campaign.id, { choices: choicesOf(ids, 'amelioration') })).results
    })
    const text = logs.join('\n')
    assert.match(text, /lot guérisons \(campagne [0-9a-f]{8}\) : 2 entrée\(s\) — amelioration×2 ; aucun contexte de soins déclaré/)
    assert.match(text, /▸ Alice · échéance [0-9a-f]{8} · « amelioration » → RÉSOLUE/)
    assert.match(text, /guérison corps\/moyenne \(case [0-9a-f]{8}, Test unique\) — issue « amelioration »/)
    assert.match(text, /→ devient legere \(nouvelle case [0-9a-f]{8}/)
    assert.match(text, /→ devient moyenne .* ligne bras_droit\/moyenne : 1 case\(s\) pour un maximum de 3/)
    assert.match(text, /échéance wound_healing_check [0-9a-f]{8} terminée/)
    assert.match(text, /lot guérisons validé en \d+ ms : 2 résolue\(s\), 0 périmée\(s\), 0 annulée\(s\) par le serveur, 0 en attente du joueur ; diffusions : 2 GAME_ECHEANCE_RESOLVED .* 1 WOUND_UPDATED, 0 ligne\(s\) de chat/)
    assert.deepEqual(withResults, ids.map(echeanceId => ({ echeanceId, resolved: true })), 'le résultat public ne porte AUCUNE trace')
    assert.ok(logs.every(line => line.startsWith('[REVUE ')))

    // Même lot, traces coupées : aucune ligne, mêmes résultats.
    const moyenne2 = await woundInReview(f.alice, 'tete', 'moyenne')
    let offResults
    const offLogs = await withTrace('0', async () => {
      offResults = (await resolveHealingChoices(io, f.campaign.id, { choices: choicesOf([moyenne2.echeance.id], 'amelioration') })).results
    })
    assert.deepEqual(offLogs, [])
    assert.deepEqual(offResults, [{ echeanceId: moyenne2.echeance.id, resolved: true }])
  } finally {
    await cleanup(f)
  }
})

test('traces : une entrée périmée et un refus de validation sont écrits (sans prétendre qu\'une écriture a eu lieu)', { skip }, async () => {
  const f = await createFixture()
  const { io } = captureIo()
  try {
    const active = await woundInReview(f.alice, 'corps', 'moyenne', { open: false })
    const logs = await withTrace('1', async () => {
      await resolveHealingChoices(io, f.campaign.id, { choices: choicesOf([active.echeance.id], 'echec') })
      await assert.rejects(resolveHealingChoices(io, f.campaign.id, { choices: [] }), AppError)
    })
    const text = logs.join('\n')
    assert.match(text, /→ PÉRIMÉE \(déjà traitée, annulée ou pas encore ouverte\) : rien écrit/)
    assert.match(text, /lot guérisons INTERROMPU \(400\) : choices : une liste non vide est requise — rien n'a été écrit/)
  } finally {
    await cleanup(f)
  }
})

test.after(async () => { await db.destroy() })
