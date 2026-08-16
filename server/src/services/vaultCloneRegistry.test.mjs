// vaultCloneRegistry.test.mjs — VAULT-REGISTRY-DRIFT1 + chantier Coffre (docs/EN_COURS.md,
// 2026-08-16).
//
// Avant VAULT-REGISTRY-DRIFT1, cloneCharacterDeep échouait pour TOUT personnage (AppError 500,
// assertRegistryUpToDate) : 6 tables avaient une FK réelle vers characters/char_sheet sans être ni
// enregistrées ni exclues (char_gauges, char_inventory_slots, chat_messages, exo_sheet,
// game_echeances, wizard_locks) — jamais détecté faute de test automatisé sur cloneCharacterDeep.
// Ce fichier comble ce trou : succès du clonage pj/drone/exo (regression + nouveau), vérification
// explicite du cas piège (char_inventory_slots, double FK remappée par cloneInventoryWithSlots, pas
// par le cloneRows générique), et — chantier Coffre — le retrait du rejet creation_state
// (philosophie "confiance à la frontière" : un brouillon inachevé est transférable, la fiche
// devient un personnage réel dès le clonage, quel que soit son état d'avancement).
//
// Lancement manuel : node --env-file=../.env --test server/src/services/vaultCloneRegistry.test.mjs

import test from 'node:test'
import assert from 'node:assert/strict'

import db from '../db/knex.js'
import { cloneCharacterDeep } from './vaultService.js'

const skip = !process.env.DATABASE_URL

async function createUser(suffix) {
  const [user] = await db('users')
    .insert({ email: `vault-clone-${suffix}-${Date.now()}-${Math.random()}@test.local`, password_hash: 'x', username: `vc-${suffix}` })
    .returning('*')
  return user
}

async function createVault(userId) {
  const [vault] = await db('vaults').insert({ user_id: userId }).returning('*')
  return vault
}

async function cleanup(...users) {
  for (const user of users) {
    if (user) await db('users').where({ id: user.id }).del()
  }
}

test('cloneCharacterDeep(pj) réussit et clone char_inventory + char_inventory_slots avec les deux FK correctement remappées', { skip }, async () => {
  const user = await createUser('pj')
  try {
    const vault = await createVault(user.id)
    const [character] = await db('characters').insert({
      vault_id: vault.id, user_id: user.id, name: 'Test PJ', color: '#4A90D9', type: 'pj', visible: false,
    }).returning('*')
    const [sheet] = await db('char_sheet').insert({
      character_id: character.id, creation_state: 'complete',
    }).returning('*')

    const [item1] = await db('char_inventory').insert({
      character_id: character.id, custom_name: 'Couteau', container: 'Sac',
    }).returning('*')
    const [item2] = await db('char_inventory').insert({
      character_id: character.id, custom_name: 'Bouclier', container: 'Sac',
    }).returning('*')
    await db('char_inventory_slots').insert([
      { char_inventory_id: item1.id, character_id: character.id, slot_code: 'MG' },
      { char_inventory_id: item2.id, character_id: character.id, slot_code: 'BG' },
    ])

    const clone = await cloneCharacterDeep(character.id, { vaultId: vault.id })
    assert.notEqual(clone.id, character.id, 'le clone doit être une nouvelle ligne characters')

    const clonedItems = await db('char_inventory').where({ character_id: clone.id })
    assert.equal(clonedItems.length, 2, 'les 2 items d\'inventaire doivent être clonés')

    const clonedSlots = await db('char_inventory_slots').where({ character_id: clone.id })
    assert.equal(clonedSlots.length, 2, 'les 2 slots doivent être clonés')

    const clonedItemIds = new Set(clonedItems.map(i => i.id))
    for (const slot of clonedSlots) {
      assert.equal(slot.character_id, clone.id, 'slot.character_id doit pointer le nouveau personnage')
      assert.ok(clonedItemIds.has(slot.char_inventory_id),
        'slot.char_inventory_id doit pointer un item CLONÉ, pas l\'ancien item source')
      assert.notEqual(slot.char_inventory_id, item1.id)
      assert.notEqual(slot.char_inventory_id, item2.id)
    }

    // Chaque item cloné garde le bon slot (pas de mélange MG/BG entre les deux items).
    const shieldClone = clonedItems.find(i => i.custom_name === 'Bouclier')
    const shieldSlot = clonedSlots.find(s => s.char_inventory_id === shieldClone.id)
    assert.equal(shieldSlot.slot_code, 'BG')

    await db('char_sheet').where({ id: sheet.id }).del()
  } finally {
    await cleanup(user)
  }
})

test('cloneCharacterDeep(drone) réussit toujours (non-régression) et remet l\'intégrité à neuf', { skip }, async () => {
  const user = await createUser('drone')
  try {
    const vault = await createVault(user.id)
    const [character] = await db('characters').insert({
      vault_id: vault.id, user_id: user.id, name: 'Test Drone', color: '#4A90D9', type: 'drone', visible: false,
    }).returning('*')
    await db('drone_sheet').insert({
      character_id: character.id, integrite_max: 20, integrite_actuelle: 5, damages: JSON.stringify({ corps: 3 }),
    })

    const clone = await cloneCharacterDeep(character.id, { vaultId: vault.id })
    const clonedSheet = await db('drone_sheet').where({ character_id: clone.id }).first()
    assert.equal(clonedSheet.integrite_actuelle, 20, 'intégrité remise au max sur le clone')
    assert.deepEqual(clonedSheet.damages, {}, 'dégâts remis à zéro sur le clone')
  } finally {
    await cleanup(user)
  }
})

test('cloneCharacterDeep(exo) réussit (nouveau, VAULT-REGISTRY-DRIFT1) et remet intégrité/pilote à neuf', { skip }, async () => {
  const user = await createUser('exo')
  try {
    const vault = await createVault(user.id)
    const [pilot] = await db('characters').insert({
      vault_id: vault.id, user_id: user.id, name: 'Pilote', color: '#4A90D9', type: 'pj', visible: false,
    }).returning('*')
    const [character] = await db('characters').insert({
      vault_id: vault.id, user_id: user.id, name: 'Test Exo', color: '#4A90D9', type: 'exo', visible: false,
    }).returning('*')
    await db('exo_sheet').insert({
      character_id: character.id,
      pilot_character_id: pilot.id,
      itg_structure_max: 20, itg_structure_current: 3,
      itg_exosquelette_max: 20, itg_exosquelette_current: 1,
      itg_generator_max: 20, itg_generator_current: 0,
      avaries_graves: 2,
    })

    const clone = await cloneCharacterDeep(character.id, { vaultId: vault.id })
    const clonedSheet = await db('exo_sheet').where({ character_id: clone.id }).first()
    assert.equal(clonedSheet.itg_structure_current, 20)
    assert.equal(clonedSheet.itg_exosquelette_current, 20)
    assert.equal(clonedSheet.itg_generator_current, 20)
    assert.equal(clonedSheet.avaries_graves, 0)
    assert.equal(clonedSheet.pilot_character_id, null, 'le clone ne doit pas hériter du pilote courant')
  } finally {
    await cleanup(user)
  }
})

test('cloneCharacterDeep(pj) réussit même pour un brouillon non finalisé (philosophie "confiance à la frontière", docs/EN_COURS.md 2026-08-16) et stampe wizard_locked_at sur le clone', { skip }, async () => {
  const user = await createUser('draft')
  try {
    const vault = await createVault(user.id)
    const [character] = await db('characters').insert({
      vault_id: vault.id, user_id: user.id, name: 'Test Brouillon', color: '#4A90D9', type: 'pj', visible: false,
    }).returning('*')
    const [sheet] = await db('char_sheet').insert({
      character_id: character.id, creation_state: 'draft_step2',
    }).returning('*')

    const clone = await cloneCharacterDeep(character.id, { vaultId: vault.id })
    const clonedSheet = await db('char_sheet').where({ character_id: clone.id }).first()
    assert.ok(clonedSheet.wizard_locked_at, 'le clone doit être stampé, même issu d\'un brouillon inachevé')
    assert.equal(clonedSheet.creation_state, 'draft_step2', 'creation_state reste tel quel, purement informatif désormais')

    await db('char_sheet').where({ id: sheet.id }).del()
  } finally {
    await cleanup(user)
  }
})

test.after(async () => { await db.destroy() })
