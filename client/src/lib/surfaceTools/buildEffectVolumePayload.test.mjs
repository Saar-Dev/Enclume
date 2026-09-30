import test from 'node:test'
import assert from 'node:assert/strict'

import { buildEffectVolumePayload } from './buildEffectVolumePayload.js'

test('buildEffectVolumePayload construit le volume à partir de la sélection et des réglages de l’outil', () => {
  const drag = { start: { x: 1, z: 1 }, end: { x: 2, z: 2 } }
  const tool = { level: 0, effectDefinitionKey: 'gas', effectHeight: 3, effectIntensity: 2.5, effectPuissance: 10 }
  const payload = buildEffectVolumePayload(drag, tool)
  assert.deepEqual(payload, {
    definitionKey: 'gas',
    targetKind: 'volume',
    volume: {
      min: { x: 1, y: 0, z: 1 },
      max: { x: 3, y: 3, z: 3 },
    },
    intensity: 2.5,
    puissance: 10,
    source: { kind: 'editor' },
  })
})

test('buildEffectVolumePayload retombe sur les défauts (fire, hauteur STORY_HEIGHT, intensité 1, puissance 0)', () => {
  const drag = { start: { x: 0, z: 0 }, end: { x: 0, z: 0 } }
  const payload = buildEffectVolumePayload(drag, {})
  assert.equal(payload.definitionKey, 'fire')
  assert.equal(payload.intensity, 1)
  assert.equal(payload.puissance, 0)
  assert.equal(payload.volume.max.y - payload.volume.min.y, 2.5)
})

test('buildEffectVolumePayload renvoie null sans sélection valide', () => {
  assert.equal(buildEffectVolumePayload(null, {}), null)
})
