const EPSILON = 1e-7

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

export function cameraFacingFacadeIds({ camera, roomId, facades }) {
  const result = new Set()
  const cameraX = Number(camera?.x)
  const cameraZ = Number(camera?.z)
  if (!roomId || !Number.isFinite(cameraX) || !Number.isFinite(cameraZ) || !Array.isArray(facades)) {
    return result
  }

  for (const facade of facades) {
    if (!facade?.id || !Array.isArray(facade.surfaces)) continue
    let facesCamera = false
    for (const surface of facade.surfaces) {
      const interiorSign = Number(surface?.interiorNormalSignsByRoom?.[roomId]) < 0 ? -1 : 1
      if (!Object.hasOwn(surface?.interiorNormalSignsByRoom || {}, roomId)) continue
      const path = surface?.path
      if (!Array.isArray(path) || path.length < 2) continue
      for (let index = 0; index < path.length - 1; index += 1) {
        const from = path[index]
        const to = path[index + 1]
        const dx = Number(to?.x) - Number(from?.x)
        const dz = Number(to?.z) - Number(from?.z)
        const length = Math.hypot(dx, dz)
        if (!Number.isFinite(length) || length <= EPSILON) continue
        const interiorNormalX = (-dz / length) * interiorSign
        const interiorNormalZ = (dx / length) * interiorSign
        const midX = (Number(from.x) + Number(to.x)) / 2
        const midZ = (Number(from.z) + Number(to.z)) / 2
        const cameraOnInteriorSide = (cameraX - midX) * interiorNormalX
          + (cameraZ - midZ) * interiorNormalZ
        if (cameraOnInteriorSide < -EPSILON) {
          facesCamera = true
          break
        }
      }
      if (facesCamera) break
    }
    if (facesCamera) result.add(facade.id)
  }
  return result
}
