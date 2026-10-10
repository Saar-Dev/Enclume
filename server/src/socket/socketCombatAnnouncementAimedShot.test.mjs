import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { registerAnnouncementHandlers } from './socketCombatAnnouncement.js'
import { WS } from '../../../shared/events.js'

// COMBAT-DECLARATION-REFUSED-NO-MESSAGE — Tir visé (aimTranches > 0) humanoïde plantait à CHAQUE
// déclaration (ReferenceError `weapon is not defined`, socketCombatAnnouncement.js ~L695 avant
// correctif), rattrapé par le catch global du handler (console.error seul, aucun message au
// joueur) : clic sur « Valider », rien ne se passe. Transport réel du payload, vraie base (fixtures
// supprimées), même patron que socketCombatAnnouncementGrab.test.mjs (`.claude/rules/combat.md`).
// Lancement manuel, base locale : node --env-file=.env --test server/src/socket/socketCombatAnnouncementAimedShot.test.mjs
const skip = !process.env.DATABASE_URL

// Entry (combat_roster AVANT déclaration) déjà arme au clair + coup par coup — préconditions RAW du
// Tir visé (getAimIneligibilityReasons) — et le payload déclaré ne transitionne aucun état (aucune
// des conditions de getStateTransitionReasons ne doit se déclencher), sinon le Tir visé serait
// refusé pour une AUTRE raison que celle testée ici.
const ENTRY_STATE = { state_position: 'standing', state_weapon: 'drawn', state_fire_mode: 'cc', state_cover: 'exposed', state_vitesse: 'normal' }
const DECLARED_STATE = { position: 'standing', weapon: 'drawn', fire_mode: 'cc', cover: 'exposed', vitesse: 'normal', combat_mode: 'normal' }

async function createFixture() {
  const [gm] = await db('users')
    .insert({ email: `aim-e2e-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'aim-e2e-gm' }).returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test tir vise e2e', invite_code: `AIM-${Date.now()}-${Math.random()}` }).returning('*')
  const [battlemap] = await db('battlemaps').insert({ campaign_id: campaign.id, name: 'Carte test' }).returning('*')
  const [owner] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Kaiser', type: 'pj' }).returning('*')
  const [foe] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Cible', type: 'pnj' }).returning('*')
  const [token] = await db('tokens').insert({ battlemap_id: battlemap.id, character_id: owner.id, label: 'Kaiser', pos_x: 5, pos_y: 5 }).returning('*')
  const [foeToken] = await db('tokens').insert({ battlemap_id: battlemap.id, character_id: foe.id, label: 'Cible', pos_x: 7, pos_y: 5 }).returning('*')
  await db('combat_state').insert({ campaign_id: campaign.id, battlemap_id: battlemap.id, phase: 'ANNOUNCEMENT', current_turn: 1 })
  await db('combat_roster').insert([
    { campaign_id: campaign.id, token_id: token.id, base_ini: 5, initiative: 10, ...ENTRY_STATE },
    { campaign_id: campaign.id, token_id: foeToken.id, base_ini: 20, initiative: 8, state_weapon: 'ready' },
  ])

  const gunRef = await db('ref_equipment')
    .where({ family: 'Armes', location: 'M' }).whereNotNull('fire_mode').where('fire_mode', 'like', '%CC%').whereNotNull('caliber').whereNull('aoe_profile')
    .orderBy('name').first()
  assert.ok(gunRef, 'catalogue de test incomplet (arme CC)')
  const gun = (await db('char_inventory')
    .insert({ character_id: owner.id, equipment_id: gunRef.id, container: 'Sac', quantity: 1, validated_by_gm: true, ammo_remaining: 20 })
    .returning('*'))[0]
  await db('char_inventory_slots').insert({ char_inventory_id: gun.id, character_id: owner.id, slot_code: 'MD' })

  const emitted = []
  const io = { to: (room) => ({ emit: (event, data) => emitted.push({ room, event, data }) }) }
  const handlers = new Map()
  const socket = { on: (event, fn) => handlers.set(event, fn), emit: (event, data) => emitted.push({ room: 'socket', event, data }) }
  const pendingMaps = { combatTimers: new Map(), combatPreviews: new Map() }
  registerAnnouncementHandlers(io, socket, { campaignId: campaign.id, user: { id: gm.id, username: 'aim-e2e-gm' }, isGm: true }, pendingMaps)

  const declare = (mapActions) => handlers.get(WS.COMBAT_ACTION_DECLARE)({ tokenId: token.id, state: { ...DECLARED_STATE }, mapActions, quick: { observer: 0, reperer: 0, phrase: false } })
  return {
    gm, campaign, owner, token, foeToken, gun, emitted, declare,
    errors: () => emitted.filter(e => e.event === WS.COMBAT_DECLARE_ERROR).map(e => e.data.message),
    declaredRows: () => db('combat_actions').where({ campaign_id: campaign.id }),
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
  const originalError = console.error
  const serverErrors = []
  console.log = () => {} // le gestionnaire journalise chaque déclaration
  console.error = (...args) => serverErrors.push(args.join(' '))
  try { await fn(fx, serverErrors) } finally { console.log = originalLog; console.error = originalError; await cleanup(fx) }
}

test.after(async () => { await db.destroy() })

test('Tir visé humanoïde (aimTranches=1) : la déclaration aboutit, aucune ReferenceError rattrapée en silence par le catch global', { skip }, async () => {
  await withFixture(async (fx, serverErrors) => {
    await fx.declare({ attack: [{ weaponInvId: fx.gun.id, targetTokenId: fx.foeToken.id, bulletCount: 1, aimTranches: 1 }] })
    // Avant correctif : `combat:action_declare error: weapon is not defined` dans serverErrors,
    // aucune ligne combat_actions, aucune COMBAT_ACTION_DECLARED émise, déclaration perdue en silence.
    assert.deepEqual(serverErrors, [], `le handler a levé une exception inattendue : ${serverErrors.join(' | ')}`)
    assert.deepEqual(fx.errors(), []) // Tir visé éligible ici — pas un refus RAW, juste pas de plantage
    const rows = await fx.declaredRows()
    assert.equal(rows.length, 1)
    assert.equal(rows[0].type, 'assault')
  })
})

test('Tir visé refusé proprement (deux armes) : message explicite, pas un plantage', { skip }, async () => {
  await withFixture(async (fx, serverErrors) => {
    await fx.declare({ attack: [{ weaponInvId: fx.gun.id, offhandWeaponInvId: fx.gun.id, isDualWield: true, targetTokenId: fx.foeToken.id, bulletCount: 1, aimTranches: 1 }] })
    assert.deepEqual(serverErrors, [])
    assert.ok(fx.errors().some(m => m.includes('Tir visé impossible')), `message attendu absent : ${JSON.stringify(fx.errors())}`)
  })
})
