import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WOUND_PENALTIES, isTestBlockingWound, isMortalWoundImmobilized, WOUND_HEALING, WOUND_INFECTION } from './woundConstants.js'

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

test('WOUND_HEALING - durées RAW en minutes (REGLEBLESSURES.md:420-433, vérifiées contre le LdB p.238)', () => {
  assert.equal(WOUND_HEALING.moyenne.durationMinutes, 3 * 1440)
  assert.equal(WOUND_HEALING.grave.durationMinutes, 7 * 1440)
  assert.equal(WOUND_HEALING.critique.durationMinutes, 21 * 1440)
  assert.equal(WOUND_HEALING.mortelle.durationMinutes, 35 * 1440)
  assert.equal(WOUND_HEALING.legere, undefined) // guérit seule, jamais d'échéance
})

test('WOUND_HEALING - soinsConstants distingue les échéances uniques des récurrentes', () => {
  assert.equal(WOUND_HEALING.moyenne.soinsConstants, false)
  assert.equal(WOUND_HEALING.grave.soinsConstants, false)
  assert.equal(WOUND_HEALING.critique.soinsConstants, true)
  assert.equal(WOUND_HEALING.mortelle.soinsConstants, true)
})

test('WOUND_INFECTION - modificateurs de base RAW (REGLEBLESSURES.md:436-472, vérifiés p.239-240)', () => {
  assert.equal(WOUND_INFECTION.moyenne.baseModifier, 5)
  assert.equal(WOUND_INFECTION.grave.baseModifier, 0)
  assert.equal(WOUND_INFECTION.critique.baseModifier, -5)
  assert.equal(WOUND_INFECTION.mortelle.baseModifier, -10)
  assert.equal(WOUND_INFECTION.legere, undefined)
})

test('WOUND_INFECTION - caseMalus absent uniquement pour Moyenne (relecture RAW attentive)', () => {
  assert.equal(WOUND_INFECTION.moyenne.caseMalus, false)
  assert.equal(WOUND_INFECTION.grave.caseMalus, true)
  assert.equal(WOUND_INFECTION.critique.caseMalus, true)
  assert.equal(WOUND_INFECTION.mortelle.caseMalus, true)
})

test('WOUND_INFECTION - infectsOnSuccess vrai uniquement pour Critique/Mortelle', () => {
  assert.equal(WOUND_INFECTION.moyenne.infectsOnSuccess, false)
  assert.equal(WOUND_INFECTION.grave.infectsOnSuccess, false)
  assert.equal(WOUND_INFECTION.critique.infectsOnSuccess, true)
  assert.equal(WOUND_INFECTION.mortelle.infectsOnSuccess, true)
})
