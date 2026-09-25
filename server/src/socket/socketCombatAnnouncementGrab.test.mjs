import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { registerAnnouncementHandlers } from './socketCombatAnnouncement.js'
import { WS } from '../../../shared/events.js'

// PLAN_PRISE_EN_MAIN.md, Lot A3 — TRANSPORT RÉEL du payload « Permuter » : le vrai gestionnaire COMBAT_ACTION_DECLARE (avec de faux
// `io` / `socket` qui capturent les émissions), une vraie base (fixtures créées puis supprimées), jusqu'aux lignes `combat_actions`.
// Complète combatGrabAnnouncement.test.mjs (règles isolées) : ici, le CÂBLAGE — payload → validation → ligne → coût d'Initiative,
// et l'objet entrant accepté « en main » par le site d'annonce du Tir. `.claude/rules/combat.md` : « tester le transport réel du payload ».
// Lancement manuel, base locale : node --env-file=.env --test server/src/socket/socketCombatAnnouncementGrab.test.mjs
const skip = !process.env.DATABASE_URL

const STATE = { position: 'standing', weapon: 'ready', fire_mode: 'cc', cover: 'exposed', vitesse: 'normal', combat_mode: 'normal' }

async function createFixture() {
  const [gm] = await db('users')
    .insert({ email: `ann-e2e-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'ann-e2e-gm' }).returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test annonce e2e', invite_code: `E2E-${Date.now()}-${Math.random()}` }).returning('*')
  const [battlemap] = await db('battlemaps').insert({ campaign_id: campaign.id, name: 'Carte test' }).returning('*')
  const [owner] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Kaiser', type: 'pj' }).returning('*')
  const [foe] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Cible', type: 'pnj' }).returning('*')
  const [token] = await db('tokens').insert({ battlemap_id: battlemap.id, character_id: owner.id, label: 'Kaiser', pos_x: 5, pos_y: 5 }).returning('*')
  const [foeToken] = await db('tokens').insert({ battlemap_id: battlemap.id, character_id: foe.id, label: 'Cible', pos_x: 7, pos_y: 5 }).returning('*')
  await db('combat_state').insert({ campaign_id: campaign.id, battlemap_id: battlemap.id, phase: 'ANNOUNCEMENT', current_turn: 1 })
  // Le token testé déclare en PREMIER (base_ini le plus bas) ; la cible garde la file ouverte (aucune bascule en Résolution).
  // `state_weapon: 'ready'` = l'état DÉCLARÉ par STATE : aucune transition d'état (dégainer coûte −3) ne se mêle au coût de la permutation.
  await db('combat_roster').insert([
    { campaign_id: campaign.id, token_id: token.id, base_ini: 5, initiative: 10, state_weapon: 'ready' },
    { campaign_id: campaign.id, token_id: foeToken.id, base_ini: 20, initiative: 8, state_weapon: 'ready' },
  ])

  const sacRef = await db('ref_equipment').where({ location: 'D' }).whereNotNull('capacity').orderBy('capacity').first()
  const beltRef = await db('ref_equipment').where({ location: 'Ce' }).whereNotNull('capacity').orderBy('capacity').first()
  const grenadeRef = await db('ref_equipment').where({ name: 'Grenade à fragmentation' }).first()
  const meleeRef = await db('ref_equipment').where({ category: 'Arme de contact', location: 'M' }).whereNull('caliber').orderBy('name').first()
  const gunRef = await db('ref_equipment')
    .where({ family: 'Armes', location: 'M' }).whereNotNull('fire_mode').where('fire_mode', 'like', '%CC%').whereNotNull('caliber').whereNull('aoe_profile')
    .orderBy('name').first()
  assert.ok(sacRef && beltRef && grenadeRef && meleeRef && gunRef, 'catalogue de test incomplet')
  const add = async (ref, container, extra = {}) => (await db('char_inventory')
    .insert({ character_id: owner.id, equipment_id: ref.id, container, quantity: 1, validated_by_gm: true, ...extra }).returning('*'))[0]
  const putInSlot = (item, slot) => db('char_inventory_slots').insert({ char_inventory_id: item.id, character_id: owner.id, slot_code: slot })
  await putInSlot(await add(sacRef, 'Sac'), 'D')
  await putInSlot(await add(beltRef, 'Ceinture'), 'Ce')
  const inHand = await add(meleeRef, 'Sac')
  await putInSlot(inHand, 'MD')

  // Faux `io` / `socket` : on capture tout ce que le gestionnaire émet.
  const emitted = []
  const io = { to: (room) => ({ emit: (event, data) => emitted.push({ room, event, data }) }) }
  const handlers = new Map()
  const socket = { on: (event, fn) => handlers.set(event, fn), emit: (event, data) => emitted.push({ room: 'socket', event, data }) }
  const pendingMaps = { combatTimers: new Map(), combatPreviews: new Map() }
  registerAnnouncementHandlers(io, socket, { campaignId: campaign.id, user: { id: gm.id, username: 'ann-e2e-gm' }, isGm: true }, pendingMaps)

  const declare = (mapActions) => handlers.get(WS.COMBAT_ACTION_DECLARE)({ tokenId: token.id, state: { ...STATE }, mapActions, quick: { observer: 0, reperer: 0, phrase: false } })
  return {
    gm, campaign, owner, token, foeToken, grenadeRef, gunRef, add, inHand, emitted, declare,
    errors: () => emitted.filter(e => e.event === WS.COMBAT_DECLARE_ERROR).map(e => e.data.message),
    actions: () => db('combat_actions').where({ campaign_id: campaign.id }).orderBy('sequence'),
    roster: () => db('combat_roster').where({ campaign_id: campaign.id, token_id: token.id }).first(),
  }
}

async function cleanup(fx) {
  await db('combat_actions').where({ campaign_id: fx.campaign.id }).del()
  await db('combat_roster').where({ campaign_id: fx.campaign.id }).del()
  await db('combat_state').where({ campaign_id: fx.campaign.id }).del()
  await db('campaigns').where({ id: fx.campaign.id }).del()
  await db('users').where({ id: fx.gm.id }).del()
}
async function withFixture(fn) {
  const fx = await createFixture()
  const originalLog = console.log
  console.log = () => {} // le gestionnaire journalise chaque déclaration
  try { await fn(fx) } finally { console.log = originalLog; await cleanup(fx) }
}

// ─── « Mains nues » et remplacement : la ligne, le coût, l'annonce ───────────────────────────────────────────────────

test('Permuter depuis la Ceinture, sans attaque : ligne grab_item (micro, sequence 2) avec la ligne à remplacer, Initiative −3, déclaration acceptée', { skip }, async () => {
  await withFixture(async (fx) => {
    const grenade = await fx.add(fx.grenadeRef, 'Ceinture')
    await fx.declare({ grab: { itemId: grenade.id, replaceItemId: fx.inHand.id } })
    assert.deepEqual(fx.errors(), [])
    const rows = await fx.actions()
    assert.equal(rows.length, 1)
    assert.equal(rows[0].action_key, 'grab_item')
    assert.equal(rows[0].type, 'micro')
    assert.equal(rows[0].sequence, 2)
    assert.equal(rows[0].status, 'pending')
    assert.equal(rows[0].turn_number, 1)
    assert.deepEqual(rows[0].modifiers, { ini_mod: -3, itemId: grenade.id, container: 'Ceinture', replaceItemId: fx.inHand.id })
    const roster = await fx.roster()
    assert.equal(roster.has_announced, true)
    assert.equal(roster.initiative, 10 - 3) // Préparation depuis la Ceinture : −3 (coût lu en base, jamais du client)
    assert.ok(fx.emitted.some(e => e.event === WS.COMBAT_ACTION_DECLARED && e.data.tokenId === fx.token.id))
  })
})

test('Permuter depuis le Sac (Action simple) : aucun coût d\'Initiative ; « Mains nues » = replaceItemId null', { skip }, async () => {
  await withFixture(async (fx) => {
    const grenade = await fx.add(fx.grenadeRef, 'Sac')
    await fx.declare({ grab: { itemId: grenade.id } })
    assert.deepEqual(fx.errors(), [])
    const [row] = await fx.actions()
    assert.deepEqual(row.modifiers, { ini_mod: 0, itemId: grenade.id, container: 'Sac', replaceItemId: null })
    assert.equal((await fx.roster()).initiative, 10)
  })
})

test('Le conteneur et le coût viennent de la base : un `container` / `ini_mod` forgés par le client sont ignorés', { skip }, async () => {
  await withFixture(async (fx) => {
    const grenade = await fx.add(fx.grenadeRef, 'Ceinture')
    await fx.declare({ grab: { itemId: grenade.id, container: 'Sac', ini_mod: 0, iniCost: 99 } })
    assert.deepEqual(fx.errors(), [])
    const [row] = await fx.actions()
    assert.equal(row.modifiers.container, 'Ceinture')
    assert.equal(row.modifiers.ini_mod, -3)
    assert.equal((await fx.roster()).initiative, 7)
  })
})

// ─── Refus structurels : rien n'est écrit, le token n'a pas déclaré ──────────────────────────────────────────────────

test('R9 et payloads invalides : deux permutations, un tableau, un objet à remplacer étranger — refusés, aucune ligne, token non annoncé', { skip }, async () => {
  await withFixture(async (fx) => {
    const g1 = await fx.add(fx.grenadeRef, 'Ceinture')
    const g2 = await fx.add(fx.grenadeRef, 'Ceinture')
    await fx.declare({ grab: [{ itemId: g1.id }, { itemId: g2.id }] })
    await fx.declare({ grab: { itemId: g1.id, replaceItemId: '00000000-0000-4000-8000-000000000000' } })
    await fx.declare({ grab: { itemId: 'pas-un-uuid' } })
    await fx.declare({ grab: { itemId: g1.id, replaceItemId: g1.id } })
    assert.equal(fx.errors().length, 4)
    assert.match(fx.errors()[0], /une seule permutation par Tour/)
    assert.match(fx.errors()[1], /objet à remplacer introuvable/)
    assert.match(fx.errors()[2], /introuvable/)
    assert.match(fx.errors()[3], /objet à remplacer introuvable/)
    assert.equal((await fx.actions()).length, 0)
    assert.equal((await fx.roster()).has_announced, false)
    assert.equal((await fx.roster()).initiative, 10)
  })
})

test('Depuis le Sac, une permutation est exclusive avec un rechargement : refusée avec le motif, rien n\'est écrit', { skip }, async () => {
  await withFixture(async (fx) => {
    const grenade = await fx.add(fx.grenadeRef, 'Sac')
    await fx.declare({ grab: { itemId: grenade.id }, reload: {} })
    assert.equal(fx.errors().length, 1)
    assert.match(fx.errors()[0], /occupe l'action du Tour — impossible avec : rechargement/)
    assert.equal((await fx.actions()).length, 0)
  })
})

// ─── L'objet entrant est « en main » pour l'attaque du MÊME Tour (Ceinture : Préparation, compatible) ─────────────────

test('Tir avec l\'arme de la Ceinture : refusé SANS permutation (pas en main), accepté AVEC — la ligne d\'assaut porte l\'arme entrante', { skip }, async () => {
  await withFixture(async (fx) => {
    const gun = await fx.add(fx.gunRef, 'Ceinture')
    const attack = [{ targetTokenId: fx.foeToken.id, weaponInvId: gun.id, bulletCount: 1 }]

    // Témoin : sans permutation, l'arme rangée n'est pas utilisable — le refus existant est inchangé.
    await fx.declare({ attack })
    assert.equal(fx.errors().length, 1)
    assert.match(fx.errors()[0], /l'arme doit être équipée en main/)
    assert.equal((await fx.actions()).length, 0)

    // Avec la permutation du même Tour (Ceinture = Préparation, cumulable) : acceptée.
    await fx.declare({ grab: { itemId: gun.id, replaceItemId: fx.inHand.id }, attack })
    assert.equal(fx.errors().length, 1, `aucune nouvelle erreur attendue : ${JSON.stringify(fx.errors())}`)
    const rows = await fx.actions()
    assert.deepEqual(rows.map(r => r.action_key), ['grab_item', 'assault'].map(k => rows.find(r => r.action_key === k)?.action_key))
    const grab = rows.find(r => r.action_key === 'grab_item')
    const assault = rows.find(r => r.type === 'assault')
    assert.ok(grab && assault, `lignes : ${JSON.stringify(rows.map(r => [r.type, r.action_key]))}`)
    assert.equal(grab.sequence, 2)
    assert.equal(assault.weapon_inv_id, gun.id)
    assert.ok(grab.sequence < assault.sequence, 'la permutation est résolue AVANT l\'entrée d\'attaque du token')
    assert.equal((await fx.roster()).has_announced, true)
  })
})

test('Tir avec l\'arme du Sac + permutation : refusé (Action simple exclusive), pas de ligne', { skip }, async () => {
  await withFixture(async (fx) => {
    const gun = await fx.add(fx.gunRef, 'Sac')
    await fx.declare({ grab: { itemId: gun.id }, attack: [{ targetTokenId: fx.foeToken.id, weaponInvId: gun.id, bulletCount: 1 }] })
    assert.equal(fx.errors().length, 1)
    assert.match(fx.errors()[0], /impossible avec : tir/)
    assert.equal((await fx.actions()).length, 0)
  })
})

// ─── Le scénario d'origine du chantier : permuter la grenade puis la LANCER au même Tour (visée d'un point, zone d'effet) ─────

test('Grenade de la Ceinture : refusée SANS permutation, acceptée AVEC — la ligne d’assaut de zone porte la grenade et le point visé', { skip }, async () => {
  await withFixture(async (fx) => {
    const grenade = await fx.add(fx.grenadeRef, 'Ceinture')
    const aimedPoint = { x: 8, y: 0, z: 5 }
    const attack = () => [{ weaponInvId: grenade.id, bulletCount: 1, aoe: { intendedOrigin: { ...aimedPoint }, detonation: 'percussion' } }]

    // Témoin : sans permutation la grenade rangée n'est pas utilisable — refus existant, inchangé.
    await fx.declare({ attack: attack() })
    assert.equal(fx.errors().length, 1)
    assert.match(fx.errors()[0], /l'arme doit être équipée en main/)
    assert.equal((await fx.actions()).length, 0)

    await fx.declare({ grab: { itemId: grenade.id, replaceItemId: fx.inHand.id }, attack: attack() })
    assert.equal(fx.errors().length, 1, `aucune nouvelle erreur attendue : ${JSON.stringify(fx.errors())}`)
    const rows = await fx.actions()
    const grab = rows.find(r => r.action_key === 'grab_item')
    const assault = rows.find(r => r.type === 'assault')
    assert.ok(grab && assault, `lignes : ${JSON.stringify(rows.map(r => [r.type, r.action_key]))}`)
    assert.equal(grab.sequence, 2)
    assert.ok(grab.sequence < assault.sequence, 'la permutation est résolue AVANT le lancer du même token')
    assert.equal(assault.weapon_inv_id, grenade.id)
    assert.equal(assault.target_token_id, null) // une zone n'a pas de cible scalaire
    assert.deepEqual(assault.modifiers.aoe.intendedOrigin, aimedPoint)
    assert.equal(assault.modifiers.aoe.detonation, 'percussion')
    assert.equal((await fx.roster()).initiative, 10 - 3) // Ceinture : Préparation −3, le lancer ne coûte rien de plus ici
    assert.equal((await fx.roster()).has_announced, true)
  })
})

test('Grenade du Sac + permutation : le lancer du même Tour est refusé (Action simple exclusive), pas de ligne', { skip }, async () => {
  await withFixture(async (fx) => {
    const grenade = await fx.add(fx.grenadeRef, 'Sac')
    await fx.declare({ grab: { itemId: grenade.id }, attack: [{ weaponInvId: grenade.id, bulletCount: 1, aoe: { intendedOrigin: { x: 8, y: 0, z: 5 } } }] })
    assert.equal(fx.errors().length, 1)
    assert.match(fx.errors()[0], /impossible avec : tir/)
    assert.equal((await fx.actions()).length, 0)
  })
})

test.after(async () => { await db.destroy() })
