import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { getOwnedHandWeapon, WEAPON_SLOTS, addItem, updateItem } from './inventoryService.js'

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
  const pricedRef = await db('ref_equipment').where('price', '>', 0).first()

  // INV2 (docs/EN_COURS.md) — char_sheet.sols, requis par _chargeSols (owner.id). 100000 : largement
  // au-dessus du prix de pricedRef pour les tests "sols suffisants", ajusté au cas par cas pour les
  // tests "sols insuffisants".
  await db('char_sheet').insert({ character_id: owner.id, sols: 100000 })

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

  return { gm, campaign, owner, other, meleeRef, shieldRef, pricedRef, meleeInHand, meleeStored, shieldInHand }
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

// INV2 (docs/EN_COURS.md) — le bouton Ajouter ne débitait jamais de Sols, malgré un prix déjà
// présent en base (ref_equipment.price). Décision Saar 2026-08-22 : débit à l'ajout quand aucune
// validation MJ n'aura jamais lieu (Coffre-native), débit à la validation MJ sinon — jamais pour un
// ajout fait par le MJ lui-même (geste privilégié, comportement préexistant préservé).
test('addItem — Coffre-native (autoValidate=true, isGm=false) avec sols suffisants : débite le prix', { skip }, async () => {
  const fx = await createFixture()
  try {
    const before = await db('char_sheet').where({ character_id: fx.owner.id }).first('sols')
    const { item } = await addItem(fx.owner.id, { equipment_id: fx.pricedRef.id, quantity: 1 }, true, false)
    assert.equal(item.validated_by_gm, true)
    const after = await db('char_sheet').where({ character_id: fx.owner.id }).first('sols')
    assert.equal(after.sols, before.sols - fx.pricedRef.price)
  } finally {
    await cleanup(fx)
  }
})

test('addItem — Coffre-native (autoValidate=true, isGm=false) avec sols insuffisants : rejette, aucun item ni débit', { skip }, async () => {
  const fx = await createFixture()
  try {
    await db('char_sheet').where({ character_id: fx.owner.id }).update({ sols: fx.pricedRef.price - 1 })
    await assert.rejects(
      () => addItem(fx.owner.id, { equipment_id: fx.pricedRef.id, quantity: 1 }, true, false),
      AppError
    )
    const after = await db('char_sheet').where({ character_id: fx.owner.id }).first('sols')
    assert.equal(after.sols, fx.pricedRef.price - 1, 'aucun débit — la transaction doit être annulée')
    const count = await db('char_inventory').where({ character_id: fx.owner.id, equipment_id: fx.pricedRef.id }).count('* as n').first()
    assert.equal(Number(count.n), 0, 'aucun item inséré')
  } finally {
    await cleanup(fx)
  }
})

test('addItem — ajout MJ (isGm=true) : jamais débité même avec autoValidate=true', { skip }, async () => {
  const fx = await createFixture()
  try {
    const before = await db('char_sheet').where({ character_id: fx.owner.id }).first('sols')
    const { item } = await addItem(fx.owner.id, { equipment_id: fx.pricedRef.id, quantity: 1 }, true, true)
    assert.equal(item.validated_by_gm, true)
    const after = await db('char_sheet').where({ character_id: fx.owner.id }).first('sols')
    assert.equal(after.sols, before.sols, 'geste MJ privilégié — jamais facturé')
  } finally {
    await cleanup(fx)
  }
})

test('addItem — ajout joueur en campagne (autoValidate=false) : jamais débité à l\'ajout', { skip }, async () => {
  const fx = await createFixture()
  try {
    const before = await db('char_sheet').where({ character_id: fx.owner.id }).first('sols')
    const { item } = await addItem(fx.owner.id, { equipment_id: fx.pricedRef.id, quantity: 1 }, false, false)
    assert.equal(item.validated_by_gm, false)
    const after = await db('char_sheet').where({ character_id: fx.owner.id }).first('sols')
    assert.equal(after.sols, before.sols, 'en attente de validation MJ — débit différé, pas ici')
  } finally {
    await cleanup(fx)
  }
})

test('updateItem — validation MJ (validated_by_gm false→true) avec sols suffisants : débite le prix', { skip }, async () => {
  const fx = await createFixture()
  try {
    const { item: pending } = await addItem(fx.owner.id, { equipment_id: fx.pricedRef.id, quantity: 1 }, false, false)
    const before = await db('char_sheet').where({ character_id: fx.owner.id }).first('sols')
    const { item } = await updateItem(fx.owner.id, pending.id, { validated_by_gm: true })
    assert.equal(item.validated_by_gm, true)
    const after = await db('char_sheet').where({ character_id: fx.owner.id }).first('sols')
    assert.equal(after.sols, before.sols - fx.pricedRef.price)
  } finally {
    await cleanup(fx)
  }
})

test('updateItem — validation MJ avec sols insuffisants : rejette, reste en attente, aucun débit', { skip }, async () => {
  const fx = await createFixture()
  try {
    const { item: pending } = await addItem(fx.owner.id, { equipment_id: fx.pricedRef.id, quantity: 1 }, false, false)
    await db('char_sheet').where({ character_id: fx.owner.id }).update({ sols: fx.pricedRef.price - 1 })
    await assert.rejects(
      () => updateItem(fx.owner.id, pending.id, { validated_by_gm: true }),
      AppError
    )
    const after = await db('char_sheet').where({ character_id: fx.owner.id }).first('sols')
    assert.equal(after.sols, fx.pricedRef.price - 1, 'aucun débit')
    const stillPending = await db('char_inventory').where({ id: pending.id }).first('validated_by_gm')
    assert.equal(stillPending.validated_by_gm, false, 'reste en attente — la transaction doit être annulée')
  } finally {
    await cleanup(fx)
  }
})

test.after(async () => { await db.destroy() })
