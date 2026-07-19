import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WOUND_PENALTIES, isTestBlockingWound, isMortalWoundImmobilized } from './woundConstants.js'

test('WOUND_PENALTIES.mortelle - plus de sentinel numérique (LdB : "non applicable")', () => {
  assert.equal(WOUND_PENALTIES.mortelle, 0)
})

test('isTestBlockingWound - détecte une blessure mortelle', () => {
  assert.equal(isTestBlockingWound([{ severity: 'critique' }, { severity: 'mortelle', wound_location: 'corps' }]), true)
})

test('isTestBlockingWound - grave/critique seuls ne bloquent pas', () => {
  assert.equal(isTestBlockingWound([{ severity: 'grave' }, { severity: 'critique' }]), false)
})

test('isTestBlockingWound - tableau vide/absent -> false', () => {
  assert.equal(isTestBlockingWound([]), false)
  assert.equal(isTestBlockingWound(), false)
})

test('isMortalWoundImmobilized - jambe mortelle bloque même le déplacement', () => {
  assert.equal(isMortalWoundImmobilized([{ severity: 'mortelle', wound_location: 'jambe_gauche' }]), true)
  assert.equal(isMortalWoundImmobilized([{ severity: 'mortelle', wound_location: 'jambe_droite' }]), true)
})

test('isMortalWoundImmobilized - bras/corps/tête mortelle laisse le déplacement lente possible', () => {
  assert.equal(isMortalWoundImmobilized([{ severity: 'mortelle', wound_location: 'bras_droit' }]), false)
  assert.equal(isMortalWoundImmobilized([{ severity: 'mortelle', wound_location: 'corps' }]), false)
  assert.equal(isMortalWoundImmobilized([{ severity: 'mortelle', wound_location: 'tete' }]), false)
})
