import test from 'node:test'
import assert from 'node:assert/strict'

import { nextKey, calcIniDelta, calcIniBreakdown } from './combatSections.js'

// position : [standing, crouching, kneeling, prone] ; fire_mode : [cc, rc, rl]

test('nextKey — cycle simple, boucle en fin de liste', () => {
  assert.equal(nextKey('position', 'standing', undefined), 'crouching')
  assert.equal(nextKey('position', 'kneeling', undefined), 'prone')
  assert.equal(nextKey('position', 'prone', undefined), 'standing') // wrap
})

test('nextKey — currentKey inconnu → premiere option', () => {
  assert.equal(nextKey('weapon', 'inexistant', undefined), 'holstered')
})

test('nextKey — availableKeys restreint le cycle (modes de tir de l\'arme)', () => {
  // arme RC/RL seulement, on est sur rc → suivant = rl
  assert.equal(nextKey('fire_mode', 'rc', ['rc', 'rl']), 'rl')
  // ... et rl boucle sur rc (cc exclu)
  assert.equal(nextKey('fire_mode', 'rl', ['rc', 'rl']), 'rc')
})

test('nextKey — currentKey hors de l\'ensemble filtre → premiere option valide (arme CC → arme RC-only)', () => {
  // le champ vaut encore 'cc' mais la nouvelle arme n'accepte que rc/rl
  assert.equal(nextKey('fire_mode', 'cc', ['rc', 'rl']), 'rc')
})

test('nextKey — ensemble filtre vide → currentKey inchange (jamais une valeur invalide)', () => {
  assert.equal(nextKey('fire_mode', 'cc', []), 'cc')
})

// ─── Prise en main (PLAN_PRISE_EN_MAIN.md) — l'aperçu d'Initiative reçoit le conteneur d'origine ─────────

const idle = { position: 'standing', weapon: 'drawn', fire_mode: 'cc', cover: 'exposed', vitesse: 'normal', combatMode: 'normal' }
const noQuick = { observer: 0, reperer: 0, phrase: false }

test('calcIniDelta — prise depuis la Ceinture : −3 ; depuis le Sac : 0 ; sans prise : 0', () => {
  assert.equal(calcIniDelta(idle, idle, { grab: { container: 'Ceinture' } }, noQuick), -3)
  assert.equal(calcIniDelta(idle, idle, { grab: { container: 'Sac' } }, noQuick), 0)
  assert.equal(calcIniDelta(idle, idle, {}, noQuick), 0)
  assert.equal(calcIniDelta(idle, idle, { grab: null }, noQuick), 0)
})

test('calcIniBreakdown — le détail nomme la prise en main avec son conteneur (libellé résolu par t())', () => {
  const t = (key, params) => `${key}|${params?.container ?? ''}`
  const lines = calcIniBreakdown(idle, idle, { grab: { container: 'Ceinture' } }, noQuick, t)
  assert.deepEqual(lines, [{ label: 'iniBreakdown.grab|Ceinture', value: -3 }])
})
