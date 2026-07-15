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

export function wallFacadeKey(wall) {
  if (wall?.facadeId) return String(wall.facadeId)
  if (wall?.curveId) return `wall-facade:curve:${wall.curveId}`
  if (wall?.logicalWallId) return `wall-facade:logical:${wall.logicalWallId}`
  if (wall?.id) return `wall-facade:id:${wall.id}`
  const from = `${Number(wall?.x0) || 0}:${Number(wall?.z0) || 0}`
  const to = `${Number(wall?.x1) || 0}:${Number(wall?.z1) || 0}`
  return from.localeCompare(to) <= 0
    ? `wall-facade:segment:${from}:${to}`
    : `wall-facade:segment:${to}:${from}`
}

export function nearestOccludingFacadeIds({ camera, targets, facades }) {
  const result = new Set()
  if (!camera || !Array.isArray(targets) || !Array.isArray(facades)) return result
  if (![Number(camera.x), Number(camera.z)].every(Number.isFinite)) return result

  for (const target of targets) {
    if (![Number(target?.x), Number(target?.z)].every(Number.isFinite)) continue
    let closestRatio = Infinity
    const closestFacadeIds = new Set()

    for (const facade of facades) {
      if (!facade?.id || !Array.isArray(facade.surfaces)) continue
      let facadeRatio = Infinity
      for (const surface of facade.surfaces) {
        const path = surface?.path
        if (!Array.isArray(path) || path.length < 2) continue
        for (let index = 0; index < path.length - 1; index += 1) {
          const ratio = segmentIntersectionRatio2D(camera, target, path[index], path[index + 1])
          if (ratio === null || ratio <= EPSILON || ratio >= 1 - EPSILON) continue
          facadeRatio = Math.min(facadeRatio, ratio)
        }
      }
      if (!Number.isFinite(facadeRatio)) continue
      if (facadeRatio < closestRatio - EPSILON) {
        closestRatio = facadeRatio
        closestFacadeIds.clear()
        closestFacadeIds.add(facade.id)
      } else if (Math.abs(facadeRatio - closestRatio) <= EPSILON) {
        closestFacadeIds.add(facade.id)
      }
    }

    for (const facadeId of closestFacadeIds) result.add(facadeId)
  }
  return result
}

export function evenlySampleTargets(targets, maximum = 256) {
  if (!Array.isArray(targets) || targets.length <= maximum) return targets || []
  return Array.from({ length: maximum }, (_, index) => (
    targets[Math.floor(index * targets.length / maximum)]
  ))
}
