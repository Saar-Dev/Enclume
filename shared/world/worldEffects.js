// Registre déclaratif commun aux déplacements, à la visibilité et aux hooks de tour.
// Les définitions personnalisées n'exécutent jamais de code : seules les clés validées ci-dessous
// peuvent produire une conséquence de jeu.

const EPSILON = 1e-9
const EFFECT_KEY_RE = /^[a-z][a-z0-9._-]{1,63}$/
const INSTANCE_STATES = new Set(['active', 'paused', 'expired'])
const TARGET_KINDS = new Set(['volume', 'support', 'feature', 'compartment', 'entity', 'token'])
const STACKING_RULES = new Set(['max', 'multiply'])
const HOOK_EVENTS = new Set(['enter', 'exit', 'traverse', 'turnStart', 'turnEnd'])
const HOOK_TYPES = new Set(['note', 'test', 'damage', 'restriction'])

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]))
  }
  return value
}

function finite(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function clamp(value, min, max, fallback) {
  return Math.min(max, Math.max(min, finite(value, fallback)))
}

function normalizePoint(value, path) {
  if (!value || typeof value !== 'object') throw new TypeError(`${path} doit être un point`)
  const point = { x: Number(value.x), y: Number(value.y), z: Number(value.z) }
  if (!Object.values(point).every(Number.isFinite)) throw new TypeError(`${path} contient une coordonnée invalide`)
  return point
}

export function normalizeEffectBounds(value, path = 'bounds') {
  if (!value || typeof value !== 'object') throw new TypeError(`${path} doit être un AABB`)
  const min = normalizePoint(value.min, `${path}.min`)
  const max = normalizePoint(value.max, `${path}.max`)
  if (max.x <= min.x || max.y <= min.y || max.z <= min.z) {
    throw new RangeError(`${path} doit avoir un volume strictement positif`)
  }
  return deepFreeze({ min, max })
}

function normalizeModifiers(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('modifiers doit être un objet')
  }
  const allowed = new Set(['movementMultiplier', 'sightOpacity'])
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new RangeError(`modificateur d'effet inconnu : ${key}`)
  }
  return {
    movementMultiplier: clamp(value.movementMultiplier, 0.05, 100, 1),
    sightOpacity: clamp(value.sightOpacity, 0, 1, 0),
  }
}

function normalizeHook(hook, index) {
  if (!hook || typeof hook !== 'object' || Array.isArray(hook)) {
    throw new TypeError(`hooks[${index}] doit être un objet`)
  }
  if (!HOOK_EVENTS.has(hook.event)) throw new RangeError(`événement de hook inconnu : ${hook.event}`)
  if (!HOOK_TYPES.has(hook.type)) throw new RangeError(`type de hook inconnu : ${hook.type}`)
  const normalized = {
    event: hook.event,
    type: hook.type,
    label: String(hook.label || '').slice(0, 160),
  }
  if (hook.type === 'note') normalized.note = String(hook.note || '').slice(0, 2000)
  if (hook.type === 'test') {
    normalized.testKey = String(hook.testKey || 'custom').slice(0, 64)
    normalized.difficulty = clamp(hook.difficulty, -20, 20, 0)
  }
  if (hook.type === 'damage') {
    normalized.damageType = String(hook.damageType || 'environment').slice(0, 64)
    normalized.amountPerIntensity = clamp(hook.amountPerIntensity, 0, 1000, 0)
  }
  if (hook.type === 'restriction') {
    normalized.restriction = String(hook.restriction || '').slice(0, 128)
  }
  return normalized
}

export function normalizeEffectDefinition(value, { custom = false } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('La définition d’effet doit être un objet')
  }
  const key = String(value.key || '').trim().toLowerCase()
  if (!EFFECT_KEY_RE.test(key)) throw new RangeError(`Clé d'effet invalide : ${key || '(vide)'}`)
  const label = String(value.label || '').trim()
  if (!label) throw new RangeError('Le libellé de l’effet est obligatoire')
  const category = String(value.category || `custom:${key}`).trim().slice(0, 80)
  const stacking = value.stacking || 'max'
  if (!STACKING_RULES.has(stacking)) throw new RangeError(`Règle de cumul inconnue : ${stacking}`)
  const hooks = Array.isArray(value.hooks) ? value.hooks.map(normalizeHook) : []
  return deepFreeze({
    key,
    label: label.slice(0, 120),
    icon: value.icon ? String(value.icon).slice(0, 120) : null,
    note: value.note ? String(value.note).slice(0, 2000) : null,
    category,
    stacking,
    builtin: !custom,
    modifiers: normalizeModifiers(value.modifiers),
    hooks,
  })
}

const BUILTIN_DEFINITIONS = [
  {
    key: 'fire', label: 'Feu', icon: 'fire', category: 'hazard:fire', stacking: 'max',
    modifiers: { movementMultiplier: 1, sightOpacity: 0.12 },
    hooks: [{ event: 'turnStart', type: 'damage', label: 'Exposition au feu', damageType: 'fire', amountPerIntensity: 1 }],
  },
  {
    key: 'flooded', label: 'Inondé', icon: 'water', category: 'terrain:water', stacking: 'max',
    modifiers: { movementMultiplier: 2, sightOpacity: 0 },
    hooks: [{ event: 'traverse', type: 'note', label: 'Terrain inondé', note: 'Appliquer les règles de nage si la profondeur l’impose.' }],
  },
  {
    key: 'gas', label: 'Gaz', icon: 'cloud', category: 'atmosphere:gas', stacking: 'max',
    modifiers: { movementMultiplier: 1, sightOpacity: 0.35 },
    hooks: [{ event: 'turnStart', type: 'test', label: 'Exposition au gaz', testKey: 'resist-gas', difficulty: 0 }],
  },
  {
    key: 'oil', label: 'Huile / glissant', icon: 'droplet', category: 'terrain:footing', stacking: 'max',
    modifiers: { movementMultiplier: 1.5, sightOpacity: 0 },
    hooks: [{ event: 'traverse', type: 'test', label: 'Sol glissant', testKey: 'balance', difficulty: 0 }],
  },
  {
    key: 'unstable', label: 'Terrain instable', icon: 'warning', category: 'terrain:footing', stacking: 'max',
    modifiers: { movementMultiplier: 1.5, sightOpacity: 0 },
    hooks: [{ event: 'traverse', type: 'test', label: 'Terrain instable', testKey: 'balance', difficulty: 0 }],
  },
].map(definition => normalizeEffectDefinition(definition))

export const BUILTIN_WORLD_EFFECTS = deepFreeze(Object.fromEntries(
  BUILTIN_DEFINITIONS.map(definition => [definition.key, definition]),
))

export function effectDefinitionRegistry(customDefinitions = []) {
  const registry = new Map(Object.entries(BUILTIN_WORLD_EFFECTS))
  for (const definition of customDefinitions) {
    const normalized = normalizeEffectDefinition(definition, { custom: true })
    if (registry.has(normalized.key)) throw new RangeError(`La clé ${normalized.key} est réservée ou dupliquée`)
    registry.set(normalized.key, normalized)
  }
  return registry
}

export function normalizeEffectInstance(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError("L'instance d'effet doit être un objet")
  }
  const id = String(value.id || '').trim()
  if (!id) throw new RangeError("L'identité de l'instance est obligatoire")
  const definitionKey = String(value.definitionKey || value.definition_key || '').trim().toLowerCase()
  if (!EFFECT_KEY_RE.test(definitionKey)) throw new RangeError("La clé de définition de l'instance est invalide")
  const targetKind = value.targetKind || value.target_kind || 'volume'
  if (!TARGET_KINDS.has(targetKind)) throw new RangeError(`Cible d'effet inconnue : ${targetKind}`)
  const state = value.state || 'active'
  if (!INSTANCE_STATES.has(state)) throw new RangeError(`État d'effet inconnu : ${state}`)
  const volume = value.volume || value.region || null
  if (targetKind === 'volume' && !volume) throw new RangeError('Un effet volumique exige un volume')
  return deepFreeze({
    id,
    battlemapId: value.battlemapId || value.battlemap_id || null,
    definitionKey,
    targetKind,
    targetId: value.targetId || value.target_id || null,
    volume: volume ? normalizeEffectBounds(volume, 'instance.volume') : null,
    intensity: clamp(value.intensity, 0.01, 100, 1),
    durationRounds: value.durationRounds ?? value.duration_rounds ?? null,
    state,
    source: clone(value.source || {}),
    metadata: clone(value.metadata || {}),
  })
}

function unionBounds(items) {
  if (items.length === 0) return null
  return normalizeEffectBounds({
    min: {
      x: Math.min(...items.map(item => item.bounds.min.x)),
      y: Math.min(...items.map(item => item.bounds.min.y)),
      z: Math.min(...items.map(item => item.bounds.min.z)),
    },
    max: {
      x: Math.max(...items.map(item => item.bounds.max.x)),
      y: Math.max(...items.map(item => item.bounds.max.y)),
      z: Math.max(...items.map(item => item.bounds.max.z)),
    },
  })
}

function instanceBounds(snapshot, instance) {
  if (instance.volume) return instance.volume
  const candidates = Object.values(snapshot.spatial)
    .flat()
    .filter(item => item?.bounds && (item.id === instance.targetId || item.sourceId === instance.targetId))
  return unionBounds(candidates)
}

export function compileEffectRegions(snapshot, { definitions = [], instances = [] } = {}) {
  const registry = effectDefinitionRegistry(definitions)
  const regions = []
  for (const rawInstance of instances) {
    const instance = normalizeEffectInstance(rawInstance)
    if (instance.state !== 'active') continue
    const definition = registry.get(instance.definitionKey)
    if (!definition) throw new RangeError(`Définition d'effet inconnue : ${instance.definitionKey}`)
    const bounds = instanceBounds(snapshot, instance)
    if (!bounds) continue
    const baseMovement = definition.modifiers.movementMultiplier
    const movementMultiplier = clamp(1 + (baseMovement - 1) * instance.intensity, 0.05, 100, 1)
    const baseOpacity = definition.modifiers.sightOpacity
    const sightOpacity = clamp(1 - ((1 - baseOpacity) ** instance.intensity), 0, 1, 0)
    regions.push(deepFreeze({
      id: `effect-region:${instance.id}`,
      instanceId: instance.id,
      definitionKey: definition.key,
      label: definition.label,
      category: definition.category,
      stacking: definition.stacking,
      bounds,
      intensity: instance.intensity,
      movementMultiplier,
      sightOpacity,
      hooks: definition.hooks,
      targetKind: instance.targetKind,
      targetId: instance.targetId,
      metadata: instance.metadata,
    }))
  }
  return deepFreeze(regions.sort((a, b) => a.id.localeCompare(b.id)))
}

export function pointInsideEffectBounds(point, bounds) {
  return point.x >= bounds.min.x - EPSILON && point.x <= bounds.max.x + EPSILON
    && point.y >= bounds.min.y - EPSILON && point.y <= bounds.max.y + EPSILON
    && point.z >= bounds.min.z - EPSILON && point.z <= bounds.max.z + EPSILON
}

export function segmentIntersectsEffectBounds(from, to, bounds) {
  let near = 0
  let far = 1
  for (const axis of ['x', 'y', 'z']) {
    const delta = to[axis] - from[axis]
    if (Math.abs(delta) <= EPSILON) {
      if (from[axis] < bounds.min[axis] || from[axis] > bounds.max[axis]) return false
      continue
    }
    let first = (bounds.min[axis] - from[axis]) / delta
    let second = (bounds.max[axis] - from[axis]) / delta
    if (first > second) [first, second] = [second, first]
    near = Math.max(near, first)
    far = Math.min(far, second)
    if (near > far) return false
  }
  return far >= 0 && near <= 1
}

export function effectMovementFactorsForSegment(regions = [], from, to) {
  const touched = regions.filter(region => (
    region.movementMultiplier !== 1 && segmentIntersectsEffectBounds(from, to, region.bounds)
  ))
  const byCategory = new Map()
  for (const region of touched) {
    const bucket = byCategory.get(region.category) || []
    bucket.push(region)
    byCategory.set(region.category, bucket)
  }
  const factors = []
  for (const [category, categoryRegions] of [...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (categoryRegions[0].stacking === 'max') {
      const selected = categoryRegions.reduce((best, region) => (
        region.movementMultiplier > best.movementMultiplier ? region : best
      ))
      factors.push({ code: `effect:${category}:${selected.instanceId}`, value: selected.movementMultiplier })
      continue
    }
    for (const region of categoryRegions) {
      factors.push({ code: `effect:${category}:${region.instanceId}`, value: region.movementMultiplier })
    }
  }
  return deepFreeze(factors)
}

export function effectOccludersFromRegions(regions = []) {
  return deepFreeze(regions
    .filter(region => region.sightOpacity > 0)
    .map(region => ({
      id: `occluder:${region.id}`,
      sourceId: region.instanceId,
      kind: 'effect',
      bounds: region.bounds,
      opacity: region.sightOpacity,
    })))
}

export function collectPathEffectEvents(regions = [], segments = []) {
  const events = []
  const emitted = new Set()
  const emit = (region, event, segment) => {
    const key = `${region.instanceId}:${event}`
    if (emitted.has(key)) return
    const hooks = region.hooks.filter(hook => hook.event === event)
    if (event === 'traverse' || hooks.length > 0) {
      events.push(deepFreeze({
        instanceId: region.instanceId,
        definitionKey: region.definitionKey,
        event,
        segmentId: segment.id || null,
        hooks,
      }))
      emitted.add(key)
    }
  }
  for (const segment of segments) {
    for (const region of regions) {
      if (!segmentIntersectsEffectBounds(segment.from, segment.to, region.bounds)) continue
      const fromInside = pointInsideEffectBounds(segment.from, region.bounds)
      const toInside = pointInsideEffectBounds(segment.to, region.bounds)
      if (!fromInside) emit(region, 'enter', segment)
      emit(region, 'traverse', segment)
      if (!toInside) emit(region, 'exit', segment)
    }
  }
  return deepFreeze(events)
}

export function collectPointEffectHooks(regions = [], point, event) {
  if (!HOOK_EVENTS.has(event)) throw new RangeError(`Événement de hook inconnu : ${event}`)
  return deepFreeze(regions
    .filter(region => pointInsideEffectBounds(point, region.bounds))
    .flatMap(region => region.hooks
      .filter(hook => hook.event === event)
      .map(hook => ({ instanceId: region.instanceId, definitionKey: region.definitionKey, event, hook }))))
}

export function collectTargetEffectHooks({
  definitions = [],
  instances = [],
  targetKind,
  targetId,
  event,
} = {}) {
  if (!HOOK_EVENTS.has(event)) throw new RangeError(`Événement de hook inconnu : ${event}`)
  const registry = effectDefinitionRegistry(definitions)
  return deepFreeze(instances
    .map(normalizeEffectInstance)
    .filter(instance => instance.state === 'active'
      && instance.targetKind === targetKind
      && String(instance.targetId) === String(targetId))
    .flatMap(instance => (registry.get(instance.definitionKey)?.hooks || [])
      .filter(hook => hook.event === event)
      .map(hook => ({ instanceId: instance.id, definitionKey: instance.definitionKey, event, hook }))))
}

export function buildCompartmentPropagationGraph(snapshot, { channel = 'gas' } = {}) {
  if (channel !== 'gas' && channel !== 'water') throw new RangeError('Le canal doit être gas ou water')
  const nodes = snapshot.spatial.compartments.map(compartment => compartment.id)
  const nodeSet = new Set(nodes)
  const edges = []
  const barrierBySource = new Map(snapshot.spatial.barriers.map(barrier => [barrier.sourceId, barrier]))
  for (const traversal of snapshot.spatial.traversals) {
    if (traversal.kind !== 'door' || !Array.isArray(traversal.roomIds) || traversal.roomIds.length < 2) continue
    const [left, right] = traversal.roomIds.slice(0, 2).map(id => `compartment:${id}`)
    if (!nodeSet.has(left) || !nodeSet.has(right)) continue
    const barrier = barrierBySource.get(traversal.sourceId)
    if (barrier?.blocks?.[channel] === true) continue
    edges.push(deepFreeze({ from: left, to: right, sourceId: traversal.sourceId, channel }))
    edges.push(deepFreeze({ from: right, to: left, sourceId: traversal.sourceId, channel }))
  }
  return deepFreeze({ channel, nodes, edges })
}

export function propagateEffectThroughCompartments(snapshot, {
  originCompartmentId,
  channel = 'gas',
  intensity = 1,
  attenuation = 0.75,
  minimumIntensity = 0.05,
} = {}) {
  const graph = buildCompartmentPropagationGraph(snapshot, { channel })
  if (!graph.nodes.includes(originCompartmentId)) throw new RangeError('Compartiment d’origine inconnu')
  const outgoing = new Map()
  for (const edge of graph.edges) {
    const bucket = outgoing.get(edge.from) || []
    bucket.push(edge.to)
    outgoing.set(edge.from, bucket)
  }
  const levels = new Map([[originCompartmentId, clamp(intensity, 0.01, 100, 1)]])
  const queue = [originCompartmentId]
  while (queue.length > 0) {
    const current = queue.shift()
    const nextIntensity = levels.get(current) * clamp(attenuation, 0, 1, 0.75)
    if (nextIntensity < minimumIntensity) continue
    for (const next of outgoing.get(current) || []) {
      if ((levels.get(next) || 0) >= nextIntensity - EPSILON) continue
      levels.set(next, nextIntensity)
      queue.push(next)
    }
  }
  return deepFreeze([...levels.entries()]
    .map(([compartmentId, propagatedIntensity]) => ({ compartmentId, intensity: propagatedIntensity }))
    .sort((a, b) => a.compartmentId.localeCompare(b.compartmentId)))
}
