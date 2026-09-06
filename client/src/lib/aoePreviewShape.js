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

import { RANGE_BANDS, SHOTGUN_SPREAD_BY_BAND, parseWeaponRangeBands, GRENADE_FRAG_BANDS } from '../../../shared/combatRange.js'

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

// ─── Cercle grenade (PLAN_GRENADES.md §5/§6 3c, §10.2) ────────────────────────────────────────────
//
// Différence clé avec le cône/rayon : le cercle est centré sur le POINT D'IMPACT visé par le lanceur,
// **pas** sur la position du tireur.
//
// Deux rendus :
//  - `buildGrenadeBlastRings` + `projectRingQuads` (mécanisme `grenade_frag`) : 5 anneaux concentriques
//    aux rayons RAW (1 / 2,5 / 5 / 10 / 15 m, `GRENADE_FRAG_BANDS` de shared/combatRange.js), opacité
//    graduée du centre (le plus meurtrier) vers l'extrême — pour que la dégression par palier soit
//    LISIBLE à la déclaration. `projectCircleOutline` trace le bord de chaque palier.
//  - `buildCircleSpan` + `projectCircleFan` (disque plein) : repli générique pour une future arme
//    `circle` d'un autre mécanisme, sans table de dégression connue de l'aperçu.

/**
 * @param {number} radiusM  rayon d'effet en mètres, `aoe_profile.radiusM`
 * @returns {{ radiusM: number } | null}  `null` si le rayon est inexploitable (jamais une exception —
 *   un aperçu manquant n'est pas bloquant, contrairement à la résolution serveur).
 */
export function buildCircleSpan(radiusM) {
  if (!Number.isFinite(radiusM) || radiusM <= 0) return null
  return Object.freeze({ radiusM })
}

// GRENADE_RING_OPACITY — opacité de remplissage par palier. Valeur d'AFFICHAGE calibrée à l'œil (pas
// RAW) : le centre `+1D10` le plus opaque, l'extrême `-3D10` le plus ténu, pour que le regard aille au
// plus dangereux. Rouge unique partout (comme le disque historique `opacity={0.4}`) — on fait varier
// l'opacité, jamais la teinte. Clés = `GRENADE_FRAG_BANDS[].name`.
const GRENADE_RING_OPACITY = Object.freeze({
  centre: 0.45, courte: 0.34, moyenne: 0.25, longue: 0.17, extreme: 0.12,
})

/**
 * buildGrenadeBlastRings — un anneau par palier RAW de dégression `grenade_frag`, du centre vers
 * l'extérieur. `innerM` chaîne sur le `outerM` du palier précédent (0 au centre). Géométrie pure,
 * aucun argument : la table `GRENADE_FRAG_BANDS` (shared/combatRange.js) est l'unique source des
 * rayons — le `radiusM` du profil catalogue vaut par construction le dernier `outerM` (garde :
 * shared/combatRange.test.mjs). L'appelant (Canvas3D) décide d'appeler ceci vs le disque plein selon
 * `aoe_profile.mechanic`.
 * @returns {ReadonlyArray<{ band: string, innerM: number, outerM: number, opacity: number }>}
 */
export function buildGrenadeBlastRings() {
  let innerM = 0
  return Object.freeze(GRENADE_FRAG_BANDS.map(band => {
    const ring = Object.freeze({
      band: band.name,
      innerM,
      outerM: band.maxDistanceM,
      opacity: GRENADE_RING_OPACITY[band.name] ?? 0.2,
    })
    innerM = band.maxDistanceM
    return ring
  }))
}

// projectRingQuads — tesselle un anneau (couronne `innerM`..`outerM`) en quadrilatères dans le plan
// horizontal monde (X/Z), centré sur le POINT D'IMPACT. Même convention d'axes que projectCircleFan /
// projectConeTriangles. Le palier centre (`innerM === 0`) produit des quads dégénérés en triangles —
// négligeable à l'échelle d'une table, pas de cas particulier. `steps` = facettes du tour complet.
export function projectRingQuads(ring, center, steps = 48) {
  if (!ring || !(ring.outerM > 0) || !(ring.innerM >= 0) || ring.innerM >= ring.outerM) {
    return Object.freeze([])
  }
  const facets = Math.max(8, Math.floor(steps))
  const at = (radiusM, i) => {
    const rad = (2 * Math.PI * i) / facets
    return Object.freeze({ x: center.x + Math.cos(rad) * radiusM, z: center.z + Math.sin(rad) * radiusM })
  }
  const quads = []
  for (let i = 0; i < facets; i++) {
    quads.push(Object.freeze({
      band: ring.band,
      corners: Object.freeze([at(ring.innerM, i), at(ring.outerM, i), at(ring.outerM, i + 1), at(ring.innerM, i + 1)]),
    }))
  }
  return Object.freeze(quads)
}

// projectCircleOutline — polyligne fermée du cercle de rayon `radiusM` centré sur `center` (plan X/Z),
// pour tracer le bord d'un palier. Le dernier point ferme la boucle sur le premier.
// @returns {ReadonlyArray<{ x: number, z: number }>}  vide si `radiusM` inexploitable.
export function projectCircleOutline(radiusM, center, steps = 64) {
  if (!Number.isFinite(radiusM) || radiusM <= 0) return Object.freeze([])
  const facets = Math.max(8, Math.floor(steps))
  const points = []
  for (let i = 0; i <= facets; i++) {
    const rad = (2 * Math.PI * i) / facets
    points.push(Object.freeze({ x: center.x + Math.cos(rad) * radiusM, z: center.z + Math.sin(rad) * radiusM }))
  }
  return Object.freeze(points)
}

// projectCircleFan — tesselle le disque en éventail de triangles (apex = centre = point d'impact,
// base = cercle de rayon `radiusM`), dans le plan horizontal monde (X/Z). Même convention d'axes et
// même esprit que projectConeTriangles (un « cône » de 360°). `steps` = nombre de facettes de l'arc ;
// 48 par défaut pour un cercle lisse à l'échelle d'une table de jeu.
export function projectCircleFan(circleSpan, center, steps = 48) {
  if (!circleSpan) return Object.freeze([])
  const { radiusM } = circleSpan
  const facets = Math.max(8, Math.floor(steps))
  const pointAt = (i) => {
    const rad = (2 * Math.PI * i) / facets
    return Object.freeze({ x: center.x + Math.cos(rad) * radiusM, z: center.z + Math.sin(rad) * radiusM })
  }
  const apex = Object.freeze({ x: center.x, z: center.z })
  const triangles = []
  for (let i = 0; i < facets; i++) {
    triangles.push(Object.freeze({ corners: Object.freeze([apex, pointAt(i), pointAt(i + 1)]) }))
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
