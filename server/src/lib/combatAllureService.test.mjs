import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { resolveMovementGait, resolveRangedAllureKeys } from './combatAllureService.js'

// Lancement : node --env-file=server/.env --test server/src/lib/combatAllureService.test.mjs
const skip = !process.env.DATABASE_URL

// docs/PLANS/PLAN_ALLURE.md A2 — le service ne fait que lire `combat_actions.movement_gait`
// du Tour et déléguer à rangedAllureKeyForGait (déjà couvert sans base par
// shared/combatSituationMods.test.mjs). Ces tests vérifient la couche d'accès : bon Tour,
// bons types de ligne, `skipped` ignoré, cible absente ≠ cible immobile.

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

// Combat minimal : user + campagne + battlemap + N tokens. Retourne les tokens + un helper
// pour poser une ligne de déplacement, et le cleanup (cascade campagne + battlemap).
async function createFixture(nbTokens = 2) {
  const [gm] = await db('users')
    .insert({ email: `allure-svc-${uniq()}@test.local`, password_hash: 'x', username: 'allure-svc-gm' })
    .returning('*')
  const [campaign] = await db('campaigns')
    .insert({ gm_id: gm.id, name: 'Campagne test combatAllureService', invite_code: `ALLURESVC-${uniq()}` })
    .returning('*')
  const [battlemap] = await db('battlemaps')
    .insert({ campaign_id: campaign.id, name: 'BM test' })
    .returning('*')
  const tokens = []
  for (let i = 0; i < nbTokens; i++) {
    const [character] = await db('characters')
      .insert({ campaign_id: campaign.id, user_id: gm.id, name: `Perso ${i}`, type: 'pj' })
      .returning('*')
    const [token] = await db('tokens')
      .insert({ battlemap_id: battlemap.id, character_id: character.id, label: `T${i}` })
      .returning('*')
    tokens.push(token)
  }

  // Pose une ligne de déplacement. status 'resolved' par défaut : évite la CHECK
  // chk_combat_world_plan_for_move (qui n'exige un world_plan complet que si status='pending').
  const putMove = ({ tokenId, gait, turn = 1, type = 'move_long', status = 'resolved', sequence = 1 }) =>
    db('combat_actions').insert({
      campaign_id: campaign.id, token_id: tokenId, target_token_id: null,
      type, action_key: `move_${gait}`, movement_gait: gait,
      status, turn_number: turn, sequence,
    })

  const cleanup = async () => {
    await db('combat_actions').where({ campaign_id: campaign.id }).del()
    await db('tokens').where({ battlemap_id: battlemap.id }).del()
    await db('battlemaps').where({ id: battlemap.id }).del()
    await db('campaigns').where({ id: campaign.id }).del()
    await db('users').where({ id: gm.id }).del()
  }
  return { gm, campaign, battlemap, tokens, putMove, cleanup }
}

test.after(async () => { await db.destroy() })

test('resolveMovementGait — pas de ligne de déplacement → null', { skip }, async () => {
  const fx = await createFixture(1)
  try {
    assert.equal(await resolveMovementGait(db, fx.campaign.id, fx.tokens[0].id, 1), null)
  } finally {
    await fx.cleanup()
  }
})

test('resolveMovementGait — move_long rapide résolu → "rapide"', { skip }, async () => {
  const fx = await createFixture(1)
  try {
    await fx.putMove({ tokenId: fx.tokens[0].id, gait: 'rapide' })
    assert.equal(await resolveMovementGait(db, fx.campaign.id, fx.tokens[0].id, 1), 'rapide')
  } finally {
    await fx.cleanup()
  }
})

test('resolveMovementGait — move_short lente (les deux types de ligne comptent)', { skip }, async () => {
  const fx = await createFixture(1)
  try {
    await fx.putMove({ tokenId: fx.tokens[0].id, gait: 'lente', type: 'move_short' })
    assert.equal(await resolveMovementGait(db, fx.campaign.id, fx.tokens[0].id, 1), 'lente')
  } finally {
    await fx.cleanup()
  }
})

test('resolveMovementGait — ligne status:"skipped" ignorée → null', { skip }, async () => {
  const fx = await createFixture(1)
  try {
    await fx.putMove({ tokenId: fx.tokens[0].id, gait: 'max', status: 'skipped' })
    assert.equal(await resolveMovementGait(db, fx.campaign.id, fx.tokens[0].id, 1), null)
  } finally {
    await fx.cleanup()
  }
})

test('resolveMovementGait — isolation par Tour : une ligne du Tour 1 n\'est pas vue au Tour 2', { skip }, async () => {
  const fx = await createFixture(1)
  try {
    await fx.putMove({ tokenId: fx.tokens[0].id, gait: 'moyenne', turn: 1 })
    assert.equal(await resolveMovementGait(db, fx.campaign.id, fx.tokens[0].id, 2), null)
    assert.equal(await resolveMovementGait(db, fx.campaign.id, fx.tokens[0].id, 1), 'moyenne')
  } finally {
    await fx.cleanup()
  }
})

test('resolveMovementGait — deux lignes le même Tour : la sequence la plus haute gagne', { skip }, async () => {
  const fx = await createFixture(1)
  try {
    await fx.putMove({ tokenId: fx.tokens[0].id, gait: 'lente', sequence: 1 })
    await fx.putMove({ tokenId: fx.tokens[0].id, gait: 'rapide', sequence: 2 })
    assert.equal(await resolveMovementGait(db, fx.campaign.id, fx.tokens[0].id, 1), 'rapide')
  } finally {
    await fx.cleanup()
  }
})

test('resolveMovementGait — tokenId / turnNumber null → null (pas de requête)', { skip }, async () => {
  assert.equal(await resolveMovementGait(db, 'nimporte', null, 1), null)
  assert.equal(await resolveMovementGait(db, 'nimporte', 'un-token', null), null)
})

test('resolveRangedAllureKeys — tireur moyenne + cible maximale', { skip }, async () => {
  const fx = await createFixture(2)
  try {
    await fx.putMove({ tokenId: fx.tokens[0].id, gait: 'moyenne' })
    await fx.putMove({ tokenId: fx.tokens[1].id, gait: 'max' })
    assert.deepEqual(
      await resolveRangedAllureKeys(db, fx.campaign.id, fx.tokens[0].id, fx.tokens[1].id, 1),
      { shooterAllureKey: 'tireur_allure_moyenne', targetAllureKey: 'cible_allure_maximale' },
    )
  } finally {
    await fx.cleanup()
  }
})

test('resolveRangedAllureKeys — tireur immobile (null) + cible immobile (cible_immobile +3)', { skip }, async () => {
  const fx = await createFixture(2)
  try {
    assert.deepEqual(
      await resolveRangedAllureKeys(db, fx.campaign.id, fx.tokens[0].id, fx.tokens[1].id, 1),
      { shooterAllureKey: null, targetAllureKey: 'cible_immobile' },
    )
  } finally {
    await fx.cleanup()
  }
})

test('resolveRangedAllureKeys — cible absente (zone d\'effet) : targetAllureKey null, jamais cible_immobile', { skip }, async () => {
  const fx = await createFixture(1)
  try {
    await fx.putMove({ tokenId: fx.tokens[0].id, gait: 'rapide' })
    assert.deepEqual(
      await resolveRangedAllureKeys(db, fx.campaign.id, fx.tokens[0].id, null, 1),
      { shooterAllureKey: 'tireur_allure_rapide', targetAllureKey: null },
    )
  } finally {
    await fx.cleanup()
  }
})

test('resolveRangedAllureKeys — cible à l\'Allure lente : aucun malus (targetAllureKey null)', { skip }, async () => {
  const fx = await createFixture(2)
  try {
    await fx.putMove({ tokenId: fx.tokens[1].id, gait: 'lente' })
    const r = await resolveRangedAllureKeys(db, fx.campaign.id, fx.tokens[0].id, fx.tokens[1].id, 1)
    assert.equal(r.targetAllureKey, null)
  } finally {
    await fx.cleanup()
  }
})
