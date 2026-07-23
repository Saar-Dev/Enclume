import test from 'node:test'
import assert from 'node:assert/strict'

import { computeSkillAllocation } from './careerSkills.js'

test('budget = 10 pts/an, somme sur toutes les carrieres (aucune allocation -> cout nul)', () => {
  const result = computeSkillAllocation({}, { careers: [{ years: 6 }, { years: 4 }] })
  assert.equal(result.budget, 100)
  assert.equal(result.totalCost, 0)
  assert.equal(result.remaining, 100)
  assert.equal(result.errors.length, 0)
})

test('extraBudgetDelta (Revers Renvoi, points_cap skill_points) ajuste le budget character-wide une seule fois', () => {
  const withoutDelta = computeSkillAllocation({}, { careers: [{ years: 10 }] })
  const withDelta = computeSkillAllocation({}, { careers: [{ years: 10 }], extraBudgetDelta: -5 })
  assert.equal(withoutDelta.budget, 100)
  assert.equal(withDelta.budget, 95)
})
