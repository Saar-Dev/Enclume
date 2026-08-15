// creationVaultNative.test.mjs — Garde-fou création directement dans le Coffre (sans campagne).
//
// Couvre les deux fonctions modifiées pour ce chantier : startCreation(null, userId) doit produire
// un personnage vault_id posé / campaign_id NULL (jamais les deux, contrainte chk_characters_
// campaign_xor_vault) sans jamais consulter campaign_members, et rester idempotent comme le chemin
// campagne existant. resolveSheetAccess doit accorder l'accès au seul propriétaire, sans notion de
// MJ, pour ce même personnage.
//
// Lancement manuel : node --env-file=../.env --test server/src/services/creationVaultNative.test.mjs

import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { startCreation, resolveSheetAccess } from './creationService.js'

const skip = !process.env.DATABASE_URL

async function createUser(suffix) {
  const [user] = await db('users')
    .insert({ email: `vault-native-${suffix}-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: `vn-${suffix}` })
    .returning('*')
  return user
}

async function cleanup(...users) {
  // Cascade : users → vaults (ON DELETE CASCADE) → characters.vault_id (ON DELETE CASCADE) →
  // char_sheet et tables filles — un seul DELETE suffit, pas de nettoyage manuel table par table.
  for (const user of users) {
    if (user) await db('users').where({ id: user.id }).del()
  }
}

test('startCreation(null, userId) crée un personnage Coffre-native (vault_id posé, campaign_id NULL, type pj)', { skip }, async () => {
  const user = await createUser('start')
  try {
    const result = await startCreation(null, user.id)
    assert.ok(result.sheetId, 'sheetId doit être renvoyé')
    assert.ok(result.characterId, 'characterId doit être renvoyé')

    const character = await db('characters').where({ id: result.characterId }).first()
    assert.equal(character.campaign_id, null, 'campaign_id doit rester NULL pour un personnage Coffre-native')
    assert.ok(character.vault_id, 'vault_id doit être posé')
    assert.equal(character.type, 'pj', 'sans campagne, resolveOwnership retombe toujours sur pj')
    assert.equal(character.user_id, user.id)

    const vault = await db('vaults').where({ id: character.vault_id }).first()
    assert.equal(vault.user_id, user.id, 'le vault créé doit appartenir à l\'utilisateur qui a démarré la création')

    // Settings par défaut du schéma (aucune campagne à lire) — ambiance par défaut du projet.
    assert.equal(result.ambiance, 'INTERMEDIAIRE')
  } finally {
    await cleanup(user)
  }
})

test('startCreation(null, userId) est idempotent : un second appel retourne le même brouillon, un seul vault créé', { skip }, async () => {
  const user = await createUser('idem')
  try {
    const first = await startCreation(null, user.id)
    const second = await startCreation(null, user.id)

    assert.equal(second.sheetId, first.sheetId, 'le second appel doit retourner le même brouillon, pas un doublon')
    assert.equal(second.characterId, first.characterId)

    const vaults = await db('vaults').where({ user_id: user.id })
    assert.equal(vaults.length, 1, 'un seul vault doit exister pour cet utilisateur malgré les deux appels')

    const characters = await db('characters').where({ vault_id: vaults[0].id })
    assert.equal(characters.length, 1, 'aucun personnage en double ne doit avoir été créé')
  } finally {
    await cleanup(user)
  }
})

test('resolveSheetAccess : le propriétaire d\'un personnage Coffre-native y accède, isGm toujours false', { skip }, async () => {
  const user = await createUser('access-owner')
  try {
    const { sheetId } = await startCreation(null, user.id)
    const access = await resolveSheetAccess(sheetId, user.id)
    assert.equal(access.isGm, false, 'aucun MJ ne peut exister pour un personnage sans campagne')
    assert.equal(access.character.user_id, user.id)
  } finally {
    await cleanup(user)
  }
})

test('resolveSheetAccess : un autre utilisateur n\'a pas accès à un personnage Coffre-native qui ne lui appartient pas', { skip }, async () => {
  const owner = await createUser('access-owner2')
  const stranger = await createUser('access-stranger')
  try {
    const { sheetId } = await startCreation(null, owner.id)
    await assert.rejects(
      () => resolveSheetAccess(sheetId, stranger.id),
      (err) => err.statusCode === 403,
      'un utilisateur tiers doit être refusé (403), jamais un accès silencieux ni un 500'
    )
  } finally {
    await cleanup(owner, stranger)
  }
})

test.after(async () => { await db.destroy() })
