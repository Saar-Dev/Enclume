const EPSILON = 1e-7

function cross2D(ax, az, bx, bz) {
  return ax * bz - az * bx
}

export function segmentIntersectionRatio2D(from, to, segmentFrom, segmentTo) {
  const rayX = Number(to?.x) - Number(from?.x)
  const rayZ = Number(to?.z) - Number(from?.z)
  const wallX = Number(segmentTo?.x) - Number(segmentFrom?.x)
  const wallZ = Number(segmentTo?.z) - Number(segmentFrom?.z)
  const offsetX = Number(segmentFrom?.x) - Number(from?.x)
  const offsetZ = Number(segmentFrom?.z) - Number(from?.z)
  if (![rayX, rayZ, wallX, wallZ, offsetX, offsetZ].every(Number.isFinite)) return null

  const denominator = cross2D(rayX, rayZ, wallX, wallZ)
  if (Math.abs(denominator) <= EPSILON) return null
  const rayRatio = cross2D(offsetX, offsetZ, wallX, wallZ) / denominator
  const wallRatio = cross2D(offsetX, offsetZ, rayX, rayZ) / denominator
  if (rayRatio < -EPSILON || rayRatio > 1 + EPSILON) return null
  if (wallRatio < -EPSILON || wallRatio > 1 + EPSILON) return null
  return Math.max(0, Math.min(1, rayRatio))
}

export function wallSliceOccludesFloorTargets({
  camera,
  wallPath,
  wallBottom,
  wallTop,
  targets,
  wallRoomIds = [],
}) {
  if (!camera || !Array.isArray(wallPath) || wallPath.length < 2 || !Array.isArray(targets)) return false
  const bottom = Math.min(Number(wallBottom), Number(wallTop))
  const top = Math.max(Number(wallBottom), Number(wallTop))
  if (![Number(camera.x), Number(camera.y), Number(camera.z), bottom, top].every(Number.isFinite)) return false
  const roomIds = new Set((wallRoomIds || []).map(String))

  for (const target of targets) {
    const targetY = Number(target?.y)
    if (![Number(target?.x), targetY, Number(target?.z)].every(Number.isFinite)) continue
    if (target?.roomId != null && roomIds.size > 0 && !roomIds.has(String(target.roomId))) continue

    for (let index = 0; index < wallPath.length - 1; index += 1) {
      const ratio = segmentIntersectionRatio2D(camera, target, wallPath[index], wallPath[index + 1])
      if (ratio === null) continue
      const hitY = Number(camera.y) + (targetY - Number(camera.y)) * ratio
      if (hitY >= bottom - EPSILON && hitY <= top + EPSILON) return true
    }
  }
  return false
}

export function evenlySampleTargets(targets, maximum = 256) {
  if (!Array.isArray(targets) || targets.length <= maximum) return targets || []
  return Array.from({ length: maximum }, (_, index) => (
    targets[Math.floor(index * targets.length / maximum)]
  ))
}
