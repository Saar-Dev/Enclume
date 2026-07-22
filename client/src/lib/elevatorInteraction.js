function finite(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export function elevatorInteractionStop(connector, point = null, displayLevel = null) {
  const stops = Array.isArray(connector?.stops) ? connector.stops : []
  if (!stops.length) return null
  if (point && [point.x, point.y, point.z].every(value => Number.isFinite(Number(value)))) {
    const width = Math.max(0.5, finite(connector?.width, 1))
    const depth = Math.max(0.5, finite(connector?.depth, 1))
    const cabinHeight = Math.max(1, finite(connector?.cabinHeight, 2.2))
    return stops.reduce((best, stop) => {
      const dx = finite(point.x) - (finite(stop.x, finite(connector?.x)) + width / 2)
      const dy = finite(point.y) - (finite(stop.y) + cabinHeight / 2)
      const dz = finite(point.z) - (finite(stop.z, finite(connector?.z)) + depth / 2)
      const distance = dx * dx + dy * dy + dz * dz
      return !best || distance < best.distance ? { stop, distance } : best
    }, null)?.stop || stops[0]
  }
  if (Number.isFinite(Number(displayLevel))) {
    return stops.reduce((best, stop) => (
      Math.abs(finite(stop.level) - Number(displayLevel)) < Math.abs(finite(best.level) - Number(displayLevel))
        ? stop
        : best
    ), stops[0])
  }
  return stops[0]
}

export function elevatorCabinIsAtStop(runtimeState, stop, fallbackStop = null) {
  if (!stop) return false
  const currentStopId = runtimeState?.currentStopId || fallbackStop?.id
  if (String(currentStopId) !== String(stop.id) || runtimeState?.phase === 'moving') return false
  const coordinates = [
    ['positionX', 'x'],
    ['positionY', 'y'],
    ['positionZ', 'z'],
  ]
  return coordinates.every(([stateKey, stopKey]) => (
    runtimeState?.[stateKey] == null
      || Math.abs(finite(runtimeState[stateKey]) - finite(stop[stopKey])) <= 0.001
  ))
}

export function selectElevatorActorToken({
  tokens = [],
  characters = [],
  userId = null,
  isGm = false,
  selectedTokenId = null,
} = {}) {
  const owns = token => token && (
    String(token.owner_id || '') === String(userId || '__no-user__')
    || characters.some(character => (
      String(character.id) === String(token.character_id)
      && String(character.user_id) === String(userId)
    ))
  )
  const selected = tokens.find(token => String(token.id) === String(selectedTokenId)) || null
  if (selected && (isGm || owns(selected))) return selected
  return tokens.find(owns) || null
}
