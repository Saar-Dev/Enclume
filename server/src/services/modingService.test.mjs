import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { returnModToInventory, installMod, getModingState } from './modingService.js'

// Lancement manuel : node --env-file=../.env --test server/src/services/modingService.test.mjs
const skip = !process.env.DATABASE_URL

// L1 Usure (PLAN_USURE&INTEGRITE.md §3) — `returnModToInventory` (mod retiré/swappé d'une arme,
// renvoyé au Coffre) est le 4ᵉ point de décision de stack, celui que le plan avait omis. Depuis le
// backfill migration 329, les « Accessoires pour armes » portent `has_integrity` → chaque exemplaire
// retourné doit devenir sa propre ligne quantity=1, jamais un incrément sur un stack existant.
// Tests en transaction rollback : `returnModToInventory` accepte le `trx`, aucun nettoyage requis.

async function fixture(trx) {
  const [gm] = await trx('users')
    .insert({ email: `moding-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'moding-gm' })
    .returning('*')
  const [campaign] = await trx('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test modingService', invite_code: `MOD-${Date.now()}-${Math.random()}` })
    .returning('*')
  const [owner] = await trx('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Proprietaire', type: 'pj' })
    .returning('*')
  const accessoryRef = await trx('ref_equipment')
    .where({ family: 'Armes', category: 'Accessoires pour armes' }).first()
  const ammoRef = await trx('ref_equipment')
    .where({ family: 'Munitions' }).whereNull('location').first()
  return { owner, accessoryRef, ammoRef }
}

test('returnModToInventory — accessoire has_integrity retourné ×2 : 2 lignes distinctes quantity=1', { skip }, async () => {
  await db.transaction(async (trx) => {
    const fx = await fixture(trx)
    assert.equal(fx.accessoryRef.has_integrity, true, 'un accessoire d\'arme doit porter has_integrity (migration 329)')

    await returnModToInventory(fx.owner.id, fx.accessoryRef.id, trx)
    await returnModToInventory(fx.owner.id, fx.accessoryRef.id, trx)

    const rows = await trx('char_inventory').where({ character_id: fx.owner.id, equipment_id: fx.accessoryRef.id })
    assert.equal(rows.length, 2, 'deux lignes — jamais un incrément de quantity')
    assert.ok(rows.every(r => r.quantity === 1))
    throw new Error('__rollback__')
  }).catch((e) => { if (e.message !== '__rollback__') throw e })
})

test('returnModToInventory — item stackable (munition) : fusionne dans le stack Coffre existant', { skip }, async () => {
  await db.transaction(async (trx) => {
    const fx = await fixture(trx)
    await trx('char_inventory').insert({ character_id: fx.owner.id, equipment_id: fx.ammoRef.id, container: 'Coffre', quantity: 4 })

    await returnModToInventory(fx.owner.id, fx.ammoRef.id, trx)

    const rows = await trx('char_inventory').where({ character_id: fx.owner.id, equipment_id: fx.ammoRef.id, container: 'Coffre' })
    assert.equal(rows.length, 1, 'aucune ligne créée — fusion')
    assert.equal(rows[0].quantity, 5)
    throw new Error('__rollback__')
  }).catch((e) => { if (e.message !== '__rollback__') throw e })
})

// GRENADE-ACCEPTS-WEAPON-MODS — fire_mode (ref_equipment) n'existe que sur les armes qui tirent
// réellement (rules/combat.md §Autorité) : une grenade, une arme de contact ou une arme de jet ont
// toutes fire_mode NULL et ne doivent jamais pouvoir recevoir un accessoire d'arme (lunette,
// silencieux...). installMod ouvre sa propre transaction (pas de paramètre trx) : fixtures et
// nettoyage manuels, pas de rollback — voir AGENTS.md § Commandes (test ciblé avec la base locale).
async function fixtureAvecCible(refFilter) {
  const [gm] = await db('users')
    .insert({ email: `moding-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'moding-gm' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test modingService', invite_code: `MOD-${Date.now()}-${Math.random()}` })
    .returning('*')
  const [owner] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Proprietaire', type: 'pj' })
    .returning('*')
  const targetRef = await db('ref_equipment').where(refFilter).first()
  const modRef = await db('ref_equipment').where({ family: 'Armes', category: 'Accessoires pour armes', mod_slot: 'optique' }).first()
  const [targetInv] = await db('char_inventory')
    .insert({ character_id: owner.id, equipment_id: targetRef.id, container: 'Coffre', quantity: 1 })
    .returning('*')
  const [modInv] = await db('char_inventory')
    .insert({ character_id: owner.id, equipment_id: modRef.id, container: 'Coffre', quantity: 1 })
    .returning('*')
  return { gm, campaign, owner, targetRef, modRef, targetInv, modInv }
}

async function nettoyerFixture(fx) {
  await db('char_inventory_mods').where({ weapon_inv_id: fx.targetInv.id }).del()
  await db('char_inventory').where({ character_id: fx.owner.id }).del()
  await db('characters').where({ id: fx.owner.id }).del()
  await db('campaigns').where({ id: fx.campaign.id }).del()
  await db('users').where({ id: fx.gm.id }).del()
}

test('installMod — rejette une grenade comme cible (fire_mode NULL)', { skip }, async () => {
  const fx = await fixtureAvecCible({ family: 'Armes', category: 'Grenade' })
  try {
    assert.equal(fx.targetRef.fire_mode, null)
    await assert.rejects(
      () => installMod(fx.owner.id, fx.targetInv.id, fx.modInv.id),
      (err) => { assert.equal(err.statusCode, 400); return true }
    )
    const installed = await db('char_inventory_mods').where({ weapon_inv_id: fx.targetInv.id })
    assert.equal(installed.length, 0, 'aucun mod ne doit être installé après le refus')
  } finally {
    await nettoyerFixture(fx)
  }
})

test('installMod — accepte toujours une arme à feu réelle (fire_mode non NULL, non-régression)', { skip }, async () => {
  const fx = await fixtureAvecCible({ family: 'Armes', category: 'Armes de poing' })
  try {
    assert.ok(fx.targetRef.fire_mode, 'fixture invalide : attendu une arme avec fire_mode')
    const { state } = await installMod(fx.owner.id, fx.targetInv.id, fx.modInv.id)
    assert.ok(state.weapons.some(w => w.id === fx.targetInv.id && w.installed_mods.length === 1))
  } finally {
    await nettoyerFixture(fx)
  }
})

test('getModingState — une grenade en inventaire n\'apparaît jamais dans la liste des armes modables', { skip }, async () => {
  const fx = await fixtureAvecCible({ family: 'Armes', category: 'Grenade' })
  try {
    const { weapons } = await getModingState(fx.owner.id)
    assert.ok(!weapons.some(w => w.id === fx.targetInv.id), 'la grenade ne doit pas figurer dans les cibles modables')
  } finally {
    await nettoyerFixture(fx)
  }
})

test.after(async () => { await db.destroy() })
