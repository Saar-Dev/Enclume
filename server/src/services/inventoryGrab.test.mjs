import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { describeGrabCandidate, GRAB_REFUSAL } from './inventoryService.js'

// PLAN_PRISE_EN_MAIN.md — validation STRUCTURELLE d'un objet demandé (`describeGrabCandidate`, utilisée à l'annonce). La
// permutation elle-même (`swapItemInHand`) est testée dans inventorySwap.test.mjs.
// Fixtures créées puis supprimées (même patron que inventoryService.test.mjs : campagne + personnages de test).
// Lancement manuel, base locale : node --env-file=.env --test server/src/services/inventoryGrab.test.mjs
const skip = !process.env.DATABASE_URL

async function createFixture() {
  const [gm] = await db('users')
    .insert({ email: `inv-grab-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'inv-grab-gm' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test prise en main', invite_code: `GRAB-${Date.now()}-${Math.random()}` })
    .returning('*')
  const [owner] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Proprietaire', type: 'pj' })
    .returning('*')
  const [other] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Autre', type: 'pj' })
    .returning('*')

  const grenadeRef = await db('ref_equipment').where({ name: 'Grenade à fragmentation' }).first()
  const shieldRef = await db('ref_equipment').where({ category: 'Bouclier' }).first()
  const twoHandRef = await db('ref_equipment').where({ location: '2M' }).first()
  const armorRef = await db('ref_equipment').whereIn('location', ['T', 'C']).first()
  const sacRef = await db('ref_equipment').where({ location: 'D' }).first()
  assert.ok(grenadeRef && shieldRef && twoHandRef && armorRef && sacRef, 'catalogue de test incomplet')

  const insertItem = async (charId, refId, container) => {
    const [row] = await db('char_inventory')
      .insert({ character_id: charId, equipment_id: refId, container, quantity: 1, validated_by_gm: true })
      .returning('*')
    return row
  }
  const putInSlot = (item, slot) =>
    db('char_inventory_slots').insert({ char_inventory_id: item.id, character_id: item.character_id, slot_code: slot })

  // Un Sac à dos équipé (slot D) : la règle PI2 exige un Sac disponible pour équiper quoi que ce soit en main.
  const backpack = await insertItem(owner.id, sacRef.id, 'Sac')
  await putInSlot(backpack, 'D')

  const fx = {
    gm, campaign, owner, other, grenadeRef, shieldRef, twoHandRef, armorRef, backpack, insertItem, putInSlot,
    grenadeSac:      await insertItem(owner.id, grenadeRef.id, 'Sac'),
    grenadeSac2:     await insertItem(owner.id, grenadeRef.id, 'Sac'),
    grenadeSac3:     await insertItem(owner.id, grenadeRef.id, 'Sac'),
    grenadeBelt:     await insertItem(owner.id, grenadeRef.id, 'Ceinture'),
    grenadeCoffre:   await insertItem(owner.id, grenadeRef.id, 'Coffre'),
    shieldSac:       await insertItem(owner.id, shieldRef.id, 'Sac'),
    twoHandSac:      await insertItem(owner.id, twoHandRef.id, 'Sac'),
    armorWorn:       await insertItem(owner.id, armorRef.id, 'Sac'),
    armorSac:        await insertItem(owner.id, armorRef.id, 'Sac'),
    otherGrenade:    await insertItem(other.id, grenadeRef.id, 'Sac'),
  }
  await putInSlot(fx.armorWorn, armorRef.location)
  return fx
}

async function cleanup({ campaign, gm }) {
  await db('campaigns').where({ id: campaign.id }).del()
  await db('users').where({ id: gm.id }).del()
}


test('describeGrabCandidate — grenade du Sac : candidate, conteneur Sac, emplacement M', { skip }, async () => {
  const fx = await createFixture()
  try {
    const r = await describeGrabCandidate(fx.owner.id, fx.grenadeSac.id)
    assert.equal(r.ok, true)
    assert.equal(r.alreadyInHand, false)
    assert.equal(r.container, 'Sac')
    assert.equal(r.refLocation, 'M')
  } finally { await cleanup(fx) }
})

test('describeGrabCandidate — grenade de la Ceinture : candidate, conteneur Ceinture', { skip }, async () => {
  const fx = await createFixture()
  try {
    const r = await describeGrabCandidate(fx.owner.id, fx.grenadeBelt.id)
    assert.equal(r.ok, true)
    assert.equal(r.container, 'Ceinture')
  } finally { await cleanup(fx) }
})

test('describeGrabCandidate — refus structurels : Coffre, objet d’un autre, identifiant forgé, porté, non tenable', { skip }, async () => {
  const fx = await createFixture()
  try {
    assert.deepEqual(await describeGrabCandidate(fx.owner.id, fx.grenadeCoffre.id), { ok: false, reason: GRAB_REFUSAL.NOT_CARRIED })
    assert.deepEqual(await describeGrabCandidate(fx.owner.id, fx.otherGrenade.id), { ok: false, reason: GRAB_REFUSAL.NOT_FOUND })
    assert.deepEqual(await describeGrabCandidate(fx.owner.id, 'pas-un-uuid'), { ok: false, reason: GRAB_REFUSAL.NOT_FOUND })
    assert.deepEqual(await describeGrabCandidate(fx.owner.id, null), { ok: false, reason: GRAB_REFUSAL.NOT_FOUND })
    assert.deepEqual(await describeGrabCandidate(fx.owner.id, fx.armorWorn.id), { ok: false, reason: GRAB_REFUSAL.EQUIPPED })
    // Une armure rangée n'est pas tenable à la main (le bouclier, lui, l'est : décision Saar 2026-09-25).
    assert.deepEqual(await describeGrabCandidate(fx.owner.id, fx.armorSac.id), { ok: false, reason: GRAB_REFUSAL.NOT_HOLDABLE })
    assert.equal((await describeGrabCandidate(fx.owner.id, fx.shieldSac.id)).ok, true)
  } finally { await cleanup(fx) }
})

test('describeGrabCandidate — objet déjà en main : ok + alreadyInHand (idempotence décidée par l’appelant)', { skip }, async () => {
  const fx = await createFixture()
  try {
    await fx.putInSlot(fx.grenadeSac, 'MD')
    const r = await describeGrabCandidate(fx.owner.id, fx.grenadeSac.id)
    assert.equal(r.ok, true)
    assert.equal(r.alreadyInHand, true)
  } finally { await cleanup(fx) }
})

test.after(async () => { await db.destroy() })
