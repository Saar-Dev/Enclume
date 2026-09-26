// shared/world/mapLimits.js
// Plafonds d'un document de carte exporté ou importé (segment S0 du chantier « éditeur de carte » :
// docs/PLANS/PLAN_EXPORT_CARTE.md §6 et §12).
//
// Valeurs de DÉPART, volontairement basses et modifiables ICI seulement (décision Saar, 2026-09-26 :
// « modifiable à terme, débuter petit, faire des tests de performance » ; départ v1 fixé à 30×30 après mesure).
// Elles se règlent avec le banc d'essai `tools/bench-compile.mjs`, jamais à l'estime : `compileSurfaceWorld` est
// synchrone et son coût croît plus vite que la surface (mesuré : salle pleine 30×30 ≈ 1 à 1,7 s, 50×50 ≈ 14 s) et
// surtout avec la complexité du contour (mesuré : salle en damier 16×16 ≈ 5 s, 30×30 > 2 min), d'où les plafonds
// par salle. Le validateur recalcule aussi le contour de la salle pour chaque arrondi déclaré (64 arrondis sur un
// damier 30×30 ≈ 11 s), d'où `maxArcsPerRoom`.
// Étendues et coordonnées en cases de grille.

export const MAP_LIMITS = Object.freeze({
  // Fichier et structure JSON
  maxFileBytes: 2 * 1024 * 1024,
  maxJsonDepth: 32,
  maxJsonNodes: 200000,
  maxStringLength: 4096,
  maxKeyLength: 128,
  maxNameLength: 100,
  maxErrors: 20,

  // Document de surface : carte entière.
  // « 30×30 » (décision Saar) s'exprime par la SURFACE : `maxTotalCells` (900 cases). `maxExtentCells` n'est qu'un garde-fou
  // par axe contre les bornes absurdes : un long couloir de 60×5 cases est léger, et la carte réelle actuelle a une salle de
  // 31×13 cases (403 cases, 88 arêtes de contour) qu'une limite de 30 par axe refuserait à tort.
  maxExtentCells: 100,
  maxTotalCells: 900,
  maxAbsCoordinate: 200,
  maxRooms: 100,
  maxWalls: 2000,
  maxConnectors: 200,
  maxStairs: 200,
  maxFloors: 900,
  maxCeilings: 900,

  // Budget de complexité de la carte entière : somme, sur toutes les salles, du CARRÉ du nombre d'arêtes de contour
  // (le coût de compilation croît environ comme ce carré et s'additionne d'une salle à l'autre : mesuré, 1 damier 12×12 ≈ 0,9 s
  // pour 83 000, 3 damiers ≈ 3,4 s pour 249 000). Sans lui, les plafonds par salle laisseraient passer une douzaine de salles
  // complexes (≈ 11 s de compilation). La carte réelle actuelle en consomme ≈ 8 400.
  maxBoundaryComplexity: 150000,

  // Document de surface : par salle
  maxBoundaryEdgesPerRoom: 300,
  maxArcsPerRoom: 16,
  maxProfilesPerRoom: 64,
  maxClipRoomsPerRoom: 8,
  // Par tranche verticale : points de contour (tous anneaux confondus) et chemins de murs (`maxWalls`)
  maxRingPoints: 2000,
  maxVerticalSlices: 20,
})
