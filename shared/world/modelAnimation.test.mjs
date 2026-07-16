import test from 'node:test'
import assert from 'node:assert/strict'
import {
  builtinOpenableStates,
  modelAnimationProgress,
  modelHasOpenAnimation,
  normalizeModelAnimationNames,
} from './modelAnimation.js'

test('les noms de clips sont normalisés sans doublons', () => {
  assert.deepEqual(normalizeModelAnimationNames([' Open_Action ', '', 'Open_Action']), ['Open_Action'])
})

test('un modèle animé pour une ouverture reçoit les états système fermé et ouvert', () => {
  assert.equal(modelHasOpenAnimation(['PIVOT_LOCKER_Left_Door_OpenAction']), true)
  assert.deepEqual(builtinOpenableStates(['PIVOT_LOCKER_Left_Door_OpenAction']).map(state => state.key), ['closed', 'open'])
  assert.deepEqual(builtinOpenableStates(['IdleAction']), [])
})

test('la pose d’animation dérive de l’état métier ou de sa surcharge explicite', () => {
  assert.equal(modelAnimationProgress('open'), 1)
  assert.equal(modelAnimationProgress({ name: 'Ouverte' }), 1)
  assert.equal(modelAnimationProgress({ name: 'Verrouillée' }), 0)
  assert.equal(modelAnimationProgress({ visual_override: { animationProgress: 0.35 } }), 0.35)
  assert.equal(modelAnimationProgress({ animation_progress: 4 }), 1)
})
