import test from 'node:test'
import assert from 'node:assert/strict'

import {
  pushDamagePrompt,
  attachDamageResult,
  dismissDamageQueueHead,
  currentDamageEntry,
  pushAttackResult,
  dismissAttackQueueHead,
  currentAttackResult,
} from './combatDamageQueue.js'

test('file vide : aucune entrée courante', () => {
  assert.equal(currentDamageEntry([]), null)
})

test('une seule cible : comportement identique à avant (un prompt, un résultat, une fermeture)', () => {
  let queue = []
  queue = pushDamagePrompt(queue, { tokenId: 't1', targetName: 'A', formula: '2d6' })
  assert.deepEqual(currentDamageEntry(queue), { payload: { tokenId: 't1', targetName: 'A', formula: '2d6' }, results: null })

  queue = attachDamageResult(queue, { degautsBruts: 7 })
  assert.deepEqual(currentDamageEntry(queue).results, { degautsBruts: 7 })

  queue = dismissDamageQueueHead(queue)
  assert.equal(currentDamageEntry(queue), null)
})

test("scénario du bug : le prompt de la cible suivante arrive avant le résultat de la cible courante — ne doit jamais s'attacher à la mauvaise entrée", () => {
  let queue = []
  queue = pushDamagePrompt(queue, { targetName: 'A', formula: '2d6' })
  // Ordre exact du serveur (confirmDamage) : prompt(B) émis avant result(A).
  queue = pushDamagePrompt(queue, { targetName: 'B', formula: '1d8' })
  assert.equal(queue.length, 2)

  queue = attachDamageResult(queue, { degautsBruts: 7, label: 'dégâts de A' })

  const current = currentDamageEntry(queue)
  assert.equal(current.payload.targetName, 'A')
  assert.deepEqual(current.results, { degautsBruts: 7, label: 'dégâts de A' })
  // B reste en attente, intact, pas affiché, pas de résultat qui lui est attaché par erreur.
  assert.equal(queue[1].payload.targetName, 'B')
  assert.equal(queue[1].results, null)
})

test('fermeture de A révèle B, prêt pour son propre jet (results null, pas les anciens de A)', () => {
  let queue = []
  queue = pushDamagePrompt(queue, { targetName: 'A', formula: '2d6' })
  queue = pushDamagePrompt(queue, { targetName: 'B', formula: '1d8' })
  queue = attachDamageResult(queue, { degautsBruts: 7 })
  queue = dismissDamageQueueHead(queue)

  const current = currentDamageEntry(queue)
  assert.equal(current.payload.targetName, 'B')
  assert.equal(current.results, null)

  queue = attachDamageResult(queue, { degautsBruts: 3 })
  assert.equal(currentDamageEntry(queue).results.degautsBruts, 3)

  queue = dismissDamageQueueHead(queue)
  assert.equal(currentDamageEntry(queue), null)
})

test('trois cibles en chaîne (attaques multiples) : chaque résultat se pose sur la bonne cible, jamais sur une autre', () => {
  let queue = []
  queue = pushDamagePrompt(queue, { targetName: 'A' })
  queue = pushDamagePrompt(queue, { targetName: 'B' })
  queue = attachDamageResult(queue, { degautsBruts: 1 }) // pour A
  queue = pushDamagePrompt(queue, { targetName: 'C' }) // arrive pendant que A est encore affichée
  queue = dismissDamageQueueHead(queue) // ferme A

  assert.equal(currentDamageEntry(queue).payload.targetName, 'B')
  assert.equal(currentDamageEntry(queue).results, null)

  queue = attachDamageResult(queue, { degautsBruts: 2 }) // pour B
  assert.equal(currentDamageEntry(queue).results.degautsBruts, 2)
  queue = dismissDamageQueueHead(queue) // ferme B

  assert.equal(currentDamageEntry(queue).payload.targetName, 'C')
  assert.equal(currentDamageEntry(queue).results, null)
})

test('attacher un résultat sur une file vide ne fait rien (pas de crash, pas de fantôme)', () => {
  const queue = attachDamageResult([], { degautsBruts: 5 })
  assert.deepEqual(queue, [])
})

test('fermer une file déjà vide ne fait rien (pas de crash)', () => {
  const queue = dismissDamageQueueHead([])
  assert.deepEqual(queue, [])
})

test('attacher un résultat quand toutes les entrées en ont déjà un ne fait rien (pas de doublon silencieux)', () => {
  let queue = []
  queue = pushDamagePrompt(queue, { targetName: 'A' })
  queue = attachDamageResult(queue, { degautsBruts: 1 })
  const before = queue
  queue = attachDamageResult(queue, { degautsBruts: 999 })
  assert.deepEqual(queue, before)
})

test('file des résultats de tir : deux attaques en rafale avant fermeture ne se perdent plus (CombatModifiersWindow)', () => {
  let queue = []
  assert.equal(currentAttackResult(queue), null)

  // Une série d'attaques déclarées ensemble devient plusieurs entrées d'échelle séparées
  // (declaration_group_id) : les deux résultats peuvent arriver avant que le joueur ait fermé le
  // premier.
  queue = pushAttackResult(queue, { hit: true, roll: 12, seuil: 10 })
  queue = pushAttackResult(queue, { hit: false, roll: 3, seuil: 10 })
  assert.equal(queue.length, 2)
  assert.equal(currentAttackResult(queue).hit, true)

  queue = dismissAttackQueueHead(queue)
  assert.equal(currentAttackResult(queue).hit, false)

  queue = dismissAttackQueueHead(queue)
  assert.equal(currentAttackResult(queue), null)
})

test('fermer une file de résultats de tir déjà vide ne fait rien (pas de crash)', () => {
  assert.deepEqual(dismissAttackQueueHead([]), [])
})
