/**
 * Migration 254 — exo_sheet : base éditable (Lot B, PLAN_EXOARMURE.md §13.3)
 *
 * Correction d'architecture : jusqu'ici, les stats de base d'une exo-armure (EXF, Blindage,
 * catégorie...) n'existaient nulle part sur `exo_sheet` — chaque consommateur (computeExoStats,
 * resolveExoContext, getExoMovementBudget, Initiative...) refaisait un JOIN live vers
 * `ref_exo_templates` pour les lire. Ça violait l'autorité unique (CLAUDE.md Priorité #4) : une
 * exo-armure ne pouvait jamais avoir de valeur personnalisée, uniquement celle du modèle choisi.
 * Ce Lot copie ces 19 colonnes (+ 3 nouvelles narratives) sur `exo_sheet` elle-même — `template_id`
 * devient une simple référence d'origine, plus une dépendance de calcul.
 *
 * Sentinelle "armure non configurée" : jusqu'ici `template_id IS NULL` (Lot 1 §6.5). Après cette
 * migration, `category IS NULL` — les champs copiés le sont toujours ensemble dans la même
 * transaction (`applyExoTemplate`), jamais une copie partielle, donc `category` seul est un proxy
 * fiable.
 *
 * Toutes les colonnes sont nullables SANS défaut — divergence délibérée par rapport à
 * `ref_exo_templates` (NOT NULL DEFAULT, une ligne catalogue est toujours une définition complète) :
 * un défaut non-nul romprait la sentinelle "non configurée" ci-dessus. En Postgres, une contrainte
 * CHECK(col IN (...)) laisse déjà passer NULL (résultat NULL du IN, pas FALSE) — pas besoin de
 * répéter "IS NULL OR" dans les contraintes ci-dessous.
 *
 * Backfill obligatoire (pas seulement l'ajout de colonnes) : le catalogue `ref_exo_templates` a été
 * seedé cette semaine (migrations 252/253) et des exo-armures réelles ont déjà `template_id` assigné
 * pour la validation navigateur des Lots 1-4. Sans backfill, ces lignes basculeraient silencieusement
 * en "non configurée" au déploiement. `taille`/`type_batterie`/`type_coque` n'ont aucune source sur
 * `ref_exo_templates` — restent NULL pour les lignes existantes (attendu, rien à backfiller).
 */

const CATEGORY_VALUES = [
  'exo-alpha', 'exo-0', 'exo-1', 'exo-2', 'exo-3', 'exo-4', 'exo-5', 'exo-6', 'exo-omega',
]
const ENVIRONMENT_VALUES = ['submarine', 'surface', 'hybrid', 'atmospheric', 'spatial', 'industrial']
const MOVEMENT_MODE_VALUES = ['vit', 'pilot', 'blocked']

// Colonnes copiées depuis ref_exo_templates — même liste pour l'ALTER TABLE et le backfill UPDATE,
// et réutilisée par applyExoTemplate (exoTemplateService.js) : une seule énumération source, jamais
// une divergence silencieuse entre "ce que la migration copie" et "ce qu'applyExoTemplate copiera".
const COPIED_FROM_TEMPLATE_COLUMNS = [
  'category', 'environment', 'depth_operational', 'depth_limit', 'depth_crush',
  'base_exoforce', 'base_blindage', 'base_speed_underwater', 'base_speed_surface',
  'underwater_movement_mode', 'surface_movement_mode', 'speeds_extra',
  'malus_init_underwater', 'malus_init_surface',
  'manufacturer', 'price', 'rarity', 'tech_level', 'autonomy',
]

export const up = async (knex) => {
  await knex.schema.alterTable('exo_sheet', (t) => {
    t.text('category')
    t.text('environment')
    t.integer('depth_operational')
    t.integer('depth_limit')
    t.integer('depth_crush')
    t.integer('base_exoforce')
    t.integer('base_blindage')
    t.integer('base_speed_underwater')
    t.integer('base_speed_surface')
    t.text('underwater_movement_mode')
    t.text('surface_movement_mode')
    t.jsonb('speeds_extra')
    t.integer('malus_init_underwater')
    t.integer('malus_init_surface')
    t.text('manufacturer')
    t.integer('price')
    t.text('rarity')
    t.text('tech_level')
    t.text('autonomy')

    // Nouveaux — absents de ref_exo_templates comme de exo_sheet jusqu'ici, confirmés contre la
    // fiche Roll20 tierce (inspiration UI seule, PLAN_EXOARMURE.md §13.3) : texte libre narratif,
    // aucun calcul ne les consomme.
    t.text('taille')
    t.text('type_batterie')
    t.text('type_coque')
  })

  await knex.raw(`
    ALTER TABLE exo_sheet
      ADD CONSTRAINT chk_exo_sheet_category CHECK (category IN (${CATEGORY_VALUES.map(v => `'${v}'`).join(', ')})),
      ADD CONSTRAINT chk_exo_sheet_environment CHECK (environment IN (${ENVIRONMENT_VALUES.map(v => `'${v}'`).join(', ')})),
      ADD CONSTRAINT chk_exo_sheet_underwater_mode CHECK (underwater_movement_mode IN (${MOVEMENT_MODE_VALUES.map(v => `'${v}'`).join(', ')})),
      ADD CONSTRAINT chk_exo_sheet_surface_mode CHECK (surface_movement_mode IN (${MOVEMENT_MODE_VALUES.map(v => `'${v}'`).join(', ')}))
  `)

  const setClause = COPIED_FROM_TEMPLATE_COLUMNS.map(col => `${col} = ret.${col}`).join(', ')
  await knex.raw(`
    UPDATE exo_sheet es SET ${setClause}
    FROM ref_exo_templates ret
    WHERE es.template_id = ret.id
  `)
}

export const down = async (knex) => {
  await knex.raw(`
    ALTER TABLE exo_sheet
      DROP CONSTRAINT IF EXISTS chk_exo_sheet_category,
      DROP CONSTRAINT IF EXISTS chk_exo_sheet_environment,
      DROP CONSTRAINT IF EXISTS chk_exo_sheet_underwater_mode,
      DROP CONSTRAINT IF EXISTS chk_exo_sheet_surface_mode
  `)
  await knex.schema.alterTable('exo_sheet', (t) => {
    t.dropColumn('category')
    t.dropColumn('environment')
    t.dropColumn('depth_operational')
    t.dropColumn('depth_limit')
    t.dropColumn('depth_crush')
    t.dropColumn('base_exoforce')
    t.dropColumn('base_blindage')
    t.dropColumn('base_speed_underwater')
    t.dropColumn('base_speed_surface')
    t.dropColumn('underwater_movement_mode')
    t.dropColumn('surface_movement_mode')
    t.dropColumn('speeds_extra')
    t.dropColumn('malus_init_underwater')
    t.dropColumn('malus_init_surface')
    t.dropColumn('manufacturer')
    t.dropColumn('price')
    t.dropColumn('rarity')
    t.dropColumn('tech_level')
    t.dropColumn('autonomy')
    t.dropColumn('taille')
    t.dropColumn('type_batterie')
    t.dropColumn('type_coque')
  })
}
