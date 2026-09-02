// server/src/lib/refI18n.js — docs/PLANS/PLAN_LOCALISATION.md §7.4.2
//
// Résolveur unique du texte de catalogue ref_*. Le FR est l'autorité dans la colonne
// d'origine (name, label, description, family…) ; la colonne JSONB <champ>_i18n ajoutée
// par la migration 318 ne porte QUE les langues ≠ fr ({"en": …, "de": …}), vide {} tant
// que le produit est FR seul.
//
// Objectif produit : une seule langue, le français. Ce module est la couture qui rend
// l'ajout d'une langue future = peupler les clés _i18n + câbler la source de `locale`
// en un point, sans re-toucher les consommateurs.
//
// Le client reçoit toujours une chaîne déjà résolue, jamais l'objet _i18n.

export const DEFAULT_LOCALE = 'fr'

// Champs traduisibles par table — source de vérité vivante (la migration 318 en garde
// une copie figée à sa date). Ajouter un champ ici APRÈS avoir ajouté sa colonne
// <champ>_i18n par une nouvelle migration.
export const REF_TRANSLATABLE = {
  ref_genotypes:              ['label', 'description'],
  ref_mutation_subtypes:      ['name', 'description', 'special_trait'],
  ref_backgrounds:            ['name', 'description'],
  ref_setbacks:               ['name', 'description'],
  ref_careers:                ['name', 'description', 'geographic_origin_details'],
  ref_mutations:              ['name', 'description', 'stack_effect', 'special_effect'],
  ref_advantages:             ['name', 'description', 'special_rule'],
  ref_skills:                 ['label', 'description', 'family'],
  ref_career_random_benefits: ['description'],
  ref_equipment:              ['name', 'description', 'family', 'category'],
}

// Résout un champ traduisible d'une ligne ref_*.
// - locale par défaut (fr) : la colonne d'origine, sans détour.
// - autre langue : <champ>_i18n[locale] si présent, sinon repli sur la colonne d'origine.
// `table` n'est pas utilisé aujourd'hui — réservé à une future validation
// `field ∈ REF_TRANSLATABLE[table]` ; gardé pour la symétrie avec localizeRef.
export function resolveRefField(table, row, field, locale = DEFAULT_LOCALE) {
  if (row == null) return null
  if (locale === DEFAULT_LOCALE) return row[field] ?? null
  return row[`${field}_i18n`]?.[locale] ?? row[field] ?? null
}

// Projette une ligne ref_* pour le client : retire toute colonne *_i18n (jamais exposée)
// et résout les champs traduisibles de la table dans `locale`. En fr, revient à un clone
// débarrassé des colonnes _i18n — les valeurs sont inchangées.
export function localizeRef(table, row, locale = DEFAULT_LOCALE) {
  if (row == null) return row
  const out = {}
  for (const [key, value] of Object.entries(row)) {
    if (!key.endsWith('_i18n')) out[key] = value
  }
  for (const field of REF_TRANSLATABLE[table] ?? []) {
    out[field] = resolveRefField(table, row, field, locale)
  }
  return out
}

export function localizeRefRows(table, rows, locale = DEFAULT_LOCALE) {
  return rows.map((row) => localizeRef(table, row, locale))
}
