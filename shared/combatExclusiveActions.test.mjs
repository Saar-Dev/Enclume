import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getExoStandUpIneligibilityReasons, isExoStandUpEligible,
  isExclusiveDeclaration, getAoeExclusiveIneligibilityReasons, isAoeExclusiveEligible,
} from './combatExclusiveActions.js'

// PLAN_EXOARMURE.md Lot 2bis §9.2 — exclusivité tranchée par Saar (2026-08-18) : tenter de se
// relever bloque toute autre action déclarée ce Tour, réussite ou échec.
//
// PLAN_AOE.md §8 étape 7 (2026-08-26) : isExclusiveDeclaration/getAoeExclusiveIneligibilityReasons
// couvrent maintenant Tir de suppression et Lance-flammes — isAimEligible (Tir visé) reste hors
// périmètre de ce lot (déjà testé implicitement via ses propres appelants, pas de régression touchée
// ici).

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

// ─── isExclusiveDeclaration — Tir visé, Tir de suppression, Lance-flammes ────────────────────────

test('isExclusiveDeclaration — aucune condition remplie : non exclusif', () => {
  assert.deepEqual(isExclusiveDeclaration({ mapActions: {} }), { exclusive: false, reason: null })
})

test('isExclusiveDeclaration — Tir visé (aimTranches > 0), inchangé', () => {
  assert.deepEqual(
    isExclusiveDeclaration({ mapActions: { attack: [{ aimTranches: 2 }] } }),
    { exclusive: true, reason: 'tir_vise' },
  )
})

test('isExclusiveDeclaration — Tir de suppression (aoe.mode) déclenche l\'exclusivité, sans arme spécifique', () => {
  assert.deepEqual(
    isExclusiveDeclaration({ mapActions: { attack: [{ aoe: { mode: 'suppression', direction: 45 } }] } }),
    { exclusive: true, reason: 'tir_suppression' },
  )
})

test('isExclusiveDeclaration — Lance-flammes : exige AOE déclarée ET catégorie/nom exacts, pas l\'un sans l\'autre', () => {
  const aoeAttack = { attack: [{ aoe: { direction: 10 } }] }
  assert.deepEqual(
    isExclusiveDeclaration({ mapActions: aoeAttack, weaponCategory: 'Lanceur', weaponName: 'Lance-flammes' }),
    { exclusive: true, reason: 'lance_flammes' },
  )
  // Même catégorie mais autre arme, ou aoe absente : jamais exclusif par erreur
  assert.equal(
    isExclusiveDeclaration({ mapActions: aoeAttack, weaponCategory: 'Lanceur', weaponName: 'Autre chose' }).exclusive,
    false,
  )
  assert.equal(
    isExclusiveDeclaration({ mapActions: { attack: [{ targetTokenId: 'a' }] }, weaponCategory: 'Lanceur', weaponName: 'Lance-flammes' }).exclusive,
    false,
  )
})

// ─── getAoeExclusiveIneligibilityReasons — interprétation stricte tranchée par Saar ──────────────

test('getAoeExclusiveIneligibilityReasons — déclaration seule : éligible', () => {
  assert.deepEqual(getAoeExclusiveIneligibilityReasons({ mapActions: {}, state: {}, quick: {}, entry: {} }), [])
  assert.equal(isAoeExclusiveEligible({ mapActions: {}, state: {}, quick: {}, entry: {} }), true)
})

test('getAoeExclusiveIneligibilityReasons — déplacement/CaC/actions rapides combinés : toutes les raisons remontent', () => {
  const reasons = getAoeExclusiveIneligibilityReasons({
    mapActions: { move: {}, melee: [{ targetTokenId: 'x' }] },
    state: {}, entry: {},
    quick: { observer: 1, phrase: 'Feu !' },
  })
  assert.deepEqual(reasons, ['déplacement', 'corps à corps', 'observation', 'phrase prononcée'])
})

test('getAoeExclusiveIneligibilityReasons — changement d\'état (posture) combiné : inéligible, contrairement au Tir visé qui a ses propres préconditions', () => {
  const reasons = getAoeExclusiveIneligibilityReasons({
    mapActions: {}, quick: {},
    state: { position: 'prone' }, entry: { state_position: 'standing' },
  })
  assert.deepEqual(reasons, ['changement de posture'])
})

test('getAoeExclusiveIneligibilityReasons — tir multiple (Tir Multi) exclu avec une action exclusive', () => {
  const reasons = getAoeExclusiveIneligibilityReasons({
    mapActions: { attack: [{ aoe: { direction: 0 } }, { targetTokenId: 'a' }] },
    state: {}, entry: {}, quick: {},
  })
  assert.deepEqual(reasons, ['tir multiple'])
})
