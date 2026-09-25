import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { AppError } from './AppError.js'
import {
  nextSeverity, previousSeverity, improvedSeverity, resolveWoundInsertion, resolveWoundImprovement,
  buildWoundInsertionUndoEntries, buildWoundImprovementUndoEntries, computeAvailableSeverityReductions, affordableReductions,
  isShockTestRequired, woundSeverityRankSql, WoundLineFullError,
} from './woundUtils.js'
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
    // corps/moyenne maxCount=3 -> 2 cases existantes déclenchent déjà la cascade (currentCount >= maxCount-1)
    const existing = []
    for (let i = 0; i < 2; i++) {
      const [row] = await trx('character_wounds')
        .insert({ char_sheet_id: charSheet.id, location: 'corps', severity: 'moyenne', occurred_at_game_minutes: 100 + i })
        .returning('*')
      existing.push(row)
    }

    const result = await resolveWoundInsertion(trx, charSheet.id, 'corps', 'moyenne', schedule)
    assert.equal(result.promoted, true)
    assert.equal(result.wound.severity, 'grave')
    assert.equal(result.deletedWounds.length, 2)
    assert.deepEqual(new Set(result.deletedWounds.map(w => w.id)), new Set(existing.map(w => w.id)))

    const undoEntries = buildWoundInsertionUndoEntries(result)
    assert.equal(undoEntries.length, 4) // 2 delete-undo (insert) + 1 insert-undo (delete) + l'échéance de la Grave obtenue (delete)
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
    await insertWounds(trx, charSheet.id, 'corps', 'moyenne', 2) // ligne au point de convertir
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
    // Tête : Légère 3 cases, Moyenne 3, Grave 2, Critique 2, Mortelle 1. Chaque ligne est au point de convertir.
    await insertWounds(trx, charSheet.id, 'tete', 'legere', 2)
    await insertWounds(trx, charSheet.id, 'tete', 'moyenne', 2)
    await insertWounds(trx, charSheet.id, 'tete', 'grave', 1)
    await insertWounds(trx, charSheet.id, 'tete', 'critique', 1)
    await insertWounds(trx, charSheet.id, 'tete', 'mortelle', 1)

    const result = await resolveWoundInsertion(trx, charSheet.id, 'tete', 'legere', schedule)
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
    const { charSheet, schedule } = await createFixture(trx)
    await insertWounds(trx, charSheet.id, 'bras_gauche', 'critique', 1) // ligne Critique (2 cases) au point de convertir
    const result = await resolveWoundInsertion(trx, charSheet.id, 'bras_gauche', 'critique', schedule)
    assert.equal(result.promoted, true)
    assert.equal(result.wound.severity, 'mortelle')
    throw new Error('ROLLBACK_WOUND_TEST')
  }), /ROLLBACK_WOUND_TEST/)
})
