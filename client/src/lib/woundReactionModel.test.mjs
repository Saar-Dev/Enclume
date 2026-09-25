import test from 'node:test'
import assert from 'node:assert/strict'
import {
  selectWoundReactions, reactionTitleKey, optionLabel, remainingRatio, chanceAfterCheapest, splitStack, STACK_MAX_ROWS,
} from './woundReactionModel.js'

const entry = (id, woundSeverity, rolledAt, extra = {}) => ({ id, site: 'wound_severity', woundSeverity, rolledAt, ...extra })

test('selectWoundReactions — seules les réactions de blessure, la plus grave d\'abord, à égalité la plus ancienne', () => {
  const list = [
    entry('a', 'grave', '2026-09-25T10:00:10Z'),
    { id: 'x', site: 'assault', rolledAt: '2026-09-25T10:00:00Z' },
    entry('b', 'mort_subite', '2026-09-25T10:00:20Z', { fatal: true }),
    entry('c', 'grave', '2026-09-25T10:00:05Z'),
    entry('d', 'critique', '2026-09-25T10:00:01Z'),
  ]
  assert.deepEqual(selectWoundReactions(list).map(e => e.id), ['b', 'd', 'c', 'a'])
  assert.deepEqual(selectWoundReactions(undefined), [])
})

test('reactionTitleKey — Mort subite, Membre détruit, sinon la gravité', () => {
  assert.equal(reactionTitleKey({ fatal: true, woundSeverity: 'mort_subite' }), 'chance.reaction.titleDeath')
  assert.equal(reactionTitleKey({ fatal: false, woundSeverity: 'mort_subite' }), 'chance.reaction.titleLimb')
  assert.equal(reactionTitleKey({ fatal: false, woundSeverity: 'grave' }), 'resultPanels.severity.grave')
})

test('optionLabel — un rachat (coût ≠ degrés) parle de survie ; sinon « Réduire »', () => {
  const death = { fatal: true }
  assert.deepEqual(optionLabel(death, { degree: 1, cost: 3, targetSeverity: 'critique' }),
    { key: 'chance.reaction.rescueDeath', params: { severity: 'critique' } })
  assert.deepEqual(optionLabel({ fatal: false }, { degree: 1, cost: 3, targetSeverity: 'critique' }),
    { key: 'chance.reaction.rescueLimb', params: { severity: 'critique' } })
  assert.deepEqual(optionLabel({}, { degree: 1, cost: 1, targetSeverity: 'moyenne' }),
    { key: 'chance.reaction.reduceOne', params: { severity: 'moyenne' } })
  assert.deepEqual(optionLabel({}, { degree: 2, cost: 2, targetSeverity: 'legere' }),
    { key: 'chance.reaction.reduceMany', params: { degree: 2, severity: 'legere' } })
})

test('remainingRatio — fraction bornée ; pas de minuteur → null', () => {
  assert.equal(remainingRatio(45, 45000), 1)
  assert.equal(remainingRatio(31, 45000), 31 / 45)
  assert.equal(remainingRatio(0, 45000), 0)
  assert.equal(remainingRatio(99, 45000), 1)
  assert.equal(remainingRatio(null, 45000), null)
  assert.equal(remainingRatio(10, null), null)
})

test('chanceAfterCheapest — Chance restante après l\'option la moins chère', () => {
  const options = [{ cost: 1 }, { cost: 2 }]
  assert.equal(chanceAfterCheapest(9, options), 8)
  assert.equal(chanceAfterCheapest(8, [{ cost: 3 }]), 5)
  assert.equal(chanceAfterCheapest(null, options), null)
  assert.equal(chanceAfterCheapest(9, []), null)
})

test('splitStack — les premières lignes et le nombre de masquées', () => {
  const five = ['a', 'b', 'c', 'd', 'e']
  assert.deepEqual(splitStack(five), { shown: ['a', 'b', 'c'], hiddenCount: 2 })
  assert.deepEqual(splitStack(['a', 'b']), { shown: ['a', 'b'], hiddenCount: 0 })
  assert.equal(STACK_MAX_ROWS, 3)
})
