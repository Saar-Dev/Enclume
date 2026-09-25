import test from 'node:test'
import assert from 'node:assert/strict'

import {
  GRAB_SOURCE_CONTAINERS, GRAB_REFUSAL, getGrabCost, isGrabbableRef, classifyGrabCandidate, getGrabConflictReasons,
} from './combatGrabItem.js'

test('getGrabCost — Ceinture : Préparation −3 sans occuper l’action ; Sac : Action simple, aucun coût d’Initiative', () => {
  assert.deepEqual(getGrabCost('Ceinture'), { iniCost: -3, occupiesAction: false })
  assert.deepEqual(getGrabCost('Sac'), { iniCost: 0, occupiesAction: true })
})

test('getGrabCost — Coffre, absent ou inconnu : null (pas une source valide)', () => {
  assert.equal(getGrabCost('Coffre'), null)
  assert.equal(getGrabCost(null), null)
  assert.equal(getGrabCost(undefined), null)
  assert.equal(getGrabCost('Poche'), null)
  assert.deepEqual([...GRAB_SOURCE_CONTAINERS], ['Ceinture', 'Sac'])
})

test('isGrabbableRef — une main (M, boucliers compris), deux mains (2M) et deux mains/trépied (2M/Tr) oui ; trépied pur, armure, conteneur, absent non', () => {
  assert.equal(isGrabbableRef({ location: 'M', category: 'Grenade' }), true)
  assert.equal(isGrabbableRef({ location: '2M', category: 'Arme d’épaule' }), true)
  // Décision Saar 2026-09-25 : rien ne distingue un bouclier d'une arme dans la main (catalogué `M`).
  assert.equal(isGrabbableRef({ location: 'M', category: 'Bouclier' }), true)
  // 11 armes lourdes du catalogue : tenables à deux mains OU montées — la v1 les excluait par oubli.
  assert.equal(isGrabbableRef({ location: '2M/Tr', category: 'Arme lourde' }), true)
  assert.equal(isGrabbableRef({ location: 'Tr', category: 'Trépied' }), false)
  assert.equal(isGrabbableRef({ location: 'T', category: 'Armure' }), false)
  assert.equal(isGrabbableRef({ location: 'D', category: 'Sac' }), false)
  assert.equal(isGrabbableRef({ location: null, category: 'Divers' }), false)
  assert.equal(isGrabbableRef(null), false)
  assert.equal(isGrabbableRef(undefined), false)
})

// classifyGrabCandidate — classification STRUCTURELLE (jamais les mains libres, le Sac ni la capacité) : autorité unique de
// l'annonce (describeGrabCandidate, sur une ligne de base) et de la résolution (swapItemInHand, sur un instantané).
test('classifyGrabCandidate — un objet rangé au Sac ou à la Ceinture, tenable : candidat', () => {
  assert.deepEqual(classifyGrabCandidate({ container: 'Sac', slots: null, refLocation: 'M' }), { ok: true, alreadyInHand: false })
  assert.deepEqual(classifyGrabCandidate({ container: 'Ceinture', slots: [], refLocation: '2M' }), { ok: true, alreadyInHand: false })
  assert.deepEqual(classifyGrabCandidate({ container: 'Sac', slots: undefined, refLocation: '2M/Tr' }), { ok: true, alreadyInHand: false })
  assert.deepEqual(classifyGrabCandidate({ container: 'Ceinture', slots: null, refLocation: 'M' }), { ok: true, alreadyInHand: false })
})

test('classifyGrabCandidate — déjà en main (y compris un bouclier au slot composite) : ok + alreadyInHand', () => {
  assert.deepEqual(classifyGrabCandidate({ container: 'Sac', slots: ['MD'], refLocation: 'M' }), { ok: true, alreadyInHand: true })
  assert.deepEqual(classifyGrabCandidate({ container: 'Sac', slots: ['BG', 'C', 'MG'], refLocation: 'M' }), { ok: true, alreadyInHand: true })
  assert.deepEqual(classifyGrabCandidate({ container: 'Sac', slots: ['2M'], refLocation: '2M' }), { ok: true, alreadyInHand: true })
})

test('classifyGrabCandidate — refus, dans l’ordre : porté ailleurs, hors Sac / Ceinture, non tenable', () => {
  assert.equal(classifyGrabCandidate({ container: 'Sac', slots: ['T'], refLocation: 'T' }).reason, GRAB_REFUSAL.EQUIPPED)
  assert.equal(classifyGrabCandidate({ container: 'Sac', slots: ['D'], refLocation: 'D' }).reason, GRAB_REFUSAL.EQUIPPED)
  assert.equal(classifyGrabCandidate({ container: 'Coffre', slots: null, refLocation: 'M' }).reason, GRAB_REFUSAL.NOT_CARRIED)
  assert.equal(classifyGrabCandidate({ container: undefined, slots: null, refLocation: 'M' }).reason, GRAB_REFUSAL.NOT_CARRIED)
  assert.equal(classifyGrabCandidate({ container: 'Sac', slots: null, refLocation: 'T' }).reason, GRAB_REFUSAL.NOT_HOLDABLE)
  assert.equal(classifyGrabCandidate({ container: 'Sac', slots: null, refLocation: 'Tr' }).reason, GRAB_REFUSAL.NOT_HOLDABLE)
  assert.equal(classifyGrabCandidate({ container: 'Sac', slots: null, refLocation: null }).reason, GRAB_REFUSAL.NOT_HOLDABLE)
})

test('getGrabConflictReasons — Sac : exclusif avec tir, corps à corps, rechargement, interaction', () => {
  assert.deepEqual(getGrabConflictReasons({ container: 'Sac', mapActions: { attack: [{}] } }), ['tir'])
  assert.deepEqual(getGrabConflictReasons({ container: 'Sac', mapActions: { melee: [{}] } }), ['corps à corps'])
  assert.deepEqual(getGrabConflictReasons({ container: 'Sac', mapActions: { reload: {} } }), ['rechargement'])
  assert.deepEqual(getGrabConflictReasons({ container: 'Sac', mapActions: { interact: {} } }), ['interaction'])
  assert.deepEqual(
    getGrabConflictReasons({ container: 'Sac', mapActions: { attack: [{}], reload: {} } }),
    ['tir', 'rechargement'],
  )
})

test('getGrabConflictReasons — Sac : le déplacement ou l’absence d’autre action ne gêne pas', () => {
  assert.deepEqual(getGrabConflictReasons({ container: 'Sac', mapActions: { move: {} } }), [])
  assert.deepEqual(getGrabConflictReasons({ container: 'Sac', mapActions: {} }), [])
  assert.deepEqual(getGrabConflictReasons({ container: 'Sac' }), [])
  assert.deepEqual(getGrabConflictReasons({ container: 'Sac', mapActions: { attack: [] } }), [])
})

test('getGrabConflictReasons — Ceinture (Préparation) : compatible avec tout', () => {
  assert.deepEqual(getGrabConflictReasons({ container: 'Ceinture', mapActions: { attack: [{}], reload: {}, melee: [{}] } }), [])
})
