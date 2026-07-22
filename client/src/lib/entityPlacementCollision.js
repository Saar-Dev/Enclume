import { normalizeEntityScale } from '../../../shared/world/entityTransform.js'

const MIN_SIZE = 0.05
const OVERLAP_EPSILON = 0.0001

const positive = (value, fallback = 1) => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

const finite = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

const placementMode = blueprint => (
  blueprint?.geometry?.placementMode || blueprint?.geometry?.placement_mode || 'free'
)

const stateDefinitionAt = (blueprint, currentStateId = 0) => {
  const states = Array.isArray(blueprint?.states) ? blueprint.states : []
  return states[currentStateId] ?? states[0] ?? null
}

/**
 * Volume de placement canonique d'une entité. Les objets de catalogue utilisent un point
 * d'ancrage `floor-center`; le chemin legacy sans origine conserve un coin au sol.
 */
export function buildEntityPlacementVolume({
  id = null,
  position,
  rotation = 0,
  blueprint,
  entityState = {},
  currentStateId = 0,
} = {}) {
  if (!position || !blueprint) return null

  const geometry = blueprint.geometry || {}
  const stateDefinition = stateDefinitionAt(blueprint, currentStateId)
  const collider = stateDefinition?.collider || {}
  const scale = normalizeEntityScale(entityState)
  const width = Math.max(MIN_SIZE, positive(collider.width, positive(geometry.width, 1)) * scale)
  const depth = Math.max(MIN_SIZE, positive(collider.depth, positive(geometry.depth, 1)) * scale)
  const height = Math.max(MIN_SIZE, positive(collider.height, positive(geometry.height, 1)) * scale)
  const quarterTurns = ((Math.trunc(finite(rotation)) % 4) + 4) % 4
  const rotatedWidth = quarterTurns % 2 === 1 ? depth : width
  const rotatedDepth = quarterTurns % 2 === 1 ? width : depth
  const origin = collider.origin || geometry.origin
  const centered = origin === 'floor-center' || origin === 'wall-back-center'
  const offset = collider.offset || {}
  const anchorX = finite(position.x) + finite(offset.x)
  const anchorY = finite(position.y) + finite(offset.y)
  const anchorZ = finite(position.z) + finite(offset.z)

  return Object.freeze({
    id,
    kind: 'entity',
    centerX: centered ? anchorX : anchorX + width / 2,
    centerZ: centered ? anchorZ : anchorZ + depth / 2,
    halfWidth: rotatedWidth / 2,
    halfDepth: rotatedDepth / 2,
    rotationY: 0,
    minY: anchorY,
    maxY: anchorY + height,
  })
}

export function buildWallPlacementVolume(renderBox, id = null, kind = 'wall') {
  if (!renderBox?.position || !renderBox?.args) return null
  const [centerX, centerY, centerZ] = renderBox.position.map(value => finite(value))
  const [width, height, depth] = renderBox.args.map(value => Math.max(MIN_SIZE, positive(value, MIN_SIZE)))
  return Object.freeze({
    id,
    kind,
    centerX,
    centerZ,
    halfWidth: width / 2,
    halfDepth: depth / 2,
    rotationY: finite(renderBox.rotationY),
    minY: centerY - height / 2,
    maxY: centerY + height / 2,
  })
}

const axesFor = volume => {
  const cos = Math.cos(volume.rotationY || 0)
  const sin = Math.sin(volume.rotationY || 0)
  return [
    { x: cos, z: -sin },
    { x: sin, z: cos },
  ]
}

const projectedRadius = (volume, axis) => {
  const [localX, localZ] = axesFor(volume)
  return volume.halfWidth * Math.abs(localX.x * axis.x + localX.z * axis.z)
    + volume.halfDepth * Math.abs(localZ.x * axis.x + localZ.z * axis.z)
}

export function placementVolumesOverlap(a, b) {
  if (!a || !b) return false
  const verticalOverlap = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY)
  if (verticalOverlap <= OVERLAP_EPSILON) return false

  const delta = { x: b.centerX - a.centerX, z: b.centerZ - a.centerZ }
  const axes = [...axesFor(a), ...axesFor(b)]
  for (const axis of axes) {
    const centerDistance = Math.abs(delta.x * axis.x + delta.z * axis.z)
    const overlap = projectedRadius(a, axis) + projectedRadius(b, axis) - centerDistance
    if (overlap <= OVERLAP_EPSILON) return false
  }
  return true
}

/**
 * Valide une transformation avant toute écriture REST. Les murs sont déjà découpés autour des
 * portes/fenêtres par l'appelant. Un objet mural peut traverser son mur support, mais reste bloqué
 * par les autres objets.
 */
export function validateEntityPlacement({
  position,
  rotation = 0,
  blueprint,
  entityState = {},
  currentStateId = 0,
  entityId = null,
  entities = [],
  blueprints = {},
  wallVolumes = [],
  obstacleVolumes = null,
} = {}) {
  const candidate = buildEntityPlacementVolume({
    id: entityId,
    position,
    rotation,
    blueprint,
    entityState,
    currentStateId,
  })
  if (!candidate) return Object.freeze({ valid: false, reason: 'position', obstacleId: null })

  const mode = placementMode(blueprint)
  const obstacles = obstacleVolumes || wallVolumes
  for (const obstacle of obstacles) {
    if (mode !== 'free' && (obstacle.kind === 'wall' || obstacle.kind === 'voxel')) continue
    if (placementVolumesOverlap(candidate, obstacle)) {
      const reason = obstacle.kind === 'wall' || obstacle.kind === 'voxel' ? 'wall' : 'structure'
      return Object.freeze({ valid: false, reason, obstacleId: obstacle.id || null })
    }
  }

  for (const entity of entities) {
    if (!entity || String(entity.id) === String(entityId)) continue
    const otherBlueprint = blueprints[entity.blueprint_id] || entity.blueprint
    if (!otherBlueprint) continue
    const other = buildEntityPlacementVolume({
      id: entity.id,
      position: {
        x: entity.pos_x,
        y: entity.pos_z,
        z: entity.pos_y,
      },
      rotation: entity.r,
      blueprint: otherBlueprint,
      entityState: entity.state,
      currentStateId: entity.current_state_id,
    })
    if (placementVolumesOverlap(candidate, other)) {
      return Object.freeze({ valid: false, reason: 'entity', obstacleId: entity.id })
    }
  }

  return Object.freeze({ valid: true, reason: null, obstacleId: null })
}
