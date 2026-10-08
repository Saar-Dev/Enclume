import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { duplicateBattlemapEntities } from './battlemaps.js'

// Lancement (depuis la racine du projet) : node --env-file=.env --test server/src/routes/battlemaps.duplicateEntities.test.mjs
// Écrit puis supprime des lignes dans la base locale — sans DATABASE_URL, tout est ignoré.
const skip = !process.env.DATABASE_URL

test.after(async () => { await db.destroy() })

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

// Campagne minimale + une carte source et une carte copie (vide), même patron que deathStateService.test.mjs.
async function createFixture() {
  const [gm] = await db('users')
    .insert({ email: `battlemap-dup-${uniq()}@test.local`, password_hash: 'x', username: `bmdup-${uniq()}` })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test duplicate', invite_code: `BMDUP-${uniq()}` })
    .returning('*')
  const [from] = await db('battlemaps').insert({ campaign_id: campaign.id, name: 'Source' }).returning('*')
  const [to] = await db('battlemaps').insert({ campaign_id: campaign.id, name: 'Copie' }).returning('*')
  const blueprint = await db('entity_blueprints').select('id').first()
  assert.ok(blueprint, 'entity_blueprints doit avoir au moins une ligne en base locale pour ce test')
  const cleanup = async () => {
    await db('entities').whereIn('battlemap_id', [from.id, to.id]).del()
    await db('battlemaps').whereIn('id', [from.id, to.id]).del()
    await db('campaigns').where({ id: campaign.id }).del()
    await db('users').where({ id: gm.id }).del()
  }
  return { campaign, from, to, blueprint, cleanup }
}

test('duplicateBattlemapEntities — copie position, état, overrides et notes GM ; laisse les autres cartes intactes', { skip }, async () => {
  const fx = await createFixture()
  let otherBattlemapId = null
  try {
    await db('entities').insert([
      {
        battlemap_id: fx.from.id,
        blueprint_id: fx.blueprint.id,
        pos_x: 3, pos_y: 1, pos_z: -2, r: 90,
        current_state_id: 1,
        gm_only: true,
        label_override: 'Caisse scellée',
        interaction_overrides: JSON.stringify({ open: { disabled: true } }),
        disabled_interactions: ['open'],
        state: JSON.stringify({ locked: true }),
        notes_gm: 'Piège à l’intérieur',
      },
      { battlemap_id: fx.from.id, blueprint_id: fx.blueprint.id, pos_x: 0, pos_y: 0, pos_z: 0 },
    ])
    // Une entité posée sur une AUTRE carte de la même campagne ne doit jamais être recopiée.
    const [otherBattlemap] = await db('battlemaps').insert({ campaign_id: fx.campaign.id, name: 'Autre carte' }).returning('*')
    otherBattlemapId = otherBattlemap.id
    await db('entities').insert({ battlemap_id: otherBattlemapId, blueprint_id: fx.blueprint.id, pos_x: 9, pos_y: 9, pos_z: 9 })

    const count = await db.transaction(trx => duplicateBattlemapEntities(trx, fx.from.id, fx.to.id))
    assert.equal(count, 2)

    const copied = await db('entities').where({ battlemap_id: fx.to.id }).orderBy('pos_x')
    assert.equal(copied.length, 2)
    const sealed = copied.find(entity => entity.label_override === 'Caisse scellée')
    assert.ok(sealed)
    assert.equal(sealed.pos_x, 3)
    assert.equal(sealed.pos_y, 1)
    assert.equal(sealed.pos_z, -2)
    assert.equal(sealed.r, 90)
    assert.equal(sealed.current_state_id, 1)
    assert.equal(sealed.gm_only, true)
    assert.deepEqual(sealed.interaction_overrides, { open: { disabled: true } })
    assert.deepEqual(sealed.disabled_interactions, ['open'])
    assert.deepEqual(sealed.state, { locked: true })
    assert.equal(sealed.notes_gm, 'Piège à l’intérieur')

    // Copie, pas déplacement : la carte source garde ses lignes, l'autre carte n'a pas bougé.
    assert.equal((await db('entities').where({ battlemap_id: fx.from.id })).length, 2)
    assert.equal((await db('entities').where({ battlemap_id: otherBattlemapId })).length, 1)
  } finally {
    if (otherBattlemapId) {
      await db('entities').where({ battlemap_id: otherBattlemapId }).del()
      await db('battlemaps').where({ id: otherBattlemapId }).del()
    }
    await fx.cleanup()
  }
})

test('duplicateBattlemapEntities — carte source sans entité : n’insère rien, renvoie 0', { skip }, async () => {
  const fx = await createFixture()
  try {
    const count = await db.transaction(trx => duplicateBattlemapEntities(trx, fx.from.id, fx.to.id))
    assert.equal(count, 0)
    assert.equal((await db('entities').where({ battlemap_id: fx.to.id })).length, 0)
  } finally { await fx.cleanup() }
})
