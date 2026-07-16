export function horizontalInterfaceRenderKind({
  hasFloor = false,
  floorDisplayLevel = null,
  hasCeiling = false,
  ceilingDisplayLevel = null,
  displayLevel = null,
  belongsToCameraVolume = false,
}) {
  const showsEveryLevel = displayLevel === null || displayLevel === undefined
  const floorIsVisible = hasFloor && (
    showsEveryLevel
      || (Number.isFinite(Number(floorDisplayLevel)) && Number(floorDisplayLevel) <= Number(displayLevel))
  )
  if (floorIsVisible) return 'floor'

  const ceilingIsVisible = hasCeiling && (
    showsEveryLevel
      || belongsToCameraVolume
      || (Number.isFinite(Number(ceilingDisplayLevel)) && Number(ceilingDisplayLevel) <= Number(displayLevel))
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
