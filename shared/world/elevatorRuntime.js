// Automate pur d'une cabine d'ascenseur. Aucun timer n'est autoritaire : l'état durable contient
// les échéances et peut être réconcilié après reconnexion ou redémarrage.

const PHASES = new Set(['idle', 'open', 'closing', 'moving', 'opening', 'blocked'])

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

function finite(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function positive(value, fallback) {
  const number = finite(value, fallback)
  return number > 0 ? number : fallback
}

function stopId(level) {
  return `level:${Number(level)}`
}

function pointOf(stop, fallback = {}) {
  return {
    x: finite(stop?.x, fallback.x),
    y: finite(stop?.y, fallback.y),
    z: finite(stop?.z, fallback.z),
  }
}

function segmentAxis(from, to) {
  const changed = ['x', 'y', 'z'].filter(axis => Math.abs(finite(to?.[axis]) - finite(from?.[axis])) > 1e-6)
  return changed.length === 1 ? changed[0] : null
}

export function normalizeElevatorDefinition(connector, { storyHeight = 2.5 } = {}) {
  if (!connector || typeof connector !== 'object') throw new TypeError("La définition d'ascenseur doit être un objet")
  const id = String(connector.worldId || connector.id || '').trim()
  if (!id) throw new RangeError("L'ascenseur exige une identité stable")
  let stops = Array.isArray(connector.stops) ? [...connector.stops] : []
  if (stops.length === 0) {
    const from = Math.trunc(finite(connector.fromLevel, connector.level || 0))
    const to = Math.trunc(finite(connector.toLevel, from + 1))
    const direction = from <= to ? 1 : -1
    for (let level = from; level !== to + direction; level += direction) {
      stops.push({ id: stopId(level), level, y: level * storyHeight + positive(connector.floorThickness, 0.25) / 2 })
    }
  }
  const origin = { x: finite(connector.x), z: finite(connector.z) }
  const defaultDoorAxis = connector.doorAxis === 'x' ? 'x' : 'z'
  const defaultDoorSide = Number(connector.doorSide) < 0 ? -1 : 1
  const normalizedStops = stops.map((stop, index) => {
    const level = Math.trunc(finite(stop.level, index))
    return {
      id: String(stop.id || stopId(level)),
      level,
      x: finite(stop.x, origin.x),
      y: finite(stop.y, level * storyHeight + positive(connector.floorThickness, 0.25) / 2),
      z: finite(stop.z, origin.z),
      label: String(stop.label || `Étage ${level}`).slice(0, 80),
      roomId: stop.roomId == null ? null : String(stop.roomId),
      doorAxis: stop.doorAxis === 'x' ? 'x' : stop.doorAxis === 'z' ? 'z' : defaultDoorAxis,
      doorSide: Number(stop.doorSide) < 0 ? -1 : stop.doorSide == null ? defaultDoorSide : 1,
    }
  })
  if (normalizedStops.length < 2) throw new RangeError("Un ascenseur doit desservir au moins deux arrêts")
  if (new Set(normalizedStops.map(stop => stop.id)).size !== normalizedStops.length) {
    throw new RangeError("Deux arrêts d'ascenseur partagent la même identité")
  }
  normalizedStops.slice(1).forEach((stop, index) => {
    if (!segmentAxis(normalizedStops[index], stop)) {
      throw new RangeError("Deux arrêts consécutifs d'ascenseur doivent être alignés sur X, Y ou Z")
    }
  })
  return deepFreeze({
    id,
    x: normalizedStops[0].x,
    z: normalizedStops[0].z,
    width: positive(connector.width, 1),
    depth: positive(connector.depth, 1),
    cabinHeight: positive(connector.cabinHeight || connector.height, Math.min(2.2, storyHeight * 0.88)),
    floorThickness: positive(connector.cabinFloorThickness, 0.12),
    wallThickness: positive(connector.cabinWallThickness, 0.08),
    doorAxis: defaultDoorAxis,
    doorSide: defaultDoorSide,
    travelSecondsPerLevel: positive(connector.travelSecondsPerLevel, 2),
    travelSecondsPerUnit: positive(connector.travelSecondsPerUnit, 1),
    storyHeight: positive(storyHeight, 2.5),
    doorSeconds: positive(connector.doorSeconds, 0.75),
    dwellSeconds: positive(connector.dwellSeconds, 0.75),
    movementMultiplier: positive(connector.movementMultiplier, 1),
    initialStopId: stopById({ stops: normalizedStops }, connector.initialStopId || connector.fromLevel)?.id
      || normalizedStops[0].id,
    stops: normalizedStops,
  })
}

function stopById(definition, id) {
  const stringId = String(id)
  return definition.stops.find(stop => stop.id === stringId || String(stop.level) === stringId) || null
}

function normalizeQueue(definition, queue = []) {
  const seen = new Set()
  return queue
    .map((request, index) => ({
      id: String(request.id || `request:${index}`),
      stopId: stopById(definition, request.stopId)?.id,
      requestedAt: Math.max(0, Math.trunc(finite(request.requestedAt, 0))),
      requestedBy: request.requestedBy || null,
    }))
    .filter(request => request.stopId && !seen.has(request.stopId) && seen.add(request.stopId))
    .sort((a, b) => a.requestedAt - b.requestedAt || a.id.localeCompare(b.id))
}

export function createInitialElevatorState(definitionInput, { initialStopId = null, now = 0 } = {}) {
  const definition = definitionInput.stops ? definitionInput : normalizeElevatorDefinition(definitionInput)
  const stop = stopById(definition, initialStopId || definition.initialStopId) || definition.stops[0]
  return deepFreeze({
    kind: 'elevator',
    phase: 'open',
    currentStopId: stop.id,
    targetStopId: null,
    positionX: stop.x,
    positionY: stop.y,
    positionZ: stop.z,
    doorState: 'open',
    queue: [],
    transitionStartedAt: Math.max(0, Math.trunc(finite(now))),
    transitionEndsAt: null,
    movementFromY: null,
    movementToY: null,
    movementFrom: null,
    movementPath: [],
    blockedReason: null,
    resume: null,
  })
}

export function normalizeElevatorState(definitionInput, state) {
  const definition = definitionInput.stops ? definitionInput : normalizeElevatorDefinition(definitionInput)
  if (!state) return createInitialElevatorState(definition)
  const phase = PHASES.has(state.phase) ? state.phase : 'idle'
  const current = stopById(definition, state.currentStopId) || definition.stops[0]
  const target = state.targetStopId ? stopById(definition, state.targetStopId) : null
  return deepFreeze({
    kind: 'elevator',
    phase,
    currentStopId: current.id,
    targetStopId: target?.id || null,
    positionX: finite(state.positionX, current.x),
    positionY: finite(state.positionY, current.y),
    positionZ: finite(state.positionZ, current.z),
    doorState: state.doorState === 'open' || state.doorState === 'opening' || state.doorState === 'closing'
      ? state.doorState
      : 'closed',
    queue: normalizeQueue(definition, state.queue),
    transitionStartedAt: state.transitionStartedAt == null ? null : Math.max(0, Math.trunc(finite(state.transitionStartedAt))),
    transitionEndsAt: state.transitionEndsAt == null ? null : Math.max(0, Math.trunc(finite(state.transitionEndsAt))),
    movementFromY: state.movementFromY == null ? null : finite(state.movementFromY),
    movementToY: state.movementToY == null ? null : finite(state.movementToY),
    movementFrom: state.movementFrom && typeof state.movementFrom === 'object'
      ? pointOf(state.movementFrom, current)
      : state.movementFromY == null ? null : { x: finite(state.positionX, current.x), y: finite(state.movementFromY), z: finite(state.positionZ, current.z) },
    movementPath: Array.isArray(state.movementPath)
      ? state.movementPath.map(point => pointOf(point, current))
      : state.movementToY == null ? [] : [{ x: target?.x ?? current.x, y: finite(state.movementToY), z: target?.z ?? current.z }],
    blockedReason: state.blockedReason ? String(state.blockedReason).slice(0, 240) : null,
    resume: state.resume && typeof state.resume === 'object' ? { ...state.resume } : null,
  })
}

function durationMs(seconds) {
  return Math.max(1, Math.round(seconds * 1000))
}

function routeBetween(definition, fromId, toId) {
  const fromIndex = definition.stops.findIndex(stop => stop.id === fromId)
  const toIndex = definition.stops.findIndex(stop => stop.id === toId)
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return []
  const direction = fromIndex < toIndex ? 1 : -1
  const route = []
  for (let index = fromIndex + direction; ; index += direction) {
    route.push(pointOf(definition.stops[index]))
    if (index === toIndex) return route
  }
}

function segmentTravelSeconds(definition, from, to) {
  const axis = segmentAxis(from, to)
  const distance = axis ? Math.abs(to[axis] - from[axis]) : 0
  if (axis === 'y') return definition.travelSecondsPerLevel * distance / definition.storyHeight
  return definition.travelSecondsPerUnit * distance
}

function movementPosition(definition, from, path, ratio) {
  const points = [from, ...path]
  const durations = points.slice(1).map((point, index) => segmentTravelSeconds(definition, points[index], point))
  const total = durations.reduce((sum, value) => sum + value, 0)
  let remaining = Math.max(0, Math.min(1, ratio)) * total
  for (let index = 0; index < durations.length; index += 1) {
    const duration = durations[index]
    if (remaining <= duration || index === durations.length - 1) {
      const localRatio = duration > 0 ? Math.max(0, Math.min(1, remaining / duration)) : 1
      return {
        x: points[index].x + (points[index + 1].x - points[index].x) * localRatio,
        y: points[index].y + (points[index + 1].y - points[index].y) * localRatio,
        z: points[index].z + (points[index + 1].z - points[index].z) * localRatio,
      }
    }
    remaining -= duration
  }
  return pointOf(path.at(-1), from)
}

function startClosing(definition, state, now) {
  return {
    ...state,
    phase: 'closing',
    doorState: 'closing',
    transitionStartedAt: now,
    transitionEndsAt: now + durationMs(definition.doorSeconds),
  }
}

function startServingFromClosed(definition, state, now) {
  const request = state.queue[0]
  if (!request) return { ...state, phase: 'idle', doorState: 'closed', targetStopId: null, transitionEndsAt: null }
  const target = stopById(definition, request.stopId)
  const current = stopById(definition, state.currentStopId)
  if (target.id === current.id) {
    return {
      ...state,
      phase: 'opening',
      targetStopId: target.id,
      doorState: 'opening',
      transitionStartedAt: now,
      transitionEndsAt: now + durationMs(definition.doorSeconds),
    }
  }
  const movementFrom = { x: state.positionX, y: state.positionY, z: state.positionZ }
  const movementPath = routeBetween(definition, current.id, target.id)
  const movementPoints = [movementFrom, ...movementPath]
  const travelSeconds = movementPoints.slice(1)
    .reduce((sum, point, index) => sum + segmentTravelSeconds(definition, movementPoints[index], point), 0)
  return {
    ...state,
    phase: 'moving',
    targetStopId: target.id,
    doorState: 'closed',
    transitionStartedAt: now,
    transitionEndsAt: now + durationMs(Math.max(0.001, travelSeconds)),
    movementFrom,
    movementPath,
    movementFromY: state.positionY,
    movementToY: target.y,
  }
}

export function reconcileElevatorState(definitionInput, stateInput, nowInput = Date.now()) {
  const definition = definitionInput.stops ? definitionInput : normalizeElevatorDefinition(definitionInput)
  const now = Math.max(0, Math.trunc(finite(nowInput)))
  let state = { ...normalizeElevatorState(definition, stateInput), queue: [...normalizeElevatorState(definition, stateInput).queue] }
  if (state.phase === 'blocked') return deepFreeze(state)

  for (let guard = 0; guard < 100; guard += 1) {
    if (state.phase === 'moving' && state.transitionEndsAt > now) {
      const duration = Math.max(1, state.transitionEndsAt - state.transitionStartedAt)
      const ratio = Math.max(0, Math.min(1, (now - state.transitionStartedAt) / duration))
      const point = movementPosition(
        definition,
        state.movementFrom || { x: state.positionX, y: state.movementFromY, z: state.positionZ },
        state.movementPath?.length ? state.movementPath : [{ x: state.positionX, y: state.movementToY, z: state.positionZ }],
        ratio,
      )
      state.positionX = point.x
      state.positionY = point.y
      state.positionZ = point.z
      break
    }
    if (state.transitionEndsAt == null || state.transitionEndsAt > now) break
    const at = state.transitionEndsAt

    if (state.phase === 'closing') {
      state = startServingFromClosed(definition, { ...state, doorState: 'closed' }, at)
      continue
    }
    if (state.phase === 'moving') {
      const target = stopById(definition, state.targetStopId)
      state = {
        ...state,
        phase: 'opening',
        currentStopId: target.id,
        positionX: target.x,
        positionY: target.y,
        positionZ: target.z,
        movementFromY: null,
        movementToY: null,
        movementFrom: null,
        movementPath: [],
        doorState: 'opening',
        transitionStartedAt: at,
        transitionEndsAt: at + durationMs(definition.doorSeconds),
      }
      continue
    }
    if (state.phase === 'opening') {
      state.queue = state.queue.filter(request => request.stopId !== state.currentStopId)
      state = {
        ...state,
        phase: 'open',
        targetStopId: null,
        doorState: 'open',
        transitionStartedAt: at,
        transitionEndsAt: state.queue.length ? at + durationMs(definition.dwellSeconds) : null,
      }
      continue
    }
    if (state.phase === 'open' && state.queue.length) {
      state = startClosing(definition, state, at)
      continue
    }
    break
  }
  return deepFreeze(state)
}

export function requestElevatorStop(definitionInput, stateInput, {
  stopId: requestedStopId,
  requestId,
  requestedAt = Date.now(),
  requestedBy = null,
} = {}) {
  const definition = definitionInput.stops ? definitionInput : normalizeElevatorDefinition(definitionInput)
  const stop = stopById(definition, requestedStopId)
  if (!stop) throw new RangeError(`Arrêt d'ascenseur inconnu : ${requestedStopId}`)
  const now = Math.max(0, Math.trunc(finite(requestedAt)))
  let state = { ...reconcileElevatorState(definition, stateInput, now) }
  if (state.currentStopId === stop.id && state.phase === 'open') return deepFreeze(state)
  if (!state.queue.some(request => request.stopId === stop.id)) {
    state.queue = normalizeQueue(definition, [
      ...state.queue,
      { id: requestId || `request:${now}:${stop.id}`, stopId: stop.id, requestedAt: now, requestedBy },
    ])
  }
  if (state.phase === 'open') state = startClosing(definition, state, now)
  else if (state.phase === 'idle') state = startServingFromClosed(definition, state, now)
  return deepFreeze(state)
}

export function commandElevator(definitionInput, stateInput, command, nowInput = Date.now()) {
  const definition = definitionInput.stops ? definitionInput : normalizeElevatorDefinition(definitionInput)
  const now = Math.max(0, Math.trunc(finite(nowInput)))
  const state = reconcileElevatorState(definition, stateInput, now)
  if (command?.type === 'request') {
    return requestElevatorStop(definition, state, {
      stopId: command.stopId,
      requestId: command.requestId,
      requestedAt: now,
      requestedBy: command.requestedBy,
    })
  }
  if (command?.type === 'block') {
    if (state.phase !== 'opening' && state.phase !== 'closing' && state.phase !== 'open') {
      throw new RangeError("La porte ne peut être bloquée dans l'état courant")
    }
    return deepFreeze({
      ...state,
      phase: 'blocked',
      blockedReason: String(command.reason || 'door-obstructed').slice(0, 240),
      resume: {
        phase: state.phase,
        remainingMs: state.transitionEndsAt == null ? null : Math.max(1, state.transitionEndsAt - now),
        doorState: state.doorState,
      },
      transitionEndsAt: null,
    })
  }
  if (command?.type === 'unblock') {
    if (state.phase !== 'blocked') return state
    const resume = state.resume || { phase: 'open', remainingMs: null, doorState: 'open' }
    return deepFreeze({
      ...state,
      phase: resume.phase,
      doorState: resume.doorState,
      blockedReason: null,
      resume: null,
      transitionStartedAt: now,
      transitionEndsAt: resume.remainingMs == null ? null : now + resume.remainingMs,
    })
  }
  if (command?.type === 'close') {
    if (state.phase !== 'open') return state
    return deepFreeze(startClosing(definition, state, now))
  }
  if (command?.type === 'open') {
    if (state.phase !== 'idle') return state
    return deepFreeze({
      ...state,
      phase: 'opening',
      doorState: 'opening',
      transitionStartedAt: now,
      transitionEndsAt: now + durationMs(definition.doorSeconds),
    })
  }
  throw new RangeError(`Commande d'ascenseur inconnue : ${command?.type || '(vide)'}`)
}

export function elevatorPassengerWorldPoint(definitionInput, state, localPoint) {
  const definition = definitionInput.stops
    ? definitionInput
    : normalizeElevatorDefinition(definitionInput)
  return deepFreeze({
    x: finite(state.positionX, definition.x) + finite(localPoint.x),
    y: finite(state.positionY) + finite(localPoint.y),
    z: finite(state.positionZ, definition.z) + finite(localPoint.z),
  })
}
