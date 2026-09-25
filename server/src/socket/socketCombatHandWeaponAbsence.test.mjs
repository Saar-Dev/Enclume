import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { WS } from '../../../shared/events.js'
import { resolveAssaultAction, resolveMeleeAction, resolveReloadAction } from './socketCombatHelpers.js'
import { resolveAoeAssaultAction } from './socketCombatAoe.js'
import { weaponNotInHandEmission, offhandNotInHandEmission } from '../lib/combatHandWeaponNotice.js'

// PLAN_PRISE_EN_MAIN.md, Lot A4 — R14 : une action dont l'arme déclarée n'est plus en main TOMBE, et le chat le dit (décision Saar
// 2026-09-25 : le personnage perd son action, pas de seconde chance). Les vraies fonctions de résolution (Tir, zone, corps à corps,
// rechargement) sont appelées avec de faux `io` / `socket` qui capturent les émissions, sur une vraie base (fixtures supprimées).
// Non couvert de bout en bout : le tir / corps à corps à DEUX armes dont seule la seconde manque (il faudrait une carte complète) —
// la formulation de sa notice est testée seule, ci-dessous.
// Lancement manuel, base locale : node --env-file=.env --test server/src/socket/socketCombatHandWeaponAbsence.test.mjs
const skip = !process.env.DATABASE_URL

test.after(async () => { await db.destroy() })

// ─── La notice seule (aucune base) ───────────────────────────────────────────────────────────────────────────────────

test('weaponNotInHandEmission : nomme l\'arme, pour toute la salle, clé i18n (jamais de texte français émis)', async () => {
  const emission = await weaponNotInHandEmission(
    { id: 'c1', name: 'Kaiser' }, 'i1',
    { loadItem: async () => ({ id: 'i1', character_id: 'c1', ref_name: 'Grenade à fragmentation', custom_name: null }) })
  assert.equal(emission.to, 'room')
  assert.equal(emission.event, WS.COMBAT_SYSTEM_NOTICE)
  assert.equal(emission.data.i18nKey, 'session.actionCancelledWeaponNotInHand')
  assert.deepEqual(emission.data.params, { label: 'Kaiser', item: 'Grenade à fragmentation' })
})

test('weaponNotInHandEmission : le nom personnalisé prime ; un objet d\'un AUTRE personnage ou introuvable ou en erreur → variante sans nom', async () => {
  const custom = await weaponNotInHandEmission({ id: 'c1', name: 'K' }, 'i1',
    { loadItem: async () => ({ character_id: 'c1', ref_name: 'Pistolet', custom_name: 'Ma vieille' }) })
  assert.equal(custom.data.params.item, 'Ma vieille')

  const foreign = await weaponNotInHandEmission({ id: 'c1', name: 'K' }, 'i1', { loadItem: async () => ({ character_id: 'autre', ref_name: 'Secret' }) })
  const missing = await weaponNotInHandEmission({ id: 'c1', name: 'K' }, 'i1', { loadItem: async () => undefined })
  const noId = await weaponNotInHandEmission({ id: 'c1', name: 'K' }, null, { loadItem: async () => assert.fail('aucune lecture sans identifiant') })
  const failing = await weaponNotInHandEmission({ id: 'c1', name: 'K' }, 'i1', {
    loadItem: async () => { throw Object.assign(new Error('boom'), { code: '22P02' }) } })
  for (const emission of [foreign, missing, noId, failing]) {
    assert.equal(emission.data.i18nKey, 'session.actionCancelledWeaponUnknown')
    assert.deepEqual(emission.data.params, { label: 'K' }) // jamais le nom d'un objet qui n'est pas au personnage
  }
})

test('offhandNotInHandEmission : retour privé au propriétaire (repli socket pour un PNJ), clé dédiée — pas « à sec »', () => {
  const pj = offhandNotInHandEmission({ id: 'c1', name: 'K', user_id: 'u1' })
  assert.equal(pj.to, 'user')
  assert.equal(pj.userId, 'u1')
  assert.equal(pj.fallback, 'socket')
  assert.equal(pj.data.i18nKey, 'session.dualWieldOffhandNotInHand')
  assert.equal(offhandNotInHandEmission({ id: 'c2', name: 'PNJ' }).userId, null)
})

// ─── Les vraies résolutions, sur une vraie base ──────────────────────────────────────────────────────────────────────

async function createFixture() {
  const [gm] = await db('users')
    .insert({ email: `a4-abs-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'a4-abs-gm' }).returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test A4 arme absente', invite_code: `A4-${Date.now()}-${Math.random()}` }).returning('*')
  const [character] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Kaiser', type: 'pj' }).returning('*')
  const gunRef = await db('ref_equipment')
    .where({ family: 'Armes', location: 'M' }).whereNotNull('fire_mode').whereNotNull('caliber').whereNull('aoe_profile').orderBy('name').first()
  const grenadeRef = await db('ref_equipment').where({ name: 'Grenade à fragmentation' }).first()
  const meleeRef = await db('ref_equipment').where({ category: 'Arme de contact', location: 'M' }).whereNull('caliber').orderBy('name').first()
  assert.ok(gunRef && grenadeRef && meleeRef, 'catalogue de test incomplet')
  const add = async (ref, container, extra = {}) => (await db('char_inventory')
    .insert({ character_id: character.id, equipment_id: ref.id, container, quantity: 1, validated_by_gm: true, ...extra }).returning('*'))[0]

  const emitted = []
  const io = { to: (room) => ({ emit: (event, data) => emitted.push({ room, event, data }) }) }
  const socket = { user: { id: gm.id }, emit: (event, data) => emitted.push({ room: 'socket', event, data }) }
  const notices = () => emitted.filter(e => e.event === WS.COMBAT_SYSTEM_NOTICE).map(e => e.data.i18nKey)
  return { gm, campaign, character, gunRef, grenadeRef, meleeRef, add, emitted, io, socket, notices }
}

async function withFixture(fn) {
  const fx = await createFixture()
  const originalLog = console.log
  const originalWarn = console.warn
  console.log = () => {} // les résolutions journalisent chaque étape
  console.warn = () => {}
  try { await fn(fx) } finally {
    console.log = originalLog
    console.warn = originalWarn
    await db('campaigns').where({ id: fx.campaign.id }).del()
    await db('users').where({ id: fx.gm.id }).del()
  }
}

const noticeKeys = (emissions) => emissions.filter(e => e.event === WS.COMBAT_SYSTEM_NOTICE).map(e => e.data.i18nKey)
const ANY_TARGET = '00000000-0000-4000-8000-000000000001'

test('Tir avec une arme restée à la Ceinture : action annulée, notice qui nomme l\'arme, aucune munition consommée', { skip }, async () => {
  await withFixture(async (fx) => {
    const gun = await fx.add(fx.gunRef, 'Ceinture', { ammo_remaining: 6 })
    const result = await resolveAssaultAction(fx.io, fx.campaign.id,
      { token_id: ANY_TARGET, weapon_inv_id: gun.id, target_token_id: ANY_TARGET, bullet_count: 1, turn_number: 1 },
      { situation: [] }, fx.character, { combatTimers: new Map() })
    assert.equal(result.suspend, false)
    assert.deepEqual(noticeKeys(result.emissions), ['session.actionCancelledWeaponNotInHand'])
    assert.equal(result.emissions[0].to, 'room')
    assert.equal(result.emissions[0].data.params.label, 'Kaiser')
    assert.ok(result.emissions[0].data.params.item.length > 0)
    assert.equal((await db('char_inventory').where({ id: gun.id }).first()).ammo_remaining, 6) // rien n'a été consommé
  })
})

test('Tir avec l\'objet d\'un AUTRE personnage : annulé aussi, variante sans nom (le nom d\'un objet étranger ne fuit pas)', { skip }, async () => {
  await withFixture(async (fx) => {
    const [other] = await db('characters').insert({ campaign_id: fx.campaign.id, user_id: fx.gm.id, name: 'Autre', type: 'pnj' }).returning('*')
    const foreign = (await db('char_inventory')
      .insert({ character_id: other.id, equipment_id: fx.gunRef.id, container: 'Sac', quantity: 1, validated_by_gm: true }).returning('*'))[0]
    const result = await resolveAssaultAction(fx.io, fx.campaign.id,
      { token_id: ANY_TARGET, weapon_inv_id: foreign.id, target_token_id: ANY_TARGET, turn_number: 1 },
      { situation: [] }, fx.character, { combatTimers: new Map() })
    assert.deepEqual(noticeKeys(result.emissions), ['session.actionCancelledWeaponUnknown'])
    assert.deepEqual(result.emissions[0].data.params, { label: 'Kaiser' })
  })
})

test('Grenade (arme de zone) restée à la Ceinture : lancer annulé, notice — le scénario d\'origine du chantier', { skip }, async () => {
  await withFixture(async (fx) => {
    const grenade = await fx.add(fx.grenadeRef, 'Ceinture')
    const result = await resolveAoeAssaultAction(fx.io, fx.campaign.id,
      { token_id: ANY_TARGET, weapon_inv_id: grenade.id, turn_number: 1, modifiers: { aoe: { mode: 'grenade' } } },
      { situation: [] }, fx.character, { combatTimers: new Map() })
    assert.equal(result.suspend, false)
    assert.deepEqual(noticeKeys(result.emissions), ['session.actionCancelledWeaponNotInHand'])
    assert.equal(await db('char_inventory').where({ id: grenade.id }).first().then(Boolean), true) // la grenade n'a pas été consommée
  })
})

test('Corps à corps avec une arme rangée : annulé, notice — JAMAIS un coup à mains nues', { skip }, async () => {
  await withFixture(async (fx) => {
    const sword = await fx.add(fx.meleeRef, 'Sac')
    const result = await resolveMeleeAction(fx.io, fx.campaign.id,
      { token_id: ANY_TARGET, weapon_inv_id: sword.id, target_token_id: ANY_TARGET, turn_number: 1 },
      fx.character, { situation: [] }, { combatTimers: new Map() })
    assert.equal(result.suspend, false)
    assert.deepEqual(noticeKeys(result.emissions), ['session.actionCancelledWeaponNotInHand'])
    // Aucune invite de défense, aucun jet : la seule émission est la notice.
    assert.equal(result.emissions.length, 1)
  })
})

test('Rechargement d\'une arme rangée : le panneau du joueur (inchangé) ET la ligne de chat de la salle', { skip }, async () => {
  await withFixture(async (fx) => {
    const gun = await fx.add(fx.gunRef, 'Ceinture', { ammo_remaining: 0 })
    await resolveReloadAction(fx.io, fx.socket, fx.campaign.id, fx.character, { weapon_inv_id: gun.id, turn_number: 1, modifiers: {} })
    const panel = fx.emitted.find(e => e.event === WS.COMBAT_RELOAD_RESULT)
    assert.equal(panel?.data.reason, 'not_in_hand')
    assert.deepEqual(fx.notices(), ['session.actionCancelledWeaponNotInHand'])
    assert.equal((await db('char_inventory').where({ id: gun.id }).first()).ammo_remaining, 0)
  })
})

test('Rechargement d\'une arme EN MAIN : aucune notice d\'annulation (le cas nominal ne change pas)', { skip }, async () => {
  await withFixture(async (fx) => {
    const gun = await fx.add(fx.gunRef, 'Sac', { ammo_remaining: 0 })
    await db('char_inventory_slots').insert({ char_inventory_id: gun.id, character_id: fx.character.id, slot_code: 'MD' })
    await resolveReloadAction(fx.io, fx.socket, fx.campaign.id, fx.character, { weapon_inv_id: gun.id, turn_number: 1, modifiers: {} })
    assert.deepEqual(fx.notices().filter(key => key.startsWith('session.actionCancelled')), [])
    assert.notEqual(fx.emitted.find(e => e.event === WS.COMBAT_RELOAD_RESULT)?.data.reason, 'not_in_hand')
  })
})
