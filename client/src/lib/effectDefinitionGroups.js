// client/src/lib/effectDefinitionGroups.js — Regroupement du menu « Effet » par catégorie
// (PLAN_ZONES_DANGER.md §6.2 point 2). Extrait de SurfaceEditorPanel.jsx (2026-09-28) pour être
// partagé avec SessionDangerZonePanel.jsx (Z6, pose de zone en session) — une seule table, jamais une
// 2ᵉ copie qui diverge (invariant « une autorité unique »).
//
// La catégorie existe déjà côté serveur (definition.category, serializeDefinition). RAW
// (feu/acide/gaz/radiation/decompression) et legacy (catégories namespacées 'hazard:fire'/
// 'terrain:water'/'atmosphere:gas'/'terrain:footing') ne partagent pas le même vocabulaire de
// catégorie — cette table les fait converger vers le même groupe visible ; une définition custom MJ
// (`builtin:false`) va toujours dans son propre groupe, jamais mélangée au RAW.
export const EFFECT_CATEGORY_GROUPS = {
  feu: 'effectCategoryFeu', 'hazard:fire': 'effectCategoryFeu',
  acide: 'effectCategoryAcide',
  decompression: 'effectCategoryDecompression',
  radiation: 'effectCategoryRadiation',
  gaz: 'effectCategoryGaz', 'atmosphere:gas': 'effectCategoryGaz',
  'terrain:water': 'effectCategoryLegacy', 'terrain:footing': 'effectCategoryLegacy',
}
export const EFFECT_CATEGORY_GROUP_ORDER = [
  'effectCategoryFeu', 'effectCategoryAcide', 'effectCategoryDecompression',
  'effectCategoryRadiation', 'effectCategoryGaz', 'effectCategoryLegacy', 'effectCategoryCustom',
]

export function groupEffectDefinitions(definitions, t) {
  const byGroup = new Map()
  for (const definition of definitions) {
    const groupKey = !definition.builtin
      ? 'effectCategoryCustom'
      : (EFFECT_CATEGORY_GROUPS[definition.category] || 'effectCategoryLegacy')
    if (!byGroup.has(groupKey)) byGroup.set(groupKey, [])
    byGroup.get(groupKey).push(definition)
  }
  return EFFECT_CATEGORY_GROUP_ORDER
    .filter(groupKey => byGroup.has(groupKey))
    .map(groupKey => ({ groupKey, label: t(`surfaceEditor.${groupKey}`), definitions: byGroup.get(groupKey) }))
}
