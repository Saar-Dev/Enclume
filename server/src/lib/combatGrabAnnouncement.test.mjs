import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { validateGrabDeclaration, isGrabbedInHand, buildGrabActionRow } from './combatGrabAnnouncement.js'
import { GRAB_REFUSAL } from '../../../shared/combatGrabItem.js'

// PLAN_PRISE_EN_MAIN.md, Lot A3 — l'ANNONCE de « Permuter » : validation structurelle du contrat
// `mapActions.grab = { itemId, replaceItemId? }`, objet entrant accepté « en main » pour une attaque du même Tour, ligne `combat_actions`.
// Cas purs : dépendances injectées (aucune base). Cas réels (skip sans DATABASE_URL) : identifiants forgés, ligne d'un autre personnage.
// Lancement manuel, base locale : node --env-file=.env --test server/src/lib/combatGrabAnnouncement.test.mjs
const skip = !process.env.DATABASE_URL

const character = { id: 'char-1' }
const ok = (over = {}) => ({ ok: true, alreadyInHand: false, itemId: 'grenade-1', container: 'Ceinture', refLocation: 'M', ...over })
const deps = (over = {}) => ({ describe: async () => ok(), belongs: async () => true, ...over })
const validate = (grab, mapActions = { grab }, over = {}, d = deps()) =>
  validateGrabDeclaration({ grab, character, mapActions, ...over }, d)

// ─── Forme du contrat (jamais fiable : c'est un payload client) ───────────────────────────────────────────────────────

test('validateGrabDeclaration — drone et exo-armure : refus (Permuter est réservé aux personnages)', async () => {
  assert.equal((await validate({ itemId: 'grenade-1' }, undefined, { isDrone: true })).ok, false)
  assert.equal((await validate({ itemId: 'grenade-1' }, undefined, { isExo: true })).ok, false)
})

test('validateGrabDeclaration — R9, une seule permutation par Tour : un tableau, null ou un scalaire est refusé', async () => {
  for (const grab of [[{ itemId: 'a' }, { itemId: 'b' }], [], null, 'grenade-1', 42]) {
    const v = await validate(grab)
    assert.equal(v.ok, false, JSON.stringify(grab))
    assert.match(v.message, /une seule permutation par Tour/)
  }
})

test('validateGrabDeclaration — identifiants non textuels (objet, nombre, absent) : refus « objet invalide »', async () => {
  for (const grab of [{}, { itemId: 12 }, { itemId: { $ne: null } }, { itemId: 'ok', replaceItemId: 7 }, { itemId: 'ok', replaceItemId: {} }]) {
    const v = await validate(grab)
    assert.equal(v.ok, false, JSON.stringify(grab))
    assert.match(v.message, /objet invalide/)
  }
})

// ─── Structure de l'objet entrant ────────────────────────────────────────────────────────────────────────────────────

test('validateGrabDeclaration — chaque refus structurel a son message ; « déjà en main » est refusé aussi', async () => {
  const expected = {
    [GRAB_REFUSAL.NOT_FOUND]: /introuvable/,
    [GRAB_REFUSAL.NOT_CARRIED]: /ni dans le Sac ni à la Ceinture/,
    [GRAB_REFUSAL.EQUIPPED]: /déjà porté/,
    [GRAB_REFUSAL.NOT_HOLDABLE]: /ne se tient pas à la main/,
  }
  for (const [reason, pattern] of Object.entries(expected)) {
    const v = await validate({ itemId: 'x' }, undefined, {}, deps({ describe: async () => ({ ok: false, reason }) }))
    assert.equal(v.ok, false)
    assert.match(v.message, pattern)
  }
  const already = await validate({ itemId: 'x' }, undefined, {}, deps({ describe: async () => ok({ alreadyInHand: true }) }))
  assert.match(already.message, /déjà en main/)
})

// ─── Ligne à remplacer ───────────────────────────────────────────────────────────────────────────────────────────────

test('validateGrabDeclaration — la ligne à remplacer : refusée si c\'est l\'objet entrant ou si elle n\'appartient pas au personnage', async () => {
  const same = await validate({ itemId: 'grenade-1', replaceItemId: 'grenade-1' })
  assert.match(same.message, /objet à remplacer introuvable/)
  const foreign = await validate({ itemId: 'grenade-1', replaceItemId: 'pistolet-etranger' }, undefined, {}, deps({ belongs: async () => false }))
  assert.match(foreign.message, /objet à remplacer introuvable/)
})

test('validateGrabDeclaration — la ligne à remplacer est contrôlée pour le BON personnage', async () => {
  const seen = []
  const v = await validate({ itemId: 'grenade-1', replaceItemId: 'pistolet-1' }, undefined, {}, deps({
    belongs: async (charId, itemId) => { seen.push([charId, itemId]); return true },
  }))
  assert.equal(v.ok, true)
  assert.deepEqual(seen, [['char-1', 'pistolet-1']])
})

// ─── Déclaration valide ──────────────────────────────────────────────────────────────────────────────────────────────

test('validateGrabDeclaration — déclaration valide : conteneur RÉEL lu en base (jamais celui du client), main visée déduite de l\'emplacement', async () => {
  const cases = [
    ['M', ['MG', 'MD']],        // une main (grenade, pistolet, bouclier)
    ['2M', ['2M']],             // deux mains
    ['2M/Tr', ['2M']],          // arme lourde : deux mains
  ]
  for (const [refLocation, targetSlots] of cases) {
    const v = await validate({ itemId: 'grenade-1', container: 'Coffre', ini_mod: -99 }, undefined, {},
      deps({ describe: async () => ok({ container: 'Ceinture', refLocation }) }))
    assert.equal(v.ok, true, refLocation)
    assert.deepEqual(v.declaration, { itemId: 'grenade-1', container: 'Ceinture', replaceItemId: null, targetSlots }, refLocation)
  }
})

test('validateGrabDeclaration — « Mains nues » : replaceItemId absent ou null vaut null ; présent, il est transporté', async () => {
  assert.equal((await validate({ itemId: 'grenade-1' })).declaration.replaceItemId, null)
  assert.equal((await validate({ itemId: 'grenade-1', replaceItemId: null })).declaration.replaceItemId, null)
  assert.equal((await validate({ itemId: 'grenade-1', replaceItemId: 'pistolet-1' })).declaration.replaceItemId, 'pistolet-1')
})

// ─── Exclusivité de l'Action simple (Sac) ────────────────────────────────────────────────────────────────────────────

test('validateGrabDeclaration — depuis le Sac (Action simple) : refusé avec un tir, un CaC ou un rechargement ; depuis la Ceinture : compatible', async () => {
  const fromSac = deps({ describe: async () => ok({ container: 'Sac' }) })
  const grab = { itemId: 'grenade-1' }
  for (const [key, value, word] of [['attack', [{}], 'tir'], ['melee', [{}], 'corps à corps'], ['reload', {}, 'rechargement']]) {
    const v = await validate(grab, { grab, [key]: value }, {}, fromSac)
    assert.equal(v.ok, false, key)
    assert.match(v.message, new RegExp(word), key)
  }
  assert.equal((await validate(grab, { grab, move: {} }, {}, fromSac)).ok, true) // le déplacement ne gêne pas
  assert.equal((await validate(grab, { grab, attack: [{}], melee: undefined, reload: {} })).ok, true) // Ceinture : Préparation, tout est permis
})

// ─── Objet entrant accepté « en main » pour l'attaque du même Tour ────────────────────────────────────────────────────

test('isGrabbedInHand — l\'objet entrant est « en main » pour le site d\'annonce si sa main visée y est permise', () => {
  const oneHand = { itemId: 'g', targetSlots: ['MG', 'MD'] }
  const twoHands = { itemId: 'r', targetSlots: ['2M'] }
  const ALL = ['MG', 'MD', '2M', 'Tr']
  assert.equal(isGrabbedInHand(oneHand, 'g', ALL), true)                 // Tir principal
  assert.equal(isGrabbedInHand(oneHand, 'g', ['MG', 'MD']), true)        // arme secondaire (Tir ou CaC)
  assert.equal(isGrabbedInHand(twoHands, 'r', ALL), true)
  assert.equal(isGrabbedInHand(twoHands, 'r', ['MG', 'MD', '2M']), true) // CaC principal
  assert.equal(isGrabbedInHand(twoHands, 'r', ['MG', 'MD']), false)      // une arme à deux mains n'est jamais une arme secondaire
})

test('isGrabbedInHand — un autre objet, aucune permutation, ou aucun objet : jamais « en main »', () => {
  const decl = { itemId: 'g', targetSlots: ['MG', 'MD'] }
  assert.equal(isGrabbedInHand(decl, 'autre', ['MG', 'MD']), false)
  assert.equal(isGrabbedInHand(null, 'g', ['MG', 'MD']), false)
  assert.equal(isGrabbedInHand(undefined, 'g', ['MG', 'MD']), false)
  assert.equal(isGrabbedInHand(decl, undefined, ['MG', 'MD']), false)
  assert.equal(isGrabbedInHand(decl, null, ['MG', 'MD']), false)
})

// ─── Ligne combat_actions ────────────────────────────────────────────────────────────────────────────────────────────

test('buildGrabActionRow — type micro (aucune migration), sequence 2, coût d\'Initiative par conteneur, objets transportés', () => {
  const row = buildGrabActionRow({ itemId: 'g', container: 'Ceinture', replaceItemId: 'p', targetSlots: ['MG', 'MD'] }, { campaignId: 'c', tokenId: 't' })
  assert.deepEqual({ ...row, modifiers: JSON.parse(row.modifiers) }, {
    campaign_id: 'c', token_id: 't', action_key: 'grab_item', type: 'micro', sequence: 2, status: 'pending',
    modifiers: { ini_mod: -3, itemId: 'g', container: 'Ceinture', replaceItemId: 'p' },
  })
  const fromSac = buildGrabActionRow({ itemId: 'g', container: 'Sac', replaceItemId: null, targetSlots: ['2M'] }, { campaignId: 'c', tokenId: 't' })
  assert.deepEqual(JSON.parse(fromSac.modifiers), { ini_mod: 0, itemId: 'g', container: 'Sac', replaceItemId: null })
})

// ─── Cas réels en base : identifiants forgés, ligne d'un autre personnage ─────────────────────────────────────────────

test('en base : ligne à remplacer réelle acceptée ; celle d\'un autre personnage, un identifiant mal formé ou inconnu : refusés sans exception', { skip }, async () => {
  const [gm] = await db('users').insert({ email: `ann-grab-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'ann-grab-gm' }).returning('*')
  try {
    const [campaign] = await db('campaigns').insert({ gm_id: gm.id, name: 'Campagne test annonce permutation', invite_code: `ANN-${Date.now()}-${Math.random()}` }).returning('*')
    const [owner] = await db('characters').insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Proprietaire', type: 'pj' }).returning('*')
    const [other] = await db('characters').insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Autre', type: 'pj' }).returning('*')
    const grenadeRef = await db('ref_equipment').where({ name: 'Grenade à fragmentation' }).first()
    const twoHandRef = await db('ref_equipment').where({ location: '2M' }).first()
    assert.ok(grenadeRef && twoHandRef, 'catalogue de test incomplet')
    const add = async (charId, ref, container) => (await db('char_inventory')
      .insert({ character_id: charId, equipment_id: ref.id, container, quantity: 1, validated_by_gm: true }).returning('*'))[0]
    const grenade = await add(owner.id, grenadeRef, 'Ceinture')
    const held = await add(owner.id, twoHandRef, 'Sac')
    const foreign = await add(other.id, twoHandRef, 'Sac')
    const run = (grab) => validateGrabDeclaration({ grab, character: owner, mapActions: { grab } })

    const good = await run({ itemId: grenade.id, replaceItemId: held.id })
    assert.equal(good.ok, true)
    assert.deepEqual(good.declaration, { itemId: grenade.id, container: 'Ceinture', replaceItemId: held.id, targetSlots: ['MG', 'MD'] })

    for (const replaceItemId of [foreign.id, 'pas-un-uuid', '00000000-0000-4000-8000-000000000000']) {
      const v = await run({ itemId: grenade.id, replaceItemId })
      assert.equal(v.ok, false, replaceItemId)
      assert.match(v.message, /objet à remplacer introuvable/)
    }
    assert.match((await run({ itemId: foreign.id })).message, /introuvable/) // l'objet ENTRANT d'un autre personnage
    assert.match((await run({ itemId: 'pas-un-uuid' })).message, /introuvable/)
  } finally {
    await db('campaigns').where({ gm_id: gm.id }).del()
    await db('users').where({ id: gm.id }).del()
  }
})

test.after(async () => { await db.destroy() })
