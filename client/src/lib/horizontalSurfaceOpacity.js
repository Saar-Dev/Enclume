export function horizontalInterfaceOpacity({
  displayLevel,
  ceilingDisplayLevel,
  belongsToCameraVolume,
  ceilingOpacity,
}) {
  return displayLevel === null
    || ceilingDisplayLevel === displayLevel
    || belongsToCameraVolume
    ? ceilingOpacity
    : 1
}
