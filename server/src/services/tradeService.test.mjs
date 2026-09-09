import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { buyFromMerchant } from './tradeService.js'
import { QUALITY_TABLE } from '../../../shared/integrityRules.js'

// Lancement manuel : node --env-file=../.env --test server/src/services/tradeService.test.mjs
const skip = !process.env.DATABASE_URL

// L1 Usure (PLAN_USURE&INTEGRITE.md §3) — à l'achat chez un Marchand, un item `has_integrity`
// (backfill migration 329 : armes, protections, ordinateurs, matériel NT IV+) ne stacke jamais :
// acheter N exemplaires crée N lignes quantity=1, jamais 1 ligne quantity=N. `buyFromMerchant`
// ouvre sa propre transaction → test réel + nettoyage explicite.

async function createFixture(opts = {}) {
  const [gm] = await db('users')
    .insert({ email: `trade-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'trade-gm' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test tradeService', invite_code: `TRADE-${Date.now()}-${Math.random()}` })
    .returning('*')
  const [owner] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Acheteur', type: 'pj' })
    .returning('*')
  await db('char_sheet').insert({ character_id: owner.id, sols: 1_000_000 })
  const [merchant] = await db('merchants')
    .insert({ campaign_id: campaign.id, name: 'Marchand test', status: 'OPEN', is_black_market: opts.isBlackMarket ?? false })
    .returning('*')

  // has_integrity non équipable (ordinateur / accessoire) + munition non suivie, tous deux `price>0`.
  const integrityRef = await db('ref_equipment')
    .where({ has_integrity: true }).whereNull('location').where('price', '>', 0).first()
  const ammoRef = await db('ref_equipment')
    .where({ family: 'Munitions' }).whereNull('location').where('price', '>', 0).first()

  return { gm, campaign, owner, merchant, integrityRef, ammoRef }
}

async function cleanup({ campaign, gm, owner }) {
  await db('trade_log').where({ campaign_id: campaign.id }).del()
  await db('char_inventory').where({ character_id: owner.id }).del()
  await db('campaigns').where({ id: campaign.id }).del()   // CASCADE : merchants, characters, char_sheet
  await db('users').where({ id: gm.id }).del()
}

test('buyFromMerchant — item has_integrity ×3 : 3 lignes quantity=1', { skip }, async () => {
  const fx = await createFixture()
  try {
    assert.ok(fx.integrityRef, 'fixture : un ref_equipment has_integrity non équipable doit exister')
    await buyFromMerchant(fx.campaign.id, {
      merchantId: fx.merchant.id, charId: fx.owner.id,
      items: [{ equipmentId: fx.integrityRef.id, qty: 3 }],
    })
    const rows = await db('char_inventory').where({ character_id: fx.owner.id, equipment_id: fx.integrityRef.id })
    assert.equal(rows.length, 3, 'trois lignes distinctes')
    assert.ok(rows.every(r => r.quantity === 1))
  } finally {
    await cleanup(fx)
  }
})

test('buyFromMerchant — munition ×3 : 1 ligne quantity=3 (non-régression, stackable)', { skip }, async () => {
  const fx = await createFixture()
  try {
    await buyFromMerchant(fx.campaign.id, {
      merchantId: fx.merchant.id, charId: fx.owner.id,
      items: [{ equipmentId: fx.ammoRef.id, qty: 3 }],
    })
    const rows = await db('char_inventory').where({ character_id: fx.owner.id, equipment_id: fx.ammoRef.id })
    assert.equal(rows.length, 1)
    assert.equal(rows[0].quantity, 3)
  } finally {
    await cleanup(fx)
  }
})

// ── L3 — ITG à l'achat ──────────────────────────────────────────────────────
test('buyFromMerchant — marché légal : chaque exemplaire has_integrity reçoit une ITG d\'occasion', { skip }, async () => {
  const fx = await createFixture() // is_black_market = false
  try {
    const q = QUALITY_TABLE[fx.integrityRef.quality] ?? QUALITY_TABLE.bonne_qualite
    await buyFromMerchant(fx.campaign.id, {
      merchantId: fx.merchant.id, charId: fx.owner.id,
      items: [{ equipmentId: fx.integrityRef.id, qty: 3 }],
    })
    const rows = await db('char_inventory').where({ character_id: fx.owner.id, equipment_id: fx.integrityRef.id })
    assert.equal(rows.length, 3)
    for (const r of rows) {
      assert.equal(r.integrity_max, q.itgMax)
      assert.ok(r.integrity_current >= 1 && r.integrity_current <= q.itgMax)
    }
    // occasion : au moins une différence courante/max attendue sur 3 tirages (pas une preuve stricte
    // mais un stack de 3 tous pile au max serait très improbable pour 2D6+6/20)
  } finally {
    await cleanup(fx)
  }
})

test('buyFromMerchant — marché noir : ITG neuve (courante = max)', { skip }, async () => {
  const fx = await createFixture({ isBlackMarket: true })
  try {
    const q = QUALITY_TABLE[fx.integrityRef.quality] ?? QUALITY_TABLE.bonne_qualite
    await buyFromMerchant(fx.campaign.id, {
      merchantId: fx.merchant.id, charId: fx.owner.id,
      items: [{ equipmentId: fx.integrityRef.id, qty: 2 }],
    })
    const rows = await db('char_inventory').where({ character_id: fx.owner.id, equipment_id: fx.integrityRef.id })
    assert.equal(rows.length, 2)
    for (const r of rows) {
      assert.equal(r.integrity_current, q.itgMax)
      assert.equal(r.integrity_max, q.itgMax)
    }
  } finally {
    await cleanup(fx)
  }
})

test('buyFromMerchant — munition (non suivie) : aucune ITG posée', { skip }, async () => {
  const fx = await createFixture()
  try {
    await buyFromMerchant(fx.campaign.id, {
      merchantId: fx.merchant.id, charId: fx.owner.id,
      items: [{ equipmentId: fx.ammoRef.id, qty: 2 }],
    })
    const row = await db('char_inventory').where({ character_id: fx.owner.id, equipment_id: fx.ammoRef.id }).first()
    assert.equal(row.integrity_current, null)
    assert.equal(row.integrity_max, null)
  } finally {
    await cleanup(fx)
  }
})

test.after(async () => { await db.destroy() })
