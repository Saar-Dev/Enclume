import { STORY_HEIGHT, getToolElevation, normalizeCellSelection } from '../surfaceCore.js'

// Partie pure de la pose d'une Zone d'effet — extrait de SurfaceEditorScene.jsx (§11.10,
// PLAN_WORLD_BUILDER_REWORK.md). Les effets de bord (appel réseau `onRuntimeEffectCreate`,
// `setHoverPreview(null)`, `preventDefault`/`stopPropagation`) restent dans le composant : ils
// touchent des callbacks/refs qui n'ont pas leur place dans une fonction pure.
export function buildEffectVolumePayload(drag, tool) {
  const area = normalizeCellSelection(drag)
  if (!area) return null
  const baseY = getToolElevation(tool)
  const height = Math.max(0.1, Number(tool?.effectHeight) || STORY_HEIGHT)
  return {
    definitionKey: tool?.effectDefinitionKey || 'fire',
    targetKind: 'volume',
    volume: {
      min: { x: area.minX, y: baseY, z: area.minZ },
      max: { x: area.maxX + 1, y: baseY + height, z: area.maxZ + 1 },
    },
    intensity: Math.max(0.01, Number(tool?.effectIntensity) || 1),
    puissance: Math.round(Number(tool?.effectPuissance) || 0),
    source: { kind: 'editor' },
  }
}
