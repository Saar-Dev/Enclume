import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDice, isValidDiceFormula } from './diceParser.js'

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
