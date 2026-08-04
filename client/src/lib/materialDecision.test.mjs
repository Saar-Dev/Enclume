// materialDecision.test.mjs — Tests unitaires pour materialDecision.js
// Lot 1a du PLAN_REFACTOR_SURFACE.md
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  surfaceBlockingForTool,
  normalizeSurfaceMaterialPreset,
  makeSurfaceMaterial,
  toolForMaterialFace,
  pickTextureVariant,
  materialOrTextureForTool,
} from './materialDecision.js'

test('surfaceBlockingForTool — retourne solid par défaut', () => {
  assert.deepStrictEqual(surfaceBlockingForTool({}), {
    barrierType: 'solid',
    blocksSight: true,
    blocksMovement: true,
    blocksWater: true,
  })
})

test('surfaceBlockingForTool — retourne glass pour surfaceBlocking glass', () => {
  assert.deepStrictEqual(surfaceBlockingForTool({ surfaceBlocking: 'glass' }), {
    barrierType: 'glass',
    blocksSight: false,
    blocksMovement: true,
    blocksWater: true,
  })
})

test('surfaceBlockingForTool — retourne grate pour surfaceBlocking grate (eau permise)', () => {
  assert.deepStrictEqual(surfaceBlockingForTool({ surfaceBlocking: 'grate' }), {
    barrierType: 'grate',
    blocksSight: false,
    blocksMovement: true,
    blocksWater: false,
  })
})

test('surfaceBlockingForTool — utilise wallBlocking si surfaceBlocking absent', () => {
  assert.deepStrictEqual(surfaceBlockingForTool({ wallBlocking: 'glass' }), {
    barrierType: 'glass',
    blocksSight: false,
    blocksMovement: true,
    blocksWater: true,
  })
})

test('normalizeSurfaceMaterialPreset — retourne le preset par défaut si aucun tool fourni', () => {
  const result = normalizeSurfaceMaterialPreset({})
  assert.strictEqual(result.material, 'steel')
  assert.strictEqual(result.paint, '#6f7f8e')
  assert.strictEqual(result.pattern, 'none')
})

test('normalizeSurfaceMaterialPreset — fusionne materialPreset du tool', () => {
  const result = normalizeSurfaceMaterialPreset({
    materialPreset: { material: 'wood', wear: 50 },
  })
  assert.strictEqual(result.material, 'wood')
  assert.strictEqual(result.wear, 50)
  assert.strictEqual(result.paint, '#6f7f8e') // conservé du défaut
})

test("makeSurfaceMaterial — retourne null si le mode est 'texture'", () => {
  assert.strictEqual(makeSurfaceMaterial({ surfaceMaterialMode: 'texture' }, 'test'), null)
})

test('makeSurfaceMaterial — retourne un descripteur procedural-material', () => {
  const result = makeSurfaceMaterial({}, 'seed1')
  assert.notStrictEqual(result, undefined)
  assert.strictEqual(result?.type, 'procedural-material')
  assert.strictEqual(result?.version, 1)
})

test('materialOrTextureForTool — retourne un matériau procédural par défaut', () => {
  const result = materialOrTextureForTool({
    tool: {},
    packId: null,
    textureId: null,
    fallbackTexId: null,
    availableBlocks: [],
    seed: 'test',
  })
  assert.notStrictEqual(result.material, undefined)
  assert.strictEqual(result.tex, null)
})

test('materialOrTextureForTool — priorise textureId explicite', () => {
  const result = materialOrTextureForTool({
    tool: {},
    packId: null,
    textureId: 'tex-123',
    fallbackTexId: null,
    availableBlocks: [{ id: 'tex-123', category_id: 'cat1', deprecated: false }],
    seed: 'test',
  })
  assert.strictEqual(result.tex, 'tex-123')
  assert.strictEqual(result.material, null)
})

test('pickTextureVariant — retourne le baseTexId si autoVariants est falsy', () => {
  assert.strictEqual(pickTextureVariant('tex-1', [], 'seed', false), 'tex-1')
  assert.strictEqual(pickTextureVariant('tex-1', [], 'seed', null), 'tex-1')
})

test('pickTextureVariant — retourne le baseTexId si le bloc est introuvable', () => {
  assert.strictEqual(pickTextureVariant('tex-1', [], 'seed', true), 'tex-1')
})

test('toolForMaterialFace — retourne le tool inchangé si aucun profil pour cette face', () => {
  const tool = { materialPreset: { material: 'steel' } }
  assert.strictEqual(toolForMaterialFace(tool, 'floor'), tool)
})

test('toolForMaterialFace — applique le profil de la face', () => {
  const tool = {
    materialPreset: { material: 'steel' },
    materialProfiles: { floor: { material: 'wood' } },
  }
  const result = toolForMaterialFace(tool, 'floor')
  assert.deepStrictEqual(result.materialPreset, { material: 'wood' })
})
