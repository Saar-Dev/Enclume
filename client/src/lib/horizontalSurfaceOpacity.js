export function horizontalInterfaceOpacity({
  hasFloor,
  displayLevel,
  ceilingDisplayLevel,
  belongsToCameraVolume,
  ceilingOpacity,
}) {
  if (hasFloor) return 1
  return displayLevel === null
    || ceilingDisplayLevel === displayLevel
    || belongsToCameraVolume
    ? ceilingOpacity
    : 1
}
