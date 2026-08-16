// charSheetService.test.mjs — createCompanionSheet (docs/EN_COURS.md, 2026-08-16).
//
// createCompanionSheet extrait le branchement par type auparavant dupliqué entre
// routes/characters.js (POST campagne, GM uniquement) et routes/vault.js (POST Coffre, création
// directe par le propriétaire) — une seule autorité pour "quelle fiche crée-t-on selon le type".
// Ce fichier couvre les trois branches contre PostgreSQL réel ; aucun test n'existait avant sur
// cette logique (elle vivait, non testée, dans routes/characters.js).
//
// Lancement manuel : node --env-file=../.env --test server/src/services/charSheetService.test.mjs

import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { createCompanionSheet } from './charSheetService.js'

const skip = !process.env.DATABASE_URL

async function createUser(suffix) {
  const [user] = await db('users')
    .insert({ email: `char-sheet-${suffix}-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: `cs-${suffix}` })
    .returning('*')
  return user
}

async function createCharacter(user, type) {
  const [vault] = await db('vaults').insert({ user_id: user.id }).returning('*')
  const [character] = await db('characters').insert({
    vault_id: vault.id, user_id: user.id, name: `Test ${type}`, color: '#4A90D9', type,
  }).returning('*')
  return character
}

async function cleanup(...users) {
  for (const user of users) {
    if (user) await db('users').where({ id: user.id }).del()
  }
}

test('createCompanionSheet(type=pj) crée char_sheet+identity+archetype+attributes (createEmptySheet)', { skip }, async () => {
  const user = await createUser('pj')
  try {
    const character = await createCharacter(user, 'pj')
    await db.transaction(trx => createCompanionSheet(trx, { characterId: character.id, type: 'pj' }))

    const sheet = await db('char_sheet').where({ character_id: character.id }).first()
    assert.ok(sheet, 'char_sheet doit exister')
    const identity = await db('char_identity').where({ char_sheet_id: sheet.id }).first()
    assert.ok(identity, 'char_identity doit exister')
    const attributes = await db('char_attributes').where({ char_sheet_id: sheet.id })
    assert.equal(attributes.length, 8, 'les 8 attributs doivent être initialisés à FOR..PRE')
  } finally {
    await cleanup(user)
  }
})

test('createCompanionSheet(type=drone) crée drone_sheet avec des dégâts initialisés, pas char_sheet', { skip }, async () => {
  const user = await createUser('drone')
  try {
    const character = await createCharacter(user, 'drone')
    await db.transaction(trx => createCompanionSheet(trx, { characterId: character.id, type: 'drone' }))

    const droneSheet = await db('drone_sheet').where({ character_id: character.id }).first()
    assert.ok(droneSheet, 'drone_sheet doit exister')
    assert.ok(droneSheet.damages, 'damages doit être initialisé')

    const charSheet = await db('char_sheet').where({ character_id: character.id }).first()
    assert.equal(charSheet, undefined, 'un drone ne doit jamais avoir de char_sheet')
  } finally {
    await cleanup(user)
  }
})

test('createCompanionSheet(type=exo) crée exo_sheet vide (non configurée, sans template), pas char_sheet', { skip }, async () => {
  const user = await createUser('exo')
  try {
    const character = await createCharacter(user, 'exo')
    await db.transaction(trx => createCompanionSheet(trx, { characterId: character.id, type: 'exo' }))

    const exoSheet = await db('exo_sheet').where({ character_id: character.id }).first()
    assert.ok(exoSheet, 'exo_sheet doit exister')
    assert.equal(exoSheet.template_id, null, 'aucun template au moment de la création directe')

    const charSheet = await db('char_sheet').where({ character_id: character.id }).first()
    assert.equal(charSheet, undefined, 'une exo-armure ne doit jamais avoir de char_sheet')
  } finally {
    await cleanup(user)
  }
})

test.after(async () => { await db.destroy() })
