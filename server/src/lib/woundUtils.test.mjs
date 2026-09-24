import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { AppError } from './AppError.js'
import {
  nextSeverity, previousSeverity, resolveWoundInsertion, resolveWoundImprovement,
  buildWoundInsertionUndoEntries, computeAvailableSeverityReductions,
  isShockTestRequired, woundSeverityRankSql, WoundLineFullError,
} from './woundUtils.js'

// Lancement manuel (aucun script npm test dans le projet) :
//   DATABASE_URL=... node --test server/src/lib/woundUtils.test.mjs
// Les tests DB tournent entièrement dans une transaction rollback (patron
// server/src/db/migrations/154_world_effects_runtime.test.mjs) — rien n'est jamais persisté.
const skip = !process.env.DATABASE_URL

test('previousSeverity est l\'inverse exact de nextSeverity, sur toute l\'échelle', () => {
  assert.equal(previousSeverity('legere'), null)
  assert.equal(previousSeverity('moyenne'), 'legere')
  assert.equal(previousSeverity('grave'), 'moyenne')
  assert.equal(previousSeverity('critique'), 'grave')
  assert.equal(previousSeverity('mortelle'), 'critique')
  assert.equal(previousSeverity('mort_subite'), 'mortelle')
  assert.equal(nextSeverity('legere'), 'moyenne')
  assert.equal(nextSeverity('mortelle'), 'mort_subite')
  assert.equal(nextSeverity('mort_subite'), null)
})

test('isShockTestRequired : RAW — Membre détruit (bras/jambe) fait un Test de Choc, la Mort subite (Tête/Corps) aucun', () => {
  assert.equal(isShockTestRequired('mort_subite', 'tete'), false)
  assert.equal(isShockTestRequired('mort_subite', 'corps'), false)
  for (const loc of ['bras_droit', 'bras_gauche', 'jambe_droite', 'jambe_gauche']) {
    assert.equal(isShockTestRequired('mort_subite', loc), true, loc)
  }
  // Inchangé pour les 5 lignes existantes.
  assert.equal(isShockTestRequired('legere', 'tete'), false)
  assert.equal(isShockTestRequired('grave', 'corps'), true)
  assert.equal(isShockTestRequired('grave', 'bras_droit'), false)
  assert.equal(isShockTestRequired('critique', 'jambe_gauche'), true)
  assert.equal(isShockTestRequired('mortelle', 'tete'), true)
})

test('woundSeverityRankSql : la plus grave d\'abord, générée depuis WOUND_SEVERITIES (6 lignes)', () => {
  assert.equal(
    woundSeverityRankSql('cw.severity'),
    "CASE cw.severity WHEN 'mort_subite' THEN 1 WHEN 'mortelle' THEN 2 WHEN 'critique' THEN 3 WHEN 'grave' THEN 4 WHEN 'moyenne' THEN 5 WHEN 'legere' THEN 6 END",
  )
})

// Crée la chaîne complète users -> campaigns -> characters -> char_sheet requise par
// character_wounds.char_sheet_id, avec un game_time_resolved_minutes connu.
async function createFixture(trx, { resolvedMinutes = 1000 } = {}) {
  const [user] = await trx('users')
    .insert({ email: `wound-test-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'wound-test' })
    .returning('*')
  const [campaign] = await trx('campaigns')
    .insert({
      gm_id: user.id, name: 'Campagne test', invite_code: `WND-${Date.now()}-${Math.random()}`,
      game_time_minutes: resolvedMinutes, game_time_resolved_minutes: resolvedMinutes,
    })
    .returning('*')
  const [character] = await trx('characters')
    .insert({ campaign_id: campaign.id, name: 'Perso test' })
    .returning('*')
  const [charSheet] = await trx('char_sheet')
    .insert({ character_id: character.id })
    .returning('*')
  return { user, campaign, charSheet }
}

test('resolveWoundInsertion stampe occurred_at_game_minutes depuis game_time_resolved_minutes', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet } = await createFixture(trx, { resolvedMinutes: 4242 })
    const { wound } = await resolveWoundInsertion(trx, charSheet.id, 'tete', 'moyenne')
    assert.equal(wound.occurred_at_game_minutes, 4242)
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('resolveWoundInsertion : sans promotion, deletedWounds vide, une seule undoEntry insert', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet } = await createFixture(trx)
    const result = await resolveWoundInsertion(trx, charSheet.id, 'corps', 'moyenne')
    assert.deepEqual(result.deletedWounds, [])
    const undoEntries = buildWoundInsertionUndoEntries(result)
    assert.deepEqual(undoEntries, [{ table: 'character_wounds', rowId: result.wound.id, previousValues: null }])
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('resolveWoundInsertion : promotion en cascade, deletedWounds capture les lignes supprimées', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet } = await createFixture(trx)
    // corps/moyenne maxCount=3 -> 2 cases existantes déclenchent déjà la cascade (currentCount >= maxCount-1)
    const existing = []
    for (let i = 0; i < 2; i++) {
      const [row] = await trx('character_wounds')
        .insert({ char_sheet_id: charSheet.id, location: 'corps', severity: 'moyenne', occurred_at_game_minutes: 100 + i })
        .returning('*')
      existing.push(row)
    }

    const result = await resolveWoundInsertion(trx, charSheet.id, 'corps', 'moyenne')
    assert.equal(result.promoted, true)
    assert.equal(result.wound.severity, 'grave')
    assert.equal(result.deletedWounds.length, 2)
    assert.deepEqual(new Set(result.deletedWounds.map(w => w.id)), new Set(existing.map(w => w.id)))

    const undoEntries = buildWoundInsertionUndoEntries(result)
    assert.equal(undoEntries.length, 3) // 2 delete-undo (insert) + 1 insert-undo (delete)
    for (const w of existing) {
      assert.ok(undoEntries.some(e => e.rowId === w.id && e.previousValues?.id === w.id))
    }
    assert.ok(undoEntries.some(e => e.rowId === result.wound.id && e.previousValues === null))

    const remaining = await trx('character_wounds').where({ char_sheet_id: charSheet.id, location: 'corps' }).select('*')
    assert.equal(remaining.length, 1)
    assert.equal(remaining[0].severity, 'grave')
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('resolveWoundImprovement : Grave -> Moyenne, nouvel horodatage, is_stabilized conservé', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet } = await createFixture(trx, { resolvedMinutes: 1000 })
    const [original] = await trx('character_wounds')
      .insert({
        char_sheet_id: charSheet.id, location: 'bras_droit', severity: 'grave',
        is_stabilized: true, occurred_at_game_minutes: 100,
      })
      .returning('*')

    // avance le temps résolu pour vérifier que la nouvelle case prend bien la valeur COURANTE,
    // pas celle héritée de la case d'origine (100)
    const campaignRow = await trx('char_sheet')
      .join('characters', 'characters.id', 'char_sheet.character_id')
      .where('char_sheet.id', charSheet.id)
      .select('characters.campaign_id')
      .first()
    await trx('campaigns').where({ id: campaignRow.campaign_id }).update({ game_time_resolved_minutes: 2000 })

    const { wound, healed } = await resolveWoundImprovement(trx, original.id)
    assert.equal(healed, false)
    assert.equal(wound.severity, 'moyenne')
    assert.equal(wound.location, 'bras_droit')
    assert.equal(wound.is_stabilized, true)
    assert.equal(wound.occurred_at_game_minutes, 2000)

    const stillThere = await trx('character_wounds').where({ id: original.id }).first()
    assert.equal(stillThere, undefined)
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('resolveWoundImprovement : Légère guérit entièrement (pas de nouvelle case)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet } = await createFixture(trx)
    const [original] = await trx('character_wounds')
      .insert({ char_sheet_id: charSheet.id, location: 'corps', severity: 'legere', is_stabilized: false })
      .returning('*')

    const { wound, healed } = await resolveWoundImprovement(trx, original.id)
    assert.equal(healed, true)
    assert.equal(wound, null)

    const remaining = await trx('character_wounds').where({ char_sheet_id: charSheet.id }).select('*')
    assert.equal(remaining.length, 0)
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('resolveWoundImprovement sur une blessure inconnue lève AppError(404)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    await assert.rejects(
      resolveWoundImprovement(trx, '00000000-0000-0000-0000-000000000000'),
      (err) => err instanceof AppError && err.statusCode === 404,
    )
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

// ─── computeAvailableSeverityReductions — PLAN_CHANCE.md L5, REGLE_CHANCE.md:112-131 ───────────────
// WOUND_MAX_COUNTS.corps = { legere:4, moyenne:3, grave:3, critique:2, mortelle:2 }

test('computeAvailableSeverityReductions : cas normal, degrés 1 et 2 tous deux disponibles', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet } = await createFixture(trx)
    const options = await computeAvailableSeverityReductions(trx, charSheet.id, 'corps', 'grave')
    assert.deepEqual(options, [
      { degree: 1, targetSeverity: 'moyenne' },
      { degree: 2, targetSeverity: 'legere' },
    ])
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('computeAvailableSeverityReductions : degré 1 plein, degré 2 seul retenu', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet } = await createFixture(trx)
    for (let i = 0; i < 3; i++) { // moyenne/corps maxCount=3 -> plein
      await trx('character_wounds').insert({ char_sheet_id: charSheet.id, location: 'corps', severity: 'moyenne', occurred_at_game_minutes: i })
    }
    const options = await computeAvailableSeverityReductions(trx, charSheet.id, 'corps', 'grave')
    assert.deepEqual(options, [{ degree: 2, targetSeverity: 'legere' }])
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('computeAvailableSeverityReductions : exception "palier plein" — degrés 1 et 2 pleins, un seul palier au-delà proposé', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet } = await createFixture(trx)
    for (let i = 0; i < 3; i++) { // moyenne/corps plein
      await trx('character_wounds').insert({ char_sheet_id: charSheet.id, location: 'corps', severity: 'moyenne', occurred_at_game_minutes: i })
    }
    for (let i = 0; i < 4; i++) { // legere/corps maxCount=4 -> plein
      await trx('character_wounds').insert({ char_sheet_id: charSheet.id, location: 'corps', severity: 'legere', occurred_at_game_minutes: i })
    }
    const options = await computeAvailableSeverityReductions(trx, charSheet.id, 'corps', 'grave')
    // Rien sous Légère : réduction impossible malgré la dépense, tableau vide (jamais un throw ici —
    // c'est à l'appelant de ne rien proposer/ne rien débiter dans ce cas).
    assert.deepEqual(options, [])
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('computeAvailableSeverityReductions : exception "palier plein" sur 3 degrés (mortelle -> moyenne, critique et grave pleins)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet } = await createFixture(trx)
    for (let i = 0; i < 2; i++) { // critique/corps maxCount=2 -> plein
      await trx('character_wounds').insert({ char_sheet_id: charSheet.id, location: 'corps', severity: 'critique', occurred_at_game_minutes: i })
    }
    for (let i = 0; i < 3; i++) { // grave/corps maxCount=3 -> plein
      await trx('character_wounds').insert({ char_sheet_id: charSheet.id, location: 'corps', severity: 'grave', occurred_at_game_minutes: i })
    }
    // moyenne/corps vide -> disponible, 3 degrés en dessous de mortelle
    const options = await computeAvailableSeverityReductions(trx, charSheet.id, 'corps', 'mortelle')
    assert.deepEqual(options, [{ degree: 3, targetSeverity: 'moyenne' }])
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test.after(async () => { await db.destroy() })

// ─── 6ᵉ ligne (mort_subite) — débordement de la ligne Mortelle ───────────────────────────────────────────────

async function insertWounds(trx, charSheetId, location, severity, count) {
  const rows = []
  for (let i = 0; i < count; i += 1) {
    const [row] = await trx('character_wounds')
      .insert({ char_sheet_id: charSheetId, location, severity, occurred_at_game_minutes: i })
      .returning('*')
    rows.push(row)
  }
  return rows
}

test('Mortelle à la tête (1 case) : la 1ʳᵉ reste une Mortelle, la 2ᵉ déborde vers mort_subite', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet } = await createFixture(trx)
    const first = await resolveWoundInsertion(trx, charSheet.id, 'tete', 'mortelle')
    assert.equal(first.promoted, false)
    assert.equal(first.wound.severity, 'mortelle')

    const second = await resolveWoundInsertion(trx, charSheet.id, 'tete', 'mortelle')
    assert.equal(second.promoted, true)
    assert.equal(second.wound.severity, 'mort_subite')
    assert.equal(second.deletedWounds.length, 1)
    assert.equal(second.deletedWounds[0].id, first.wound.id)

    const remaining = await trx('character_wounds').where({ char_sheet_id: charSheet.id, location: 'tete' })
    assert.deepEqual(remaining.map(w => w.severity), ['mort_subite'])
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('Mortelle au corps (2 cases) : 2 Mortelles tiennent, la 3ᵉ déborde vers mort_subite', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet } = await createFixture(trx)
    const one = await resolveWoundInsertion(trx, charSheet.id, 'corps', 'mortelle')
    const two = await resolveWoundInsertion(trx, charSheet.id, 'corps', 'mortelle')
    assert.equal(one.promoted, false)
    assert.equal(two.promoted, false)
    assert.equal((await trx('character_wounds').where({ char_sheet_id: charSheet.id, severity: 'mortelle' })).length, 2)

    const three = await resolveWoundInsertion(trx, charSheet.id, 'corps', 'mortelle')
    assert.equal(three.promoted, true)
    assert.equal(three.wound.severity, 'mort_subite')
    assert.equal(three.deletedWounds.length, 2)
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('un coup ≥ 30 écrit mort_subite directement ; une 2ᵉ sur la même localisation lève WoundLineFullError', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet } = await createFixture(trx)
    const first = await resolveWoundInsertion(trx, charSheet.id, 'bras_droit', 'mort_subite')
    assert.equal(first.promoted, false)
    assert.equal(first.wound.severity, 'mort_subite')

    await assert.rejects(
      resolveWoundInsertion(trx, charSheet.id, 'bras_droit', 'mort_subite'),
      (err) => err instanceof WoundLineFullError && err instanceof AppError && err.statusCode === 400,
    )
    // Une autre localisation n'est pas affectée : le cadavre continue de prendre des blessures ailleurs.
    const other = await resolveWoundInsertion(trx, charSheet.id, 'jambe_gauche', 'mort_subite')
    assert.equal(other.wound.severity, 'mort_subite')
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('promotion en cascade complète : Légère → Moyenne → Grave → Critique → Mortelle → mort_subite (tête)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet } = await createFixture(trx)
    // Tête : Légère 3 cases, Moyenne 3, Grave 2, Critique 2, Mortelle 1. Chaque ligne est au point de convertir.
    await insertWounds(trx, charSheet.id, 'tete', 'legere', 2)
    await insertWounds(trx, charSheet.id, 'tete', 'moyenne', 2)
    await insertWounds(trx, charSheet.id, 'tete', 'grave', 1)
    await insertWounds(trx, charSheet.id, 'tete', 'critique', 1)
    await insertWounds(trx, charSheet.id, 'tete', 'mortelle', 1)

    const result = await resolveWoundInsertion(trx, charSheet.id, 'tete', 'legere')
    assert.equal(result.promoted, true)
    assert.equal(result.wound.severity, 'mort_subite')
    assert.equal(result.deletedWounds.length, 2 + 2 + 1 + 1 + 1)

    const remaining = await trx('character_wounds').where({ char_sheet_id: charSheet.id, location: 'tete' })
    assert.deepEqual(remaining.map(w => w.severity), ['mort_subite'])
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('une cascade qui atteint la ligne Mortelle vide s\'y arrête (pas de mort tant que la Mortelle n\'est pas pleine)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet } = await createFixture(trx)
    await insertWounds(trx, charSheet.id, 'bras_gauche', 'critique', 1) // ligne Critique (2 cases) au point de convertir
    const result = await resolveWoundInsertion(trx, charSheet.id, 'bras_gauche', 'critique')
    assert.equal(result.promoted, true)
    assert.equal(result.wound.severity, 'mortelle')
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})
