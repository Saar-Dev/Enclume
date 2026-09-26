import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { MINUTES_PER_DAY } from '../../../shared/gameTime.js'
import { createEcheance, resolveEcheanceNow } from './echeanceService.js'
import { initializeWoundHealingEcheance } from './woundHealingSchedule.js'
import {
  woundHealingCheckHandler,
  computeWoundInfectionThreshold, woundInfectionCheckHandler,
} from './woundEvolutionService.js'
import './echeanceHandlerRegistrations.js' // effet de bord : peuple le registre (wound_healing_check + infection)

// Lancement manuel : node --env-file=../.env --test server/src/lib/woundEvolutionService.test.mjs
// Patron rollback (154_world_effects_runtime.test.mjs) : rien n'est jamais persisté.
const skip = !process.env.DATABASE_URL
const WEEK_MINUTES = 7 * MINUTES_PER_DAY

async function createFixture(trx, { resolvedMinutes = 1000 } = {}) {
  const [user] = await trx('users')
    .insert({ email: `wes-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'wes-test' })
    .returning('*')
  const [campaign] = await trx('campaigns')
    .insert({
      gm_id: user.id, name: 'Campagne test évolution blessures', invite_code: `WES-${Date.now()}-${Math.random()}`,
      game_time_minutes: resolvedMinutes, game_time_resolved_minutes: resolvedMinutes,
    })
    .returning('*')
  const [character] = await trx('characters')
    .insert({ campaign_id: campaign.id, name: 'Perso test' })
    .returning('*')
  const [charSheet] = await trx('char_sheet')
    .insert({ character_id: character.id })
    .returning('*')
  return { campaign, character, charSheet }
}

// Constitution seule renseignée (base_level connu, aucun génotype/mutation) -> NA(CON) = base_level
// (calcNA : base_level + pc_modifier - TOTAL_MALUS(0), pas de mod génotype/mutation sans ces lignes).
async function setConstitution(trx, charSheetId, baseLevel) {
  await trx('char_attributes').insert({ char_sheet_id: charSheetId, attr_id: 'CON', base_level: baseLevel, pc_modifier: 0 })
}

async function createWound(trx, charSheetId, { location = 'corps', severity, occurredAt = 1000 } = {}) {
  const [wound] = await trx('character_wounds')
    .insert({ char_sheet_id: charSheetId, location, severity, occurred_at_game_minutes: occurredAt })
    .returning('*')
  return wound
}

// ─── initializeWoundHealingEcheance ─────────────────────────────────────────────────────────────

test('initializeWoundHealingEcheance : Légère -> aucune échéance (guérit seule)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet } = await createFixture(trx)
    const wound = await createWound(trx, charSheet.id, { severity: 'legere', occurredAt: 1000 })
    const result = await initializeWoundHealingEcheance(trx, { campaignId: campaign.id, characterId: character.id, wound })
    assert.equal(result, null)
    const echeances = await trx('game_echeances').where({ campaign_id: campaign.id })
    assert.equal(echeances.length, 0)
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('initializeWoundHealingEcheance : Moyenne -> échéance unique à occurred_at + 3 jours', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet } = await createFixture(trx)
    const wound = await createWound(trx, charSheet.id, { severity: 'moyenne', occurredAt: 1000 })
    const echeance = await initializeWoundHealingEcheance(trx, { campaignId: campaign.id, characterId: character.id, wound })
    assert.equal(echeance.condition_type, 'wound_healing_check')
    assert.equal(echeance.interactive, true)
    assert.equal(echeance.next_due_minutes, 1000 + 3 * MINUTES_PER_DAY)
    assert.equal(echeance.interval_minutes, null)
    assert.equal(echeance.occurrences_remaining, null)
    assert.deepEqual(echeance.payload, { woundId: wound.id })
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('initializeWoundHealingEcheance : Critique -> échéance hebdomadaire récurrente, 3 occurrences', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet } = await createFixture(trx)
    const wound = await createWound(trx, charSheet.id, { severity: 'critique', occurredAt: 1000 })
    const echeance = await initializeWoundHealingEcheance(trx, { campaignId: campaign.id, characterId: character.id, wound })
    assert.equal(echeance.next_due_minutes, 1000 + WEEK_MINUTES)
    assert.equal(echeance.interval_minutes, WEEK_MINUTES)
    assert.equal(echeance.occurrences_remaining, 3)
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('initializeWoundHealingEcheance : Mortelle -> échéance hebdomadaire récurrente, 5 occurrences', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet } = await createFixture(trx)
    const wound = await createWound(trx, charSheet.id, { severity: 'mortelle', occurredAt: 1000 })
    const echeance = await initializeWoundHealingEcheance(trx, { campaignId: campaign.id, characterId: character.id, wound })
    assert.equal(echeance.occurrences_remaining, 5)
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

// ─── woundHealingCheckHandler ────────────────────────────────────────────────────────────────────

test('handler : sans mjChoice -> resolved false (attend le MJ)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet } = await createFixture(trx)
    const wound = await createWound(trx, charSheet.id, { severity: 'moyenne' })
    const echeance = { payload: { woundId: wound.id } }
    const result = await woundHealingCheckHandler(trx, echeance)
    assert.deepEqual(result, { resolved: false })
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('handler : blessure introuvable (guérie/supprimée entre-temps) -> no-op résolu', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const echeance = { payload: { woundId: '00000000-0000-0000-0000-000000000000', mjChoice: 'amelioration' } }
    const result = await woundHealingCheckHandler(trx, echeance)
    assert.deepEqual(result, { resolved: true, reschedule: null, spawn: [], undoEntries: [] })
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('handler : mjChoice invalide -> throw', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet } = await createFixture(trx)
    const wound = await createWound(trx, charSheet.id, { severity: 'moyenne' })
    const echeance = { payload: { woundId: wound.id, mjChoice: 'blabla' } }
    await assert.rejects(woundHealingCheckHandler(trx, echeance), /mjChoice "blabla" invalide/)
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('handler : amélioration sur échéance unique (Moyenne) -> resolveWoundImprovement + reschedule null', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet } = await createFixture(trx, { resolvedMinutes: 5000 })
    const wound = await createWound(trx, charSheet.id, { severity: 'moyenne', occurredAt: 1000 })
    const echeance = await createEcheance(trx, {
      campaignId: campaign.id, characterId: character.id, conditionType: 'wound_healing_check',
      payload: { woundId: wound.id, mjChoice: 'amelioration' },
      nextDueMinutes: 1000 + 3 * MINUTES_PER_DAY, intervalMinutes: null, occurrencesRemaining: null,
    })
    const result = await woundHealingCheckHandler(trx, echeance)
    assert.equal(result.resolved, true)
    assert.equal(result.reschedule, null)
    assert.equal(result.spawn.length, 0)
    assert.equal(result.undoEntries.length, 2) // delete de l'original + insert de la nouvelle case

    const remaining = await trx('character_wounds').where({ char_sheet_id: charSheet.id }).select('*')
    assert.equal(remaining.length, 1)
    assert.equal(remaining[0].severity, 'legere') // previousSeverity('moyenne')
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('handler : amélioration sur échéance récurrente, PAS la dernière occurrence -> continue sans muter la blessure', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet } = await createFixture(trx)
    const wound = await createWound(trx, charSheet.id, { severity: 'critique', occurredAt: 1000 })
    const echeance = await createEcheance(trx, {
      campaignId: campaign.id, characterId: character.id, conditionType: 'wound_healing_check',
      payload: { woundId: wound.id, mjChoice: 'amelioration' },
      nextDueMinutes: 1000 + WEEK_MINUTES, intervalMinutes: WEEK_MINUTES, occurrencesRemaining: 3,
    })
    const result = await woundHealingCheckHandler(trx, echeance)
    assert.deepEqual(result.reschedule, { intervalMinutes: WEEK_MINUTES, occurrencesRemaining: 2 })
    assert.equal(result.undoEntries.length, 0)
    const stillCritique = await trx('character_wounds').where({ id: wound.id }).first()
    assert.equal(stillCritique.severity, 'critique') // pas encore diminuée
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('handler : amélioration sur échéance récurrente, DERNIÈRE occurrence -> diminue la gravité', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet } = await createFixture(trx)
    const wound = await createWound(trx, charSheet.id, { severity: 'critique', occurredAt: 1000 })
    const echeance = await createEcheance(trx, {
      campaignId: campaign.id, characterId: character.id, conditionType: 'wound_healing_check',
      payload: { woundId: wound.id, mjChoice: 'amelioration' },
      nextDueMinutes: 1000 + 3 * WEEK_MINUTES, intervalMinutes: WEEK_MINUTES, occurrencesRemaining: 1,
    })
    const result = await woundHealingCheckHandler(trx, echeance)
    assert.equal(result.reschedule, null)
    assert.equal(result.undoEntries.length, 3) // la case d'origine, la Grave obtenue, l'échéance de guérison de la Grave
    const improved = await trx('character_wounds').where({ char_sheet_id: charSheet.id }).first()
    assert.equal(improved.severity, 'grave') // previousSeverity('critique')
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('handler : échec sur échéance unique (Moyenne) -> reprogramme une tentative, spawn infection (`soinsContinues` n\'a plus aucun effet)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet } = await createFixture(trx)
    const wound = await createWound(trx, charSheet.id, { severity: 'moyenne', occurredAt: 1000 })
    const echeance = await createEcheance(trx, {
      campaignId: campaign.id, characterId: character.id, conditionType: 'wound_healing_check',
      payload: { woundId: wound.id, mjChoice: 'echec', soinsContinues: true },
      nextDueMinutes: 1000 + 3 * MINUTES_PER_DAY, intervalMinutes: null, occurrencesRemaining: null,
    })
    const result = await woundHealingCheckHandler(trx, echeance)
    assert.deepEqual(result.reschedule, { intervalMinutes: 3 * MINUTES_PER_DAY, occurrencesRemaining: 1 })
    assert.equal(result.spawn.length, 1)
    assert.equal(result.spawn[0].conditionType, 'wound_infection_check')
    assert.equal(result.spawn[0].nextDueMinutes, echeance.next_due_minutes)
    assert.equal(result.spawn[0].intervalMinutes, null)
    assert.deepEqual(result.spawn[0].payload, { woundId: wound.id, periodesSansSoin: 0 })
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('handler : échec sur échéance unique (Grave), sans aucune case cochée -> une nouvelle tentative de 1 semaine est TOUJOURS reprogrammée, spawn infection', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet } = await createFixture(trx)
    const wound = await createWound(trx, charSheet.id, { severity: 'grave', occurredAt: 1000 })
    const echeance = await createEcheance(trx, {
      campaignId: campaign.id, characterId: character.id, conditionType: 'wound_healing_check',
      payload: { woundId: wound.id, mjChoice: 'echec' },
      nextDueMinutes: 1000 + 7 * MINUTES_PER_DAY, intervalMinutes: null, occurrencesRemaining: null,
    })
    const result = await woundHealingCheckHandler(trx, echeance)
    assert.deepEqual(result.reschedule, { intervalMinutes: 7 * MINUTES_PER_DAY, occurrencesRemaining: 1 })
    assert.equal(result.spawn.length, 1)
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('handler : échec sur échéance récurrente -> continue son cycle normalement, spawn infection', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet } = await createFixture(trx)
    const wound = await createWound(trx, charSheet.id, { severity: 'mortelle', occurredAt: 1000 })
    const echeance = await createEcheance(trx, {
      campaignId: campaign.id, characterId: character.id, conditionType: 'wound_healing_check',
      payload: { woundId: wound.id, mjChoice: 'echec' },
      nextDueMinutes: 1000 + WEEK_MINUTES, intervalMinutes: WEEK_MINUTES, occurrencesRemaining: 5,
    })
    const result = await woundHealingCheckHandler(trx, echeance)
    assert.deepEqual(result.reschedule, { intervalMinutes: WEEK_MINUTES, occurrencesRemaining: 4 })
    assert.equal(result.spawn.length, 1)
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('handler : catastrophe sur échéance unique (Moyenne, 3j) -> infection récurrente ~2 occurrences', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet } = await createFixture(trx)
    const wound = await createWound(trx, charSheet.id, { severity: 'moyenne', occurredAt: 1000 })
    const echeance = await createEcheance(trx, {
      campaignId: campaign.id, characterId: character.id, conditionType: 'wound_healing_check',
      payload: { woundId: wound.id, mjChoice: 'catastrophe' },
      nextDueMinutes: 1000 + 3 * MINUTES_PER_DAY, intervalMinutes: null, occurrencesRemaining: null,
    })
    const result = await woundHealingCheckHandler(trx, echeance)
    // Une Catastrophe ne termine pas la guérison : la Moyenne guérit naturellement, une nouvelle période de 3 jours est reprogrammée.
    assert.deepEqual(result.reschedule, { intervalMinutes: 3 * MINUTES_PER_DAY, occurrencesRemaining: 1 })
    assert.equal(result.spawn.length, 1)
    assert.equal(result.spawn[0].intervalMinutes, 2 * MINUTES_PER_DAY)
    assert.equal(result.spawn[0].occurrencesRemaining, Math.round((3 * MINUTES_PER_DAY) / (2 * MINUTES_PER_DAY)))
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('handler : catastrophe sur échéance récurrente (Critique) -> fenêtre = la semaine en cours', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet } = await createFixture(trx)
    const wound = await createWound(trx, charSheet.id, { severity: 'critique', occurredAt: 1000 })
    const echeance = await createEcheance(trx, {
      campaignId: campaign.id, characterId: character.id, conditionType: 'wound_healing_check',
      payload: { woundId: wound.id, mjChoice: 'catastrophe' },
      nextDueMinutes: 1000 + WEEK_MINUTES, intervalMinutes: WEEK_MINUTES, occurrencesRemaining: 3,
    })
    const result = await woundHealingCheckHandler(trx, echeance)
    assert.deepEqual(result.reschedule, { intervalMinutes: WEEK_MINUTES, occurrencesRemaining: 2 })
    assert.equal(result.spawn[0].occurrencesRemaining, Math.round(WEEK_MINUTES / (2 * MINUTES_PER_DAY)))
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

// ─── computeWoundInfectionThreshold ─────────────────────────────────────────────────────────────

test('computeWoundInfectionThreshold : Moyenne = NA(CON) + 5, jamais de malus de cases', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet } = await createFixture(trx)
    await setConstitution(trx, charSheet.id, 12)
    const wound = await createWound(trx, charSheet.id, { severity: 'moyenne' })
    // 2 cases supplémentaires sur la même ligne -> ne doit rien changer pour Moyenne
    await createWound(trx, charSheet.id, { severity: 'moyenne' })
    await createWound(trx, charSheet.id, { severity: 'moyenne' })
    const threshold = await computeWoundInfectionThreshold(trx, wound, 5)
    assert.equal(threshold, 12 + 5)
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('computeWoundInfectionThreshold : Grave = NA(CON) + 0 - malus de cases - malus de périodes', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet } = await createFixture(trx)
    await setConstitution(trx, charSheet.id, 12)
    const wound = await createWound(trx, charSheet.id, { severity: 'grave' })
    await createWound(trx, charSheet.id, { severity: 'grave' }) // 2e case -> -2
    const threshold = await computeWoundInfectionThreshold(trx, wound, 3) // 3 périodes -> -6
    assert.equal(threshold, 12 + 0 - 2 - 6)
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('computeWoundInfectionThreshold : Critique = NA(CON) - 5 - malus de cases - malus de périodes', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet } = await createFixture(trx)
    await setConstitution(trx, charSheet.id, 14)
    const wound = await createWound(trx, charSheet.id, { severity: 'critique' })
    const threshold = await computeWoundInfectionThreshold(trx, wound, 2)
    assert.equal(threshold, 14 - 5 - 0 - 4) // 1 seule case -> pas de malus de case, 2 périodes -> -4
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('computeWoundInfectionThreshold : Mortelle = NA(CON) - 10 - malus de cases, jamais de malus de périodes', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet } = await createFixture(trx)
    await setConstitution(trx, charSheet.id, 14)
    const wound = await createWound(trx, charSheet.id, { severity: 'mortelle' })
    const threshold = await computeWoundInfectionThreshold(trx, wound, 10) // periodesSansSoin ignoré
    assert.equal(threshold, 14 - 10)
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

// ─── woundInfectionCheckHandler ──────────────────────────────────────────────────────────────────

async function createInfectionEcheance(trx, campaign, character, wound, payloadExtra = {}, scheduleExtra = {}) {
  return createEcheance(trx, {
    campaignId: campaign.id, characterId: character.id, conditionType: 'wound_infection_check',
    payload: { woundId: wound.id, periodesSansSoin: 0, ...payloadExtra },
    nextDueMinutes: 1000, intervalMinutes: null, occurrencesRemaining: null,
    ...scheduleExtra,
  })
}

test('handler infection : sans rollResult -> resolved false (attend le jet)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet } = await createFixture(trx)
    const wound = await createWound(trx, charSheet.id, { severity: 'moyenne' })
    const echeance = await createInfectionEcheance(trx, campaign, character, wound)
    const result = await woundInfectionCheckHandler(trx, echeance)
    assert.deepEqual(result, { resolved: false })
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('handler infection : blessure introuvable -> no-op résolu', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const echeance = { id: '00000000-0000-0000-0000-000000000000', payload: { woundId: '00000000-0000-0000-0000-000000000001', rollResult: { isSuccess: true } } }
    const result = await woundInfectionCheckHandler(trx, echeance)
    assert.deepEqual(result, { resolved: true, reschedule: null, spawn: [], undoEntries: [] })
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('handler infection : Moyenne réussie -> aucune case ajoutée, aucune undoEntry', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet } = await createFixture(trx)
    const wound = await createWound(trx, charSheet.id, { severity: 'moyenne' })
    const echeance = await createInfectionEcheance(trx, campaign, character, wound)
    await trx('game_echeances').where({ id: echeance.id }).update({ payload: { ...echeance.payload, rollResult: { isSuccess: true } } })
    const fresh = await trx('game_echeances').where({ id: echeance.id }).first()

    const result = await woundInfectionCheckHandler(trx, fresh)
    assert.equal(result.resolved, true)
    assert.equal(result.effects.infected, false)
    assert.equal(result.undoEntries.length, 0)

    const woundsAfter = await trx('character_wounds').where({ char_sheet_id: charSheet.id })
    assert.equal(woundsAfter.length, 1) // aucune case supplémentaire
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('handler infection : Moyenne échouée -> case supplémentaire ajoutée', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet } = await createFixture(trx)
    const wound = await createWound(trx, charSheet.id, { severity: 'moyenne' })
    const echeance = await createInfectionEcheance(trx, campaign, character, wound)
    await trx('game_echeances').where({ id: echeance.id }).update({ payload: { ...echeance.payload, rollResult: { isSuccess: false } } })
    const fresh = await trx('game_echeances').where({ id: echeance.id }).first()

    const result = await woundInfectionCheckHandler(trx, fresh)
    assert.equal(result.effects.infected, true)
    assert.equal(result.undoEntries.length, 2) // la case ajoutée + son échéance de guérison

    const woundsAfter = await trx('character_wounds').where({ char_sheet_id: charSheet.id })
    assert.equal(woundsAfter.length, 2) // case supplémentaire réellement ajoutée
    // Elle guérit comme toute autre case : sa propre échéance de guérison, à côté de celle (absente ici) de la case d'origine.
    const added = woundsAfter.find(w => w.id !== wound.id)
    const addedEcheance = await trx('game_echeances').where({ campaign_id: campaign.id, condition_type: 'wound_healing_check' }).first()
    assert.deepEqual(addedEcheance.payload, { woundId: added.id })
    assert.equal(addedEcheance.character_id, character.id)
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('handler infection : Critique réussi -> infecte quand même (RAW, malgré la réussite)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet } = await createFixture(trx)
    const wound = await createWound(trx, charSheet.id, { severity: 'critique' })
    const echeance = await createInfectionEcheance(trx, campaign, character, wound)
    await trx('game_echeances').where({ id: echeance.id }).update({ payload: { ...echeance.payload, rollResult: { isSuccess: true } } })
    const fresh = await trx('game_echeances').where({ id: echeance.id }).first()

    const result = await woundInfectionCheckHandler(trx, fresh)
    assert.equal(result.effects.isSuccess, true)
    assert.equal(result.effects.infected, true)
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('handler infection : Mortelle -> délai de survie affiché, jamais appliqué (aucune suppression)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    // Deux personnages distincts : le délai de survie se calcule par personnage (NA de Constitution propre).
    // L'infection d'une Mortelle n'ajoute AUCUNE case (WOUND_INFECTION.mortelle.extraCase = false, RAW : survie en
    // heures) — vérifié plus bas : la ligne ne déborde donc jamais vers la 6ᵉ gravité par infection.
    const fixtureOk = await createFixture(trx)
    await setConstitution(trx, fixtureOk.charSheet.id, 10)
    const woundOk = await createWound(trx, fixtureOk.charSheet.id, { severity: 'mortelle' })
    const echeanceOk = await createInfectionEcheance(trx, fixtureOk.campaign, fixtureOk.character, woundOk)
    await trx('game_echeances').where({ id: echeanceOk.id }).update({ payload: { ...echeanceOk.payload, rollResult: { isSuccess: true } } })
    const freshOk = await trx('game_echeances').where({ id: echeanceOk.id }).first()
    const resultOk = await woundInfectionCheckHandler(trx, freshOk)
    assert.deepEqual(resultOk.effects.survivalHoursInfo, { hours: 10, onSuccess: true })
    assert.equal(resultOk.effects.infected, true)
    assert.equal(resultOk.undoEntries.length, 0)
    const woundsAfterOk = await trx('character_wounds').where({ char_sheet_id: fixtureOk.charSheet.id })
    assert.deepEqual(woundsAfterOk.map(w => w.severity), ['mortelle']) // aucune case ajoutée, pas de mort_subite

    const fixtureFail = await createFixture(trx)
    await setConstitution(trx, fixtureFail.charSheet.id, 10)
    const woundFail = await createWound(trx, fixtureFail.charSheet.id, { severity: 'mortelle' })
    const echeanceFail = await createInfectionEcheance(trx, fixtureFail.campaign, fixtureFail.character, woundFail)
    await trx('game_echeances').where({ id: echeanceFail.id }).update({ payload: { ...echeanceFail.payload, rollResult: { isSuccess: false } } })
    const freshFail = await trx('game_echeances').where({ id: echeanceFail.id }).first()
    const resultFail = await woundInfectionCheckHandler(trx, freshFail)
    assert.deepEqual(resultFail.effects.survivalHoursInfo, { hours: 5, onSuccess: false })

    const character_row = await trx('characters').where({ id: fixtureOk.character.id }).first()
    assert.ok(character_row) // le personnage n'est jamais supprimé/modifié par la mort — narratif MJ
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('handler infection : payload.periodesSansSoin incrémente et rollResult est vidé pour la prochaine occurrence', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet } = await createFixture(trx)
    const wound = await createWound(trx, charSheet.id, { severity: 'grave' })
    const echeance = await createInfectionEcheance(trx, campaign, character, wound, { periodesSansSoin: 2 },
      { intervalMinutes: 2 * MINUTES_PER_DAY, occurrencesRemaining: 3 })
    await trx('game_echeances').where({ id: echeance.id }).update({ payload: { ...echeance.payload, periodesSansSoin: 2, rollResult: { isSuccess: true } } })
    const fresh = await trx('game_echeances').where({ id: echeance.id }).first()

    const result = await woundInfectionCheckHandler(trx, fresh)
    assert.deepEqual(result.reschedule, { intervalMinutes: 2 * MINUTES_PER_DAY, occurrencesRemaining: 2 })

    const afterRow = await trx('game_echeances').where({ id: echeance.id }).first()
    assert.equal(afterRow.payload.periodesSansSoin, 3)
    assert.equal(afterRow.payload.rollResult, null)
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test.after(async () => { await db.destroy() })

// ─── Lot 2b — la 6ᵉ gravité (mort_subite) : Membre détruit (bras/jambe) guérit ; une Mort (Tête/Corps) ne guérit pas ──

test('initializeWoundHealingEcheance : Membre détruit (bras) -> échéance hebdomadaire récurrente, 3 occurrences (RAW : 3 semaines, soins constants)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet } = await createFixture(trx)
    const wound = await createWound(trx, charSheet.id, { location: 'bras_gauche', severity: 'mort_subite', occurredAt: 1000 })
    const echeance = await initializeWoundHealingEcheance(trx, { campaignId: campaign.id, characterId: character.id, wound })
    assert.equal(echeance.condition_type, 'wound_healing_check')
    assert.equal(echeance.next_due_minutes, 1000 + WEEK_MINUTES)
    assert.equal(echeance.interval_minutes, WEEK_MINUTES)
    assert.equal(echeance.occurrences_remaining, 3)
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('initializeWoundHealingEcheance : Mort (Tête ou Corps) -> aucune échéance (la résurrection reste une décision du MJ)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    for (const location of ['tete', 'corps']) {
      const { campaign, character, charSheet } = await createFixture(trx)
      const wound = await createWound(trx, charSheet.id, { location, severity: 'mort_subite', occurredAt: 1000 })
      const result = await initializeWoundHealingEcheance(trx, { campaignId: campaign.id, characterId: character.id, wound })
      assert.equal(result, null, location)
      assert.equal((await trx('game_echeances').where({ campaign_id: campaign.id })).length, 0, location)
    }
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('handler : amélioration, DERNIÈRE occurrence, sur un Membre détruit -> devient une Critique (jamais une Mortelle)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet } = await createFixture(trx)
    const wound = await createWound(trx, charSheet.id, { location: 'jambe_droite', severity: 'mort_subite', occurredAt: 1000 })
    const echeance = await createEcheance(trx, {
      campaignId: campaign.id, characterId: character.id, conditionType: 'wound_healing_check',
      payload: { woundId: wound.id, mjChoice: 'amelioration' },
      nextDueMinutes: 1000 + 3 * WEEK_MINUTES, intervalMinutes: WEEK_MINUTES, occurrencesRemaining: 1,
    })
    const result = await woundHealingCheckHandler(trx, echeance)
    assert.equal(result.reschedule, null)
    assert.equal(result.undoEntries.length, 3) // la case d'origine, la Critique obtenue, l'échéance de guérison de la Critique
    const improved = await trx('character_wounds').where({ char_sheet_id: charSheet.id })
    assert.deepEqual(improved.map(w => [w.location, w.severity]), [['jambe_droite', 'critique']])
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('handler : échec puis catastrophe sur un Membre détruit -> cycle hebdomadaire conservé, infection déclenchée (sans erreur)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet } = await createFixture(trx)
    const wound = await createWound(trx, charSheet.id, { location: 'bras_droit', severity: 'mort_subite', occurredAt: 1000 })
    const heal = (mjChoice) => createEcheance(trx, {
      campaignId: campaign.id, characterId: character.id, conditionType: 'wound_healing_check',
      payload: { woundId: wound.id, mjChoice },
      nextDueMinutes: 1000 + WEEK_MINUTES, intervalMinutes: WEEK_MINUTES, occurrencesRemaining: 3,
    })

    const echec = await woundHealingCheckHandler(trx, await heal('echec'))
    assert.deepEqual(echec.reschedule, { intervalMinutes: WEEK_MINUTES, occurrencesRemaining: 2 })
    assert.equal(echec.spawn.length, 1)
    assert.equal(echec.spawn[0].conditionType, 'wound_infection_check')

    const catastrophe = await woundHealingCheckHandler(trx, await heal('catastrophe'))
    assert.equal(catastrophe.spawn[0].occurrencesRemaining, Math.round(WEEK_MINUTES / (2 * MINUTES_PER_DAY)))
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('computeWoundInfectionThreshold : Membre détruit = NA(CON) - 10, comme la Mortelle (RAW « Mortelles/Membres détruits »)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet } = await createFixture(trx)
    await setConstitution(trx, charSheet.id, 14)
    const wound = await createWound(trx, charSheet.id, { location: 'bras_gauche', severity: 'mort_subite' })
    assert.equal(await computeWoundInfectionThreshold(trx, wound, 10), 14 - 10)
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('handler infection : Membre détruit -> délai de survie affiché, aucune case ajoutée (pas de débordement), jamais appliqué', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const infectWith = async (isSuccess) => {
      const { campaign, character, charSheet } = await createFixture(trx)
      await setConstitution(trx, charSheet.id, 10)
      const wound = await createWound(trx, charSheet.id, { location: 'bras_gauche', severity: 'mort_subite' })
      const echeance = await createInfectionEcheance(trx, campaign, character, wound)
      await trx('game_echeances').where({ id: echeance.id }).update({ payload: { ...echeance.payload, rollResult: { isSuccess } } })
      const result = await woundInfectionCheckHandler(trx, await trx('game_echeances').where({ id: echeance.id }).first())
      const wounds = await trx('character_wounds').where({ char_sheet_id: charSheet.id })
      return { result, wounds }
    }

    const ok = await infectWith(true)
    assert.deepEqual(ok.result.effects.survivalHoursInfo, { hours: 10, onSuccess: true })
    assert.equal(ok.result.effects.infected, true)
    assert.equal(ok.result.undoEntries.length, 0)
    assert.deepEqual(ok.wounds.map(w => w.severity), ['mort_subite'])

    const fail = await infectWith(false)
    assert.deepEqual(fail.result.effects.survivalHoursInfo, { hours: 5, onSuccess: false })
    assert.deepEqual(fail.wounds.map(w => w.severity), ['mort_subite'])
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

// ─── WOUND-HEAL-CHAIN-STOPS — la guérison se poursuit de gravité en gravité, jusqu'à disparition ─────────────────────

test('handler : la case obtenue par une guérison naît avec son échéance, datée du jour d\'échéance (pas du repère mécanique courant)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    // Repère mécanique = 1000 : n'a pas encore avancé (l'avance de temps n'est confirmée qu'après la revue du MJ).
    const { campaign, character, charSheet } = await createFixture(trx, { resolvedMinutes: 1000 })
    const wound = await createWound(trx, charSheet.id, { severity: 'critique', occurredAt: 1000 })
    const due = 1000 + 3 * WEEK_MINUTES
    const echeance = await createEcheance(trx, {
      campaignId: campaign.id, characterId: character.id, conditionType: 'wound_healing_check',
      payload: { woundId: wound.id, mjChoice: 'amelioration' },
      nextDueMinutes: due, intervalMinutes: WEEK_MINUTES, occurrencesRemaining: 1,
    })
    const result = await woundHealingCheckHandler(trx, echeance)

    const [grave] = await trx('character_wounds').where({ char_sheet_id: charSheet.id })
    assert.equal(grave.severity, 'grave')
    assert.equal(grave.occurred_at_game_minutes, due, 'datée du jour où la Critique a guéri, pas de 1000')
    const next = await trx('game_echeances')
      .where({ campaign_id: campaign.id, condition_type: 'wound_healing_check' }).whereNot({ id: echeance.id }).first()
    assert.deepEqual(next.payload, { woundId: grave.id })
    assert.equal(next.next_due_minutes, due + WEEK_MINUTES)
    assert.equal(next.character_id, character.id)
    assert.ok(result.undoEntries.some(e => e.table === 'game_echeances' && e.rowId === next.id && e.previousValues === null))
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('handler : la guérison s\'enchaîne Critique -> Grave -> Moyenne -> Légère (plus d\'échéance, elle guérit seule)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet } = await createFixture(trx, { resolvedMinutes: 1000 })
    let wound = await createWound(trx, charSheet.id, { severity: 'critique', occurredAt: 1000 })
    let echeance = await createEcheance(trx, {
      campaignId: campaign.id, characterId: character.id, conditionType: 'wound_healing_check',
      payload: { woundId: wound.id, mjChoice: 'amelioration' },
      nextDueMinutes: 1000 + 3 * WEEK_MINUTES, intervalMinutes: WEEK_MINUTES, occurrencesRemaining: 1,
    })

    const seen = []
    for (let step = 0; step < 3; step += 1) {
      await woundHealingCheckHandler(trx, echeance)
      const [current] = await trx('character_wounds').where({ char_sheet_id: charSheet.id })
      seen.push(current.severity)
      if (current.severity === 'legere') break
      const row = await trx('game_echeances')
        .where({ campaign_id: campaign.id, condition_type: 'wound_healing_check' })
        .whereRaw("payload->>'woundId' = ?", [current.id]).first()
      assert.ok(row, `la ${current.severity} obtenue a son échéance de guérison`)
      echeance = { ...row, payload: { ...row.payload, mjChoice: 'amelioration' } }
    }
    assert.deepEqual(seen, ['grave', 'moyenne', 'legere'])

    const [legere] = await trx('character_wounds').where({ char_sheet_id: charSheet.id })
    const none = await trx('game_echeances')
      .where({ campaign_id: campaign.id, condition_type: 'wound_healing_check' })
      .whereRaw("payload->>'woundId' = ?", [legere.id])
    assert.equal(none.length, 0, 'la Légère guérit seule : aucune échéance')
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('resolveEcheanceNow : la guérison est journalisée en entier — annuler l\'avance de temps retire aussi l\'échéance de la case obtenue', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet } = await createFixture(trx, { resolvedMinutes: 1000 })
    const wound = await createWound(trx, charSheet.id, { severity: 'critique', occurredAt: 1000 })
    const echeance = await createEcheance(trx, {
      campaignId: campaign.id, characterId: character.id, conditionType: 'wound_healing_check',
      payload: { woundId: wound.id, mjChoice: 'amelioration' },
      nextDueMinutes: 1000 + 3 * WEEK_MINUTES, intervalMinutes: WEEK_MINUTES, occurrencesRemaining: 1,
      status: 'pending_mj_review',
    })
    assert.deepEqual(await resolveEcheanceNow(trx, echeance.id), { resolved: true })

    const { pending_advance_undo_log: undoLog } = await trx('campaigns').where({ id: campaign.id }).first()
    // Même algorithme que gameTimeService.js:replayUndoEntry (privé), rejoué en sens inverse comme cancelPendingAdvance.
    for (const { table, rowId, previousValues } of [...undoLog].reverse()) {
      const existing = await trx(table).where({ id: rowId }).first()
      if (previousValues !== null && existing) await trx(table).where({ id: rowId }).update(previousValues)
      else if (previousValues === null && existing) await trx(table).where({ id: rowId }).del()
      else if (previousValues !== null && !existing) await trx(table).insert(previousValues)
    }

    const wounds = await trx('character_wounds').where({ char_sheet_id: charSheet.id })
    assert.deepEqual(wounds.map(w => [w.id, w.severity]), [[wound.id, 'critique']], 'la Critique est revenue, la Grave a disparu')
    const echeances = await trx('game_echeances').where({ campaign_id: campaign.id, condition_type: 'wound_healing_check' })
    assert.deepEqual(echeances.map(e => e.id), [echeance.id], 'l\'échéance de la Grave obtenue est retirée')
    assert.equal(echeances[0].status, 'pending_mj_review')
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

// ─── Lot 0 (PLAN_REVUE_GUERISON) — le Test suivant ne s'éteint jamais ; l'échéance meurt avec sa case ──────────────────

test('handler : un Échec ou une Catastrophe ne termine JAMAIS l\'échéance — échéance unique, tentative déjà reprogrammée, dernière semaine (toutes gravités)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const DAY = MINUTES_PER_DAY
    const cases = [
      { label: 'Moyenne, échéance unique', severity: 'moyenne', occ: null, interval: null, expected: { intervalMinutes: 3 * DAY, occurrencesRemaining: 1 } },
      { label: 'Moyenne, 2ᵉ échec sur la tentative reprogrammée', severity: 'moyenne', occ: 1, interval: 3 * DAY, expected: { intervalMinutes: 3 * DAY, occurrencesRemaining: 1 } },
      { label: 'Grave, échéance unique', severity: 'grave', occ: null, interval: null, expected: { intervalMinutes: 7 * DAY, occurrencesRemaining: 1 } },
      { label: 'Critique, dernière semaine', severity: 'critique', occ: 1, interval: WEEK_MINUTES, expected: { intervalMinutes: WEEK_MINUTES, occurrencesRemaining: 1 } },
      { label: 'Mortelle, dernière semaine', severity: 'mortelle', occ: 1, interval: WEEK_MINUTES, expected: { intervalMinutes: WEEK_MINUTES, occurrencesRemaining: 1 } },
      { label: 'Membre détruit, dernière semaine', severity: 'mort_subite', location: 'bras_droit', occ: 1, interval: WEEK_MINUTES, expected: { intervalMinutes: WEEK_MINUTES, occurrencesRemaining: 1 } },
    ]
    const { campaign, character, charSheet } = await createFixture(trx)
    for (const c of cases) {
      for (const mjChoice of ['echec', 'catastrophe']) {
        const wound = await createWound(trx, charSheet.id, { severity: c.severity, location: c.location ?? 'corps', occurredAt: 1000 })
        const echeance = await createEcheance(trx, {
          campaignId: campaign.id, characterId: character.id, conditionType: 'wound_healing_check',
          payload: { woundId: wound.id, mjChoice }, nextDueMinutes: 5000, intervalMinutes: c.interval, occurrencesRemaining: c.occ,
        })
        const result = await woundHealingCheckHandler(trx, echeance)
        assert.deepEqual(result.reschedule, c.expected, `${c.label} — ${mjChoice}`)
      }
    }
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('handler : pas la dernière occurrence, un Échec continue le cycle hebdomadaire (inchangé)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet } = await createFixture(trx)
    const wound = await createWound(trx, charSheet.id, { severity: 'critique', occurredAt: 1000 })
    const echeance = await createEcheance(trx, {
      campaignId: campaign.id, characterId: character.id, conditionType: 'wound_healing_check',
      payload: { woundId: wound.id, mjChoice: 'echec' }, nextDueMinutes: 5000, intervalMinutes: WEEK_MINUTES, occurrencesRemaining: 2,
    })
    assert.deepEqual((await woundHealingCheckHandler(trx, echeance)).reschedule, { intervalMinutes: WEEK_MINUTES, occurrencesRemaining: 1 })
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('resolveEcheanceNow : deux Échecs de suite reprogramment chaque fois (jamais bloquée), puis l\'Amélioration fait guérir', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet } = await createFixture(trx, { resolvedMinutes: 1000 })
    const wound = await createWound(trx, charSheet.id, { severity: 'moyenne', occurredAt: 1000 })
    const due0 = 1000 + 3 * MINUTES_PER_DAY
    const echeance = await createEcheance(trx, {
      campaignId: campaign.id, characterId: character.id, conditionType: 'wound_healing_check',
      payload: { woundId: wound.id, mjChoice: 'echec' }, nextDueMinutes: due0, intervalMinutes: null, occurrencesRemaining: null,
      status: 'pending_mj_review',
    })
    const rowOf = () => trx('game_echeances').where({ id: echeance.id }).first()
    const answer = (mjChoice) => trx('game_echeances').where({ id: echeance.id })
      .update({ status: 'pending_mj_review', payload: trx.raw('payload || ?::jsonb', [JSON.stringify({ mjChoice })]) })

    assert.deepEqual(await resolveEcheanceNow(trx, echeance.id), { resolved: true })
    let row = await rowOf()
    assert.deepEqual([row.status, row.next_due_minutes, row.occurrences_remaining], ['active', due0 + 3 * MINUTES_PER_DAY, 1])

    await answer('echec') // 2ᵉ échec : avant ce correctif, l'échéance se terminait ici
    assert.deepEqual(await resolveEcheanceNow(trx, echeance.id), { resolved: true })
    row = await rowOf()
    assert.deepEqual([row.status, row.next_due_minutes, row.occurrences_remaining], ['active', due0 + 6 * MINUTES_PER_DAY, 1])

    await answer('amelioration')
    assert.deepEqual(await resolveEcheanceNow(trx, echeance.id), { resolved: true })
    assert.equal((await rowOf()).status, 'completed')
    assert.deepEqual((await trx('character_wounds').where({ char_sheet_id: charSheet.id })).map(w => w.severity), ['legere'])
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('handler infection : la ligne déborde et la case infectée est fusionnée -> l\'infection SE TERMINE, les échéances des cases fusionnées sont annulées et journalisées', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet } = await createFixture(trx)
    // corps/moyenne : capacité 3, la ligne est pleine à 3 cases — la case d'infection est la 4ᵉ, elle déborde.
    const w1 = await createWound(trx, charSheet.id, { severity: 'moyenne' })
    const w2 = await createWound(trx, charSheet.id, { severity: 'moyenne' })
    const w3 = await createWound(trx, charSheet.id, { severity: 'moyenne' })
    const heal = (wound) => createEcheance(trx, {
      campaignId: campaign.id, characterId: character.id, conditionType: 'wound_healing_check',
      payload: { woundId: wound.id }, nextDueMinutes: 5000, intervalMinutes: null, occurrencesRemaining: null,
    })
    const heal1 = await heal(w1)
    const heal2 = await heal(w2)
    const heal3 = await heal(w3)
    const infection = await createInfectionEcheance(trx, campaign, character, w1, {}, { intervalMinutes: 2 * MINUTES_PER_DAY, occurrencesRemaining: 3 })
    await trx('game_echeances').where({ id: infection.id }).update({ payload: { ...infection.payload, rollResult: { isSuccess: false } } })

    const result = await woundInfectionCheckHandler(trx, await trx('game_echeances').where({ id: infection.id }).first())
    assert.equal(result.reschedule, null, 'sa case n\'existe plus : plus de reprogrammation sans blessure')
    assert.deepEqual((await trx('character_wounds').where({ char_sheet_id: charSheet.id })).map(w => w.severity), ['grave'])

    const statusOf = async (e) => (await trx('game_echeances').where({ id: e.id }).first()).status
    assert.equal(await statusOf(heal1), 'cancelled')
    assert.equal(await statusOf(heal2), 'cancelled')
    assert.equal(await statusOf(heal3), 'cancelled')
    assert.equal(await statusOf(infection), 'active', 'l\'échéance que le moteur résout n\'est pas touchée : il fixe lui-même son statut')
    for (const healing of [heal1, heal2, heal3]) {
      const entry = result.undoEntries.find(e => e.table === 'game_echeances' && e.rowId === healing.id)
      assert.equal(entry?.previousValues?.status, 'active', 'entrée d\'annulation = la ligne d\'origine')
    }
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('resolveEcheanceNow : une guérison annule l\'infection en cours de la case guérie ; annuler l\'avance de temps la RESTAURE', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet } = await createFixture(trx, { resolvedMinutes: 1000 })
    const wound = await createWound(trx, charSheet.id, { severity: 'critique', occurredAt: 1000 })
    const healing = await createEcheance(trx, {
      campaignId: campaign.id, characterId: character.id, conditionType: 'wound_healing_check',
      payload: { woundId: wound.id, mjChoice: 'amelioration' }, nextDueMinutes: 1000 + 3 * WEEK_MINUTES,
      intervalMinutes: WEEK_MINUTES, occurrencesRemaining: 1, status: 'pending_mj_review',
    })
    const infection = await createInfectionEcheance(trx, campaign, character, wound, {}, { intervalMinutes: 2 * MINUTES_PER_DAY, occurrencesRemaining: 3 })

    assert.deepEqual(await resolveEcheanceNow(trx, healing.id), { resolved: true })
    assert.equal((await trx('game_echeances').where({ id: infection.id }).first()).status, 'cancelled', 'la Critique a guéri : son infection n\'a plus d\'objet')
    assert.equal((await trx('game_echeances').where({ id: healing.id }).first()).status, 'completed')

    const { pending_advance_undo_log: undoLog } = await trx('campaigns').where({ id: campaign.id }).first()
    // Même algorithme que gameTimeService.js:replayUndoEntry (privé), rejoué en sens inverse comme cancelPendingAdvance.
    for (const { table, rowId, previousValues } of [...undoLog].reverse()) {
      const existing = await trx(table).where({ id: rowId }).first()
      if (previousValues !== null && existing) await trx(table).where({ id: rowId }).update(previousValues)
      else if (previousValues === null && existing) await trx(table).where({ id: rowId }).del()
      else if (previousValues !== null && !existing) await trx(table).insert(previousValues)
    }
    assert.equal((await trx('game_echeances').where({ id: infection.id }).first()).status, 'active', 'l\'infection est restaurée telle qu\'elle était')
    assert.deepEqual((await trx('character_wounds').where({ char_sheet_id: charSheet.id })).map(w => w.severity), ['critique'])
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('handler : une guérison sur une ligne d\'arrivée PLEINE efface la ligne, le raconte (trace) et « Annuler l\'avance » restaure tout', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet } = await createFixture(trx, { resolvedMinutes: 1000 })
    const line = []
    for (let i = 0; i < 3; i += 1) line.push(await createWound(trx, charSheet.id, { location: 'tete', severity: 'moyenne', occurredAt: 1000 + i }))
    const grave = await createWound(trx, charSheet.id, { location: 'tete', severity: 'grave', occurredAt: 1000 })
    const echeance = await createEcheance(trx, {
      campaignId: campaign.id, characterId: character.id, conditionType: 'wound_healing_check',
      payload: { woundId: grave.id, mjChoice: 'amelioration' },
      nextDueMinutes: 1000 + 7 * 24 * 60, intervalMinutes: null, occurrencesRemaining: null,
      status: 'pending_mj_review',
    })
    const lines = []
    assert.deepEqual(await resolveEcheanceNow(trx, echeance.id, { trace: line => lines.push(line) }), { resolved: true })

    const text = lines.join('\n')
    assert.match(text, /guérison tete\/grave \(case [0-9a-f]{8}, Test unique\) — issue « amelioration »/)
    assert.match(text, /→ devient grave .* LIGNE D'ARRIVÉE PLEINE : 3 case\(s\) effacée\(s\), la case est cochée en grave/)
    assert.deepEqual((await trx('character_wounds').where({ char_sheet_id: charSheet.id })).map(w => w.severity), ['grave'], 'les 3 Moyennes sont effacées')

    const { pending_advance_undo_log: undoLog } = await trx('campaigns').where({ id: campaign.id }).first()
    for (const { table, rowId, previousValues } of [...undoLog].reverse()) {
      const existing = await trx(table).where({ id: rowId }).first()
      if (previousValues !== null && existing) await trx(table).where({ id: rowId }).update(previousValues)
      else if (previousValues === null && existing) await trx(table).where({ id: rowId }).del()
      else if (previousValues !== null && !existing) await trx(table).insert(previousValues)
    }
    const restored = (await trx('character_wounds').where({ char_sheet_id: charSheet.id })).map(w => w.id).sort()
    assert.deepEqual(restored, [grave.id, ...line.map(w => w.id)].sort(), 'la Grave d\'origine et les 3 Moyennes sont revenues')
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})
