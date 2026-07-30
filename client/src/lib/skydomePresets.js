// Catalogue des ambiances de skydome — un jeu de réglages (couleurs, brouillard, particules)
// consommé par le moteur générique unique `Skydome.jsx`. Ajouter une ambiance ne demande pas de
// nouveau code de rendu, juste une nouvelle entrée ici (même patron que PROCEDURAL_MATERIAL_PRESETS
// dans `proceduralMaterials.js`).
// Lot 1 (visuel, preset figé) : docs/EN_COURS.md — pas encore configurable par le MJ ni persisté.
export const SKYDOME_PRESETS = {
  ocean_floor: {
    label: 'Plancher océanique',
    domeColors: ['#03141c', '#0b3d4a', '#146b78'],
    groundColorCenter: '#2f4a3a',
    groundColorEdge: '#04110f',
    fogColor: '#0b3d4a',
    fogDensity: 0.045,
    particleColor: '#bcd9c8',
    particleCount: 220,
    particleSpeed: 0.15,
    particleSize: 2.2,
  },
}
