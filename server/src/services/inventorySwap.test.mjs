import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { swapItemInHand, GRAB_REFUSAL } from './inventoryService.js'

// PLAN_PRISE_EN_MAIN.md, Lot A2 — `swapItemInHand` : « Permuter » côté serveur (état réel en base, transaction, capacité).
// Fixtures créées puis supprimées (même patron que inventoryEquip.test.mjs). Lancement manuel, base locale :
//   node --env-file=.env --test server/src/services/inventorySwap.test.mjs
// Le CHOIX (planHandSwap) et la capacité (planStowDestination) sont testés purs dans shared/combatGrabSwap.test.mjs ; ici :
// ce qui exige la base — l'instantané, les écritures, l'atomicité, les refus d'équipement à code, la concurrence.
const skip = !process.env.DATABASE_URL

async function createFixture({ backpack = true, belt = true } = {}) {
  const [gm] = await db('users')
    .insert({ email: `inv-swap-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'inv-swap-gm' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test permutation', invite_code: `SWAP-${Date.now()}-${Math.random()}` })
    .returning('*')
  const [owner] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Proprietaire', type: 'pj' })
    .returning('*')
  const [other] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Autre', type: 'pj' })
    .returning('*')

  // Catalogue : par propriété métier (jamais par id). Sac de 8 kg et Ceinture de 3 kg : les capacités des exemples du plan.
  const sacRef = await db('ref_equipment').where({ location: 'D' }).whereNotNull('capacity').orderBy('capacity').first()
  const beltRef = await db('ref_equipment').where({ location: 'Ce' }).whereNotNull('capacity').orderBy('capacity').first()
  const grenadeRef = await db('ref_equipment').where({ name: 'Grenade à fragmentation' }).first()
  const meleeRef = await db('ref_equipment').where({ category: 'Arme de contact', location: 'M' }).whereNull('caliber')
    .whereBetween('weight', [0.4, 2]).orderBy('name').first()
  const heavyRef = await db('ref_equipment').where({ location: '2M' }).where('weight', '>', 3).orderBy('weight').first()
  const gunRef = (await db('ref_equipment').where({ family: 'Armes', location: 'M' }).whereNotNull('caliber').whereNotNull('ammo_count').orderBy('name'))
    .find(r => parseInt(String(r.ammo_count).match(/\d+/)?.[0] ?? '0', 10) > 0)
  const shieldSmallRef = await db('ref_equipment').where({ category: 'Bouclier' }).whereNull('shield_extra_locations').first()
  const shieldMediumRef = await db('ref_equipment').where({ category: 'Bouclier', shield_extra_locations: 'C' }).first()
  const armorRefs = await db('ref_equipment').where({ location: 'C' }).where('malus_cat', 'C').orderBy('name').limit(2)
  assert.ok(sacRef && beltRef && grenadeRef && meleeRef && heavyRef && gunRef && shieldSmallRef && shieldMediumRef && armorRefs.length === 2,
    'catalogue de test incomplet')
  assert.ok(Number(beltRef.capacity) < Number(heavyRef.weight), 'la Ceinture de test doit être plus petite que l’arme lourde')

  const insertItem = async (charId, ref, container, extra = {}) => {
    const [row] = await db('char_inventory')
      .insert({ character_id: charId, equipment_id: ref.id, container, quantity: 1, validated_by_gm: true, ...extra })
      .returning('*')
    return row
  }
  const putInSlot = (item, slot) =>
    db('char_inventory_slots').insert({ char_inventory_id: item.id, character_id: item.character_id, slot_code: slot })

  if (backpack) await putInSlot(await insertItem(owner.id, sacRef, 'Sac'), 'D')
  if (belt) await putInSlot(await insertItem(owner.id, beltRef, 'Ceinture'), 'Ce')

  return {
    gm, campaign, owner, other, grenadeRef, meleeRef, heavyRef, gunRef, shieldSmallRef, shieldMediumRef, armorRefs, insertItem, putInSlot,
    // Objet tenu : rangé dans le Sac (conteneur d'un objet équipé) avec son emplacement de main.
    held: async (ref, ...slots) => {
      const row = await insertItem(owner.id, ref, 'Sac')
      for (const slot of slots) await putInSlot(row, slot)
      return row
    },
  }
}

async function cleanup({ campaign, gm }) {
  await db('campaigns').where({ id: campaign.id }).del()
  await db('users').where({ id: gm.id }).del()
}
async function withFixture(options, fn) {
  const fx = await createFixture(options)
  try { await fn(fx) } finally { await cleanup(fx) }
}

const slotsOf = async (itemId) => (await db('char_inventory_slots').where({ char_inventory_id: itemId }).pluck('slot_code')).sort()
const rowOf = (itemId) => db('char_inventory').where({ id: itemId }).first()
// Empreinte de l'inventaire d'un personnage : (id, conteneur, emplacements) — pour prouver qu'un refus n'a RIEN écrit.
async function fingerprint(characterId) {
  const rows = await db('char_inventory as ci').where('ci.character_id', characterId).select('ci.id', 'ci.container')
  const out = []
  for (const r of rows) out.push(`${r.id}:${r.container}:${(await slotsOf(r.id)).join('/')}`)
  return out.sort().join('|')
}

// ─── Mains nues : une main libre reçoit l'objet ──────────────────────────────────────────────────────────────────────

test('Mains nues, mains vides : la grenade du Sac entre en MD, conteneur « Sac » (équipée), rien ne sort', { skip }, async () => {
  await withFixture({}, async (fx) => {
    const grenade = await fx.insertItem(fx.owner.id, fx.grenadeRef, 'Sac')
    const r = await swapItemInHand(fx.owner.id, { incomingId: grenade.id })
    assert.equal(r.status, 'swapped')
    assert.equal(r.slot, 'MD')
    assert.equal(r.fromContainer, 'Sac')
    assert.deepEqual(r.outgoing, [])
    assert.equal(r.item.id, grenade.id)
    assert.deepEqual(r.item.slots, ['MD'])
    assert.deepEqual(await slotsOf(grenade.id), ['MD'])
    assert.equal((await rowOf(grenade.id)).container, 'Sac')
  })
})

test('Mains nues : la grenade de la Ceinture entre dans la main libre (MG si MD est prise)', { skip }, async () => {
  await withFixture({}, async (fx) => {
    const inHand = await fx.held(fx.meleeRef, 'MD')
    const grenade = await fx.insertItem(fx.owner.id, fx.grenadeRef, 'Ceinture')
    const r = await swapItemInHand(fx.owner.id, { incomingId: grenade.id })
    assert.equal(r.status, 'swapped')
    assert.equal(r.slot, 'MG')
    assert.equal(r.fromContainer, 'Ceinture')
    assert.deepEqual(await slotsOf(grenade.id), ['MG'])
    assert.deepEqual(await slotsOf(inHand.id), ['MD'])
  })
})

test('Mains nues, deux mains prises (ou un deux-mains) : refus HANDS_FULL, rien n\'est écrit', { skip }, async () => {
  await withFixture({}, async (fx) => {
    await fx.held(fx.meleeRef, 'MD')
    await fx.held(fx.meleeRef, 'MG')
    const grenade = await fx.insertItem(fx.owner.id, fx.grenadeRef, 'Sac')
    const before = await fingerprint(fx.owner.id)
    assert.deepEqual(await swapItemInHand(fx.owner.id, { incomingId: grenade.id }), { status: 'refused', reason: GRAB_REFUSAL.HANDS_FULL })
    assert.equal(await fingerprint(fx.owner.id), before)
  })
})

// ─── Remplacement : la ligne cliquée sort vers le conteneur d'origine de l'entrant ───────────────────────────────────

test('Remplacement : la grenade de la Ceinture prend la main de l\'arme cliquée, qui est rangée à la Ceinture', { skip }, async () => {
  await withFixture({}, async (fx) => {
    const melee = await fx.held(fx.meleeRef, 'MD')
    const grenade = await fx.insertItem(fx.owner.id, fx.grenadeRef, 'Ceinture')
    const r = await swapItemInHand(fx.owner.id, { incomingId: grenade.id, clickedItemId: melee.id })
    assert.equal(r.status, 'swapped')
    assert.equal(r.slot, 'MD')
    assert.equal(r.stowedIn, 'Ceinture')
    assert.deepEqual(r.outgoing.map(i => i.id), [melee.id])
    assert.deepEqual(await slotsOf(melee.id), [])
    assert.equal((await rowOf(melee.id)).container, 'Ceinture')
    assert.deepEqual(await slotsOf(grenade.id), ['MD'])
    assert.equal((await rowOf(grenade.id)).container, 'Sac')
  })
})

test('Deux-mains entrant : TOUT ce qui est tenu (arme et bouclier) est rangé au Sac, l\'arme prend les deux mains', { skip }, async () => {
  await withFixture({}, async (fx) => {
    const melee = await fx.held(fx.meleeRef, 'MD')
    const shield = await fx.held(fx.shieldSmallRef, 'MG', 'BG')
    const rifle = await fx.insertItem(fx.owner.id, fx.heavyRef, 'Sac')
    const r = await swapItemInHand(fx.owner.id, { incomingId: rifle.id, clickedItemId: melee.id })
    assert.equal(r.status, 'swapped')
    assert.equal(r.slot, '2M')
    assert.deepEqual(r.outgoing.map(i => i.id).sort(), [melee.id, shield.id].sort())
    assert.deepEqual(await slotsOf(rifle.id), ['2M'])
    for (const out of [melee, shield]) {
      assert.deepEqual(await slotsOf(out.id), [])
      assert.equal((await rowOf(out.id)).container, 'Sac')
    }
  })
})

test('Bouclier entrant (objet à une main) : il entre dans la main libre, chaîne composée par le serveur ; ligne cliquée disparue = ignorée', { skip }, async () => {
  await withFixture({}, async (fx) => {
    await fx.held(fx.meleeRef, 'MD')
    const shield = await fx.insertItem(fx.owner.id, fx.shieldMediumRef, 'Sac')
    const r = await swapItemInHand(fx.owner.id, { incomingId: shield.id, clickedItemId: '00000000-0000-4000-8000-000000000000' })
    assert.equal(r.status, 'swapped')
    assert.equal(r.slot, 'MG')
    assert.deepEqual(await slotsOf(shield.id), ['BG', 'C', 'MG'])
  })
})

// ─── Refus faute de place (R17) : aucun objet ne bouge ────────────────────────────────────────────────────────────────

test('Arme trop lourde pour la Ceinture : refus NO_ROOM avec le conteneur et l\'arme, rien n\'est écrit', { skip }, async () => {
  await withFixture({}, async (fx) => {
    const rifle = await fx.held(fx.heavyRef, '2M')
    const grenade = await fx.insertItem(fx.owner.id, fx.grenadeRef, 'Ceinture')
    const before = await fingerprint(fx.owner.id)
    const r = await swapItemInHand(fx.owner.id, { incomingId: grenade.id, clickedItemId: rifle.id })
    assert.deepEqual(r, { status: 'refused', reason: GRAB_REFUSAL.NO_ROOM, container: 'Ceinture', outgoingIds: [rifle.id] })
    assert.equal(await fingerprint(fx.owner.id), before)
  })
})

test('Ceinture non équipée alors que l\'objet y est rangé : refus CONTAINER_UNAVAILABLE, rien n\'est écrit', { skip }, async () => {
  await withFixture({ belt: false }, async (fx) => {
    const melee = await fx.held(fx.meleeRef, 'MD')
    const grenade = await fx.insertItem(fx.owner.id, fx.grenadeRef, 'Ceinture')
    const before = await fingerprint(fx.owner.id)
    const r = await swapItemInHand(fx.owner.id, { incomingId: grenade.id, clickedItemId: melee.id })
    assert.equal(r.status, 'refused')
    assert.equal(r.reason, GRAB_REFUSAL.CONTAINER_UNAVAILABLE)
    assert.equal(await fingerprint(fx.owner.id), before)
  })
})

// ─── Refus structurels, Sac requis, idempotence ──────────────────────────────────────────────────────────────────────

test('Sans Sac à dos équipé : refus NO_SAC (règle PI2), rien n\'est écrit', { skip }, async () => {
  await withFixture({ backpack: false }, async (fx) => {
    const grenade = await fx.insertItem(fx.owner.id, fx.grenadeRef, 'Ceinture')
    const before = await fingerprint(fx.owner.id)
    assert.deepEqual(await swapItemInHand(fx.owner.id, { incomingId: grenade.id }), { status: 'refused', reason: GRAB_REFUSAL.NO_SAC })
    assert.equal(await fingerprint(fx.owner.id), before)
  })
})

test('Objet déjà en main : « already », idempotent, aucune écriture', { skip }, async () => {
  await withFixture({}, async (fx) => {
    const grenade = await fx.held(fx.grenadeRef, 'MD')
    const before = await fingerprint(fx.owner.id)
    const r = await swapItemInHand(fx.owner.id, { incomingId: grenade.id })
    assert.equal(r.status, 'already')
    assert.equal(r.item.id, grenade.id)
    assert.equal(await fingerprint(fx.owner.id), before)
  })
})

test('Refus structurels : Coffre, objet d\'un autre, identifiant forgé ou absent, armure rangée, armure portée', { skip }, async () => {
  await withFixture({}, async (fx) => {
    const coffre = await fx.insertItem(fx.owner.id, fx.grenadeRef, 'Coffre')
    const foreign = await fx.insertItem(fx.other.id, fx.grenadeRef, 'Sac')
    const armorSac = await fx.insertItem(fx.owner.id, fx.armorRefs[0], 'Sac')
    const armorWorn = await fx.held(fx.armorRefs[1], 'C')
    const reason = async (incomingId) => (await swapItemInHand(fx.owner.id, { incomingId })).reason
    assert.equal(await reason(coffre.id), GRAB_REFUSAL.NOT_CARRIED)
    assert.equal(await reason(foreign.id), GRAB_REFUSAL.NOT_FOUND)
    assert.equal(await reason('pas-un-uuid'), GRAB_REFUSAL.NOT_FOUND)
    assert.equal(await reason(null), GRAB_REFUSAL.NOT_FOUND)
    assert.equal(await reason(armorSac.id), GRAB_REFUSAL.NOT_HOLDABLE)
    assert.equal(await reason(armorWorn.id), GRAB_REFUSAL.EQUIPPED)
    assert.equal((await swapItemInHand(null, { incomingId: coffre.id })).reason, GRAB_REFUSAL.NOT_FOUND)
  })
})

// ─── Atomicité : un refus d'équipement tardif annule TOUT (R11) ──────────────────────────────────────────────────────

test('Bouclier refusé par les couches d\'armure : ARMOR_LAYERS, et le rangement de l\'arme sortante est ANNULÉ avec lui', { skip }, async () => {
  await withFixture({}, async (fx) => {
    const melee = await fx.held(fx.meleeRef, 'MD')
    for (let i = 0; i < 3; i += 1) await fx.held(fx.armorRefs[i % 2], 'C')      // torse : 3 couches, plein
    const shield = await fx.insertItem(fx.owner.id, fx.shieldMediumRef, 'Ceinture') // localisation C : refusée à l'équipement
    const before = await fingerprint(fx.owner.id)
    const r = await swapItemInHand(fx.owner.id, { incomingId: shield.id, clickedItemId: melee.id })
    assert.deepEqual(r, { status: 'refused', reason: GRAB_REFUSAL.ARMOR_LAYERS })
    // L'arme avait déjà été rangée à la Ceinture dans la transaction : elle est revenue en main, conteneur d'origine.
    assert.deepEqual(await slotsOf(melee.id), ['MD'])
    assert.equal((await rowOf(melee.id)).container, 'Sac')
    assert.equal(await fingerprint(fx.owner.id), before)
  })
})

test('Concurrence : une main prise par une écriture concurrente devient un refus HANDS_FULL, jamais une exception, rien n\'est écrit', { skip }, async () => {
  await withFixture({}, async (fx) => {
    const grenade = await fx.insertItem(fx.owner.id, fx.grenadeRef, 'Sac')
    const intruder = await fx.insertItem(fx.owner.id, fx.meleeRef, 'Sac')
    const before = await fingerprint(fx.owner.id)
    // Une transaction concurrente (la fiche) prend MD sans encore valider : l'instantané de la permutation voit MD libre.
    const concurrent = await db.transaction()
    try {
      await concurrent('char_inventory_slots').insert({ char_inventory_id: intruder.id, character_id: fx.owner.id, slot_code: 'MD' })
      const pending = swapItemInHand(fx.owner.id, { incomingId: grenade.id })
      // On ne valide qu'une fois la permutation RÉELLEMENT bloquée sur l'index unique de MD (attente de verrou signalée par la
      // base) : c'est la voie « erreur 23505 » qui est éprouvée, pas la détection à la validation.
      let blocked = false
      for (let i = 0; i < 60 && !blocked; i += 1) {
        const { rows } = await db.raw("select count(*)::int as n from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'")
        blocked = rows[0].n > 0
        if (!blocked) await new Promise(resolve => setTimeout(resolve, 50))
      }
      assert.ok(blocked, 'la permutation devait attendre l’écriture concurrente sur l’index unique')
      await concurrent.commit()
      assert.deepEqual(await pending, { status: 'refused', reason: GRAB_REFUSAL.HANDS_FULL })
    } catch (err) {
      if (!concurrent.isCompleted()) await concurrent.rollback()
      throw err
    }
    // Seul l'intrus est en main ; la grenade n'a pas bougé.
    assert.deepEqual(await slotsOf(grenade.id), [])
    assert.deepEqual(await slotsOf(intruder.id), ['MD'])
    assert.notEqual(await fingerprint(fx.owner.id), before) // l'intrus, lui, a bien été écrit par SA transaction
  })
})

// ─── Munitions (R16) ─────────────────────────────────────────────────────────────────────────────────────────────────

test('R16 : une arme à calibre jamais équipée reçoit le chargeur plein à sa première mise en main, sans stock consommé', { skip }, async () => {
  await withFixture({}, async (fx) => {
    const capacity = parseInt(String(fx.gunRef.ammo_count).match(/\d+/)[0], 10)
    const gun = await fx.insertItem(fx.owner.id, fx.gunRef, 'Sac')
    assert.equal(gun.ammo_remaining, null)
    const r = await swapItemInHand(fx.owner.id, { incomingId: gun.id })
    assert.equal(r.status, 'swapped')
    assert.equal((await rowOf(gun.id)).ammo_remaining, capacity)
    assert.equal(r.item.ammo_remaining, capacity)
  })
})

test('R16 : la permutation ne touche jamais au chargeur d\'une arme sortante', { skip }, async () => {
  await withFixture({}, async (fx) => {
    const gun = await fx.held(fx.gunRef, 'MD')
    await db('char_inventory').where({ id: gun.id }).update({ ammo_remaining: 3 })
    const grenade = await fx.insertItem(fx.owner.id, fx.grenadeRef, 'Sac')
    const r = await swapItemInHand(fx.owner.id, { incomingId: grenade.id, clickedItemId: gun.id })
    assert.equal(r.status, 'swapped')
    assert.equal((await rowOf(gun.id)).ammo_remaining, 3)
  })
})

test.after(async () => { await db.destroy() })
