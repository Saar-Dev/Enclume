import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { AppError } from '../lib/AppError.js'
import { updateItem, applyItemUpdate } from './inventoryService.js'

// PLAN_PRISE_EN_MAIN.md, Lot A0-0 — TESTS DE CARACTÉRISATION du chemin « équiper / déséquiper » de `updateItem`.
//
// Ils FIGENT le comportement ACTUEL avant la scission transactionnelle `applyItemUpdate` / `updateItem` (Lot A0-1) : ils
// doivent passer sur le code d'aujourd'hui et rester verts, INCHANGÉS, après la scission. Un test qui échoue ici n'est pas
// « à corriger » : soit il décrit mal le comportement actuel (à réparer ici), soit la scission l'a changé (à réparer là-bas).
// Couvre ce que `inventoryService.test.mjs` ne couvre pas (il ne teste `updateItem` que pour les Sols, l'intégrité et la
// quantité) : mains, deux-mains, Sac requis, Sac / Ceinture, bouclier composite, armure 1+S+S, cascade du Sac vers le
// Coffre, déséquipement avec conteneur explicite, chargeur initial.
//
// Fixtures créées puis supprimées (même patron que inventoryService.test.mjs). Lancement manuel, base locale :
//   node --env-file=.env --test server/src/services/inventoryEquip.test.mjs
const skip = !process.env.DATABASE_URL

async function createFixture({ backpack = true, belt = false } = {}) {
  const [gm] = await db('users')
    .insert({ email: `inv-equip-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'inv-equip-gm' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test equip', invite_code: `EQUIP-${Date.now()}-${Math.random()}` })
    .returning('*')
  const [owner] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Proprietaire', type: 'pj' })
    .returning('*')
  const [other] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Autre', type: 'pj' })
    .returning('*')

  // Catalogue : jamais un `id` ni un nom en dur quand une propriété métier suffit (les seeds ne garantissent que la clé métier).
  const sacRef = await db('ref_equipment').where({ location: 'D' }).orderBy('name').first()
  const beltRef = await db('ref_equipment').where({ location: 'Ce' }).orderBy('name').first()
  const meleeRef = await db('ref_equipment').where({ category: 'Arme de contact', location: 'M' }).whereNull('caliber').orderBy('name').first()
  const twoHandRef = await db('ref_equipment').where({ location: '2M' }).orderBy('name').first()
  const shieldSmallRef = await db('ref_equipment').where({ category: 'Bouclier' }).whereNull('shield_extra_locations').first()
  const shieldMediumRef = await db('ref_equipment').where({ category: 'Bouclier', shield_extra_locations: 'C' }).first()
  const armorRefs = await db('ref_equipment').where({ location: 'C' }).where('malus_cat', 'C').orderBy('name').limit(2)
  const gunCandidates = await db('ref_equipment')
    .where({ family: 'Armes', location: 'M' }).whereNotNull('caliber').whereNotNull('ammo_count').orderBy('name')
  const gunRef = gunCandidates.find(r => parseInt(String(r.ammo_count).match(/\d+/)?.[0] ?? '0', 10) > 0)
  assert.ok(sacRef && beltRef && meleeRef && twoHandRef && shieldSmallRef && shieldMediumRef && armorRefs.length === 2 && gunRef,
    'catalogue de test incomplet')

  const insertItem = async (charId, refId, container, extra = {}) => {
    const [row] = await db('char_inventory')
      .insert({ character_id: charId, equipment_id: refId, container, quantity: 1, validated_by_gm: true, ...extra })
      .returning('*')
    return row
  }
  const putInSlot = (item, slot) =>
    db('char_inventory_slots').insert({ char_inventory_id: item.id, character_id: item.character_id, slot_code: slot })

  // Sac à dos équipé (slot D) : la règle PI2 exige un Sac disponible pour équiper quoi que ce soit.
  const backpackItem = backpack ? await insertItem(owner.id, sacRef.id, 'Sac') : null
  if (backpackItem) await putInSlot(backpackItem, 'D')
  // Ceinture équipée (slot Ce) : rend le conteneur « Ceinture » disponible.
  const beltItem = belt ? await insertItem(owner.id, beltRef.id, 'Ceinture') : null
  if (beltItem) await putInSlot(beltItem, 'Ce')

  return {
    gm, campaign, owner, other,
    sacRef, beltRef, meleeRef, twoHandRef, shieldSmallRef, shieldMediumRef, armorRefs, gunRef,
    backpackItem, beltItem, insertItem, putInSlot,
  }
}

async function cleanup({ campaign, gm }) {
  await db('campaigns').where({ id: campaign.id }).del()
  await db('users').where({ id: gm.id }).del()
}

// Enveloppe fixture + nettoyage : une seule forme de test, jamais un oubli de `cleanup`.
async function withFixture(options, fn) {
  const fx = await createFixture(options)
  try { await fn(fx) } finally { await cleanup(fx) }
}

const slotsOf = async (itemId) => (await db('char_inventory_slots').where({ char_inventory_id: itemId }).pluck('slot_code')).sort()
const rowOf = (itemId) => db('char_inventory').where({ id: itemId }).first()
const appError = (statusCode, pattern) => (err) =>
  err instanceof AppError && err.statusCode === statusCode && pattern.test(err.message)

// ─── Armes en main ───────────────────────────────────────────────────────────────────────────────────

test('équiper une arme à une main en MD : slot MD, conteneur forcé à « Sac » même depuis la Ceinture', { skip }, async () => {
  await withFixture({ belt: true }, async (fx) => {
    const weapon = await fx.insertItem(fx.owner.id, fx.meleeRef.id, 'Ceinture')
    const result = await updateItem(fx.owner.id, weapon.id, { slot: 'MD' })
    assert.equal(result.item.id, weapon.id)
    assert.deepEqual(await slotsOf(weapon.id), ['MD'])
    assert.equal((await rowOf(weapon.id)).container, 'Sac')
  })
})

test('équiper une arme à deux mains (2M) quand les deux mains sont libres : slot 2M', { skip }, async () => {
  await withFixture({}, async (fx) => {
    const weapon = await fx.insertItem(fx.owner.id, fx.twoHandRef.id, 'Sac')
    await updateItem(fx.owner.id, weapon.id, { slot: '2M' })
    assert.deepEqual(await slotsOf(weapon.id), ['2M'])
  })
})

test('une arme à deux mains est refusée (409) si une main est prise : rien n\'est écrit', { skip }, async () => {
  await withFixture({}, async (fx) => {
    const inHand = await fx.insertItem(fx.owner.id, fx.meleeRef.id, 'Sac')
    await fx.putInSlot(inHand, 'MD')
    const weapon = await fx.insertItem(fx.owner.id, fx.twoHandRef.id, 'Sac')
    await assert.rejects(updateItem(fx.owner.id, weapon.id, { slot: '2M' }), appError(409, /Mains déjà occupées/))
    assert.deepEqual(await slotsOf(weapon.id), [])
    assert.deepEqual(await slotsOf(inHand.id), ['MD'])
  })
})

test('une arme à une main est refusée (409) si un deux-mains est équipé', { skip }, async () => {
  await withFixture({}, async (fx) => {
    const twoHand = await fx.insertItem(fx.owner.id, fx.twoHandRef.id, 'Sac')
    await fx.putInSlot(twoHand, '2M')
    const weapon = await fx.insertItem(fx.owner.id, fx.meleeRef.id, 'Sac')
    await assert.rejects(updateItem(fx.owner.id, weapon.id, { slot: 'MD' }), appError(409, /Arme à 2 mains déjà équipée/))
    assert.deepEqual(await slotsOf(weapon.id), [])
  })
})

test('une arme à une main est refusée (409) si la main visée est déjà prise', { skip }, async () => {
  await withFixture({}, async (fx) => {
    const inHand = await fx.insertItem(fx.owner.id, fx.meleeRef.id, 'Sac')
    await fx.putInSlot(inHand, 'MD')
    const weapon = await fx.insertItem(fx.owner.id, fx.meleeRef.id, 'Sac')
    await assert.rejects(updateItem(fx.owner.id, weapon.id, { slot: 'MD' }), appError(409, /Slot MD déjà occupé/))
    // L'autre main reste libre : la même arme s'équipe en MG.
    await updateItem(fx.owner.id, weapon.id, { slot: 'MG' })
    assert.deepEqual(await slotsOf(weapon.id), ['MG'])
  })
})

test('règle PI2 : sans Sac à dos équipé, aucune arme ne peut être équipée (400)', { skip }, async () => {
  await withFixture({ backpack: false }, async (fx) => {
    const weapon = await fx.insertItem(fx.owner.id, fx.meleeRef.id, 'Coffre')
    await assert.rejects(updateItem(fx.owner.id, weapon.id, { slot: 'MD' }), appError(400, /Sac non disponible/))
    assert.deepEqual(await slotsOf(weapon.id), [])
  })
})

test('l\'objet d\'un autre personnage est introuvable (404) : jamais équipé', { skip }, async () => {
  await withFixture({}, async (fx) => {
    const weapon = await fx.insertItem(fx.owner.id, fx.meleeRef.id, 'Sac')
    await assert.rejects(updateItem(fx.other.id, weapon.id, { slot: 'MD' }), appError(404, /Item not found/))
    assert.deepEqual(await slotsOf(weapon.id), [])
  })
})

// ─── Déséquiper : le conteneur doit être passé explicitement ─────────────────────────────────────────

test('déséquiper vers la Ceinture : slots vidés, conteneur explicite appliqué', { skip }, async () => {
  await withFixture({ belt: true }, async (fx) => {
    const weapon = await fx.insertItem(fx.owner.id, fx.meleeRef.id, 'Sac')
    await fx.putInSlot(weapon, 'MD')
    await updateItem(fx.owner.id, weapon.id, { slot: null, container: 'Ceinture' })
    assert.deepEqual(await slotsOf(weapon.id), [])
    assert.equal((await rowOf(weapon.id)).container, 'Ceinture')
  })
})

test('déséquiper vers la Ceinture sans Ceinture équipée : refusé (400), l\'arme reste en main', { skip }, async () => {
  await withFixture({ belt: false }, async (fx) => {
    const weapon = await fx.insertItem(fx.owner.id, fx.meleeRef.id, 'Sac')
    await fx.putInSlot(weapon, 'MD')
    await assert.rejects(updateItem(fx.owner.id, weapon.id, { slot: null, container: 'Ceinture' }), appError(400, /non disponible/))
    assert.deepEqual(await slotsOf(weapon.id), ['MD'])
    assert.equal((await rowOf(weapon.id)).container, 'Sac')
  })
})

// ─── Sac à dos et Ceinture ───────────────────────────────────────────────────────────────────────────

test('équiper le Sac (D) puis la Ceinture (Ce) : leur conteneur devient « Sac » / « Ceinture », sans exiger de Sac déjà équipé', { skip }, async () => {
  await withFixture({ backpack: false }, async (fx) => {
    const backpack = await fx.insertItem(fx.owner.id, fx.sacRef.id, 'Coffre')
    await updateItem(fx.owner.id, backpack.id, { slot: 'D' })
    assert.deepEqual(await slotsOf(backpack.id), ['D'])
    assert.equal((await rowOf(backpack.id)).container, 'Sac')

    const belt = await fx.insertItem(fx.owner.id, fx.beltRef.id, 'Coffre')
    await updateItem(fx.owner.id, belt.id, { slot: 'Ce' })
    assert.deepEqual(await slotsOf(belt.id), ['Ce'])
    assert.equal((await rowOf(belt.id)).container, 'Ceinture')
  })
})

test('un second Sac ne peut pas être équipé quand le slot D est pris (409)', { skip }, async () => {
  await withFixture({}, async (fx) => {
    const second = await fx.insertItem(fx.owner.id, fx.sacRef.id, 'Coffre')
    await assert.rejects(updateItem(fx.owner.id, second.id, { slot: 'D' }), appError(409, /Slot déjà occupé/))
    assert.deepEqual(await slotsOf(second.id), [])
  })
})

test('déséquiper le Sac : refusé (409) tant que le bac contient un objet ; avec confirmation, le contenu part au Coffre (cascade)', { skip }, async () => {
  await withFixture({}, async (fx) => {
    const content = await fx.insertItem(fx.owner.id, fx.meleeRef.id, 'Sac')
    await assert.rejects(
      updateItem(fx.owner.id, fx.backpackItem.id, { slot: null }),
      appError(409, /contient encore 1 objet/),
    )
    assert.deepEqual(await slotsOf(fx.backpackItem.id), ['D'])
    assert.equal((await rowOf(content.id)).container, 'Sac')

    const result = await updateItem(fx.owner.id, fx.backpackItem.id, { slot: null, confirmEmptyContainer: true })
    assert.deepEqual(await slotsOf(fx.backpackItem.id), [])
    assert.equal((await rowOf(content.id)).container, 'Coffre')
    assert.deepEqual(result.cascadedItems.map(i => i.id), [content.id])
  })
})

// ─── Bouclier : slot composite tout-ou-rien (main + bras + localisations d'armure) ──────────────────

test('bouclier Petit en MD : main + bras droit ; bouclier Moyen en MG : main + bras gauche + torse (chaîne composée par le serveur)', { skip }, async () => {
  await withFixture({}, async (fx) => {
    const small = await fx.insertItem(fx.owner.id, fx.shieldSmallRef.id, 'Sac')
    await updateItem(fx.owner.id, small.id, { slot: 'MD' })
    assert.deepEqual(await slotsOf(small.id), ['BD', 'MD'])
    assert.equal((await rowOf(small.id)).container, 'Sac')

    const medium = await fx.insertItem(fx.owner.id, fx.shieldMediumRef.id, 'Sac')
    await updateItem(fx.owner.id, medium.id, { slot: 'MG' })
    assert.deepEqual(await slotsOf(medium.id), ['BG', 'C', 'MG'])
  })
})

test('bouclier : seul le choix de la main est accepté (400) ; une main déjà prise est refusée (409)', { skip }, async () => {
  await withFixture({}, async (fx) => {
    const shield = await fx.insertItem(fx.owner.id, fx.shieldSmallRef.id, 'Sac')
    await assert.rejects(updateItem(fx.owner.id, shield.id, { slot: 'C' }), appError(400, /Bouclier : choisir la main/))

    const inHand = await fx.insertItem(fx.owner.id, fx.meleeRef.id, 'Sac')
    await fx.putInSlot(inHand, 'MG')
    await assert.rejects(updateItem(fx.owner.id, shield.id, { slot: 'MG' }), appError(409, /Slot MG déjà occupé/))
    assert.deepEqual(await slotsOf(shield.id), [])
  })
})

test('déséquiper un bouclier libère sa main ET ses localisations d\'armure', { skip }, async () => {
  await withFixture({}, async (fx) => {
    const shield = await fx.insertItem(fx.owner.id, fx.shieldMediumRef.id, 'Sac')
    await updateItem(fx.owner.id, shield.id, { slot: 'MG' })
    assert.deepEqual(await slotsOf(shield.id), ['BG', 'C', 'MG'])
    await updateItem(fx.owner.id, shield.id, { slot: null })
    assert.deepEqual(await slotsOf(shield.id), [])
    // La main est libre : une arme s'y équipe.
    const weapon = await fx.insertItem(fx.owner.id, fx.meleeRef.id, 'Sac')
    await updateItem(fx.owner.id, weapon.id, { slot: 'MG' })
    assert.deepEqual(await slotsOf(weapon.id), ['MG'])
  })
})

// ─── Armure : règle 1 principale + 2 supplémentaires (1+S+S) ─────────────────────────────────────────

test('armure : une protection principale par localisation — la seconde est refusée (409, règle 1+S+S)', { skip }, async () => {
  await withFixture({}, async (fx) => {
    const first = await fx.insertItem(fx.owner.id, fx.armorRefs[0].id, 'Sac')
    const second = await fx.insertItem(fx.owner.id, fx.armorRefs[1].id, 'Sac')
    await updateItem(fx.owner.id, first.id, { slot: 'C' })
    assert.deepEqual(await slotsOf(first.id), ['C'])
    assert.equal((await rowOf(first.id)).container, 'Sac')
    await assert.rejects(updateItem(fx.owner.id, second.id, { slot: 'C' }), appError(409, /règle 1\+S\+S/))
    assert.deepEqual(await slotsOf(second.id), [])
  })
})

test('armure : une localisation ne porte jamais plus de 3 couches (409)', { skip }, async () => {
  await withFixture({}, async (fx) => {
    for (let i = 0; i < 3; i += 1) {
      const layer = await fx.insertItem(fx.owner.id, fx.armorRefs[i % 2].id, 'Sac')
      await fx.putInSlot(layer, 'C')
    }
    const fourth = await fx.insertItem(fx.owner.id, fx.armorRefs[0].id, 'Sac')
    await assert.rejects(updateItem(fx.owner.id, fourth.id, { slot: 'C' }), appError(409, /maximum 3 couches/))
    assert.deepEqual(await slotsOf(fourth.id), [])
  })
})

test('règle PI2 : sans Sac à dos équipé, aucune armure ne peut être équipée (400)', { skip }, async () => {
  await withFixture({ backpack: false }, async (fx) => {
    const armor = await fx.insertItem(fx.owner.id, fx.armorRefs[0].id, 'Coffre')
    await assert.rejects(updateItem(fx.owner.id, armor.id, { slot: 'C' }), appError(400, /Sac non disponible/))
    assert.deepEqual(await slotsOf(armor.id), [])
  })
})

// ─── Chargeur initial à la première mise en main (R16 du plan : règle actuelle gardée) ───────────────

test('première mise en main d\'une arme à calibre : chargeur plein initialisé, aucun stock consommé', { skip }, async () => {
  await withFixture({}, async (fx) => {
    const capacity = parseInt(String(fx.gunRef.ammo_count).match(/\d+/)[0], 10)
    const gun = await fx.insertItem(fx.owner.id, fx.gunRef.id, 'Sac')
    assert.equal(gun.ammo_remaining, null)
    await updateItem(fx.owner.id, gun.id, { slot: 'MD' })
    const after = await rowOf(gun.id)
    assert.equal(after.ammo_remaining, capacity)
    assert.equal(after.current_ammo, null)
  })
})

test('un chargeur déjà renseigné est conservé à la mise en main (rangé puis ré-équipé : jamais réinitialisé)', { skip }, async () => {
  await withFixture({}, async (fx) => {
    const gun = await fx.insertItem(fx.owner.id, fx.gunRef.id, 'Sac', { ammo_remaining: 3 })
    await updateItem(fx.owner.id, gun.id, { slot: 'MD' })
    assert.equal((await rowOf(gun.id)).ammo_remaining, 3)
    await updateItem(fx.owner.id, gun.id, { slot: null, container: 'Sac' })
    await updateItem(fx.owner.id, gun.id, { slot: 'MG' })
    assert.equal((await rowOf(gun.id)).ammo_remaining, 3)
  })
})

// ─── Lot A0-2 : `applyItemUpdate` — plusieurs écritures dans UNE transaction (base de « Permuter ») ─────────────────
// Contrairement aux tests ci-dessus (caractérisation : comportement d'AVANT la scission, inchangé), ceux-ci décrivent le
// contrat NOUVEAU du cœur transactionnel : ses lectures voient les écritures non validées de la même transaction, et un
// échec annule tout ce qui précède.

test('applyItemUpdate — la main libérée par une première écriture est vue libre par la seconde, dans la même transaction', { skip }, async () => {
  await withFixture({ belt: true }, async (fx) => {
    const outgoing = await fx.insertItem(fx.owner.id, fx.meleeRef.id, 'Sac')
    await fx.putInSlot(outgoing, 'MD')
    const incoming = await fx.insertItem(fx.owner.id, fx.meleeRef.id, 'Ceinture')

    await db.transaction(async (trx) => {
      await applyItemUpdate(trx, fx.owner.id, outgoing.id, { slot: null, container: 'Ceinture' })
      await applyItemUpdate(trx, fx.owner.id, incoming.id, { slot: 'MD' })
    })

    assert.deepEqual(await slotsOf(outgoing.id), [])
    assert.equal((await rowOf(outgoing.id)).container, 'Ceinture')
    assert.deepEqual(await slotsOf(incoming.id), ['MD'])
    assert.equal((await rowOf(incoming.id)).container, 'Sac')
  })
})

test('applyItemUpdate — la seconde écriture échoue : la première est annulée, rien n\'est écrit', { skip }, async () => {
  await withFixture({ belt: true }, async (fx) => {
    const outgoing = await fx.insertItem(fx.owner.id, fx.meleeRef.id, 'Sac')
    await fx.putInSlot(outgoing, 'MD')
    const otherHand = await fx.insertItem(fx.owner.id, fx.meleeRef.id, 'Sac')
    await fx.putInSlot(otherHand, 'MG')
    const twoHand = await fx.insertItem(fx.owner.id, fx.twoHandRef.id, 'Ceinture')

    // MD libérée, mais MG reste prise : le deux-mains est refusé, et le rangement de MD doit être annulé avec lui.
    await assert.rejects(
      db.transaction(async (trx) => {
        await applyItemUpdate(trx, fx.owner.id, outgoing.id, { slot: null, container: 'Ceinture' })
        await applyItemUpdate(trx, fx.owner.id, twoHand.id, { slot: '2M' })
      }),
      appError(409, /Mains déjà occupées/),
    )

    assert.deepEqual(await slotsOf(outgoing.id), ['MD'])
    assert.equal((await rowOf(outgoing.id)).container, 'Sac')
    assert.deepEqual(await slotsOf(otherHand.id), ['MG'])
    assert.deepEqual(await slotsOf(twoHand.id), [])
    assert.equal((await rowOf(twoHand.id)).container, 'Ceinture')
  })
})

test('applyItemUpdate — une cascade (déséquiper le Sac) ne rend que des identifiants : la relecture est à l\'appelant, après le commit', { skip }, async () => {
  await withFixture({}, async (fx) => {
    const content = await fx.insertItem(fx.owner.id, fx.meleeRef.id, 'Sac')
    const result = await db.transaction(trx =>
      applyItemUpdate(trx, fx.owner.id, fx.backpackItem.id, { slot: null, confirmEmptyContainer: true }))
    assert.deepEqual(result, { cascadedItemIds: [content.id] })
    assert.equal((await rowOf(content.id)).container, 'Coffre')
  })
})

test.after(async () => { await db.destroy() })
