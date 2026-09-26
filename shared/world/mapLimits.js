// shared/world/mapLimits.js
// Plafonds d'un document de carte exporté ou importé (segment S0 du chantier « éditeur de carte » :
// docs/PLANS/PLAN_EXPORT_CARTE.md §6 et §12).
//
// Valeurs de DÉPART, volontairement basses et modifiables ICI seulement (décision Saar, 2026-09-26 :
// « modifiable à terme, débuter petit, faire des tests de performance » ; départ v1 fixé à 30×30 après mesure).
// Elles se règlent avec le banc d'essai `tools/bench-compile.mjs`, jamais à l'estime : `compileSurfaceWorld` est
// synchrone et son coût croît plus vite que la surface (mesuré : salle 30×30 ≈ 1,6 s, 40×40 ≈ 5,8 s, 50×50 ≈ 14 s).
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

  // Document de surface
  maxExtentCells: 30,
  maxTotalCells: 900,
  maxAbsCoordinate: 200,
  maxRooms: 100,
  maxWalls: 2000,
  maxConnectors: 200,
  maxStairs: 200,
  maxFloors: 900,
  maxCeilings: 900,
  maxRingPoints: 2000,
  maxVerticalSlices: 20,
})
