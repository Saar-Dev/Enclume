import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDice, isValidDiceFormula, rollSignedDie, rollDamageFormula } from './diceParser.js'

test('parseDice — formule simple, total dans les bornes, dieType correct', async () => {
  const result = await parseDice('3d6+2')
  assert.equal(result.rolls.length, 3)
  assert.ok(result.rolls.every(r => r >= 1 && r <= 6))
  assert.equal(result.total, result.rolls.reduce((a, b) => a + b, 0) + 2)
  assert.equal(result.dieType, 'd6')
})

test('parseDice — formule invalide lève toujours (comportement inchangé après extraction de parseFormulaShape)', async () => {
  await assert.rejects(() => parseDice('pas une formule'))
  await assert.rejects(() => parseDice('3d6+2d8'))
  await assert.rejects(() => parseDice(''))
  await assert.rejects(() => parseDice(null))
})

test('isValidDiceFormula — true sur formule valide, jamais de jet (fonction pure, pas de rolls exposés)', () => {
  assert.equal(isValidDiceFormula('1d6'), true)
  assert.equal(isValidDiceFormula('3d10+2'), true)
  assert.equal(isValidDiceFormula('1d3+3'), true)
})

test('isValidDiceFormula — false sur formule invalide, jamais un throw', () => {
  assert.equal(isValidDiceFormula('pas une formule'), false)
  assert.equal(isValidDiceFormula('3d6+2d8'), false)
  assert.equal(isValidDiceFormula(''), false)
  assert.equal(isValidDiceFormula(null), false)
  assert.equal(isValidDiceFormula(undefined), false)
})

test('rollSignedDie — "+0" et chaîne absente → exactement 0 (déterministe)', async () => {
  assert.equal(await rollSignedDie('+0'), 0)
  assert.equal(await rollSignedDie(''), 0)
  assert.equal(await rollSignedDie(null), 0)
  assert.equal(await rollSignedDie(undefined), 0)
})

test('rollSignedDie — signe de tête appliqué au total, bornes respectées', async () => {
  for (let i = 0; i < 50; i += 1) {
    const plus = await rollSignedDie('+1D10')
    assert.ok(plus >= 1 && plus <= 10, `+1D10 hors bornes : ${plus}`)
    const minus = await rollSignedDie('-2D10')
    assert.ok(minus >= -20 && minus <= -2, `-2D10 hors bornes : ${minus}`)
  }
})

test('rollSignedDie — sans signe de tête → traité comme positif', async () => {
  const v = await rollSignedDie('3D10')
  assert.ok(v >= 3 && v <= 30, `3D10 hors bornes : ${v}`)
})

// EXO-CHOC-PUR-TIR-BLOQUE — arme catalogue à Choc pur (damage_h null, ex. Fusil sonique incap.
// sirène/Flex) : formule vide légitime, jamais un throw (contrairement à parseDice ci-dessus).
test('rollDamageFormula — formule absente (arme Choc pur) → 0 dégât, jamais un throw', async () => {
  assert.deepEqual(await rollDamageFormula(''), { rolls: [], total: 0, formula: '', dieType: null, seed: 0 })
  assert.deepEqual(await rollDamageFormula(null), { rolls: [], total: 0, formula: '', dieType: null, seed: 0 })
  assert.deepEqual(await rollDamageFormula(undefined), { rolls: [], total: 0, formula: '', dieType: null, seed: 0 })
})

test('rollDamageFormula — formule présente → même résultat que parseDice, aucun changement de comportement', async () => {
  const result = await rollDamageFormula('2d10+2')
  assert.equal(result.rolls.length, 2)
  assert.ok(result.rolls.every(r => r >= 1 && r <= 10))
  assert.equal(result.total, result.rolls.reduce((a, b) => a + b, 0) + 2)
})

test('rollDamageFormula — formule mixte/invalide reste un throw (jamais avalée silencieusement)', async () => {
  await assert.rejects(() => rollDamageFormula('3d6+2d8'))
  await assert.rejects(() => rollDamageFormula('pas une formule'))
})
