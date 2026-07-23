import test from 'node:test'
import assert from 'node:assert/strict'

import { atiOnTurnStart, atiOnCalculateModifiers } from './ati.js'

// rollDice mocké déterministe — pas de vrai dé, seul le comportement RAW est sous test ici (le
// vrai parseDice est couvert par server/src/services/weaponModService.test.mjs).
const rollDice = (total) => async () => ({ total, rolls: [total], seed: total })

test('onTurnStart — aucune cible configurée (pas d’UI Phase 4) -> no-op strict', async () => {
  const result = await atiOnTurnStart(null, { modLevel: 12, rollDice: rollDice(1), targetCharacterId: 'char-B' })
  assert.deepEqual(result, { updatedState: null, tokenEffects: [] })
})

test('onTurnStart — Test réussi avant activation : la marge s’ajoute à cumulativeMR, pas encore actif', async () => {
  const modState = { ati: { mode: 'offensive', targetCharacterId: 'char-B', cumulativeMR: 5, active: false, currentEffect: 0 } }
  // modLevel 12, roll 4 -> marge = 8 -> cumulativeMR = 13, toujours < 20
  const result = await atiOnTurnStart(modState, { modLevel: 12, rollDice: rollDice(4), targetCharacterId: 'char-B' })
  assert.equal(result.updatedState.ati.cumulativeMR, 13)
  assert.equal(result.updatedState.ati.active, false)
  assert.deepEqual(result.tokenEffects, [])
})

test('onTurnStart — franchissement du seuil de 20 : activation, currentEffect reste à 0 ce tour-là', async () => {
  const modState = { ati: { mode: 'offensive', targetCharacterId: 'char-B', cumulativeMR: 15, active: false, currentEffect: 0 } }
  // modLevel 12, roll 3 -> marge = 9 -> cumulativeMR = 24 >= 20 -> active
  const result = await atiOnTurnStart(modState, { modLevel: 12, rollDice: rollDice(3), targetCharacterId: 'char-B' })
  assert.equal(result.updatedState.ati.active, true)
  assert.equal(result.updatedState.ati.currentEffect, 0)
  assert.deepEqual(result.tokenEffects, [{ statusCode: 'ati_offensive' }])
})

test('onTurnStart — actif, Test suivant réussi : +1 par Test, jamais avant', async () => {
  const modState = { ati: { mode: 'offensive', targetCharacterId: 'char-B', cumulativeMR: 24, active: true, currentEffect: 0 } }
  const result = await atiOnTurnStart(modState, { modLevel: 12, rollDice: rollDice(5), targetCharacterId: 'char-B' })
  assert.equal(result.updatedState.ati.currentEffect, 1)
})

test('onTurnStart — plafond +4 jamais dépassé', async () => {
  const modState = { ati: { mode: 'offensive', targetCharacterId: 'char-B', cumulativeMR: 40, active: true, currentEffect: 4 } }
  const result = await atiOnTurnStart(modState, { modLevel: 12, rollDice: rollDice(5), targetCharacterId: 'char-B' })
  assert.equal(result.updatedState.ati.currentEffect, 4)
})

test('onTurnStart — Test raté : aucune progression, ni cumul ni effet', async () => {
  const modState = { ati: { mode: 'offensive', targetCharacterId: 'char-B', cumulativeMR: 10, active: false, currentEffect: 0 } }
  // modLevel 12, roll 15 -> échec (15 > 12)
  const result = await atiOnTurnStart(modState, { modLevel: 12, rollDice: rollDice(15), targetCharacterId: 'char-B' })
  assert.equal(result.updatedState.ati.cumulativeMR, 10)
  assert.equal(result.updatedState.ati.active, false)
})

test('onTurnStart — changement de cible : mécanique mono-cible, tout repart de zéro', async () => {
  const modState = { ati: { mode: 'offensive', targetCharacterId: 'char-B', cumulativeMR: 18, active: false, currentEffect: 0 } }
  const result = await atiOnTurnStart(modState, { modLevel: 12, rollDice: rollDice(10), targetCharacterId: 'char-C' })
  assert.equal(result.updatedState.ati.targetCharacterId, 'char-C')
  // marge du nouveau test (12-10=2) s'ajoute à un cumul reparti de 0, pas de 18
  assert.equal(result.updatedState.ati.cumulativeMR, 2)
})

test('onCalculateModifiers — inactif -> aucun bonus', async () => {
  const modState = { ati: { mode: 'offensive', targetCharacterId: 'char-B', active: false, currentEffect: 0 } }
  const result = await atiOnCalculateModifiers(modState, { targetCharacterId: 'char-B' })
  assert.deepEqual(result, { bonusAttaque: 0, bonusDefense: 0, breakdowns: [] })
})

test('onCalculateModifiers — actif, mode offensif, cible correspondante -> bonusAttaque', async () => {
  const modState = { ati: { mode: 'offensive', targetCharacterId: 'char-B', active: true, currentEffect: 3 } }
  const result = await atiOnCalculateModifiers(modState, { targetCharacterId: 'char-B' })
  assert.deepEqual(result, { bonusAttaque: 3, bonusDefense: 0, breakdowns: [{ name: 'Analyseur tactique individuel', value: 3 }] })
})

test('onCalculateModifiers — actif, mode défensif -> bonusDefense, jamais bonusAttaque', async () => {
  const modState = { ati: { mode: 'defensive', targetCharacterId: 'char-B', active: true, currentEffect: 2 } }
  const result = await atiOnCalculateModifiers(modState, { targetCharacterId: 'char-B' })
  assert.equal(result.bonusAttaque, 0)
  assert.equal(result.bonusDefense, 2)
})

test('onCalculateModifiers — actif mais cible différente : "une seule cible à la fois" (RAW) -> aucun bonus', async () => {
  const modState = { ati: { mode: 'offensive', targetCharacterId: 'char-B', active: true, currentEffect: 3 } }
  const result = await atiOnCalculateModifiers(modState, { targetCharacterId: 'char-AUTRE' })
  assert.deepEqual(result, { bonusAttaque: 0, bonusDefense: 0, breakdowns: [] })
})
