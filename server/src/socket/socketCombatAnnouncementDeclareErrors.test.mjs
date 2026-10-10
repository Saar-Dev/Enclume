import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { registerAnnouncementHandlers } from './socketCombatAnnouncement.js'
import { WS } from '../../../shared/events.js'

// COMBAT-DECLARATION-REFUSED-NO-MESSAGE — audit : plusieurs refus de déclaration (ownership,
// FSM, déjà-annoncé, phase) ne renvoyaient RIEN au joueur (juste un console.warn serveur). Ici, les
// deux cas les plus probables en usage réel (pas juste un payload forgé) : double-clic/réessai réseau
// sur une déclaration déjà envoyée, et un client qui tente de déclarer pour un personnage qui n'est
// pas le sien. Transport réel du payload, vraie base (fixtures supprimées), même patron que
// socketCombatAnnouncementGrab.test.mjs.
// Lancement manuel, base locale : node --env-file=.env --test server/src/socket/socketCombatAnnouncementDeclareErrors.test.mjs
const skip = !process.env.DATABASE_URL

async function createFixture() {
  const [gm] = await db('users')
    .insert({ email: `declerr-gm-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'declerr-gm' }).returning('*')
  const [otherUser] = await db('users')
    .insert({ email: `declerr-other-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'declerr-other' }).returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test erreurs declaration', invite_code: `DECLERR-${Date.now()}-${Math.random()}` }).returning('*')
  const [battlemap] = await db('battlemaps').insert({ campaign_id: campaign.id, name: 'Carte test' }).returning('*')
  const [owner] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Kaiser', type: 'pj' }).returning('*')
  const [other] = await db('characters')
    .insert({ campaign_id: campaign.id, user_id: gm.id, name: 'Autre combattant', type: 'pnj' }).returning('*')
  const [token] = await db('tokens').insert({ battlemap_id: battlemap.id, character_id: owner.id, label: 'Kaiser', pos_x: 5, pos_y: 5 }).returning('*')
  const [otherToken] = await db('tokens').insert({ battlemap_id: battlemap.id, character_id: other.id, label: 'Autre', pos_x: 7, pos_y: 5 }).returning('*')
  await db('combat_state').insert({ campaign_id: campaign.id, battlemap_id: battlemap.id, phase: 'ANNOUNCEMENT', current_turn: 1 })
  // Deux combattants : après la déclaration du premier (base_ini le plus bas), le second reste à
  // annoncer — le combat ne bascule pas en RÉSOLUTION, donc la garde FSM ne s'interpose pas avant
  // d'atteindre le garde has_announced testé ici.
  await db('combat_roster').insert([
    { campaign_id: campaign.id, token_id: token.id, base_ini: 5, initiative: 10, has_announced: false },
    { campaign_id: campaign.id, token_id: otherToken.id, base_ini: 20, initiative: 8, has_announced: false },
  ])

  const emitted = []
  const io = { to: (room) => ({ emit: (event, data) => emitted.push({ room, event, data }) }) }

  const registerAs = (asUser, asGm) => {
    const handlers = new Map()
    const socket = { on: (event, fn) => handlers.set(event, fn), emit: (event, data) => emitted.push({ room: 'socket', event, data }) }
    const pendingMaps = { combatTimers: new Map(), combatPreviews: new Map() }
    registerAnnouncementHandlers(io, socket, { campaignId: campaign.id, user: asUser, isGm: asGm }, pendingMaps)
    return (mapActions = {}) => handlers.get(WS.COMBAT_ACTION_DECLARE)({
      tokenId: token.id,
      state: { position: 'standing', weapon: 'ready', fire_mode: 'cc', cover: 'exposed', vitesse: 'normal', combat_mode: 'normal' },
      mapActions, quick: { observer: 0, reperer: 0, phrase: false },
    })
  }

  return {
    gm, otherUser, campaign, owner, token, emitted, registerAs,
    errors: () => emitted.filter(e => e.event === WS.COMBAT_DECLARE_ERROR).map(e => e.data.message),
    roster: () => db('combat_roster').where({ campaign_id: campaign.id, token_id: token.id }).first(),
  }
}

async function cleanup(fx) {
  await db('combat_actions').where({ campaign_id: fx.campaign.id }).del()
  await db('combat_roster').where({ campaign_id: fx.campaign.id }).del()
  await db('combat_state').where({ campaign_id: fx.campaign.id }).del()
  await db('campaigns').where({ id: fx.campaign.id }).del()
  await db('users').whereIn('id', [fx.gm.id, fx.otherUser.id]).del()
}
async function withFixture(fn) {
  const fx = await createFixture()
  const originalLog = console.log
  const originalWarn = console.warn
  console.log = () => {}
  console.warn = () => {}
  try { await fn(fx) } finally { console.log = originalLog; console.warn = originalWarn; await cleanup(fx) }
}

test.after(async () => { await db.destroy() })

test('Déclarer deux fois le même Tour : la seconde déclaration est refusée avec un message, pas silencieuse', { skip }, async () => {
  await withFixture(async (fx) => {
    const declare = fx.registerAs({ id: fx.gm.id, username: 'declerr-gm' }, true)
    await declare({})
    assert.deepEqual(fx.errors(), []) // première déclaration acceptée
    assert.equal((await fx.roster()).has_announced, true)

    await declare({}) // même token, has_announced déjà true
    assert.deepEqual(fx.errors(), ['Vous avez déjà déclaré votre action ce Tour'])
  })
})

test('Déclarer pour le personnage d\'un autre joueur : refusé avec un message explicite', { skip }, async () => {
  await withFixture(async (fx) => {
    const declare = fx.registerAs({ id: fx.otherUser.id, username: 'declerr-other' }, false)
    await declare({})
    assert.deepEqual(fx.errors(), ["Vous n'êtes pas autorisé à déclarer pour ce personnage"])
    assert.equal((await fx.roster()).has_announced, false) // rien n'a été écrit
  })
})
