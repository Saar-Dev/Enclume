// 127_char_mutation_effects_view_subtypes.js
// char_mutation_effects_view (migration 109) ne lisait que ref_mutations — jamais
// ref_mutation_subtypes. "Caractère génétique animal" (has_subtable: true, seule mutation du
// catalogue à utiliser ce mécanisme, migration 95) porte tous ses mod_FOR..PRE sur la table
// enfant, pas sur la ligne parente (qui reste à 0 par défaut) — la vue retournait donc toujours
// 0 pour cette mutation, quel que soit le sous-type choisi (félin/canin/reptilien/simiesque).
// Voir docs/PLAN_MUTATION2.md Lot 1.
//
// ref_mutation_subtypes n'a que mod_FOR..PRE (pas de résistances/natural_armor/identité) — seuls
// ces 6 attributs primaires sont donc concernés par ce correctif.
//
// LEFT JOIN (pas JOIN) : la quasi-totalité des mutations n'ont pas de subtype_id (NULL) —
// COALESCE(rmst."mod_FOR", 0) retombe à 0 pour elles, aucun changement pour les 32 autres
// mutations du catalogue. La jointure reste 1:1 (subtype_id est soit NULL soit une FK unique
// vers ref_mutation_subtypes.subtype_id, sa clé primaire) — aucun risque de doublonner les lignes
// agrégées par le GROUP BY.

const ATTRS = ['FOR', 'CON', 'COO', 'INT', 'VOL', 'PRE']

const attrSelect = (attr) => `
      COALESCE(SUM(rm."mod_${attr}" + COALESCE(rmst."mod_${attr}", 0) + (cm.count - 1) * COALESCE((rm.stack_deltas->>'mod_${attr}')::int, rm."mod_${attr}")), 0) AS "mod_${attr}"`

const VIEW_UP = `
    CREATE OR REPLACE VIEW char_mutation_effects_view AS
    SELECT
      cm.char_sheet_id,
${ATTRS.map(attrSelect).join(',\n')},
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

// down() — vue identique à celle laissée par la migration 109 (aucun JOIN vers les sous-types).
const VIEW_DOWN = `
    CREATE OR REPLACE VIEW char_mutation_effects_view AS
    SELECT
      cm.char_sheet_id,
      COALESCE(SUM(rm."mod_FOR" + (cm.count - 1) * COALESCE((rm.stack_deltas->>'mod_FOR')::int, rm."mod_FOR")), 0) AS "mod_FOR",
      COALESCE(SUM(rm."mod_CON" + (cm.count - 1) * COALESCE((rm.stack_deltas->>'mod_CON')::int, rm."mod_CON")), 0) AS "mod_CON",
      COALESCE(SUM(rm."mod_COO" + (cm.count - 1) * COALESCE((rm.stack_deltas->>'mod_COO')::int, rm."mod_COO")), 0) AS "mod_COO",
      COALESCE(SUM(rm."mod_INT" + (cm.count - 1) * COALESCE((rm.stack_deltas->>'mod_INT')::int, rm."mod_INT")), 0) AS "mod_INT",
      COALESCE(SUM(rm."mod_VOL" + (cm.count - 1) * COALESCE((rm.stack_deltas->>'mod_VOL')::int, rm."mod_VOL")), 0) AS "mod_VOL",
      COALESCE(SUM(rm."mod_PRE" + (cm.count - 1) * COALESCE((rm.stack_deltas->>'mod_PRE')::int, rm."mod_PRE")), 0) AS "mod_PRE",
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
    WHERE cm.status = 'active'
    GROUP BY cm.char_sheet_id
`

export const up = async (knex) => {
  await knex.raw(VIEW_UP)
}

export const down = async (knex) => {
  await knex.raw(VIEW_DOWN)
}
