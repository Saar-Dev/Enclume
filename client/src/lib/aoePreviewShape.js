// client/src/lib/aoePreviewShape.js
//
// Géométrie pure de l'APERÇU client des zones d'effet — deux formes :
//  - couloir de dispersion "fusil à pompe" (`ray`, PLAN_AOE.md §8 étape 9) : segments de bande empilés
//    (largeur constante par palier RAW), jamais un dégradé continu — la RAW est un palier discret
//    (1/2/3/3 m, shared/combatRange.js#SHOTGUN_SPREAD_BY_BAND) ;
//  - cône "lance-flammes" (`cone`, PLAN_ARMES_SPECIALES.md §1.4 segment 1d) : un secteur angulaire
//    (angle fixe `aoe_profile.angleDeg`, rayon = portée extrême du catalogue) — même forme que le
//    serveur teste (shared/world/aoeShapes.js branche 'cone', `distance <= amplitude` &&
//    `|écart d'azimut| <= angleDeg/2`), tessellé ici en éventail de triangles pour le rendu.
//
// Même source de vérité que le serveur des deux côtés (RANGE_BANDS/SHOTGUN_SPREAD_BY_BAND/
// parseWeaponRangeBands / la portée du catalogue), rien de reparsé ni de réapproximé.
//
// Aucune dépendance Three.js : le composant appelant (Canvas3D) traduit ces sommets (plan X/Z monde)
// en meshes positionnés sur le tireur.

import { RANGE_BANDS, SHOTGUN_SPREAD_BY_BAND, parseWeaponRangeBands } from '../../../shared/combatRange.js'

/**
 * @param {string} referenceRange  `ref_range` brut de l'arme (ex. Klauss : "2/7/14/28 (35)")
 * @returns {ReadonlyArray<{ band: string, fromM: number, toM: number, widthM: number }>}
 *   Un segment par palier RAW à zone géométrique (bout_portant exclu — RAW : "le tir ne touche qu'une
 *   cible", cf. SHOTGUN_SPREAD_BY_BAND). Tableau vide si la portée n'est pas exploitable ou dégénérée
 *   au point de ne produire aucun segment valide (jamais une exception — un aperçu manquant n'est pas
 *   une erreur bloquante, contrairement à la résolution serveur).
 */
export function buildShotgunSpreadSegments(referenceRange) {
  const thresholds = parseWeaponRangeBands(referenceRange)
  if (!thresholds) return Object.freeze([])

  const segments = []
  for (let i = 0; i < RANGE_BANDS.length; i++) {
    const band = RANGE_BANDS[i]
    const spread = SHOTGUN_SPREAD_BY_BAND[band]
    if (!spread || spread.widthM == null) continue // bout_portant : cible unique, pas de zone à dessiner
    const fromM = i === 0 ? 0 : thresholds[i - 1]
    const toM = thresholds[i]
    if (toM <= fromM) continue // seuils dégénérés (portée catalogue incomplète) — pas de tranche à tracer
    segments.push(Object.freeze({ band, fromM, toM, widthM: spread.widthM }))
  }
  return Object.freeze(segments)
}

// ─── Cône lance-flammes (PLAN_ARMES_SPECIALES.md §1.4 segment 1d) ──────────────────────────────────

/**
 * @param {string} referenceRange  `ref_range` brut de l'arme (ex. Lance-flammes : "3/7/15/30 (40)")
 * @param {number} angleDeg  ouverture totale du cône, `aoe_profile.angleDeg` (lance-flammes : 30)
 * @returns {{ lengthM: number, angleDeg: number } | null}
 *   Rayon du cône = dernier seuil de portée (portée extrême du catalogue, 40 m pour le lance-flammes —
 *   même valeur que `amplitudeM` côté serveur). `null` si la portée ou l'angle sont inexploitables
 *   (jamais une exception : un aperçu manquant n'est pas bloquant, contrairement à la résolution).
 */
export function buildConeSpan(referenceRange, angleDeg) {
  const thresholds = parseWeaponRangeBands(referenceRange)
  if (!thresholds || thresholds.length === 0) return null
  const lengthM = thresholds[thresholds.length - 1]
  if (!(lengthM > 0)) return null
  if (!Number.isFinite(angleDeg) || angleDeg <= 0 || angleDeg > 360) return null
  return Object.freeze({ lengthM, angleDeg })
}

// projectConeTriangles — tesselle le secteur angulaire en éventail de triangles (apex = tireur, base
// = arc à `lengthM`), dans le plan horizontal monde (X/Z), depuis une origine et une direction en
// degrés. Même convention d'axes que projectShotgunSpreadCorners / shared/world/aoeShapes.js
// (0° = +X, sens trigonométrique vers +Z). `steps` = nombre de triangles (résolution de l'arc) ;
// 24 pour 360° max, proportionnel sinon — l'arc d'un cône de 30° n'a pas besoin de plus de ~2-3
// facettes mais on garde une densité constante par degré, pas de cas particulier.
export function projectConeTriangles(coneSpan, origin, directionDeg, steps = null) {
  if (!coneSpan) return Object.freeze([])
  const { lengthM, angleDeg } = coneSpan
  const facets = steps ?? Math.max(2, Math.ceil(angleDeg / 6))
  const startDeg = directionDeg - angleDeg / 2
  const pointAt = (deg) => {
    const rad = deg * Math.PI / 180
    return Object.freeze({ x: origin.x + Math.cos(rad) * lengthM, z: origin.z + Math.sin(rad) * lengthM })
  }
  const apex = Object.freeze({ x: origin.x, z: origin.z })
  const triangles = []
  for (let i = 0; i < facets; i++) {
    const a = pointAt(startDeg + (angleDeg * i) / facets)
    const b = pointAt(startDeg + (angleDeg * (i + 1)) / facets)
    triangles.push(Object.freeze({ corners: Object.freeze([apex, a, b]) }))
  }
  return Object.freeze(triangles)
}

// projectShotgunSpreadCorners — place les segments dans le plan horizontal monde (X/Z), en 4 coins par
// segment (quadrilatère), depuis une origine et une direction en degrés. Même convention que
// shared/world/aoeShapes.js (0° = axe +X, sens trigonométrique vers +Z, `alongX=cos, alongZ=sin`,
// perpendiculaire `(-alongZ, alongX)`) — la même formule que le côté serveur (`isPointInAoeShape`,
// branche 'ray'), pas une réinvention : l'aperçu dessine exactement la géométrie que le serveur teste.
// Trigonométrie pure, aucune dépendance Three.js — Canvas3D traduit ces coins (x,z) en sommets de mesh.
export function projectShotgunSpreadCorners(segments, origin, directionDeg) {
  const rad = directionDeg * Math.PI / 180
  const alongX = Math.cos(rad)
  const alongZ = Math.sin(rad)
  const perpX = -alongZ
  const perpZ = alongX
  return segments.map(seg => {
    const halfWidth = seg.widthM / 2
    const nearX = origin.x + alongX * seg.fromM
    const nearZ = origin.z + alongZ * seg.fromM
    const farX  = origin.x + alongX * seg.toM
    const farZ  = origin.z + alongZ * seg.toM
    return Object.freeze({
      band: seg.band,
      corners: Object.freeze([
        Object.freeze({ x: nearX + perpX * halfWidth, z: nearZ + perpZ * halfWidth }),
        Object.freeze({ x: nearX - perpX * halfWidth, z: nearZ - perpZ * halfWidth }),
        Object.freeze({ x: farX  - perpX * halfWidth, z: farZ  - perpZ * halfWidth }),
        Object.freeze({ x: farX  + perpX * halfWidth, z: farZ  + perpZ * halfWidth }),
      ]),
    })
  })
}
