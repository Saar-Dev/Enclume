// Graphe de navigation 3D pondéré dérivé du WorldSnapshot. Les sols fournissent les positions
// stables ; les traversées fournissent les portes, escaliers et futurs connecteurs verticaux.

import { buildMovementPlan, calculateMovementCost } from './movementCost.js'
import {
  distanceBetweenWorldPointsM,
  normalizeWorldPoint,
} from './worldMetrics.js'
import {
  createOccupancyIndex,
  createSpatialIndex,
  normalizeActorProfile,
} from './spatialIndex.js'
import { effectMovementFactorsForSegment } from './worldEffects.js'

const EPSILON = 1e-9
const DEFAULT_TRAVERSAL_FACTORS = Object.freeze({
  walk: 1,
  stairs: 1,
  climb: 2,
  crawl: 2,
  swim: 2,
  jump: 1,
  elevator: 1,
  platform: 1,
  forced: 1,
})

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

function clean(value) {
  const rounded = Math.round(value * 1e9) / 1e9
  return Object.is(rounded, -0) ? 0 : rounded
}

function pointAtRatio(from, to, ratio) {
  return {
    x: clean(from.x + (to.x - from.x) * ratio),
    y: clean(from.y + (to.y - from.y) * ratio),
    z: clean(from.z + (to.z - from.z) * ratio),
  }
}

function nodeBucket(point) {
  return `${Math.floor(point.x)}:${Math.floor(point.y)}:${Math.floor(point.z)}`
}

function neighboringBucketKeys(point) {
  const keys = []
  const x = Math.floor(point.x)
  const y = Math.floor(point.y)
  const z = Math.floor(point.z)
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) keys.push(`${x + dx}:${y + dy}:${z + dz}`)
    }
  }
  return keys
}

function nodePointFromSupport(support) {
  return {
    x: clean((support.bounds.min.x + support.bounds.max.x) / 2),
    y: clean(Number(support.y ?? support.bounds.max.y)),
    z: clean((support.bounds.min.z + support.bounds.max.z) / 2),
  }
}

function edgeFactors(mode, surfaceMultiplier = 1, traversalMultiplier = null) {
  return {
    traversal: {
      code: `mode:${mode}`,
      value: Number(traversalMultiplier ?? DEFAULT_TRAVERSAL_FACTORS[mode] ?? 1),
    },
    surface: { code: 'surface', value: Number(surfaceMultiplier || 1) },
  }
}

function makeEdge({ id, fromNode, toNode, mode, allowPartial, sourceId, metrics, factors, effectRegions = [] }) {
  const distanceM = distanceBetweenWorldPointsM(fromNode.point, toNode.point, metrics)
  if (distanceM <= EPSILON) return null
  const environment = effectMovementFactorsForSegment(effectRegions, fromNode.point, toNode.point)
  const resolvedFactors = environment.length > 0
    ? { ...factors, environment: [...(factors.environment || []), ...environment] }
    : factors
  const movement = calculateMovementCost(distanceM, resolvedFactors)
  return {
    id,
    from: fromNode.id,
    to: toNode.id,
    fromPoint: fromNode.point,
    toPoint: toNode.point,
    mode,
    allowPartial,
    sourceId,
    distanceM,
    factors: movement.factors,
    costM: movement.costM,
  }
}

export function buildNavigationGraph(snapshot, {
  actorProfile = {},
  traversalFactors = {},
  effectRegions = snapshot?.spatial?.regions || [],
} = {}) {
  const actor = normalizeActorProfile(actorProfile)
  const spatialIndex = createSpatialIndex(snapshot)
  const nodes = []
  const nodeById = new Map()
  const supportNodes = []
  const traversalNodeGroups = []
  const buckets = new Map()

  const addNode = node => {
    if (nodeById.has(node.id)) throw new Error(`Nœud de navigation dupliqué : ${node.id}`)
    const frozen = deepFreeze({ ...node, point: normalizeWorldPoint(node.point) })
    nodes.push(frozen)
    nodeById.set(frozen.id, frozen)
    const key = nodeBucket(frozen.point)
    const bucket = buckets.get(key) || []
    bucket.push(frozen)
    buckets.set(key, bucket)
    return frozen
  }

  for (const support of snapshot.spatial.supports) {
    if (support.walkable === false || support.from || support.to) continue
    const node = addNode({
      id: `nav:support:${support.id}`,
      point: nodePointFromSupport(support),
      kind: 'support',
      supportId: support.id,
      sourceId: support.sourceId,
      movementMultiplier: Number(support.movementMultiplier || 1),
      stable: true,
    })
    supportNodes.push(node)
  }

  for (const traversal of snapshot.spatial.traversals) {
    if (traversal.enabled === false) continue
    const from = normalizeWorldPoint(traversal.from, `${traversal.id}.from`)
    const to = normalizeWorldPoint(traversal.to, `${traversal.id}.to`)
    const distanceWorld = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z)
    const sampleSpacing = Number(traversal.anchorSpacing || snapshot.metrics.worldUnitsPerCell || 1)
    const sampleCount = Math.max(1, Math.ceil(distanceWorld / sampleSpacing))
    const group = []
    for (let index = 0; index <= sampleCount; index++) {
      group.push(addNode({
        id: `nav:traversal:${traversal.id}:${index}`,
        point: pointAtRatio(from, to, index / sampleCount),
        kind: 'traversal',
        traversalId: traversal.id,
        sourceId: traversal.sourceId,
        mode: traversal.mode || 'walk',
        movementMultiplier: Number(traversal.movementMultiplier || 1),
        stable: traversal.allowPartial !== false,
      }))
    }
    traversalNodeGroups.push({ traversal, nodes: group })
  }

  const edges = []
  const edgeKeys = new Set()
  const addEdge = descriptor => {
    const key = `${descriptor.fromNode.id}>${descriptor.toNode.id}:${descriptor.mode}:${descriptor.sourceId || ''}`
    if (edgeKeys.has(key)) return
    const edge = makeEdge({ ...descriptor, metrics: snapshot.metrics, effectRegions })
    if (!edge) return
    edgeKeys.add(key)
    edges.push(deepFreeze(edge))
  }

  const maxNeighborDistance = Math.SQRT2 * Number(snapshot.metrics.worldUnitsPerCell || 1) + 0.05
  for (const node of supportNodes) {
    for (const key of neighboringBucketKeys(node.point)) {
      for (const other of buckets.get(key) || []) {
        if (other.kind !== 'support' || node.id >= other.id) continue
        const horizontal = Math.hypot(other.point.x - node.point.x, other.point.z - node.point.z)
        if (horizontal <= EPSILON || horizontal > maxNeighborDistance) continue
        if (Math.abs(other.point.y - node.point.y) > actor.maxStepHeight + EPSILON) continue
        if (!spatialIndex.isSegmentClear(node.point, other.point, actor)) continue

        addEdge({
          id: `edge:${node.id}>${other.id}`,
          fromNode: node,
          toNode: other,
          mode: 'walk',
          allowPartial: false,
          sourceId: other.sourceId,
          factors: edgeFactors('walk', other.movementMultiplier),
        })
        addEdge({
          id: `edge:${other.id}>${node.id}`,
          fromNode: other,
          toNode: node,
          mode: 'walk',
          allowPartial: false,
          sourceId: node.sourceId,
          factors: edgeFactors('walk', node.movementMultiplier),
        })
      }
    }
  }

  for (const group of traversalNodeGroups) {
    const { traversal, nodes: traversalNodes } = group
    const mode = traversal.mode || 'walk'
    const factors = edgeFactors(
      mode,
      traversal.movementMultiplier,
      traversalFactors[mode],
    )
    for (let index = 1; index < traversalNodes.length; index++) {
      const previous = traversalNodes[index - 1]
      const current = traversalNodes[index]
      addEdge({
        id: `edge:${previous.id}>${current.id}`,
        fromNode: previous,
        toNode: current,
        mode,
        allowPartial: traversal.allowPartial !== false,
        sourceId: traversal.sourceId,
        factors,
      })
      if (traversal.oneWay !== true) {
        addEdge({
          id: `edge:${current.id}>${previous.id}`,
          fromNode: current,
          toNode: previous,
          mode,
          allowPartial: traversal.allowPartial !== false,
          sourceId: traversal.sourceId,
          factors,
        })
      }
    }

    const connectorNodes = [traversalNodes[0], traversalNodes.at(-1)]
    for (const connectorNode of connectorNodes) {
      for (const supportNode of supportNodes) {
        const horizontal = Math.hypot(
          supportNode.point.x - connectorNode.point.x,
          supportNode.point.z - connectorNode.point.z,
        )
        if (horizontal > 0.8 || Math.abs(supportNode.point.y - connectorNode.point.y) > actor.maxStepHeight) continue
        if (!spatialIndex.isSegmentClear(connectorNode.point, supportNode.point, actor)) continue
        const connectorFactors = edgeFactors(mode, traversal.movementMultiplier, traversalFactors[mode])
        addEdge({
          id: `edge:${supportNode.id}>${connectorNode.id}`,
          fromNode: supportNode,
          toNode: connectorNode,
          mode,
          allowPartial: false,
          sourceId: traversal.sourceId,
          factors: connectorFactors,
        })
        addEdge({
          id: `edge:${connectorNode.id}>${supportNode.id}`,
          fromNode: connectorNode,
          toNode: supportNode,
          mode,
          allowPartial: false,
          sourceId: traversal.sourceId,
          factors: edgeFactors('walk', supportNode.movementMultiplier),
        })
      }
    }
  }

  nodes.sort((a, b) => a.id.localeCompare(b.id))
  edges.sort((a, b) => a.id.localeCompare(b.id))
  return deepFreeze({
    worldRevision: snapshot.worldRevision,
    metrics: snapshot.metrics,
    actorProfile: actor,
    effectRegions,
    nodes,
    edges,
  })
}

class MinHeap {
  constructor() {
    this.items = []
  }

  push(value) {
    this.items.push(value)
    let index = this.items.length - 1
    while (index > 0) {
      const parent = (index - 1) >> 1
      if (this.items[parent].score <= value.score) break
      this.items[index] = this.items[parent]
      index = parent
    }
    this.items[index] = value
  }

  pop() {
    if (this.items.length === 1) return this.items.pop()
    const top = this.items[0]
    const last = this.items.pop()
    let index = 0
    while (true) {
      const left = index * 2 + 1
      const right = left + 1
      if (left >= this.items.length) break
      const child = right < this.items.length && this.items[right].score < this.items[left].score
        ? right
        : left
      if (this.items[child].score >= last.score) break
      this.items[index] = this.items[child]
      index = child
    }
    this.items[index] = last
    return top
  }

  get size() {
    return this.items.length
  }
}

function nearestNode(nodes, point, blocked, maxDistance = 1.25) {
  let best = null
  for (const node of nodes) {
    const distance = Math.hypot(
      node.point.x - point.x,
      node.point.y - point.y,
      node.point.z - point.z,
    )
    if (distance > maxDistance || (best && distance >= best.distance)) continue
    best = { node, distance }
  }
  if (!best || blocked.has(best.node.id)) return null
  return best.node
}

function projectedPointOnSegment(point, from, to) {
  const delta = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z }
  const lengthSquared = delta.x ** 2 + delta.y ** 2 + delta.z ** 2
  if (lengthSquared <= EPSILON) return null
  const relative = { x: point.x - from.x, y: point.y - from.y, z: point.z - from.z }
  const ratio = Math.max(0, Math.min(1, (
    relative.x * delta.x + relative.y * delta.y + relative.z * delta.z
  ) / lengthSquared))
  const projected = pointAtRatio(from, to, ratio)
  return {
    point: projected,
    ratio,
    distance: Math.hypot(point.x - projected.x, point.y - projected.y, point.z - projected.z),
  }
}

function graphWithTransientTraversalPoint(graph, requestedPoint, suffix) {
  if (graph.nodes.some(node => Math.hypot(
    node.point.x - requestedPoint.x,
    node.point.y - requestedPoint.y,
    node.point.z - requestedPoint.z,
  ) <= EPSILON)) return graph

  let selected = null
  for (const edge of graph.edges) {
    if (!edge.allowPartial || edge.mode === 'walk') continue
    const projection = projectedPointOnSegment(requestedPoint, edge.fromPoint, edge.toPoint)
    if (!projection || projection.ratio <= EPSILON || projection.ratio >= 1 - EPSILON) continue
    const tolerance = Math.max(0.15, Number(graph.actorProfile?.radius || 0.35) + 0.1)
    if (projection.distance > tolerance || (selected && projection.distance >= selected.projection.distance)) continue
    selected = { edge, projection }
  }
  if (!selected) return graph

  const nodeById = new Map(graph.nodes.map(node => [node.id, node]))
  const transient = deepFreeze({
    id: `nav:transient:${suffix}`,
    point: normalizeWorldPoint(selected.projection.point),
    kind: 'traversal',
    sourceId: selected.edge.sourceId,
    mode: selected.edge.mode,
    stable: true,
    transient: true,
  })
  const edgePair = new Set([
    `${selected.edge.from}>${selected.edge.to}`,
    `${selected.edge.to}>${selected.edge.from}`,
  ])
  const additions = []
  for (const edge of graph.edges) {
    if (!edgePair.has(`${edge.from}>${edge.to}`)) continue
    const fromNode = nodeById.get(edge.from)
    const toNode = nodeById.get(edge.to)
    const first = makeEdge({
      id: `${edge.id}:to-${suffix}`,
      fromNode,
      toNode: transient,
      mode: edge.mode,
      allowPartial: edge.allowPartial,
      sourceId: edge.sourceId,
      metrics: graph.metrics,
      factors: edge.factors,
    })
    const second = makeEdge({
      id: `${edge.id}:from-${suffix}`,
      fromNode: transient,
      toNode,
      mode: edge.mode,
      allowPartial: edge.allowPartial,
      sourceId: edge.sourceId,
      metrics: graph.metrics,
      factors: edge.factors,
    })
    if (first) additions.push(deepFreeze(first))
    if (second) additions.push(deepFreeze(second))
  }
  return {
    ...graph,
    nodes: [...graph.nodes, transient],
    edges: [...graph.edges, ...additions],
  }
}

export function findNavigationPath(graph, {
  from,
  to,
  occupancy = createOccupancyIndex(),
  excludeOccupantIds = [],
  maxSnapDistance = 1.25,
} = {}) {
  const requestedFrom = normalizeWorldPoint(from, 'from')
  const requestedTo = normalizeWorldPoint(to, 'to')
  const transientStartGraph = graphWithTransientTraversalPoint(graph, requestedFrom, 'start')
  const workingGraph = graphWithTransientTraversalPoint(transientStartGraph, requestedTo, 'destination')
  const blocked = new Set()
  for (const node of workingGraph.nodes) {
    if (!occupancy.canOccupy(node.point, workingGraph.actorProfile, { excludeIds: excludeOccupantIds })) {
      blocked.add(node.id)
    }
  }
  const start = nearestNode(workingGraph.nodes, requestedFrom, blocked, maxSnapDistance)
  const destination = nearestNode(workingGraph.nodes, requestedTo, blocked, maxSnapDistance)
  if (!start || !destination) return null
  if (start.id === destination.id) return deepFreeze({ start, destination, nodes: [start], edges: [], costM: 0 })

  const outgoing = new Map()
  for (const edge of workingGraph.edges) {
    if (blocked.has(edge.to)) continue
    const list = outgoing.get(edge.from) || []
    list.push(edge)
    outgoing.set(edge.from, list)
  }
  const nodeById = new Map(workingGraph.nodes.map(node => [node.id, node]))
  const minFactor = workingGraph.edges.length
    ? Math.min(...workingGraph.edges.map(edge => edge.costM / edge.distanceM))
    : 1
  const heuristic = node => distanceBetweenWorldPointsM(node.point, destination.point, workingGraph.metrics) * minFactor
  const heap = new MinHeap()
  const costs = new Map([[start.id, 0]])
  const previous = new Map()
  heap.push({ id: start.id, score: heuristic(start), cost: 0 })

  while (heap.size > 0) {
    const current = heap.pop()
    if (current.cost > (costs.get(current.id) ?? Infinity) + EPSILON) continue
    if (current.id === destination.id) break
    for (const edge of outgoing.get(current.id) || []) {
      const nextCost = current.cost + edge.costM
      if (nextCost + EPSILON >= (costs.get(edge.to) ?? Infinity)) continue
      costs.set(edge.to, nextCost)
      previous.set(edge.to, edge)
      heap.push({
        id: edge.to,
        cost: nextCost,
        score: nextCost + heuristic(nodeById.get(edge.to)),
      })
    }
  }
  if (!previous.has(destination.id)) return null

  const edges = []
  let currentId = destination.id
  while (currentId !== start.id) {
    const edge = previous.get(currentId)
    if (!edge) return null
    edges.unshift(edge)
    currentId = edge.from
  }
  const nodes = [start, ...edges.map(edge => nodeById.get(edge.to))]
  return deepFreeze({
    start,
    destination,
    nodes,
    edges,
    costM: clean(costs.get(destination.id)),
  })
}

export function planWorldPath({
  snapshot,
  graph = null,
  from,
  to,
  budgetM,
  actorProfile = {},
  occupants = [],
  excludeOccupantIds = [],
  traversalFactors = {},
  effectRegions = snapshot?.spatial?.regions || [],
  pathId = null,
} = {}) {
  const navigationGraph = graph || buildNavigationGraph(snapshot, { actorProfile, traversalFactors, effectRegions })
  const route = findNavigationPath(navigationGraph, {
    from,
    to,
    occupancy: createOccupancyIndex(occupants),
    excludeOccupantIds,
  })
  if (!route) return deepFreeze({
    status: 'unreachable',
    worldRevision: snapshot.worldRevision,
    requestedFrom: normalizeWorldPoint(from),
    requestedTo: normalizeWorldPoint(to),
    plan: null,
  })

  const segments = route.edges.map(edge => ({
    id: edge.id,
    from: edge.fromPoint,
    to: edge.toPoint,
    mode: edge.mode,
    distanceM: edge.distanceM,
    factors: edge.factors,
    allowPartial: edge.allowPartial,
    metadata: { sourceId: edge.sourceId, fromNodeId: edge.from, toNodeId: edge.to },
  }))
  const effectiveBudget = budgetM == null ? route.costM : budgetM
  const plan = buildMovementPlan({
    segments,
    budgetM: effectiveBudget,
    worldRevision: snapshot.worldRevision,
    pathId,
  })
  return deepFreeze({
    status: plan.reachedDestination ? 'destination' : 'budget',
    worldRevision: snapshot.worldRevision,
    requestedFrom: normalizeWorldPoint(from),
    requestedTo: normalizeWorldPoint(to),
    snappedFrom: route.start.point,
    snappedTo: route.destination.point,
    routeCostM: route.costM,
    plan,
  })
}
