import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { isCharacterDead, isTokenDead } from './deathStateService.js'
import { applyStunWithDuration, applyDeathConsequences } from './statusService.js'
import { resolveChanceRecipientCharacterId } from './exoPilotService.js'

// Lancement (depuis la racine du projet) : node --env-file=.env --test server/src/lib/deathStateService.test.mjs
// Écrit puis supprime des lignes dans la base locale — sans DATABASE_URL, tout est ignoré.
const skip = !process.env.DATABASE_URL

test.after(async () => { await db.destroy() })

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

// Campagne minimale + personnages (type au choix) + un token par personnage.
async function createFixture(types) {
  const [gm] = await db('users')
    .insert({ email: `death-state-${uniq()}@test.local`, password_hash: 'x', username: 'death-state-gm' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test deathState', invite_code: `DEATHST-${uniq()}` })
    .returning('*')
  const [battlemap] = await db('battlemaps').insert({ campaign_id: campaign.id, name: 'BM test' }).returning('*')
  const chars = []
  for (const type of types) {
    const [character] = await db('characters')
      .insert({ campaign_id: campaign.id, user_id: gm.id, name: `Perso ${chars.length}`, type })
      .returning('*')
    const [token] = await db('tokens')
      .insert({ battlemap_id: battlemap.id, character_id: character.id, label: `T${chars.length}` })
      .returning('*')
    chars.push({ character, token })
  }
  const cleanup = async () => {
    const characterIds = chars.map(c => c.character.id)
    const tokenIds = await db('tokens').where({ battlemap_id: battlemap.id }).pluck('id') // y compris les tokens ajoutés par un test
    await db('combat_pending').where({ campaign_id: campaign.id }).del()
    await db('token_statuses').whereIn('token_id', tokenIds).del()
    await db('tokens').whereIn('id', tokenIds).del()
    await db('exo_sheet').whereIn('character_id', characterIds).del()
    await db('characters').whereIn('id', characterIds).del()
    await db('battlemaps').where({ id: battlemap.id }).del()
    await db('campaigns').where({ id: campaign.id }).del()
    await db('users').where({ id: gm.id }).del()
  }
  return { campaign, battlemap, chars, cleanup }
}

const setStatus = (tokenId, statusCode) => db('token_statuses').insert({ token_id: tokenId, status_code: statusCode })
const setMode = (campaignId, mode) =>
  db('campaigns').where({ id: campaignId }).update({ settings: JSON.stringify({ status_effects_mode: mode }) })

test('isCharacterDead — vrai seulement avec un statut de mort, en mode enforced', { skip }, async () => {
  const fx = await createFixture(['pj', 'pj'])
  try {
    const [alive, other] = fx.chars
    assert.equal(await isCharacterDead(db, fx.campaign.id, alive.character.id), false)
    await setStatus(alive.token.id, 'stunned')                       // statut ordinaire : pas un cadavre
    assert.equal(await isCharacterDead(db, fx.campaign.id, alive.character.id), false)
    await setStatus(alive.token.id, 'dead')
    assert.equal(await isCharacterDead(db, fx.campaign.id, alive.character.id), true)
    assert.equal(await isCharacterDead(db, fx.campaign.id, other.character.id), false) // l'autre personnage : intact
    assert.equal(await isCharacterDead(db, fx.campaign.id, null), false)
    await setMode(fx.campaign.id, 'icon_only')                       // sans effet mécanique hors 'enforced'
    assert.equal(await isCharacterDead(db, fx.campaign.id, alive.character.id), false)
  } finally { await fx.cleanup() }
})

test('resolveChanceRecipientCharacterId — PJ/PNJ : vivant = lui-même, mort = null, icon_only = inchangé', { skip }, async () => {
  const fx = await createFixture(['pj', 'pnj'])
  try {
    const [pj, pnj] = fx.chars
    assert.equal(await resolveChanceRecipientCharacterId(db, fx.campaign.id, pj.character.id, 'pj'), pj.character.id)
    await setStatus(pj.token.id, 'dead')
    assert.equal(await resolveChanceRecipientCharacterId(db, fx.campaign.id, pj.character.id, 'pj'), null)
    assert.equal(await resolveChanceRecipientCharacterId(db, fx.campaign.id, pnj.character.id, 'pnj'), pnj.character.id)
    await setMode(fx.campaign.id, 'icon_only')
    assert.equal(await resolveChanceRecipientCharacterId(db, fx.campaign.id, pj.character.id, 'pj'), pj.character.id)
  } finally { await fx.cleanup() }
})

test('resolveChanceRecipientCharacterId — drone : toujours null (contrat historique)', { skip }, async () => {
  const fx = await createFixture(['drone'])
  try {
    assert.equal(await resolveChanceRecipientCharacterId(db, fx.campaign.id, fx.chars[0].character.id, 'drone'), null)
  } finally { await fx.cleanup() }
})

test('resolveChanceRecipientCharacterId — exo : le pilote reçoit la Chance ; exo morte OU pilote mort → null ; sans pilote → null', { skip }, async () => {
  const fx = await createFixture(['exo', 'pj'])
  try {
    const [exo, pilot] = fx.chars
    await db('exo_sheet').insert({ character_id: exo.character.id })
    assert.equal(await resolveChanceRecipientCharacterId(db, fx.campaign.id, exo.character.id, 'exo'), null) // pas de pilote

    await db('exo_sheet').where({ character_id: exo.character.id }).update({ pilot_character_id: pilot.character.id })
    assert.equal(await resolveChanceRecipientCharacterId(db, fx.campaign.id, exo.character.id, 'exo'), pilot.character.id)

    await setStatus(pilot.token.id, 'dead')                                                                   // pilote mort
    assert.equal(await resolveChanceRecipientCharacterId(db, fx.campaign.id, exo.character.id, 'exo'), null)
    await db('token_statuses').where({ token_id: pilot.token.id }).del()

    await setStatus(exo.token.id, 'dead')                                                                     // exo morte
    assert.equal(await resolveChanceRecipientCharacterId(db, fx.campaign.id, exo.character.id, 'exo'), null)
  } finally { await fx.cleanup() }
})

// ─── Lot 1f — un cadavre ne reçoit pas d'état de corps vivant ───────────────────────────────────────
const io = { to: () => ({ emit: () => {} }) }
const statusCodes = async (tokenId) =>
  (await db('token_statuses').where({ token_id: tokenId }).pluck('status_code')).sort()

test('isTokenDead — lecture au niveau du personnage ; token sans personnage jamais mort', { skip }, async () => {
  const fx = await createFixture(['pj'])
  try {
    const [{ character, token }] = fx.chars
    const [second] = await db('tokens').insert({ battlemap_id: fx.battlemap.id, character_id: character.id, label: 'T-bis' }).returning('*')
    const [orphan] = await db('tokens').insert({ battlemap_id: fx.battlemap.id, label: 'sans-personnage' }).returning('*')
    assert.equal(await isTokenDead(db, fx.campaign.id, second.id), false)
    await setStatus(token.id, 'dead')
    assert.equal(await isTokenDead(db, fx.campaign.id, second.id), true)   // le 2ᵉ token du même personnage
    assert.equal(await isTokenDead(db, fx.campaign.id, orphan.id), false)
  } finally { await fx.cleanup() }
})

test('applyStunWithDuration — vivant : posé ; cadavre : refusé sans rien effacer ; gmOverride : posé ; icon_only : posé', { skip }, async () => {
  const fx = await createFixture(['pj', 'pj'])
  try {
    const [alive, dead] = fx.chars
    await applyStunWithDuration(io, db, fx.campaign.id, alive.token.id, 'etourdi', 3, 1)
    assert.deepEqual(await statusCodes(alive.token.id), ['stunned'])

    await setStatus(dead.token.id, 'dead')
    await applyStunWithDuration(io, db, fx.campaign.id, dead.token.id, 'etourdi', 3, 1)
    await applyStunWithDuration(io, db, fx.campaign.id, dead.token.id, 'inconscient', 3, 1)
    await applyStunWithDuration(io, db, fx.campaign.id, dead.token.id, 'x', 3, 1, { statusCode: 'evanoui' })
    assert.deepEqual(await statusCodes(dead.token.id), ['dead'])            // rien posé, rien effacé

    await applyStunWithDuration(io, db, fx.campaign.id, dead.token.id, 'etourdi', 3, 1, { gmOverride: true })
    assert.deepEqual(await statusCodes(dead.token.id), ['dead', 'stunned']) // MJ libre

    await db('token_statuses').where({ token_id: dead.token.id, status_code: 'stunned' }).del()
    await setMode(fx.campaign.id, 'icon_only')                              // règle inactive hors 'enforced'
    await applyStunWithDuration(io, db, fx.campaign.id, dead.token.id, 'etourdi', 3, 1)
    assert.deepEqual(await statusCodes(dead.token.id), ['dead', 'stunned'])
  } finally { await fx.cleanup() }
})

test('applyDeathConsequences — retire les 8 états interdits (tous les tokens du personnage) + étourdissement en attente, garde les autres', { skip }, async () => {
  const fx = await createFixture(['pj', 'pj'])
  try {
    const [target, other] = fx.chars
    const [second] = await db('tokens').insert({ battlemap_id: fx.battlemap.id, character_id: target.character.id, label: 'T-bis' }).returning('*')
    const interdits = ['restrained', 'off_balance', 'stunned', 'unconscious', 'asphyxia', 'blinded', 'hypothermia', 'evanoui']
    const autorises = ['burning', 'acid', 'irradiated', 'grappled', 'electrocuted', 'infected', 'poisoned', 'decompression', 'dead']
    for (const code of [...interdits, ...autorises]) await setStatus(target.token.id, code)
    await setStatus(second.id, 'blinded')
    await setStatus(other.token.id, 'stunned')                              // autre personnage : intact
    await db('combat_pending').insert({ campaign_id: fx.campaign.id, token_id: target.token.id, type: 'stun', payload: {} })

    const touched = await applyDeathConsequences(io, db, fx.campaign.id, target.character.id)

    assert.deepEqual(await statusCodes(target.token.id), [...autorises].sort())
    assert.deepEqual(await statusCodes(second.id), [])
    assert.deepEqual(await statusCodes(other.token.id), ['stunned'])
    assert.equal((await db('combat_pending').where({ campaign_id: fx.campaign.id }).select('id')).length, 0)
    assert.deepEqual([...touched].sort(), [target.token.id, second.id].sort())
  } finally { await fx.cleanup() }
})

test("applyDeathConsequences — mode icon_only : rien n'est retiré", { skip }, async () => {
  const fx = await createFixture(['pj'])
  try {
    const [{ character, token }] = fx.chars
    await setStatus(token.id, 'stunned')
    await setMode(fx.campaign.id, 'icon_only')
    assert.deepEqual(await applyDeathConsequences(io, db, fx.campaign.id, character.id), [])
    assert.deepEqual(await statusCodes(token.id), ['stunned'])
  } finally { await fx.cleanup() }
})
