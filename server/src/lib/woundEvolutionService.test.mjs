import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { MINUTES_PER_DAY } from '../../../shared/gameTime.js'
import { createEcheance } from './echeanceService.js'
import {
  initializeWoundHealingEcheance, woundHealingCheckHandler,
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
    assert.equal(result.undoEntries.length, 2)
    const improved = await trx('character_wounds').where({ char_sheet_id: charSheet.id }).first()
    assert.equal(improved.severity, 'grave') // previousSeverity('critique')
    throw new Error('ROLLBACK_WES_TEST')
  }), /ROLLBACK_WES_TEST/)
})

test('handler : échec sur échéance unique + soinsContinues=true -> reprogramme une tentative, spawn infection', { skip }, async () => {
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

test('handler : échec sur échéance unique sans soinsContinues -> se termine, spawn infection quand même', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet } = await createFixture(trx)
    const wound = await createWound(trx, charSheet.id, { severity: 'grave', occurredAt: 1000 })
    const echeance = await createEcheance(trx, {
      campaignId: campaign.id, characterId: character.id, conditionType: 'wound_healing_check',
      payload: { woundId: wound.id, mjChoice: 'echec' },
      nextDueMinutes: 1000 + 7 * MINUTES_PER_DAY, intervalMinutes: null, occurrencesRemaining: null,
    })
    const result = await woundHealingCheckHandler(trx, echeance)
    assert.equal(result.reschedule, null)
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
    assert.equal(result.reschedule, null) // one-shot, terminé
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
    assert.equal(result.undoEntries.length, 1)

    const woundsAfter = await trx('character_wounds').where({ char_sheet_id: charSheet.id })
    assert.equal(woundsAfter.length, 2) // case supplémentaire réellement ajoutée
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
    // Deux personnages distincts — mortelle/corps n'a que 2 cases de capacité (WOUND_MAX_COUNTS,
    // les autres Localisations n'en ont qu'1), et le handler "infecte quand même" ajoute une case à
    // chaque résolution : réutiliser le même personnage/la même Localisation pour les deux branches
    // épuiserait la ligne (aucune promotion au-delà de mortelle), sans rapport avec ce que ce test
    // vérifie (le calcul du délai de survie, indépendant par personnage).
    const fixtureOk = await createFixture(trx)
    await setConstitution(trx, fixtureOk.charSheet.id, 10)
    const woundOk = await createWound(trx, fixtureOk.charSheet.id, { severity: 'mortelle' })
    const echeanceOk = await createInfectionEcheance(trx, fixtureOk.campaign, fixtureOk.character, woundOk)
    await trx('game_echeances').where({ id: echeanceOk.id }).update({ payload: { ...echeanceOk.payload, rollResult: { isSuccess: true } } })
    const freshOk = await trx('game_echeances').where({ id: echeanceOk.id }).first()
    const resultOk = await woundInfectionCheckHandler(trx, freshOk)
    assert.deepEqual(resultOk.effects.survivalHoursInfo, { hours: 10, onSuccess: true })

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
