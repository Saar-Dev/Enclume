export function horizontalInterfaceRenderKind({
  hasFloor = false,
  floorDisplayLevel = null,
  floorBelongsToCameraVolume = false,
  hasCeiling = false,
  ceilingDisplayLevel = null,
  ceilingBelongsToCameraVolume = false,
  displayLevel = null,
}) {
  const showsEveryLevel = displayLevel === null || displayLevel === undefined
  const floorIsVisible = hasFloor && (
    showsEveryLevel
      || floorBelongsToCameraVolume
      || (Number.isFinite(Number(floorDisplayLevel)) && Number(floorDisplayLevel) === Number(displayLevel))
  )
  if (floorIsVisible) return 'floor'

  const ceilingIsVisible = hasCeiling && (
    showsEveryLevel
      || ceilingBelongsToCameraVolume
      || (Number.isFinite(Number(ceilingDisplayLevel)) && Number(ceilingDisplayLevel) === Number(displayLevel))
  )
  return ceilingIsVisible ? 'ceiling' : null
}

export function horizontalInterfaceOpacity({
  displayLevel,
  ceilingDisplayLevel,
  belongsToCameraVolume,
  ceilingOpacity,
}) {
  return displayLevel === null
    || displayLevel === undefined
    || ceilingDisplayLevel === displayLevel
    || belongsToCameraVolume
    ? ceilingOpacity
    : 1
}

export function horizontalSurfaceY({
  yOverride = null,
  kind,
  roomBaseY,
  roomTopY,
}) {
  const hasOverride = yOverride !== null && yOverride !== undefined
  if (hasOverride && Number.isFinite(Number(yOverride))) return Number(yOverride)
  return kind === 'ceiling' ? Number(roomTopY) : Number(roomBaseY)
}
