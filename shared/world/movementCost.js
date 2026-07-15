// shared/world/movementCost.js
// Calcul pur et explicable du coût d'un chemin. Aucun état de combat, aucune I/O et aucune unité
// implicite : les distances reçues et retournées sont toujours des mètres.

import {
  DEFAULT_WORLD_METRICS,
  distanceBetweenWorldPointsM,
  interpolateWorldPoint,
  normalizeWorldPoint,
} from './worldMetrics.js'

export const TRAVERSAL_MODES = Object.freeze([
  'walk',
  'stairs',
  'climb',
  'crawl',
  'swim',
  'jump',
  'elevator',
  'platform',
  'forced',
])

const EPSILON = 1e-9

function cleanNumber(value) {
  const rounded = Math.round(value * 1e9) / 1e9
  return Object.is(rounded, -0) ? 0 : rounded
}

function finiteNumber(value, label) {
  const number = Number(value)
  if (!Number.isFinite(number)) throw new TypeError(`${label} doit être un nombre fini`)
  return number
}

function nonNegativeNumber(value, label) {
  const number = finiteNumber(value, label)
  if (number < 0) throw new RangeError(`${label} ne peut pas être négatif`)
  return number
}

function positiveNumber(value, label) {
  const number = finiteNumber(value, label)
  if (number <= 0) throw new RangeError(`${label} doit être strictement positif`)
  return number
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]))
  }
  return value
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

function normalizeFactorEntry(entry, fallbackCode, label) {
  const descriptor = typeof entry === 'number'
    ? { code: fallbackCode, value: entry }
    : entry
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
    throw new TypeError(`${label} doit être un nombre ou un descripteur de facteur`)
  }
  const code = String(descriptor.code ?? fallbackCode).trim()
  if (!code) throw new TypeError(`${label}.code ne peut pas être vide`)
  const normalized = {
    code,
    value: positiveNumber(descriptor.value ?? descriptor.factor, `${label}.value`),
  }
  if (descriptor.label != null) normalized.label = String(descriptor.label)
  if (descriptor.sourceId != null) normalized.sourceId = String(descriptor.sourceId)
  return Object.freeze(normalized)
}

function normalizeFactorList(value, fallbackPrefix, label) {
  if (value == null) return Object.freeze([])
  const entries = Array.isArray(value) ? value : [value]
  return Object.freeze(entries.map((entry, index) => (
    normalizeFactorEntry(entry, `${fallbackPrefix}:${index + 1}`, `${label}[${index}]`)
  )))
}

export function normalizeMovementFactors(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('factors doit être un objet')
  }
  return Object.freeze({
    traversal: normalizeFactorEntry(
      input.traversal ?? input.traversalMode ?? 1,
      'traversal',
      'factors.traversal',
    ),
    surface: normalizeFactorEntry(input.surface ?? 1, 'surface', 'factors.surface'),
    environment: normalizeFactorList(
      input.environment ?? input.effects,
      'environment',
      'factors.environment',
    ),
    actor: normalizeFactorList(input.actor, 'actor', 'factors.actor'),
    equipment: normalizeFactorList(input.equipment, 'equipment', 'factors.equipment'),
  })
}

export function getMovementFactorProduct(factors = {}) {
  const normalized = normalizeMovementFactors(factors)
  const entries = [
    normalized.traversal,
    normalized.surface,
    ...normalized.environment,
    ...normalized.actor,
    ...normalized.equipment,
  ]
  return cleanNumber(entries.reduce((product, entry) => product * entry.value, 1))
}

export function calculateMovementCost(distanceM, factors = {}) {
  const distance = nonNegativeNumber(distanceM, 'distanceM')
  const normalized = normalizeMovementFactors(factors)
  const factor = getMovementFactorProduct(normalized)
  return Object.freeze({
    distanceM: cleanNumber(distance),
    factor,
    costM: cleanNumber(distance * factor),
    factors: normalized,
  })
}

export function createPathSegment({
  id = null,
  from,
  to,
  mode = 'walk',
  distanceM = null,
  factors = {},
  metrics = DEFAULT_WORLD_METRICS,
  allowPartial = true,
  metadata = {},
}) {
  if (id != null && (typeof id !== 'string' || !id.trim())) {
    throw new TypeError('segment.id doit être null ou une chaîne non vide')
  }
  if (!TRAVERSAL_MODES.includes(mode)) {
    throw new RangeError(`mode de traversée inconnu : ${mode}`)
  }
  if (typeof allowPartial !== 'boolean') throw new TypeError('allowPartial doit être booléen')
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new TypeError('metadata doit être un objet')
  }

  const normalizedFrom = normalizeWorldPoint(from, 'segment.from')
  const normalizedTo = normalizeWorldPoint(to, 'segment.to')
  const physicalDistance = distanceM == null
    ? distanceBetweenWorldPointsM(normalizedFrom, normalizedTo, metrics)
    : positiveNumber(distanceM, 'segment.distanceM')
  if (physicalDistance <= EPSILON) throw new RangeError('Un segment doit avoir une longueur positive')

  const movement = calculateMovementCost(physicalDistance, factors)
  return deepFreeze({
    id,
    from: normalizedFrom,
    to: normalizedTo,
    mode,
    distanceM: movement.distanceM,
    factors: movement.factors,
    factor: movement.factor,
    costM: movement.costM,
    allowPartial,
    partial: false,
    metadata: cloneValue(metadata),
  })
}

function pointsEqual(a, b) {
  return Math.abs(a.x - b.x) <= EPSILON
    && Math.abs(a.y - b.y) <= EPSILON
    && Math.abs(a.z - b.z) <= EPSILON
}

function createPartialSegment(segment, remainingBudgetM) {
  const ratio = Math.min(1, remainingBudgetM / segment.costM)
  return deepFreeze({
    ...segment,
    to: interpolateWorldPoint(segment.from, segment.to, ratio),
    distanceM: cleanNumber(segment.distanceM * ratio),
    costM: cleanNumber(remainingBudgetM),
    partial: true,
    metadata: cloneValue(segment.metadata),
  })
}

export function buildMovementPlan({
  segments = [],
  budgetM,
  worldRevision = 0,
  pathId = null,
} = {}) {
  if (!Array.isArray(segments)) throw new TypeError('segments doit être un tableau')
  const budget = nonNegativeNumber(budgetM, 'budgetM')
  if (!Number.isInteger(worldRevision) || worldRevision < 0) {
    throw new RangeError('worldRevision doit être un entier positif ou nul')
  }
  if (pathId != null && (typeof pathId !== 'string' || !pathId.trim())) {
    throw new TypeError('pathId doit être null ou une chaîne non vide')
  }

  const normalizedSegments = segments.map(segment => createPathSegment(segment))
  for (let index = 1; index < normalizedSegments.length; index++) {
    if (!pointsEqual(normalizedSegments[index - 1].to, normalizedSegments[index].from)) {
      throw new RangeError(`segments[${index}] ne commence pas à la fin du segment précédent`)
    }
  }

  const plannedCostM = cleanNumber(
    normalizedSegments.reduce((sum, segment) => sum + segment.costM, 0),
  )
  const plannedDistanceM = cleanNumber(
    normalizedSegments.reduce((sum, segment) => sum + segment.distanceM, 0),
  )
  const traversed = []
  let spentM = 0
  let distanceM = 0
  let stopReason = 'destination'
  let end = normalizedSegments[0]?.from ?? null

  for (const segment of normalizedSegments) {
    const remaining = cleanNumber(budget - spentM)
    if (segment.costM <= remaining + EPSILON) {
      traversed.push(segment)
      spentM = cleanNumber(spentM + segment.costM)
      distanceM = cleanNumber(distanceM + segment.distanceM)
      end = segment.to
      continue
    }

    if (remaining > EPSILON && segment.allowPartial) {
      const partial = createPartialSegment(segment, remaining)
      traversed.push(partial)
      spentM = cleanNumber(spentM + partial.costM)
      distanceM = cleanNumber(distanceM + partial.distanceM)
      end = partial.to
      stopReason = 'budget'
    } else {
      stopReason = segment.allowPartial ? 'budget' : 'non_partial_segment'
    }
    break
  }

  const reachedDestination = traversed.length === normalizedSegments.length
    && traversed.every(segment => !segment.partial)
  if (!reachedDestination && stopReason === 'destination') stopReason = 'budget'

  return deepFreeze({
    pathId,
    worldRevision,
    budgetM: cleanNumber(budget),
    plannedCostM,
    plannedDistanceM,
    spentM,
    remainingM: cleanNumber(Math.max(0, budget - spentM)),
    distanceM,
    reachedDestination,
    stopReason,
    end,
    segments: traversed,
  })
}
