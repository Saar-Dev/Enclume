import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../knex.js'
import { up, down } from './258_exo_programs_computer_link.js'
import { assertColumnsExist } from './testHelpers/schemaAssertions.mjs'

async function createFixture(trx) {
  const [user] = await trx('users')
    .insert({ email: `mig258-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'mig258-gm' })
    .returning('*')
  const [campaign] = await trx('campaigns')
    .insert({ gm_id: user.id, name: 'Campagne test migration 258', invite_code: `MIG258-${Date.now()}-${Math.random()}` })
    .returning('*')
  const [character] = await trx('characters')
    .insert({ campaign_id: campaign.id, user_id: user.id, name: 'Exo test migration 258', type: 'exo' })
    .returning('*')
  return { user, campaign, character }
}

test('schéma réel — exo_programs.exo_computer_id existe', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  await assertColumnsExist(db, 'exo_programs', ['exo_computer_id'])
})

test('migration 258 ajoute exo_programs.exo_computer_id et revient proprement', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = await db.schema.hasColumn('exo_programs', 'exo_computer_id')
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)
    assert.equal(await trx.schema.hasColumn('exo_programs', 'exo_computer_id'), true)

    await down(trx)
    assert.equal(await trx.schema.hasColumn('exo_programs', 'exo_computer_id'), false)

    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test('exo_computer_id référence exo_computers, ON DELETE SET NULL (un programme survit à son ordinateur retiré)', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const alreadyApplied = await db.schema.hasColumn('exo_programs', 'exo_computer_id')
  if (alreadyApplied) return

  await assert.rejects(db.transaction(async (trx) => {
    await up(trx)
    const { character } = await createFixture(trx)

    const [computer] = await trx('exo_computers')
      .insert({ character_id: character.id, role: 'principal', gen: 5, nt: 3 })
      .returning('*')
    const [program] = await trx('exo_programs')
      .insert({ character_id: character.id, label_override: 'Programme test 258', category: 'specialise', level: 3, exo_computer_id: computer.id })
      .returning('*')
    assert.equal(program.exo_computer_id, computer.id)

    await trx('exo_computers').where({ id: computer.id }).delete()
    const reread = await trx('exo_programs').where({ id: program.id }).first()
    assert.notEqual(reread, undefined, 'le programme doit survivre à la suppression de son ordinateur')
    assert.equal(reread.exo_computer_id, null, 'la référence doit passer à NULL, pas de CASCADE')

    throw new Error('ROLLBACK_MIGRATION_TEST')
  }), /ROLLBACK_MIGRATION_TEST/)
})

test.after(async () => { await db.destroy() })
