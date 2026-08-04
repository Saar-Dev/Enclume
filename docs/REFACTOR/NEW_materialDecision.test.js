// materialDecision.test.js — Tests unitaires pour materialDecision.js
// Lot 1a du PLAN_REFACTOR_SURFACE.md

import { describe, it, expect } from 'vitest'
import {
  surfaceBlockingForTool,
  normalizeSurfaceMaterialPreset,
  makeSurfaceMaterial,
  toolForMaterialFace,
  pickTextureVariant,
  materialOrTextureForTool,
} from '../materialDecision.js'

describe('surfaceBlockingForTool', () => {
  it('retourne solid par défaut', () => {
    expect(surfaceBlockingForTool({})).toEqual({
      barrierType: 'solid',
      blocksSight: true,
      blocksMovement: true,
      blocksWater: true,
    })
  })

  it('retourne glass pour surfaceBlocking glass', () => {
    expect(surfaceBlockingForTool({ surfaceBlocking: 'glass' })).toEqual({
      barrierType: 'glass',
      blocksSight: false,
      blocksMovement: true,
      blocksWater: true,
    })
  })

  it('retourne grate pour surfaceBlocking grate (eau permise)', () => {
    expect(surfaceBlockingForTool({ surfaceBlocking: 'grate' })).toEqual({
      barrierType: 'grate',
      blocksSight: false,
      blocksMovement: true,
      blocksWater: false,
    })
  })

  it('utilise wallBlocking si surfaceBlocking absent', () => {
    expect(surfaceBlockingForTool({ wallBlocking: 'glass' })).toEqual({
      barrierType: 'glass',
      blocksSight: false,
      blocksMovement: true,
      blocksWater: true,
    })
  })
})

describe('normalizeSurfaceMaterialPreset', () => {
  it('retourne le preset par défaut si aucun tool fourni', () => {
    const result = normalizeSurfaceMaterialPreset({})
    expect(result.material).toBe('steel')
    expect(result.paint).toBe('#6f7f8e')
    expect(result.pattern).toBe('none')
  })

  it('fusionne materialPreset du tool', () => {
    const result = normalizeSurfaceMaterialPreset({
      materialPreset: { material: 'wood', wear: 50 },
    })
    expect(result.material).toBe('wood')
    expect(result.wear).toBe(50)
    expect(result.paint).toBe('#6f7f8e') // conservé du défaut
  })
})

describe('makeSurfaceMaterial', () => {
  it("retourne null si le mode est 'texture'", () => {
    expect(makeSurfaceMaterial({ surfaceMaterialMode: 'texture' }, 'test')).toBeNull()
  })

  it('retourne un descripteur procedural-material', () => {
    const result = makeSurfaceMaterial({}, 'seed1')
    expect(result).toBeDefined()
    expect(result?.type).toBe('procedural-material')
    expect(result?.version).toBe(1)
  })
})

describe('materialOrTextureForTool', () => {
  it('retourne un matériau procédural par défaut', () => {
    const result = materialOrTextureForTool({
      tool: {},
      packId: null,
      textureId: null,
      fallbackTexId: null,
      availableBlocks: [],
      seed: 'test',
    })
    expect(result.material).toBeDefined()
    expect(result.tex).toBeNull()
  })

  it('priorise textureId explicite', () => {
    const result = materialOrTextureForTool({
      tool: {},
      packId: null,
      textureId: 'tex-123',
      fallbackTexId: null,
      availableBlocks: [{ id: 'tex-123', category_id: 'cat1', deprecated: false }],
      seed: 'test',
    })
    expect(result.tex).toBe('tex-123')
    expect(result.material).toBeNull()
  })
})

describe('pickTextureVariant', () => {
  it('retourne le baseTexId si autoVariants est falsy', () => {
    expect(pickTextureVariant('tex-1', [], 'seed', false)).toBe('tex-1')
    expect(pickTextureVariant('tex-1', [], 'seed', null)).toBe('tex-1')
  })

  it('retourne le baseTexId si le bloc est introuvable', () => {
    expect(pickTextureVariant('tex-1', [], 'seed', true)).toBe('tex-1')
  })
})

describe('toolForMaterialFace', () => {
  it('retourne le tool inchangé si aucun profil pour cette face', () => {
    const tool = { materialPreset: { material: 'steel' } }
    expect(toolForMaterialFace(tool, 'floor')).toBe(tool)
  })

  it('applique le profil de la face', () => {
    const tool = {
      materialPreset: { material: 'steel' },
      materialProfiles: { floor: { material: 'wood' } },
    }
    const result = toolForMaterialFace(tool, 'floor')
    expect(result.materialPreset).toEqual({ material: 'wood' })
  })
})