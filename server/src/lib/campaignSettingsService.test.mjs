import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SETTINGS_SCHEMA, mergeWithDefaults } from './campaignSettingsService.js'

test('mergeWithDefaults — settings undefined/null → tous les défauts du schéma', () => {
  for (const input of [undefined, null]) {
    const merged = mergeWithDefaults(input)
    for (const [key, def] of Object.entries(SETTINGS_SCHEMA)) {
      assert.equal(merged[key], def.default, `clé ${key}`)
    }
  }
})

test('mergeWithDefaults — clé stockée override le défaut', () => {
  const merged = mergeWithDefaults({ encumbrance_enabled: false, encumbrance_multiplier: 5 })
  assert.equal(merged.encumbrance_enabled, false)
  assert.equal(merged.encumbrance_multiplier, 5)
  // clé non fournie → défaut du schéma malgré tout
  assert.equal(merged.fatigue_enabled, SETTINGS_SCHEMA.fatigue_enabled.default)
})

test('mergeWithDefaults — clé parasite (schéma passé, JSONB jamais purgé) est filtrée, pas propagée', () => {
  const merged = mergeWithDefaults({ ambiance: 'HEROIQUE', old_removed_key: 'legacy' })
  assert.equal(merged.ambiance, 'HEROIQUE')
  assert.equal('old_removed_key' in merged, false)
  assert.deepEqual(Object.keys(merged).sort(), Object.keys(SETTINGS_SCHEMA).sort())
})

test('mergeWithDefaults — falsy valide (false) sur une clé dont le défaut est true reste false (piège ?? vs ||)', () => {
  // shock_auto_stun/pnj_unlimited_ammo ont un défaut `true` — si le code utilisait `||` au lieu de
  // `??`, ce test échouerait (false || true → true, silencieusement écrasé).
  const merged = mergeWithDefaults({ shock_auto_stun: false, pnj_unlimited_ammo: false })
  assert.equal(merged.shock_auto_stun, false)
  assert.equal(merged.pnj_unlimited_ammo, false)
})
