import test from 'node:test'
import assert from 'node:assert/strict'

import { getExoStandUpIneligibilityReasons, isExoStandUpEligible } from './combatExclusiveActions.js'

// PLAN_EXOARMURE.md Lot 2bis §9.2 — exclusivité tranchée par Saar (2026-08-18) : tenter de se
// relever bloque toute autre action déclarée ce Tour, réussite ou échec. Seule cette fonction est
// testée ici (nouvelle) — le reste du fichier (isAimEligible, isExclusiveDeclaration...) n'a aucun
// test existant, hors périmètre de ce lot de ne pas les combler rétroactivement.

test('getExoStandUpIneligibilityReasons — déclaration seule (rien d\'autre) : éligible', () => {
  assert.deepEqual(getExoStandUpIneligibilityReasons({ mapActions: {}, quick: {} }), [])
  assert.equal(isExoStandUpEligible({ mapActions: {}, quick: {} }), true)
})

test('getExoStandUpIneligibilityReasons — mapActions.move combiné : inéligible', () => {
  const reasons = getExoStandUpIneligibilityReasons({ mapActions: { move: { targetPosX: 1 } }, quick: {} })
  assert.deepEqual(reasons, ['déplacement'])
  assert.equal(isExoStandUpEligible({ mapActions: { move: { targetPosX: 1 } }, quick: {} }), false)
})

test('getExoStandUpIneligibilityReasons — tir/CaC combinés : les deux raisons remontent', () => {
  const reasons = getExoStandUpIneligibilityReasons({
    mapActions: { attack: [{ targetTokenId: 'a' }], melee: [{ targetTokenId: 'b' }] },
    quick: {},
  })
  assert.deepEqual(reasons, ['tir', 'corps à corps'])
})

test('getExoStandUpIneligibilityReasons — arrays vides (mapActions.attack/melee=[]) : jamais un faux positif', () => {
  assert.deepEqual(getExoStandUpIneligibilityReasons({ mapActions: { attack: [], melee: [] }, quick: {} }), [])
})

test('getExoStandUpIneligibilityReasons — interaction/rechargement/actions rapides combinés', () => {
  assert.deepEqual(
    getExoStandUpIneligibilityReasons({ mapActions: { interact: true }, quick: {} }),
    ['interaction']
  )
  assert.deepEqual(
    getExoStandUpIneligibilityReasons({ mapActions: { reload: true }, quick: {} }),
    ['rechargement']
  )
  assert.deepEqual(
    getExoStandUpIneligibilityReasons({ mapActions: {}, quick: { observer: 1 } }),
    ['observation']
  )
  assert.deepEqual(
    getExoStandUpIneligibilityReasons({ mapActions: {}, quick: { reperer: 1 } }),
    ['repérage']
  )
  assert.deepEqual(
    getExoStandUpIneligibilityReasons({ mapActions: {}, quick: { phrase: 'À couvert !' } }),
    ['phrase prononcée']
  )
})

test('getExoStandUpIneligibilityReasons — mapActions/quick absents (undefined) : éligible, jamais un throw', () => {
  assert.deepEqual(getExoStandUpIneligibilityReasons({}), [])
})
