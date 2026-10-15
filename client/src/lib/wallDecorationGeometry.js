// wallDecorationGeometry.js — Géométrie de rendu d'un décor mural (PLAN_DECALS.md Lot 2).
// Logique pure (pas de JSX/Three.js), testable indépendamment de SurfaceDungeonScene.jsx —
// même découpage que surfaceGeometry.js/roomWalls.js pour le reste des murs.

import { SURFACE_FINE } from './surfaceCore.js'
import { wallPointDistanceToPanel } from './roomWalls.js'
import { getWallRenderBox } from './surfaceGeometry.js'

export const DECOR_EYE_HEIGHT_M = 1.5
export const DECOR_SURFACE_MARGIN_M = 0.015

// Retrouve le panneau de mur réel (post-découpe porte, `cutWallsForDoorConnectors`) qui porte un
// décor. `sourceEdgeKeys` seul ne suffit pas : une découpe par porte clone le panneau d'origine sans
// jamais recadrer `sourceEdgeKeys` (`cloneWallPiece`, SurfaceDungeonScene.jsx) — plusieurs panneaux
// issus de la même découpe partagent alors les mêmes clés. On filtre par clé puis on départage par
// position réelle du point d'ancrage, même technique qu'à la pose (`wallPointDistanceToPanel`, déjà
// utilisé par `makeWallDecorationFromWallPoint`/`connectors.js`) — jamais le premier panneau trouvé
// par clé (analyse à charge, JOURNALANALYSE.md §P, 2026-10-15).
export function findWallDecorationPanel(panels, decoration) {
  const edgeKeys = new Set((decoration?.sourceEdgeKeys || []).map(String))
  if (edgeKeys.size === 0) return null
  const wallPoint = {
    fx: Number(decoration.anchorX) * SURFACE_FINE,
    fz: Number(decoration.anchorZ) * SURFACE_FINE,
  }
  let best = null
  for (const panel of panels || []) {
    if (!(panel.sourceEdgeKeys || []).some(key => edgeKeys.has(String(key)))) continue
    const projection = wallPointDistanceToPanel(wallPoint, panel)
    if (!projection) continue
    if (!best || projection.distance < best.distance) best = { panel, distance: projection.distance }
  }
  return best?.panel || null
}

// Position et orientation du quad à partir du panneau porteur réel. Deux corrections par rapport à
// la donnée stockée au Lot 1 (trouvées en analyse à charge, JOURNALANALYSE.md §M/§N) :
// - hauteur de pose plafonnée à la hauteur réelle du mur (un mur peut descendre à 0,5 m,
//   `getWallRenderBox`) — jamais la constante brute ;
// - sens de la normale corrigé par `interiorNormalSignsByRoom[decoration.roomId]` : la normale
//   stockée n'est qu'une rotation à 90° de la tangente, pas garantie de regarder vers la salle
//   propriétaire du décor.
export function wallDecorationPlacement(decoration, panel) {
  const box = getWallRenderBox(panel)
  if (!box) return null
  const wallHeight = Number(box.args[1])
  const wallThickness = Number(box.args[2])
  const sign = Number(panel.interiorNormalSignsByRoom?.[decoration.roomId]) < 0 ? -1 : 1
  const normalX = Number(decoration.normalX) * sign
  const normalZ = Number(decoration.normalZ) * sign
  const offset = wallThickness / 2 + DECOR_SURFACE_MARGIN_M
  const half = Math.max(0.05, Number(decoration.heightM) / 2 || 0.25)
  // Hauteur choisie à la pose (Saar, 2026-10-15 : position libre, pas une hauteur imposée) —
  // `anchorY` absent OU explicitement `null` (décor posé avant ce changement, ou aperçu sans point
  // réel — `makeWallDecorationFromWallPoint` pose `null`, jamais `undefined`, dans ce cas) retombe
  // sur la hauteur des yeux par défaut. `Number.isFinite` SANS conversion au préalable : `Number(null)`
  // vaut 0 (un vrai nombre, piège classique JS), ce qui aurait silencieusement forcé tous les décors
  // sans hauteur choisie au ras du sol au lieu du repli attendu — à vérifier sur `decoration.anchorY`
  // tel quel, jamais sur une version déjà convertie par `Number(...)`.
  const rawCenter = Number.isFinite(decoration.anchorY) ? Number(decoration.anchorY) : DECOR_EYE_HEIGHT_M
  const centerOffset = Math.max(half, Math.min(rawCenter, wallHeight - half))

  return {
    position: [
      Number(decoration.anchorX) + normalX * offset,
      Number(decoration.y) + centerOffset,
      Number(decoration.anchorZ) + normalZ * offset,
    ],
    // Rotation Y seule : tangente et normale sont toujours horizontales (mur vertical), la
    // correction de sens ci-dessus suffit à réorienter tout le quad (pas de base 3D complète).
    rotationY: Math.atan2(normalX, normalZ),
  }
}
