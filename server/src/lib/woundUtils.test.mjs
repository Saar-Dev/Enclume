import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { AppError } from './AppError.js'
import {
  nextSeverity, previousSeverity, improvedSeverity, resolveWoundInsertion, resolveWoundImprovement,
  buildWoundInsertionUndoEntries, buildWoundImprovementUndoEntries, computeAvailableSeverityReductions, affordableReductions,
  isShockTestRequired, woundSeverityRankSql, WoundLineFullError, deleteWoundRows, hasSeverityRoom,
} from './woundUtils.js'
import { WOUND_MAX_COUNTS } from '../../../shared/woundConstants.js'
import { getHealingRetrySchedule } from './woundHealingSchedule.js'
import { createEcheance } from './echeanceService.js'
import { MINUTES_PER_DAY } from '../../../shared/gameTime.js'
import './echeanceHandlerRegistrations.js' // effet de bord : peuple le registre (écrire une blessure programme son échéance de guérison)

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

test('improvedSeverity : la gravité juste en dessous, sauf la 6ᵉ ligne (Membre détruit / Mort rachetée → Critique, pas Mortelle)', () => {
  assert.equal(improvedSeverity('legere'), null)
  assert.equal(improvedSeverity('moyenne'), 'legere')
  assert.equal(improvedSeverity('grave'), 'moyenne')
  assert.equal(improvedSeverity('critique'), 'grave')
  assert.equal(improvedSeverity('mortelle'), 'critique')
  assert.equal(improvedSeverity('mort_subite'), 'critique')
  assert.equal(previousSeverity('mort_subite'), 'mortelle', 'previousSeverity reste l\'inverse mécanique de la promotion')
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
  return { user, campaign, character, charSheet, schedule: { campaignId: campaign.id, characterId: character.id } }
}

test('resolveWoundInsertion stampe occurred_at_game_minutes depuis game_time_resolved_minutes', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet, schedule } = await createFixture(trx, { resolvedMinutes: 4242 })
    const { wound } = await resolveWoundInsertion(trx, charSheet.id, 'tete', 'moyenne', schedule)
    assert.equal(wound.occurred_at_game_minutes, 4242)
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('resolveWoundInsertion : sans promotion, deletedWounds vide, undoEntries = la case insérée + son échéance de guérison', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet, schedule } = await createFixture(trx)
    const result = await resolveWoundInsertion(trx, charSheet.id, 'corps', 'moyenne', schedule)
    assert.deepEqual(result.deletedWounds, [])
    const undoEntries = buildWoundInsertionUndoEntries(result)
    assert.deepEqual(undoEntries, [
      { table: 'character_wounds', rowId: result.wound.id, previousValues: null },
      { table: 'game_echeances', rowId: result.echeance.id, previousValues: null },
    ])
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('resolveWoundInsertion : promotion en cascade, deletedWounds capture les lignes supprimées', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet, schedule } = await createFixture(trx)
    // corps/moyenne maxCount=3 : la ligne est PLEINE à 3 cases (règle des cases du livre) — la 4ᵉ Moyenne déclenche la cascade
    const existing = []
    for (let i = 0; i < 3; i++) {
      const [row] = await trx('character_wounds')
        .insert({ char_sheet_id: charSheet.id, location: 'corps', severity: 'moyenne', occurred_at_game_minutes: 100 + i })
        .returning('*')
      existing.push(row)
    }

    const result = await resolveWoundInsertion(trx, charSheet.id, 'corps', 'moyenne', schedule)
    assert.equal(result.promoted, true)
    assert.equal(result.wound.severity, 'grave')
    assert.equal(result.deletedWounds.length, 3)
    assert.deepEqual(new Set(result.deletedWounds.map(w => w.id)), new Set(existing.map(w => w.id)))

    const undoEntries = buildWoundInsertionUndoEntries(result)
    assert.equal(undoEntries.length, 5) // 3 delete-undo (insert) + 1 insert-undo (delete) + l'échéance de la Grave obtenue (delete)
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
    const { charSheet, schedule } = await createFixture(trx, { resolvedMinutes: 1000 })
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

    const { wound, healed } = await resolveWoundImprovement(trx, original.id, schedule)
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

test('resolveWoundImprovement : Membre détruit (mort_subite sur un bras) -> Critique au même endroit, jamais une Mortelle', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet, schedule } = await createFixture(trx)
    const charSheetId = charSheet.id
    const [wound] = await trx('character_wounds')
      .insert({ char_sheet_id: charSheetId, location: 'bras_gauche', severity: 'mort_subite', is_stabilized: true, occurred_at_game_minutes: 0 })
      .returning('*')
    const result = await resolveWoundImprovement(trx, wound.id, schedule)
    assert.equal(result.healed, false)
    assert.equal(result.wound.severity, 'critique')
    assert.equal(result.wound.location, 'bras_gauche')
    assert.equal(result.wound.is_stabilized, true, 'la stabilisation est conservée')
    assert.deepEqual((await trx('character_wounds').where({ char_sheet_id: charSheetId })).map(w => w.severity), ['critique'])
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('resolveWoundImprovement : Légère guérit entièrement (pas de nouvelle case)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet, schedule } = await createFixture(trx)
    const [original] = await trx('character_wounds')
      .insert({ char_sheet_id: charSheet.id, location: 'corps', severity: 'legere', is_stabilized: false })
      .returning('*')

    const { wound, healed } = await resolveWoundImprovement(trx, original.id, schedule)
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
      resolveWoundImprovement(trx, '00000000-0000-0000-0000-000000000000', { campaignId: null, characterId: null }),
      (err) => err instanceof AppError && err.statusCode === 404,
    )
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

// ─── WOUND-HEAL-CHAIN-STOPS — chaque case qui doit guérir naît AVEC son échéance de guérison ────────────────────────

const WEEK_MINUTES = 7 * MINUTES_PER_DAY
const healingEcheancesOf = (trx, campaignId) => trx('game_echeances').where({ campaign_id: campaignId, condition_type: 'wound_healing_check' })

test('resolveWoundInsertion : la case Moyenne naît avec son échéance de guérison (3 jours, identité = le contexte fourni)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet, schedule } = await createFixture(trx, { resolvedMinutes: 500 })
    const { wound, echeance } = await resolveWoundInsertion(trx, charSheet.id, 'tete', 'moyenne', schedule)
    assert.equal(echeance.campaign_id, campaign.id)
    assert.equal(echeance.character_id, character.id)
    assert.deepEqual(echeance.payload, { woundId: wound.id })
    assert.equal(echeance.next_due_minutes, 500 + 3 * MINUTES_PER_DAY)
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('resolveWoundInsertion : Légère et Mort (Tête/Corps) n\'ont aucune échéance de guérison', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, charSheet, schedule } = await createFixture(trx)
    assert.equal((await resolveWoundInsertion(trx, charSheet.id, 'corps', 'legere', schedule)).echeance, null)
    assert.equal((await resolveWoundInsertion(trx, charSheet.id, 'tete', 'mort_subite', schedule)).echeance, null)
    assert.equal((await healingEcheancesOf(trx, campaign.id)).length, 0)
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('resolveWoundInsertion : une promotion en cascade ne programme que la case finale (les cases fusionnées n\'en reçoivent pas de nouvelle)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, charSheet, schedule } = await createFixture(trx)
    await insertWounds(trx, charSheet.id, 'corps', 'moyenne', 3) // ligne pleine : la prochaine Moyenne convertit
    const result = await resolveWoundInsertion(trx, charSheet.id, 'corps', 'moyenne', schedule)
    assert.equal(result.wound.severity, 'grave')
    const echeances = await healingEcheancesOf(trx, campaign.id)
    assert.equal(echeances.length, 1)
    assert.equal(echeances[0].payload.woundId, result.wound.id)
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('resolveWoundImprovement : Critique -> Grave, la case obtenue naît avec son échéance (1 semaine), datée du départ fourni', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet, schedule } = await createFixture(trx, { resolvedMinutes: 1000 })
    const [original] = await insertWounds(trx, charSheet.id, 'corps', 'critique', 1)
    // Départ = jour d'échéance de la guérison (5000), pas le repère mécanique courant (1000).
    const result = await resolveWoundImprovement(trx, original.id, schedule, { occurredAtGameMinutes: 5000 })
    assert.equal(result.wound.severity, 'grave')
    assert.equal(result.wound.occurred_at_game_minutes, 5000)
    assert.equal(result.echeance.campaign_id, campaign.id)
    assert.equal(result.echeance.character_id, character.id)
    assert.deepEqual(result.echeance.payload, { woundId: result.wound.id })
    assert.equal(result.echeance.next_due_minutes, 5000 + WEEK_MINUTES)
    assert.equal(result.echeance.occurrences_remaining, null, 'Grave : échéance unique')
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('resolveWoundImprovement : sans départ fourni, la case obtenue est datée du repère mécanique courant', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet, schedule } = await createFixture(trx, { resolvedMinutes: 2000 })
    const [original] = await insertWounds(trx, charSheet.id, 'corps', 'critique', 1)
    const result = await resolveWoundImprovement(trx, original.id, schedule)
    assert.equal(result.wound.occurred_at_game_minutes, 2000)
    assert.equal(result.echeance.next_due_minutes, 2000 + WEEK_MINUTES)
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('resolveWoundImprovement : Membre détruit -> Critique, échéance hebdomadaire de 3 occurrences', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet, schedule } = await createFixture(trx, { resolvedMinutes: 1000 })
    const [original] = await insertWounds(trx, charSheet.id, 'bras_gauche', 'mort_subite', 1)
    const result = await resolveWoundImprovement(trx, original.id, schedule)
    assert.equal(result.wound.severity, 'critique')
    assert.equal(result.echeance.interval_minutes, WEEK_MINUTES)
    assert.equal(result.echeance.occurrences_remaining, 3)
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('resolveWoundImprovement : Moyenne -> Légère (guérit seule) et Légère -> guérie : aucune échéance', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, charSheet, schedule } = await createFixture(trx)
    const [moyenne] = await insertWounds(trx, charSheet.id, 'corps', 'moyenne', 1)
    const toLegere = await resolveWoundImprovement(trx, moyenne.id, schedule)
    assert.equal(toLegere.wound.severity, 'legere')
    assert.equal(toLegere.echeance, null)
    const healed = await resolveWoundImprovement(trx, toLegere.wound.id, schedule)
    assert.equal(healed.healed, true)
    assert.equal(healed.echeance, null)
    assert.equal((await healingEcheancesOf(trx, campaign.id)).length, 0)
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('resolveWoundImprovement steps=2 : UNE seule case à la gravité d\'arrivée, UNE seule échéance — jamais une case intermédiaire', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, charSheet, schedule } = await createFixture(trx)
    const [original] = await insertWounds(trx, charSheet.id, 'corps', 'mortelle', 1)
    const result = await resolveWoundImprovement(trx, original.id, schedule, { steps: 2 })
    assert.equal(result.wound.severity, 'grave') // Mortelle -> Critique -> Grave
    const wounds = await trx('character_wounds').where({ char_sheet_id: charSheet.id })
    assert.deepEqual(wounds.map(w => w.severity), ['grave'])
    const echeances = await healingEcheancesOf(trx, campaign.id)
    assert.equal(echeances.length, 1)
    assert.equal(echeances[0].payload.woundId, result.wound.id)
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('resolveWoundImprovement steps=2 depuis Moyenne : guérie entièrement (Légère puis rien), aucune case ni échéance', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, charSheet, schedule } = await createFixture(trx)
    const [original] = await insertWounds(trx, charSheet.id, 'corps', 'moyenne', 1)
    const result = await resolveWoundImprovement(trx, original.id, schedule, { steps: 2 })
    assert.equal(result.healed, true)
    assert.equal(result.wound, null)
    assert.equal((await trx('character_wounds').where({ char_sheet_id: charSheet.id })).length, 0)
    assert.equal((await healingEcheancesOf(trx, campaign.id)).length, 0)
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('buildWoundImprovementUndoEntries : la case d\'origine, la case obtenue et son échéance (annulation d\'une avance de temps)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet, schedule } = await createFixture(trx)
    const [original] = await insertWounds(trx, charSheet.id, 'corps', 'critique', 1)
    const result = await resolveWoundImprovement(trx, original.id, schedule)
    assert.deepEqual(buildWoundImprovementUndoEntries(original, result), [
      { table: 'character_wounds', rowId: original.id, previousValues: original },
      { table: 'character_wounds', rowId: result.wound.id, previousValues: null },
      { table: 'game_echeances', rowId: result.echeance.id, previousValues: null },
    ])
    // Légère guérie : plus que la case d'origine à restaurer.
    const [light] = await insertWounds(trx, charSheet.id, 'tete', 'legere', 1)
    const healed = await resolveWoundImprovement(trx, light.id, schedule)
    assert.deepEqual(buildWoundImprovementUndoEntries(light, healed), [
      { table: 'character_wounds', rowId: light.id, previousValues: light },
    ])
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('écrire une blessure sans contexte de programmation échoue tout de suite, avant toute écriture', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet } = await createFixture(trx)
    await assert.rejects(resolveWoundInsertion(trx, charSheet.id, 'corps', 'moyenne'), /contexte de programmation/)
    const [original] = await insertWounds(trx, charSheet.id, 'corps', 'grave', 1)
    await assert.rejects(resolveWoundImprovement(trx, original.id), /contexte de programmation/)
    assert.equal((await trx('character_wounds').where({ char_sheet_id: charSheet.id })).length, 1, 'la case d\'origine n\'est pas supprimée')
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('resolveWoundImprovement : steps invalide (0, négatif, non entier) refusé', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet, schedule } = await createFixture(trx)
    const [original] = await insertWounds(trx, charSheet.id, 'corps', 'grave', 1)
    for (const steps of [0, -1, 1.5, '2']) {
      await assert.rejects(resolveWoundImprovement(trx, original.id, schedule, { steps }), /steps doit être un entier/, String(steps))
    }
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
      { degree: 1, cost: 1, targetSeverity: 'moyenne' },
      { degree: 2, cost: 2, targetSeverity: 'legere' },
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
    assert.deepEqual(options, [{ degree: 2, cost: 2, targetSeverity: 'legere' }])
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
    assert.deepEqual(options, [{ degree: 3, cost: 3, targetSeverity: 'moyenne' }])
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

// 6ᵉ ligne : UN cran (→ Critique) pour 3 points ; si la Critique est pleine, l'exception « palier plein » ajoute 1 point par cran.
test('computeAvailableSeverityReductions : la 6ᵉ ligne (Mort, coup ≥ 30) se rachète en Critique pour 3 points, une seule option', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet } = await createFixture(trx)
    const options = await computeAvailableSeverityReductions(trx, charSheet.id, 'tete', 'mort_subite')
    assert.deepEqual(options, [{ degree: 1, cost: 3, targetSeverity: 'critique' }])
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('computeAvailableSeverityReductions : 6ᵉ ligne, Critique pleine → palier plein : Grave pour 4 points (3 + 1)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet } = await createFixture(trx)
    for (let i = 0; i < 2; i++) { // critique/tete maxCount=2 -> plein
      await trx('character_wounds').insert({ char_sheet_id: charSheet.id, location: 'tete', severity: 'critique', occurred_at_game_minutes: i })
    }
    const options = await computeAvailableSeverityReductions(trx, charSheet.id, 'tete', 'mort_subite')
    assert.deepEqual(options, [{ degree: 2, cost: 4, targetSeverity: 'grave' }])
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('computeAvailableSeverityReductions : Mortelle inchangée (Critique 1 pt, Grave 2 pts)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet } = await createFixture(trx)
    const options = await computeAvailableSeverityReductions(trx, charSheet.id, 'corps', 'mortelle')
    assert.deepEqual(options, [
      { degree: 1, cost: 1, targetSeverity: 'critique' },
      { degree: 2, cost: 2, targetSeverity: 'grave' },
    ])
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('affordableReductions : ne garde que ce que la Chance permet de payer (il doit en rester 3) — pur', () => {
  const options = [
    { degree: 1, cost: 1, targetSeverity: 'moyenne' },
    { degree: 2, cost: 2, targetSeverity: 'legere' },
  ]
  assert.deepEqual(affordableReductions(options, 11), options)
  assert.deepEqual(affordableReductions(options, 4), [options[0]], '4 − 2 = 2 : le 2ᵉ degré est refusé')
  assert.deepEqual(affordableReductions(options, 3), [], 'déjà au plancher')
  assert.deepEqual(affordableReductions([{ degree: 1, cost: 3, targetSeverity: 'critique' }], 6).length, 1)
  assert.deepEqual(affordableReductions([{ degree: 1, cost: 3, targetSeverity: 'critique' }], 5), [])
  assert.deepEqual(affordableReductions(options, null), [], 'Chance inconnue : rien de payable')
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
    const { charSheet, schedule } = await createFixture(trx)
    const first = await resolveWoundInsertion(trx, charSheet.id, 'tete', 'mortelle', schedule)
    assert.equal(first.promoted, false)
    assert.equal(first.wound.severity, 'mortelle')

    const second = await resolveWoundInsertion(trx, charSheet.id, 'tete', 'mortelle', schedule)
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
    const { charSheet, schedule } = await createFixture(trx)
    const one = await resolveWoundInsertion(trx, charSheet.id, 'corps', 'mortelle', schedule)
    const two = await resolveWoundInsertion(trx, charSheet.id, 'corps', 'mortelle', schedule)
    assert.equal(one.promoted, false)
    assert.equal(two.promoted, false)
    assert.equal((await trx('character_wounds').where({ char_sheet_id: charSheet.id, severity: 'mortelle' })).length, 2)

    const three = await resolveWoundInsertion(trx, charSheet.id, 'corps', 'mortelle', schedule)
    assert.equal(three.promoted, true)
    assert.equal(three.wound.severity, 'mort_subite')
    assert.equal(three.deletedWounds.length, 2)
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('un coup ≥ 30 écrit mort_subite directement ; une 2ᵉ sur la même localisation lève WoundLineFullError', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet, schedule } = await createFixture(trx)
    const first = await resolveWoundInsertion(trx, charSheet.id, 'bras_droit', 'mort_subite', schedule)
    assert.equal(first.promoted, false)
    assert.equal(first.wound.severity, 'mort_subite')

    await assert.rejects(
      resolveWoundInsertion(trx, charSheet.id, 'bras_droit', 'mort_subite', schedule),
      (err) => err instanceof WoundLineFullError && err instanceof AppError && err.statusCode === 400,
    )
    // Une autre localisation n'est pas affectée : le cadavre continue de prendre des blessures ailleurs.
    const other = await resolveWoundInsertion(trx, charSheet.id, 'jambe_gauche', 'mort_subite', schedule)
    assert.equal(other.wound.severity, 'mort_subite')
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('promotion en cascade complète : Légère → Moyenne → Grave → Critique → Mortelle → mort_subite (tête)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet, schedule } = await createFixture(trx)
    // Tête : Légère 3 cases, Moyenne 3, Grave 2, Critique 2, Mortelle 1. Chaque ligne est PLEINE.
    await insertWounds(trx, charSheet.id, 'tete', 'legere', 3)
    await insertWounds(trx, charSheet.id, 'tete', 'moyenne', 3)
    await insertWounds(trx, charSheet.id, 'tete', 'grave', 2)
    await insertWounds(trx, charSheet.id, 'tete', 'critique', 2)
    await insertWounds(trx, charSheet.id, 'tete', 'mortelle', 1)

    const result = await resolveWoundInsertion(trx, charSheet.id, 'tete', 'legere', schedule)
    assert.equal(result.promoted, true)
    assert.equal(result.wound.severity, 'mort_subite')
    assert.equal(result.deletedWounds.length, 3 + 3 + 2 + 2 + 1)

    const remaining = await trx('character_wounds').where({ char_sheet_id: charSheet.id, location: 'tete' })
    assert.deepEqual(remaining.map(w => w.severity), ['mort_subite'])
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('une cascade qui atteint la ligne Mortelle vide s\'y arrête (pas de mort tant que la Mortelle n\'est pas pleine)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet, schedule } = await createFixture(trx)
    await insertWounds(trx, charSheet.id, 'bras_gauche', 'critique', 2) // ligne Critique (2 cases) pleine
    const result = await resolveWoundInsertion(trx, charSheet.id, 'bras_gauche', 'critique', schedule)
    assert.equal(result.promoted, true)
    assert.equal(result.wound.severity, 'mortelle')
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

// ─── Lot 0 (PLAN_REVUE_GUERISON) — une échéance vit et meurt avec sa case : woundUtils est aussi l'UNIQUE suppresseur ───────────────

// Lot B1 : l'infection appartient à une LOCALISATION d'un personnage, pas à une case.
const infectionEcheanceOf = (trx, campaign, character, location) => createEcheance(trx, {
  campaignId: campaign.id, characterId: character.id, conditionType: 'wound_infection_check',
  payload: { location, periodesSansSoin: 0 }, nextDueMinutes: 2000, intervalMinutes: null, occurrencesRemaining: null,
})
const statusOfEcheance = async (trx, echeance) => (await trx('game_echeances').where({ id: echeance.id }).first()).status

test('deleteWoundRows : supprime les cases visées, annule leur guérison et l\'infection d\'une localisation devenue sans blessure susceptible, laisse les autres, retourne les lignes d\'origine', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet, schedule } = await createFixture(trx)
    const head = await resolveWoundInsertion(trx, charSheet.id, 'tete', 'moyenne', schedule)
    const body = await resolveWoundInsertion(trx, charSheet.id, 'corps', 'moyenne', schedule)
    const infection = await infectionEcheanceOf(trx, campaign, character, 'tete')

    const { wounds, cancelledEcheances } = await deleteWoundRows(trx, { char_sheet_id: charSheet.id, location: 'tete' })
    assert.deepEqual(wounds.map(w => w.id), [head.wound.id])
    assert.deepEqual(new Set(cancelledEcheances.map(e => e.id)), new Set([head.echeance.id, infection.id]))
    assert.ok(cancelledEcheances.every(e => e.status === 'active'), 'lignes telles qu\'elles étaient AVANT l\'annulation')
    assert.equal(await statusOfEcheance(trx, head.echeance), 'cancelled')
    assert.equal(await statusOfEcheance(trx, infection), 'cancelled')
    assert.equal(await statusOfEcheance(trx, body.echeance), 'active', 'l\'échéance d\'une autre case n\'est pas touchée')
    assert.deepEqual((await trx('character_wounds').where({ char_sheet_id: charSheet.id })).map(w => w.id), [body.wound.id])

    // Idempotent : plus rien de vivant à annuler, aucune case à supprimer.
    const again = await deleteWoundRows(trx, { char_sheet_id: charSheet.id, location: 'tete' })
    assert.deepEqual(again, { wounds: [], cancelledEcheances: [] })
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('deleteWoundRows : l\'échéance que le moteur résout (exceptEcheanceId) n\'est jamais annulée ici', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet, schedule } = await createFixture(trx)
    const head = await resolveWoundInsertion(trx, charSheet.id, 'tete', 'moyenne', schedule)
    const { cancelledEcheances } = await deleteWoundRows(trx, { id: head.wound.id }, { exceptEcheanceId: head.echeance.id })
    assert.deepEqual(cancelledEcheances, [])
    assert.equal(await statusOfEcheance(trx, head.echeance), 'active')
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('une échéance déjà terminée (completed) n\'est pas touchée par la suppression de sa case', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet, schedule } = await createFixture(trx)
    const head = await resolveWoundInsertion(trx, charSheet.id, 'tete', 'moyenne', schedule)
    await trx('game_echeances').where({ id: head.echeance.id }).update({ status: 'completed' })
    const { cancelledEcheances } = await deleteWoundRows(trx, { id: head.wound.id })
    assert.deepEqual(cancelledEcheances, [])
    assert.equal(await statusOfEcheance(trx, head.echeance), 'completed')
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('resolveWoundInsertion (promotion) : les échéances des cases fusionnées sont annulées et journalisées, celle de la case finale reste vivante', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet, schedule } = await createFixture(trx)
    const one = await resolveWoundInsertion(trx, charSheet.id, 'corps', 'moyenne', schedule)
    const two = await resolveWoundInsertion(trx, charSheet.id, 'corps', 'moyenne', schedule)
    const three = await resolveWoundInsertion(trx, charSheet.id, 'corps', 'moyenne', schedule) // la 3ᵉ tient : ligne pleine
    assert.equal(three.promoted, false)
    const result = await resolveWoundInsertion(trx, charSheet.id, 'corps', 'moyenne', schedule) // la ligne pleine déborde -> Grave
    assert.equal(result.promoted, true)
    assert.equal(result.wound.severity, 'grave')
    assert.deepEqual(new Set(result.cancelledEcheances.map(e => e.id)), new Set([one.echeance.id, two.echeance.id, three.echeance.id]))
    assert.equal(await statusOfEcheance(trx, result.echeance), 'active', 'la Grave obtenue a son échéance, vivante')

    const restores = buildWoundInsertionUndoEntries(result).filter(e => e.table === 'game_echeances' && e.previousValues !== null)
    assert.deepEqual(new Set(restores.map(e => e.rowId)), new Set([one.echeance.id, two.echeance.id, three.echeance.id]))
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('resolveWoundImprovement : l\'échéance de la case d\'origine est annulée (retournée et journalisée) ; sauf celle que le moteur résout', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet, schedule } = await createFixture(trx)
    // Cas « Chance » : personne ne résout l'échéance de la case réduite — elle est annulée avec elle.
    const grave = await resolveWoundInsertion(trx, charSheet.id, 'corps', 'grave', schedule)
    const infection = await infectionEcheanceOf(trx, campaign, character, 'corps')
    const reduced = await resolveWoundImprovement(trx, grave.wound.id, schedule)
    // L'infection appartient à la LOCALISATION : la Moyenne obtenue est encore susceptible de s'infecter, elle continue.
    assert.deepEqual(new Set(reduced.cancelledEcheances.map(e => e.id)), new Set([grave.echeance.id]))
    assert.equal(await statusOfEcheance(trx, grave.echeance), 'cancelled')
    assert.equal(await statusOfEcheance(trx, infection), 'active', 'la Moyenne obtenue est encore susceptible de s\'infecter')
    assert.equal(await statusOfEcheance(trx, reduced.echeance), 'active', 'la Moyenne obtenue a la sienne')
    const restores = buildWoundImprovementUndoEntries(grave.wound, reduced).filter(e => e.table === 'game_echeances' && e.previousValues !== null)
    assert.deepEqual(new Set(restores.map(e => e.rowId)), new Set([grave.echeance.id]))

    // Cas « guérison » : l'échéance résolue par le moteur (exceptEcheanceId) reste à lui.
    const critique = await resolveWoundInsertion(trx, charSheet.id, 'tete', 'critique', schedule)
    const healed = await resolveWoundImprovement(trx, critique.wound.id, schedule, { exceptEcheanceId: critique.echeance.id })
    assert.deepEqual(healed.cancelledEcheances, [])
    assert.equal(await statusOfEcheance(trx, critique.echeance), 'active')
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('getHealingRetrySchedule : Moyenne/Grave = la durée de la gravité, soins constants = 1 semaine, Légère et Mort n\'en ont pas', () => {
  assert.deepEqual(getHealingRetrySchedule('moyenne', 'corps'), { intervalMinutes: 3 * MINUTES_PER_DAY, occurrencesRemaining: 1 })
  assert.deepEqual(getHealingRetrySchedule('grave', 'corps'), { intervalMinutes: 7 * MINUTES_PER_DAY, occurrencesRemaining: 1 })
  for (const [severity, location] of [['critique', 'corps'], ['mortelle', 'tete'], ['mort_subite', 'bras_droit']]) {
    assert.deepEqual(getHealingRetrySchedule(severity, location), { intervalMinutes: WEEK_MINUTES, occurrencesRemaining: 1 }, `${severity}/${location}`)
  }
  assert.equal(getHealingRetrySchedule('legere', 'corps'), null)
  assert.equal(getHealingRetrySchedule('mort_subite', 'tete'), null)
})

// ─── Guérison sur une ligne d'arrivée PLEINE (WOUND-HEAL-LINE-CAPACITY ; règle des cases du livre, PLAN_GUERISON_RAW Lot A, 2026-09-26) ─────────

// Même algorithme que gameTimeService.js:replayUndoEntry (privé), rejoué en sens inverse comme cancelPendingAdvance.
async function replayUndoEntries(trx, entries) {
  for (const { table, rowId, previousValues } of [...entries].reverse()) {
    const existing = await trx(table).where({ id: rowId }).first()
    if (previousValues !== null && existing) await trx(table).where({ id: rowId }).update(previousValues)
    else if (previousValues === null && existing) await trx(table).where({ id: rowId }).del()
    else if (previousValues !== null && !existing) await trx(table).insert(previousValues)
  }
}
const healingEcheanceOf = (trx, campaign, character, woundId) => createEcheance(trx, {
  campaignId: campaign.id, characterId: character.id, conditionType: 'wound_healing_check',
  payload: { woundId }, nextDueMinutes: 5000, intervalMinutes: null, occurrencesRemaining: null,
})
const countAt = async (trx, charSheetId, location, severity) =>
  Number((await trx('character_wounds').where({ char_sheet_id: charSheetId, location, severity }).count('* as n').first()).n)

test('guérison : une case libre reste sur la ligne d\'arrivée — 2 Légères sur 3, la case guérie prend la 3ᵉ (ligne pleine, mais aucune ligne effacée)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet, schedule } = await createFixture(trx)
    await insertWounds(trx, charSheet.id, 'tete', 'legere', 2)
    const moyenne = await resolveWoundInsertion(trx, charSheet.id, 'tete', 'moyenne', schedule)

    const result = await resolveWoundImprovement(trx, moyenne.wound.id, schedule)
    assert.equal(result.wound.severity, 'legere')
    assert.equal(result.promoted, false)
    assert.deepEqual(result.deletedWounds, [])
    assert.equal(await countAt(trx, charSheet.id, 'tete', 'legere'), 3, 'toutes les cases cochées : la ligne est pleine, jamais plus')
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('guérison : ligne d\'arrivée PLEINE (3 Moyennes sur 3) — la ligne est effacée, la case est cochée au-dessus (gravité d\'origine), échéances annulées', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet, schedule } = await createFixture(trx)
    const line = await insertWounds(trx, charSheet.id, 'tete', 'moyenne', 3)
    const lineEcheances = []
    for (const row of line) lineEcheances.push(await healingEcheanceOf(trx, campaign, character, row.id))
    const grave = await resolveWoundInsertion(trx, charSheet.id, 'tete', 'grave', schedule)

    const result = await resolveWoundImprovement(trx, grave.wound.id, schedule)
    assert.equal(result.wound.severity, 'grave', 'la Grave « guérie » reste une Grave : sa ligne d\'arrivée était pleine')
    assert.equal(result.promoted, true)
    assert.deepEqual(new Set(result.deletedWounds.map(w => w.id)), new Set(line.map(w => w.id)))
    assert.equal(await countAt(trx, charSheet.id, 'tete', 'moyenne'), 0, 'la ligne pleine est effacée')
    assert.equal(await countAt(trx, charSheet.id, 'tete', 'grave'), 1)

    const cancelled = new Set(result.cancelledEcheances.map(e => e.id))
    assert.deepEqual(cancelled, new Set([grave.echeance.id, ...lineEcheances.map(e => e.id)]), 'la case d\'origine ET les cases effacées perdent leur échéance')
    for (const echeance of lineEcheances) assert.equal(await statusOfEcheance(trx, echeance), 'cancelled')
    assert.equal(await statusOfEcheance(trx, result.echeance), 'active', 'la case cochée naît avec son échéance de guérison')
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('guérison : deux lignes pleines à la suite (Chance, 2 crans) — de ligne pleine en ligne pleine jusqu\'à la première case libre, jamais au-dessus de la gravité d\'origine', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet, schedule } = await createFixture(trx)
    await insertWounds(trx, charSheet.id, 'tete', 'grave', 2)     // ligne d'arrivée (2 crans sous Mortelle) : pleine
    await insertWounds(trx, charSheet.id, 'tete', 'critique', 2)  // ligne suivante : pleine aussi
    const mortelle = await resolveWoundInsertion(trx, charSheet.id, 'tete', 'mortelle', schedule)

    const result = await resolveWoundImprovement(trx, mortelle.wound.id, schedule, { steps: 2 })
    assert.equal(result.wound.severity, 'mortelle', 'toutes les lignes en dessous sont pleines : la case retombe à la gravité d\'origine')
    assert.equal(result.deletedWounds.length, 4)
    assert.equal(await countAt(trx, charSheet.id, 'tete', 'grave'), 0)
    assert.equal(await countAt(trx, charSheet.id, 'tete', 'critique'), 0)
    assert.equal(await countAt(trx, charSheet.id, 'tete', 'mortelle'), 1)
    assert.equal(await countAt(trx, charSheet.id, 'tete', 'mort_subite'), 0, 'jamais plus haut que la gravité d\'origine')

    // Une ligne libre sur le chemin arrête la cascade : la Critique a de la place → la case y est cochée, la Mortelle n'est pas rejouée.
    const second = await resolveWoundInsertion(trx, charSheet.id, 'corps', 'mortelle', schedule)
    await insertWounds(trx, charSheet.id, 'corps', 'grave', 3)    // pleine (corps : 3 cases)
    const stopped = await resolveWoundImprovement(trx, second.wound.id, schedule, { steps: 2 })
    assert.equal(stopped.wound.severity, 'critique', 'la première case libre au-dessus de la ligne pleine')
    assert.equal(stopped.deletedWounds.length, 3)
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('guérison : un Membre détruit qui guérit vers une Critique pleine et une Mortelle pleine reste un Membre détruit (les lignes pleines sont effacées)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet, schedule } = await createFixture(trx)
    await insertWounds(trx, charSheet.id, 'bras_droit', 'critique', 2)
    await insertWounds(trx, charSheet.id, 'bras_droit', 'mortelle', 1)
    const [membre] = await insertWounds(trx, charSheet.id, 'bras_droit', 'mort_subite', 1)

    const result = await resolveWoundImprovement(trx, membre.id, schedule)
    assert.equal(result.wound.severity, 'mort_subite')
    assert.equal(result.deletedWounds.length, 3, 'les 2 Critiques et la Mortelle')
    assert.equal(await countAt(trx, charSheet.id, 'bras_droit', 'mort_subite'), 1)
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('guérison : jamais au-dessus de la gravité d\'origine, même sur une fiche déjà corrompue (ligne d\'origine au-dessus de sa capacité)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet, schedule } = await createFixture(trx)
    await insertWounds(trx, charSheet.id, 'tete', 'moyenne', 3)   // pleine
    const graves = await insertWounds(trx, charSheet.id, 'tete', 'grave', 3) // déjà AU-DESSUS de sa capacité (2) : fiche corrompue

    const result = await resolveWoundImprovement(trx, graves[0].id, schedule)
    assert.equal(result.wound.severity, 'grave')
    assert.equal(await countAt(trx, charSheet.id, 'tete', 'critique'), 0, 'aucune escalade : une guérison n\'aggrave jamais la blessure')
    assert.equal(await countAt(trx, charSheet.id, 'tete', 'moyenne'), 0)
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('guérison sur ligne pleine : annuler l\'avance de temps restaure TOUT (case d\'origine, lignes effacées, échéances)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet, schedule } = await createFixture(trx)
    const line = await insertWounds(trx, charSheet.id, 'tete', 'moyenne', 3)
    const lineEcheances = []
    for (const row of line) lineEcheances.push(await healingEcheanceOf(trx, campaign, character, row.id))
    const grave = await resolveWoundInsertion(trx, charSheet.id, 'tete', 'grave', schedule)
    const before = (await trx('character_wounds').where({ char_sheet_id: charSheet.id })).map(w => w.id).sort()

    const result = await resolveWoundImprovement(trx, grave.wound.id, schedule)
    const entries = buildWoundImprovementUndoEntries(grave.wound, result)
    assert.equal(entries.filter(e => e.table === 'character_wounds' && e.previousValues !== null).length, 1 + 3, 'la Grave d\'origine + les 3 Moyennes effacées')

    await replayUndoEntries(trx, entries)
    const after = (await trx('character_wounds').where({ char_sheet_id: charSheet.id })).map(w => w.id).sort()
    assert.deepEqual(after, before, 'les mêmes cases qu\'avant, la case cochée en plus a disparu')
    for (const echeance of [grave.echeance, ...lineEcheances]) assert.equal(await statusOfEcheance(trx, echeance), 'active')
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

// ─── La règle des cases du livre à l'aggravation (PLAN_GUERISON_RAW Lot A, REGLEBLESSURES.md:47-53) ────────────────────────────────────────────

test('règle des cases : 3 Légères tiennent à la tête (ligne pleine), la 4ᵉ efface la ligne et coche une Moyenne', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet, schedule } = await createFixture(trx)
    for (let i = 1; i <= 3; i += 1) {
      const result = await resolveWoundInsertion(trx, charSheet.id, 'tete', 'legere', schedule)
      assert.equal(result.promoted, false, `la Légère n°${i} se coche sur la ligne`)
    }
    assert.equal(await countAt(trx, charSheet.id, 'tete', 'legere'), 3)

    const fourth = await resolveWoundInsertion(trx, charSheet.id, 'tete', 'legere', schedule)
    assert.equal(fourth.promoted, true)
    assert.equal(fourth.wound.severity, 'moyenne')
    assert.equal(fourth.deletedWounds.length, 3)
    assert.equal(await countAt(trx, charSheet.id, 'tete', 'legere'), 0)
    assert.equal(await countAt(trx, charSheet.id, 'tete', 'moyenne'), 1)
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('règle des cases : 2 Critiques tiennent à la tête (2 cases), la 3ᵉ convertit en Mortelle', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet, schedule } = await createFixture(trx)
    assert.equal((await resolveWoundInsertion(trx, charSheet.id, 'tete', 'critique', schedule)).promoted, false)
    assert.equal((await resolveWoundInsertion(trx, charSheet.id, 'tete', 'critique', schedule)).promoted, false)
    const third = await resolveWoundInsertion(trx, charSheet.id, 'tete', 'critique', schedule)
    assert.equal(third.promoted, true)
    assert.equal(third.wound.severity, 'mortelle')
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('UNE seule définition de « pleine » : la Chance voit de la place (hasSeverityRoom) exactement quand la pose ne convertit pas — sur chaque ligne de la Tête', { skip }, async () => {
  for (const severity of ['legere', 'moyenne', 'grave', 'critique', 'mortelle']) {
    const max = WOUND_MAX_COUNTS.tete[severity]
    for (let count = 0; count <= max; count += 1) {
      await assert.rejects(db.transaction(async (trx) => {
        const { charSheet, schedule } = await createFixture(trx)
        await insertWounds(trx, charSheet.id, 'tete', severity, count)
        const room = await hasSeverityRoom(trx, charSheet.id, 'tete', severity)
        const result = await resolveWoundInsertion(trx, charSheet.id, 'tete', severity, schedule)
        assert.equal(room, !result.promoted, `tete/${severity} avec ${count}/${max} cases : place = ${room}, conversion = ${result.promoted}`)
        throw new Error('ROLLBACK_WOUND_TEST')
      }), /ROLLBACK_WOUND_TEST/)
    }
  }
})

test("guérison : la cascade part de la Moyenne pleine et s'arrête à la Grave d'origine (2 cases, sa place est libre), sans toucher aux Légères pleines", { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { charSheet, schedule } = await createFixture(trx)
    // Tête : Légères 3/3 et Moyennes 3/3 (pleines), une Grave. La Grave guérit vers la Moyenne : pleine → effacée, la case revient en Grave (2 cases : elle y a sa place).
    await insertWounds(trx, charSheet.id, 'tete', 'legere', 3)
    await insertWounds(trx, charSheet.id, 'tete', 'moyenne', 3)
    const [grave] = await insertWounds(trx, charSheet.id, 'tete', 'grave', 1)
    const result = await resolveWoundImprovement(trx, grave.id, schedule)
    assert.equal(result.wound.severity, 'grave')
    assert.equal(await countAt(trx, charSheet.id, 'tete', 'grave'), 1)
    assert.equal(await countAt(trx, charSheet.id, 'tete', 'legere'), 3, 'la ligne Légère n\'est pas touchée : la cascade est partie de la Moyenne')
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

// ─── Lot B1 — l'infection d'une localisation vit tant que la localisation porte une blessure susceptible de s'infecter (PLAN_GUERISON_RAW §8) ────

test('infection de localisation : une promotion (3 Moyennes pleines + une 4ᵉ -> Grave) ne l\'annule PAS en route — la Grave est susceptible de s\'infecter', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet, schedule } = await createFixture(trx)
    await insertWounds(trx, charSheet.id, 'corps', 'moyenne', 3) // ligne pleine
    const infection = await infectionEcheanceOf(trx, campaign, character, 'corps')
    const result = await resolveWoundInsertion(trx, charSheet.id, 'corps', 'moyenne', schedule)
    assert.equal(result.promoted, true)
    assert.equal(result.wound.severity, 'grave')
    assert.equal(await statusOfEcheance(trx, infection), 'active')
    assert.ok(!result.cancelledEcheances.some(e => e.id === infection.id))
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('infection de localisation : une cascade qui n\'aboutit qu\'à une Mort (Tête) la termine — plus aucune blessure susceptible ; l\'annulation est journalisée', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet, schedule } = await createFixture(trx)
    await insertWounds(trx, charSheet.id, 'tete', 'mortelle', 1) // ligne Mortelle pleine (1 case)
    const infection = await infectionEcheanceOf(trx, campaign, character, 'tete')
    const result = await resolveWoundInsertion(trx, charSheet.id, 'tete', 'mortelle', schedule) // déborde vers la Mort
    assert.equal(result.wound.severity, 'mort_subite')
    assert.equal(await statusOfEcheance(trx, infection), 'cancelled', 'une Mort en Tête n\'a ni guérison ni infection')
    assert.ok(result.cancelledEcheances.some(e => e.id === infection.id && e.status === 'active'), 'ligne d\'origine retournée pour l\'annulation d\'avance')
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('infection de localisation : supprimer une blessure alors qu\'une autre susceptible de s\'infecter reste -> l\'infection reste ; supprimer la dernière -> annulée ; les autres localisations ne sont pas touchées', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet, schedule } = await createFixture(trx)
    const moyenne = await resolveWoundInsertion(trx, charSheet.id, 'bras_droit', 'moyenne', schedule)
    const grave = await resolveWoundInsertion(trx, charSheet.id, 'bras_droit', 'grave', schedule)
    await resolveWoundInsertion(trx, charSheet.id, 'jambe_gauche', 'moyenne', schedule)
    const bras = await infectionEcheanceOf(trx, campaign, character, 'bras_droit')
    const jambe = await infectionEcheanceOf(trx, campaign, character, 'jambe_gauche')

    await deleteWoundRows(trx, { id: grave.wound.id })
    assert.equal(await statusOfEcheance(trx, bras), 'active', 'la Moyenne du bras reste susceptible de s\'infecter')
    await deleteWoundRows(trx, { id: moyenne.wound.id })
    assert.equal(await statusOfEcheance(trx, bras), 'cancelled')
    assert.equal(await statusOfEcheance(trx, jambe), 'active', 'l\'infection d\'une autre localisation n\'est jamais touchée')
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('infection de localisation : une Légère qui reste n\'est pas « susceptible de s\'infecter » ; l\'infection que le moteur résout (exceptEcheanceId) n\'est jamais annulée ici', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet, schedule } = await createFixture(trx)
    await insertWounds(trx, charSheet.id, 'corps', 'legere', 1)
    const moyenne = await resolveWoundInsertion(trx, charSheet.id, 'corps', 'moyenne', schedule)
    const infection = await infectionEcheanceOf(trx, campaign, character, 'corps')

    const { cancelledEcheances } = await deleteWoundRows(trx, { id: moyenne.wound.id }, { exceptEcheanceId: infection.id })
    assert.ok(!cancelledEcheances.some(e => e.id === infection.id))
    assert.equal(await statusOfEcheance(trx, infection), 'active')
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})

test('guérison complète (Moyenne -> Légère) : l\'infection de la localisation est annulée et journalisée (annuler l\'avance la restaure)', { skip }, async () => {
  await assert.rejects(db.transaction(async (trx) => {
    const { campaign, character, charSheet, schedule } = await createFixture(trx)
    const moyenne = await resolveWoundInsertion(trx, charSheet.id, 'corps', 'moyenne', schedule)
    const infection = await infectionEcheanceOf(trx, campaign, character, 'corps')
    const healed = await resolveWoundImprovement(trx, moyenne.wound.id, schedule)
    assert.equal(healed.wound.severity, 'legere')
    assert.equal(await statusOfEcheance(trx, infection), 'cancelled', 'une Légère ne s\'infecte pas')
    const restores = buildWoundImprovementUndoEntries(moyenne.wound, healed).filter(e => e.table === 'game_echeances' && e.previousValues !== null)
    assert.ok(restores.some(e => e.rowId === infection.id))
    await replayUndoEntries(trx, buildWoundImprovementUndoEntries(moyenne.wound, healed))
    assert.equal(await statusOfEcheance(trx, infection), 'active')
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})
