// socketCombatHelpers.droneIntegrity.test.mjs — resolveDroneIntegrityLoss (DRONE-INTEGRITY-LOSS-PER-HIT-RAW,
// 2026-10-13). Avant ce correctif, l'intégrité baissait de 1 à CHAQUE touche, même sous 5 de dégâts
// nets (aucune case cochée). Décision de Saar : alignement sur l'exo-armure (REGLEARMURE.md:341-353,
// reprise par les drones REGLEDRONE.md:48-50) — seule la 1ère Avarie du palier le plus grave
// (« mortelle ») coûte un point d'Intégrité, jamais un coup léger/moyen/grave/critique, jamais une
// 2ᵉ Avarie du même palier.
//
// Lancement manuel (depuis la racine) : node --env-file=.env --test server/src/socket/socketCombatHelpers.droneIntegrity.test.mjs

import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import db from '../db/knex.js'
import { createCompanionSheet } from '../services/charSheetService.js'
import { resolveDroneIntegrityLoss } from './socketCombatHelpers.js'

const skip = !process.env.DATABASE_URL
const io = { to: () => ({ emit: () => {} }) }

async function createDroneFixture() {
  const [user] = await db('users')
    .insert({ email: `drone-itg-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: 'drone-itg-user' })
    .returning('*')
  const [vault] = await db('vaults').insert({ user_id: user.id }).returning('*')
  const [character] = await db('characters')
    .insert({ vault_id: vault.id, user_id: user.id, name: 'Drone test', color: '#4A90D9', type: 'drone' })
    .returning('*')
  await db.transaction(trx => createCompanionSheet(trx, { characterId: character.id, type: 'drone' }))
  const getSheet = () => db('drone_sheet').where({ character_id: character.id }).first()
  const cleanup = async () => { await db('users').where({ id: user.id }).del() }
  return { user, character, getSheet, cleanup }
}

test('resolveDroneIntegrityLoss — coup léger (5 dégâts nets) : case légère cochée, intégrité intacte', { skip }, async () => {
  const fx = await createDroneFixture()
  try {
    const before = await fx.getSheet()
    const result = await resolveDroneIntegrityLoss(io, randomUUID(), fx.character.id, randomUUID(), before, 5)
    assert.equal(result.severity, 'legere')
    assert.equal(result.newIntegrite, before.integrite_actuelle)
    const after = await fx.getSheet()
    assert.equal(after.integrite_actuelle, before.integrite_actuelle)
    assert.equal(after.damages.legere.filter(Boolean).length, 1)
  } finally { await fx.cleanup() }
})

test('resolveDroneIntegrityLoss — 1ère Avarie mortelle (25 dégâts nets) : case cochée, intégrité -1', { skip }, async () => {
  const fx = await createDroneFixture()
  try {
    const before = await fx.getSheet()
    const result = await resolveDroneIntegrityLoss(io, randomUUID(), fx.character.id, randomUUID(), before, 25)
    assert.equal(result.severity, 'mortelle')
    assert.equal(result.newIntegrite, before.integrite_actuelle - 1)
    const after = await fx.getSheet()
    assert.equal(after.integrite_actuelle, before.integrite_actuelle - 1)
    assert.equal(after.damages.mortelle.filter(Boolean).length, 1)
  } finally { await fx.cleanup() }
})

test('resolveDroneIntegrityLoss — 2e Avarie mortelle : case suivante cochée, AUCUNE perte d\'intégrité supplémentaire', { skip }, async () => {
  const fx = await createDroneFixture()
  try {
    const first = await fx.getSheet()
    await resolveDroneIntegrityLoss(io, randomUUID(), fx.character.id, randomUUID(), first, 25)
    const afterFirst = await fx.getSheet()
    const result = await resolveDroneIntegrityLoss(io, randomUUID(), fx.character.id, randomUUID(), afterFirst, 26)
    assert.equal(result.severity, 'mortelle')
    assert.equal(result.newIntegrite, afterFirst.integrite_actuelle) // inchangée par rapport à APRÈS la 1ère
    const after = await fx.getSheet()
    assert.equal(after.integrite_actuelle, afterFirst.integrite_actuelle)
    assert.equal(after.damages.mortelle.filter(Boolean).length, 2)
  } finally { await fx.cleanup() }
})

test('resolveDroneIntegrityLoss — destruction (30 dégâts nets) : intégrité à 0, détruit', { skip }, async () => {
  const fx = await createDroneFixture()
  try {
    const before = await fx.getSheet()
    const result = await resolveDroneIntegrityLoss(io, randomUUID(), fx.character.id, randomUUID(), before, 30)
    assert.equal(result.severity, 'detruit')
    assert.equal(result.newIntegrite, 0)
    assert.equal(result.detruit, true)
    const after = await fx.getSheet()
    assert.equal(after.integrite_actuelle, 0)
  } finally { await fx.cleanup() }
})

test.after(async () => { await db.destroy() })
