import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { returnModToInventory } from './modingService.js'

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

test.after(async () => { await db.destroy() })
