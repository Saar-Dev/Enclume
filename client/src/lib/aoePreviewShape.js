// client/src/lib/aoePreviewShape.js
//
// Géométrie pure de l'APERÇU client du couloir de dispersion "fusil à pompe" (PLAN_AOE.md §8 étape 9).
// Renvoie des segments de bande empilés (largeur constante par palier RAW), jamais un dégradé continu
// — la RAW est un palier discret (1/2/3/3m selon la distance, shared/combatRange.js#SHOTGUN_SPREAD_BY_BAND),
// pas une droite depuis l'origine. Un cône ou un flare lissé représenterait une géométrie que le serveur
// ne calcule pas (shared/combatRange.js:88-93 / socketCombatHelpers.js#resolveAoeAssaultAction) — même
// source de vérité des deux côtés (RANGE_BANDS/SHOTGUN_SPREAD_BY_BAND/parseWeaponRangeBands), rien de
// reparsé ni de réapproximé ici.
//
// Aucune dépendance Three.js : le composant appelant (Canvas3D) traduit ces segments (distance le long
// de l'axe de tir, demi-largeur) en meshes positionnés/orientés sur le tireur.

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
