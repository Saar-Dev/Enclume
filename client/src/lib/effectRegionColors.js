// Couleur par catégorie d'une zone d'effet, pour son rendu 3D (mesh translucide) — sur la carte de
// session (Canvas3D.jsx, ce qu'un joueur/MJ voit réellement en partie) ET dans l'éditeur
// (SurfaceEditorScene.jsx), une seule table (PLAN_ZONES_DANGER.md §6.2 point 3). Deux copies
// identiques existaient encore le 2026-09-28 (l'éditeur avait été corrigé, la session non — même
// bug, non détecté avant de vérifier les deux chemins de rendu).
//
// `region.category` vient de `compileEffectRegions` (shared/world/worldEffects.js,
// `definition.category`), aucun changement serveur. Couvre à la fois le vocabulaire RAW
// (feu/acide/gaz/radiation/decompression, catalogue Z0-Z2) et celui, différent, des 5 anciens types
// (catégories namespacées 'hazard:fire'/'terrain:water'/'atmosphere:gas'/'terrain:footing') pour
// qu'un ancien "Feu" et un nouveau "Grand feu" restent visuellement cohérents.
export const EFFECT_CATEGORY_COLORS = {
  feu: '#f5934a', 'hazard:fire': '#f5934a',
  acide: '#b6e05a',
  decompression: '#6ec3ff',
  radiation: '#d4e157',
  gaz: '#b39ddb', 'atmosphere:gas': '#b39ddb',
  'terrain:water': '#38bdf8',
  'terrain:footing': '#c9a86a',
}
export const EFFECT_REGION_FALLBACK_COLOR = '#fb7185'

export function getEffectRegionColor(region) {
  return EFFECT_CATEGORY_COLORS[region?.category] || EFFECT_REGION_FALLBACK_COLOR
}
