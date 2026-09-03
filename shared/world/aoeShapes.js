// shared/world/aoeShapes.js
//
// Géométrie pure de résolution de zone d'effet (AOE) — cercle/cône/rayon, dispersion sur échec.
// Couche 1 de docs/PLANS/PLAN_AOE.md §2/§6 : fonctions pures, aucune DB, aucune dépendance au monde
// compilé. Travaille exclusivement sur le plan horizontal (X/Z) — la hauteur n'intervient jamais ici,
// elle est couverte séparément par la couche LOS (worldVisibilityService, PLAN_AOE.md §2.1).
//
// Unités : les paramètres de forme (amplitudeM/widthM) et de dispersion (failureMarginM) sont en
// mètres, convertis en unités monde une seule fois à la frontière (metersToWorldUnits) — jamais
// mélangés avec les coordonnées brutes ensuite, même patron que worldMetrics.js.

import { normalizeWorldPoint, metersToWorldUnits } from './worldMetrics.js'

const EPSILON = 1e-9
// Formes AOE reconnues — exporté : `shared/combatAoe.js` valide `aoe_profile.shape` contre cette
// même liste (autorité unique, jamais un 2ᵉ Set recopié).
export const SHAPES = new Set(['circle', 'cone', 'ray'])

function finiteNumber(value, label) {
  const number = Number(value)
  if (!Number.isFinite(number)) throw new TypeError(`${label} doit être un nombre fini`)
  return number
}

function positiveNumber(value, label) {
  const number = finiteNumber(value, label)
  if (number <= 0) throw new RangeError(`${label} doit être strictement positif`)
  return number
}

function normalizeDirectionDeg(value, label = 'directionDeg') {
  return ((finiteNumber(value, label) % 360) + 360) % 360
}

// Cap horizontal (degrés, 0-360, 0 = +X, sens trigonométrique X→Z) du vecteur from→to.
// null si les deux points sont confondus (aucune direction définie).
function bearingDeg(from, to) {
  const dx = to.x - from.x
  const dz = to.z - from.z
  if (Math.abs(dx) <= EPSILON && Math.abs(dz) <= EPSILON) return null
  return ((Math.atan2(dz, dx) * 180 / Math.PI) + 360) % 360
}

// Différence angulaire minimale entre deux caps, toujours dans [0, 180].
function angularDifferenceDeg(a, b) {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

// normalizeAoeShape — valide une commande d'entrée (PLAN_AOE.md §6) en descriptif de forme immuable.
// Lève une erreur explicite plutôt que de propager une figure invalide (même discipline que
// createWorldMetrics/normalizeWorldPoint).
export function normalizeAoeShape(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('la description de forme AOE doit être un objet')
  }
  const shape = input.shape
  if (!SHAPES.has(shape)) throw new RangeError(`forme AOE inconnue : ${shape}`)
  const origin = normalizeWorldPoint(input.origin, 'origin')
  const amplitudeM = positiveNumber(input.amplitudeM, 'amplitudeM')
  const normalized = { shape, origin, amplitudeM }

  if (shape === 'cone') {
    normalized.directionDeg = normalizeDirectionDeg(input.directionDeg)
    const angleDeg = positiveNumber(input.angleDeg, 'angleDeg')
    if (angleDeg > 360) throw new RangeError('angleDeg ne peut pas dépasser 360')
    normalized.angleDeg = angleDeg
  }
  if (shape === 'ray') {
    normalized.directionDeg = normalizeDirectionDeg(input.directionDeg)
    normalized.widthM = positiveNumber(input.widthM, 'widthM')
  }
  return Object.freeze(normalized)
}

// isPointInAoeShape — test de présence pur, consommé en boucle par la couche 2 (requête spatiale,
// worldSpatialQueryService.js) sur une liste de positions déjà chargées. Ne lit jamais la DB.
export function isPointInAoeShape(point, aoeShape, metrics) {
  const target = normalizeWorldPoint(point, 'point')
  const dx = target.x - aoeShape.origin.x
  const dz = target.z - aoeShape.origin.z
  const distanceWorld = Math.hypot(dx, dz)
  const amplitudeWorld = metersToWorldUnits(aoeShape.amplitudeM, metrics)

  if (aoeShape.shape === 'circle') {
    return distanceWorld <= amplitudeWorld + EPSILON
  }

  if (aoeShape.shape === 'cone') {
    if (distanceWorld > amplitudeWorld + EPSILON) return false
    if (distanceWorld <= EPSILON) return true // l'origine elle-même est toujours dans son propre cône
    const bearing = bearingDeg(aoeShape.origin, target)
    if (bearing === null) return true
    return angularDifferenceDeg(bearing, aoeShape.directionDeg) <= aoeShape.angleDeg / 2 + EPSILON
  }

  if (aoeShape.shape === 'ray') {
    const rad = aoeShape.directionDeg * Math.PI / 180
    const alongX = Math.cos(rad)
    const alongZ = Math.sin(rad)
    const alongWorld = dx * alongX + dz * alongZ
    const lateralWorld = dx * -alongZ + dz * alongX
    const widthWorld = metersToWorldUnits(aoeShape.widthM, metrics)
    return alongWorld >= -EPSILON
      && alongWorld <= amplitudeWorld + EPSILON
      && Math.abs(lateralWorld) <= widthWorld / 2 + EPSILON
  }

  throw new RangeError(`forme AOE inconnue : ${aoeShape.shape}`)
}

// Direction du 1D6 de dispersion (grenades RAW, docs/REGLES/REGLES_ARMES_SPECIALES.md — schéma fourni
// par Saar, diagramme à 6 branches non symétrique dans le livre). Approximation d'implémentation
// retenue : hexagone régulier par pas de 60°, le dessin d'origine n'étant pas destiné à une lecture au
// degré près (PLAN_AOE.md §6.1). Offsets relatifs à l'axe lanceur→point visé : 0° (1) = continue
// au-delà du point visé (surshoot), 180° (4) = tombe en-deçà (undershoot), 60/120/240/300°
// (2/3/5/6) = diagonales et latéral.
const SCATTER_DIRECTION_OFFSET_DEG = { 1: 0, 2: 60, 3: 120, 4: 180, 5: 240, 6: 300 }

// resolveScatter — calcule le point d'impact réel après un échec de jet (grenades). Appelée AVANT
// normalizeAoeShape : la dispersion déplace l'origine, elle ne fait pas partie de la forme elle-même
// (PLAN_AOE.md §3.1/§6.1).
export function resolveScatter({ throwerPosition, intendedOrigin, failureMarginM, d6Roll }, metrics) {
  const from = normalizeWorldPoint(throwerPosition, 'throwerPosition')
  const to = normalizeWorldPoint(intendedOrigin, 'intendedOrigin')
  const margin = finiteNumber(failureMarginM, 'failureMarginM')
  if (margin <= 0) return to // pas d'échec, pas de dispersion

  if (!Number.isInteger(d6Roll) || d6Roll < 1 || d6Roll > 6) {
    throw new RangeError('d6Roll doit être un entier entre 1 et 6')
  }

  const throwBearing = bearingDeg(from, to) ?? 0 // lanceur/cible confondus : 0° par convention
  const deviationDeg = normalizeDirectionDeg(throwBearing + SCATTER_DIRECTION_OFFSET_DEG[d6Roll])
  const rad = deviationDeg * Math.PI / 180
  const marginWorld = metersToWorldUnits(margin, metrics)

  return Object.freeze({
    x: to.x + Math.cos(rad) * marginWorld,
    y: to.y,
    z: to.z + Math.sin(rad) * marginWorld,
  })
}
