// 128_char_mutation_effects_view_int_cast.js
// char_mutation_effects_view retournait chaque agrégat via COALESCE(SUM(...), 0) — SUM() sur une
// colonne integer produit un bigint en PostgreSQL, que node-pg parse en STRING JS (pas un number),
// pour éviter la perte de précision au-delà de 2^53 (comportement standard du driver). Resté latent
// depuis la création de la vue (personne ne la consommait) — devenu un vrai bug avec le Lot 1
// (docs/PLAN_MUTATION2.md) : `base_level + pc_modifier + mod_genotype + mod_mutation` concatène la
// chaîne au lieu de l'additionner dès que mod_mutation vaut autre chose que 0 (`10 + '2'` → `'102'`,
// pas `12`). Vérifié en base réelle (Session 141 suite 10) : SUM(2)::bigint → typeof 'string'.
//
// Correctif : caster chaque agrégat en ::integer — jamais de valeur réaliste au-delà de l'intervalle
// int4 pour un modificateur de personnage, aucun risque de dépassement.

const ATTRS = ['FOR', 'CON', 'COO', 'INT', 'VOL', 'PRE']
const RESISTANCES = ['damage', 'shock', 'drugs', 'disease', 'poison', 'radiation']

const attrSelect = (attr) => `
      COALESCE(SUM(rm."mod_${attr}" + COALESCE(rmst."mod_${attr}", 0) + (cm.count - 1) * COALESCE((rm.stack_deltas->>'mod_${attr}')::int, rm."mod_${attr}")), 0)::integer AS "mod_${attr}"`

const resistanceSelect = (res) => `
      COALESCE(SUM(rm.mod_res_${res} + (cm.count - 1) * COALESCE((rm.stack_deltas->>'mod_res_${res}')::int, rm.mod_res_${res})), 0)::integer AS mod_res_${res}`

const VIEW_UP = `
    CREATE OR REPLACE VIEW char_mutation_effects_view AS
    SELECT
      cm.char_sheet_id,
${ATTRS.map(attrSelect).join(',\n')},
${RESISTANCES.map(resistanceSelect).join(',\n')},
      COALESCE(SUM(rm.natural_armor + (cm.count - 1) * COALESCE((rm.stack_deltas->>'natural_armor')::int, rm.natural_armor)), 0)::integer AS natural_armor,
      BOOL_OR(rm.mod_sex = 'androgyne')       AS is_androgyne,
      BOOL_OR(rm.mod_sex = 'asexue')          AS is_asexue,
      BOOL_OR(rm.mod_fertility = 'sterile')   AS is_sterile,
      BOOL_OR(rm.mod_fertility = 'self_fertile') AS is_self_fertile,
      STRING_AGG(rm.special_effect, ' | ')
        FILTER (WHERE rm.special_effect IS NOT NULL) AS special_effects
    FROM char_mutations cm
    JOIN ref_mutations rm ON rm.mutation_id = cm.mutation_id
    LEFT JOIN ref_mutation_subtypes rmst ON rmst.subtype_id = cm.subtype_id
    WHERE cm.status = 'active'
    GROUP BY cm.char_sheet_id
`

// down() — vue identique à celle laissée par la migration 127 (sans cast ::integer).
const VIEW_DOWN = `
    CREATE OR REPLACE VIEW char_mutation_effects_view AS
    SELECT
      cm.char_sheet_id,
      COALESCE(SUM(rm."mod_FOR" + COALESCE(rmst."mod_FOR", 0) + (cm.count - 1) * COALESCE((rm.stack_deltas->>'mod_FOR')::int, rm."mod_FOR")), 0) AS "mod_FOR",
      COALESCE(SUM(rm."mod_CON" + COALESCE(rmst."mod_CON", 0) + (cm.count - 1) * COALESCE((rm.stack_deltas->>'mod_CON')::int, rm."mod_CON")), 0) AS "mod_CON",
      COALESCE(SUM(rm."mod_COO" + COALESCE(rmst."mod_COO", 0) + (cm.count - 1) * COALESCE((rm.stack_deltas->>'mod_COO')::int, rm."mod_COO")), 0) AS "mod_COO",
      COALESCE(SUM(rm."mod_INT" + COALESCE(rmst."mod_INT", 0) + (cm.count - 1) * COALESCE((rm.stack_deltas->>'mod_INT')::int, rm."mod_INT")), 0) AS "mod_INT",
      COALESCE(SUM(rm."mod_VOL" + COALESCE(rmst."mod_VOL", 0) + (cm.count - 1) * COALESCE((rm.stack_deltas->>'mod_VOL')::int, rm."mod_VOL")), 0) AS "mod_VOL",
      COALESCE(SUM(rm."mod_PRE" + COALESCE(rmst."mod_PRE", 0) + (cm.count - 1) * COALESCE((rm.stack_deltas->>'mod_PRE')::int, rm."mod_PRE")), 0) AS "mod_PRE",
      COALESCE(SUM(rm.mod_res_damage + (cm.count - 1) * COALESCE((rm.stack_deltas->>'mod_res_damage')::int, rm.mod_res_damage)), 0) AS mod_res_damage,
      COALESCE(SUM(rm.mod_res_shock + (cm.count - 1) * COALESCE((rm.stack_deltas->>'mod_res_shock')::int, rm.mod_res_shock)), 0) AS mod_res_shock,
      COALESCE(SUM(rm.mod_res_drugs + (cm.count - 1) * COALESCE((rm.stack_deltas->>'mod_res_drugs')::int, rm.mod_res_drugs)), 0) AS mod_res_drugs,
      COALESCE(SUM(rm.mod_res_disease + (cm.count - 1) * COALESCE((rm.stack_deltas->>'mod_res_disease')::int, rm.mod_res_disease)), 0) AS mod_res_disease,
      COALESCE(SUM(rm.mod_res_poison + (cm.count - 1) * COALESCE((rm.stack_deltas->>'mod_res_poison')::int, rm.mod_res_poison)), 0) AS mod_res_poison,
      COALESCE(SUM(rm.mod_res_radiation + (cm.count - 1) * COALESCE((rm.stack_deltas->>'mod_res_radiation')::int, rm.mod_res_radiation)), 0) AS mod_res_radiation,
      COALESCE(SUM(rm.natural_armor + (cm.count - 1) * COALESCE((rm.stack_deltas->>'natural_armor')::int, rm.natural_armor)), 0) AS natural_armor,
      BOOL_OR(rm.mod_sex = 'androgyne')       AS is_androgyne,
      BOOL_OR(rm.mod_sex = 'asexue')          AS is_asexue,
      BOOL_OR(rm.mod_fertility = 'sterile')   AS is_sterile,
      BOOL_OR(rm.mod_fertility = 'self_fertile') AS is_self_fertile,
      STRING_AGG(rm.special_effect, ' | ')
        FILTER (WHERE rm.special_effect IS NOT NULL) AS special_effects
    FROM char_mutations cm
    JOIN ref_mutations rm ON rm.mutation_id = cm.mutation_id
    LEFT JOIN ref_mutation_subtypes rmst ON rmst.subtype_id = cm.subtype_id
    WHERE cm.status = 'active'
    GROUP BY cm.char_sheet_id
`

// CREATE OR REPLACE VIEW refuse de changer le type d'une colonne existante (bigint → integer,
// erreur Postgres 42P16 "cannot change data type of view column") — DROP + CREATE obligatoire ici,
// contrairement aux migrations 109/127 qui ne changeaient que la formule, jamais le type.

export const up = async (knex) => {
  await knex.raw('DROP VIEW IF EXISTS char_mutation_effects_view')
  await knex.raw(VIEW_UP)
}

export const down = async (knex) => {
  await knex.raw('DROP VIEW IF EXISTS char_mutation_effects_view')
  await knex.raw(VIEW_DOWN)
}
