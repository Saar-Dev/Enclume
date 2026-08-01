import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { grantAdvantage } from './advantageService.js'

// Lancement manuel : node --env-file=../.env --test server/src/services/advantageService.test.mjs
const skip = !process.env.DATABASE_URL

async function createRealFixture() {
  const [gm] = await db('users')
    .insert({ email: `pol1-gm-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'pol1-gm' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({
      gm_id: gm.id, name: 'Campagne test POL1', invite_code: `POL1-${Date.now()}-${Math.random()}`,
      settings: { polaris_latent: true },
    })
    .returning('*')
  const [character] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Perso test POL1', type: 'pj' })
    .returning('*')
  const [charSheet] = await db('char_sheet').insert({ character_id: character.id }).returning('*')
  return { gm, campaign, character, charSheet }
}

async function cleanup({ campaign, gm }) {
  if (campaign) await db('campaigns').where({ id: campaign.id }).del()
  if (gm) await db('users').where({ id: gm.id }).del()
}

test('grantAdvantage(adv_078) : tire 2 pouvoirs Polaris distincts et les marque appris', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    await grantAdvantage(fixture.charSheet.id, 'adv_078', 'campaign')

    const advRow = await db('char_advantages')
      .where({ char_sheet_id: fixture.charSheet.id, advantage_id: 'adv_078' })
      .whereNull('removed_at')
      .first()
    assert.ok(advRow, 'adv_078 doit être présent dans char_advantages')

    const learned = await db('char_skills as cs')
      .join('ref_skills as rs', 'rs.id', 'cs.skill_id')
      .where({ 'cs.char_sheet_id': fixture.charSheet.id, 'cs.is_learned': true })
      .select('cs.skill_id', 'rs.parent')

    assert.equal(learned.length, 2, 'exactement 2 pouvoirs marqués appris')
    assert.ok(learned.every(s => s.parent === 'POUVOIRS_POLARIS'), 'les 2 doivent appartenir à POUVOIRS_POLARIS')
    assert.notEqual(learned[0].skill_id, learned[1].skill_id, 'les 2 pouvoirs doivent être distincts')
  } finally {
    await cleanup(fixture)
  }
})

test('grantAdvantage(adv_079) : ne tire aucun pouvoir Polaris (adv_078 uniquement)', { skip }, async () => {
  const fixture = await createRealFixture()
  try {
    await grantAdvantage(fixture.charSheet.id, 'adv_079', 'campaign')

    const learned = await db('char_skills')
      .where({ char_sheet_id: fixture.charSheet.id, is_learned: true })
    assert.equal(learned.length, 0)
  } finally {
    await cleanup(fixture)
  }
})

test.after(async () => { await db.destroy() })
