import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { getOwnedHandWeapon, WEAPON_SLOTS, addItem } from './inventoryService.js'

// Lancement manuel : node --env-file=../.env --test server/src/services/inventoryService.test.mjs
const skip = !process.env.DATABASE_URL

// MELEE-INHAND / ASSAULT-INHAND-RESOLUTION (docs/BUGIDENTIFIE.md, 2026-08-05) — getOwnedHandWeapon
// est l'autorité unique consommée par le combat (Tir + CaC, principale + secondaire, Déclaration +
// Résolution). Ces tests couvrent le contrat de la fonction elle-même, indépendamment de ses
// appelants combat.

async function createFixture() {
  const [gm] = await db('users')
    .insert({ email: `inv-svc-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'inv-svc-gm' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test inventoryService', invite_code: `INVSVC-${Date.now()}-${Math.random()}` })
    .returning('*')
  const [owner] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Proprietaire', type: 'pj' })
    .returning('*')
  const [other] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Autre personnage', type: 'pj' })
    .returning('*')

  const meleeRef = await db('ref_equipment').where({ category: 'Arme de contact' }).first()
  const shieldRef = await db('ref_equipment').where({ category: 'Bouclier' }).first()

  const [meleeInHand] = await db('char_inventory')
    .insert({ character_id: owner.id, equipment_id: meleeRef.id, container: 'Coffre', quantity: 1 })
    .returning('*')
  await db('char_inventory_slots').insert({ char_inventory_id: meleeInHand.id, character_id: owner.id, slot_code: 'MG' })

  const [meleeStored] = await db('char_inventory')
    .insert({ character_id: owner.id, equipment_id: meleeRef.id, container: 'Coffre', quantity: 1 })
    .returning('*')
  // Pas de char_inventory_slots pour celui-ci — jamais équipé.

  const [shieldInHand] = await db('char_inventory')
    .insert({ character_id: owner.id, equipment_id: shieldRef.id, container: 'Coffre', quantity: 1 })
    .returning('*')
  await db('char_inventory_slots').insert({ char_inventory_id: shieldInHand.id, character_id: owner.id, slot_code: 'MD' })

  return { gm, campaign, owner, other, meleeRef, shieldRef, meleeInHand, meleeStored, shieldInHand }
}

async function cleanup({ campaign, gm }) {
  await db('campaigns').where({ id: campaign.id }).del()
  await db('users').where({ id: gm.id }).del()
}

test('getOwnedHandWeapon — arme en main, bon propriétaire, bonne catégorie : item + inHand/categoryOk vrais', { skip }, async () => {
  const fx = await createFixture()
  try {
    const result = await getOwnedHandWeapon(fx.owner.id, fx.meleeInHand.id, { slotCodes: ['MG', 'MD', '2M'], category: 'Arme de contact' })
    assert.ok(result, 'doit retourner l\'item')
    assert.equal(result.ref_damage_h, fx.meleeRef.damage_h)
    assert.equal(result.inHand, true)
    assert.equal(result.categoryOk, true)
  } finally {
    await cleanup(fx)
  }
})

test('getOwnedHandWeapon — mauvais propriétaire : null (MELEE-INHAND, cause racine)', { skip }, async () => {
  const fx = await createFixture()
  try {
    const result = await getOwnedHandWeapon(fx.other.id, fx.meleeInHand.id, { slotCodes: ['MG', 'MD', '2M'], category: 'Arme de contact' })
    assert.equal(result, null)
  } finally {
    await cleanup(fx)
  }
})

test('getOwnedHandWeapon — bon propriétaire mais arme rangée (pas en main) : item retourné, inHand faux', { skip }, async () => {
  const fx = await createFixture()
  try {
    const result = await getOwnedHandWeapon(fx.owner.id, fx.meleeStored.id, { slotCodes: ['MG', 'MD', '2M'], category: 'Arme de contact' })
    assert.ok(result, 'objet trouvé et possédé — l\'appelant doit pouvoir distinguer "pas en main" d\'"introuvable"')
    assert.equal(result.inHand, false)
  } finally {
    await cleanup(fx)
  }
})

test('getOwnedHandWeapon — en main mais mauvaise catégorie (bouclier passé comme arme de contact) : categoryOk faux', { skip }, async () => {
  const fx = await createFixture()
  try {
    const result = await getOwnedHandWeapon(fx.owner.id, fx.shieldInHand.id, { slotCodes: ['MG', 'MD'], category: 'Arme de contact' })
    assert.ok(result)
    assert.equal(result.inHand, true)
    assert.equal(result.categoryOk, false)
  } finally {
    await cleanup(fx)
  }
})

test('getOwnedHandWeapon — en main mais slot non autorisé pour ce contexte (secondaire refuse 2M) : inHand faux', { skip }, async () => {
  const fx = await createFixture()
  try {
    // meleeInHand est en MG — autorisé comme principale (MG/MD/2M) mais on simule ici un appelant
    // qui n'autorise que 2M pour vérifier que le filtre de slots est bien respecté et pas ignoré.
    const result = await getOwnedHandWeapon(fx.owner.id, fx.meleeInHand.id, { slotCodes: ['2M'], category: 'Arme de contact' })
    assert.ok(result)
    assert.equal(result.inHand, false)
  } finally {
    await cleanup(fx)
  }
})

test('getOwnedHandWeapon — sans filtre de catégorie (Tir, comportement historique) : categoryOk toujours vrai', { skip }, async () => {
  const fx = await createFixture()
  try {
    const result = await getOwnedHandWeapon(fx.owner.id, fx.shieldInHand.id, { slotCodes: [...WEAPON_SLOTS] })
    assert.ok(result)
    assert.equal(result.categoryOk, true, 'category=null ne doit pas filtrer — comportement historique du Tir préservé')
  } finally {
    await cleanup(fx)
  }
})

test('getOwnedHandWeapon — itemId ou characterId absent : null sans exception', { skip }, async () => {
  const result1 = await getOwnedHandWeapon('some-char-id', null, { slotCodes: ['MG'] })
  const result2 = await getOwnedHandWeapon(null, 'some-item-id', { slotCodes: ['MG'] })
  assert.equal(result1, null)
  assert.equal(result2, null)
})

// addItem/autoValidate (PLAN_WIZARD_MATERIEL_GAUGES.md §3, étendu pour la création Coffre-native
// sans campagne, char-sheet.js) — inventoryService.js ne connaît pas la notion de campagne, le
// paramètre est un booléen brut décidé par l'appelant. Ces deux tests couvrent le seul contrat qui
// revient à ce fichier : autoValidate pilote validated_by_gm sur l'item inséré, rien d'autre.
test('addItem — autoValidate=true : l\'item part directement validated_by_gm=true', { skip }, async () => {
  const fx = await createFixture()
  try {
    const { item } = await addItem(fx.owner.id, { custom_name: 'Babiole', quantity: 1 }, true)
    assert.equal(item.validated_by_gm, true)
  } finally {
    await cleanup(fx)
  }
})

test('addItem — autoValidate=false (défaut) : l\'item part en attente, validated_by_gm=false', { skip }, async () => {
  const fx = await createFixture()
  try {
    const { item } = await addItem(fx.owner.id, { custom_name: 'Babiole', quantity: 1 })
    assert.equal(item.validated_by_gm, false)
  } finally {
    await cleanup(fx)
  }
})

test.after(async () => { await db.destroy() })
