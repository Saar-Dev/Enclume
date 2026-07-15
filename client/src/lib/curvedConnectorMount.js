const EPSILON = 1e-8

/**
 * Repère local d'un accessoire monté sur un arc circulaire.
 *
 * `tangentOffset` est mesuré sur la tangente au centre de la porte. Le résultat donne le décalage
 * normal de la ligne médiane du mur et la rotation Y à appliquer pour suivre sa tangente locale.
 */
export function arcSurfaceMountFrame(radius, tangentOffset, centerSign = 1) {
  const safeRadius = Math.abs(Number(radius))
  const offset = Number(tangentOffset)
  const side = Number(centerSign) < 0 ? -1 : 1
  if (!Number.isFinite(safeRadius) || !Number.isFinite(offset) || safeRadius <= EPSILON) return null
  if (Math.abs(offset) >= safeRadius - EPSILON) return null

  const ratio = Math.max(-1, Math.min(1, offset / safeRadius))
  return {
    normalOffset: side * (safeRadius - Math.sqrt(safeRadius * safeRadius - offset * offset)),
    rotationY: -side * Math.asin(ratio),
  }
}
