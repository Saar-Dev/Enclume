// 109_mutation_stacking.js
// Stacking des mutations is_stackable : count réel + effets corrects (docs/PLAN_MUTATION.md).
//
// char_mutations a un index unique partiel (uq_char_mut_no_sub) empêchant toute mutation
// stackable (sans sous-type) d'être achetée/tirée deux fois sans faire planter finalizeCreation.
// Formule : valeur_effective = base + (count-1) × COALESCE(delta_stack, base).
// Les 8 mutations à incrément non-linéaire ont un stack_deltas explicite (JSONB) ; toutes
// les autres retombent sur delta_stack = base (comportement linéaire par défaut).

export const up = async (knex) => {
  await knex.schema.alterTable('ref_mutations', (table) => {
    table.jsonb('stack_deltas').nullable()
  })

  await knex('ref_mutations').where({ name: 'Peau renforcée' })
    .update({ stack_deltas: JSON.stringify({ natural_armor: 2 }) })

  await knex('ref_mutations').where({ name: 'Purulence' })
    .update({ stack_deltas: JSON.stringify({ mod_PRE: -1, mod_res_disease: 2 }) })

  await knex('ref_mutations').where({ name: 'Squelette renforcé' })
    .update({ stack_deltas: JSON.stringify({ mod_res_damage: 1, mod_res_shock: 1 }) })

  const resNaturelleDeltas = {
    fire: { mod_res_damage: 1 },
    cold: { mod_res_damage: 1 },
    drugs: { mod_res_drugs: 1 },
    disease: { mod_res_disease: 1 },
    poison: { mod_res_poison: 1 },
    radiation: { mod_res_radiation: 1 },
  }
  for (const [subtype, delta] of Object.entries(resNaturelleDeltas)) {
    await knex('ref_mutations').where({ name: 'Résistance naturelle', subtype })
      .update({ stack_deltas: JSON.stringify(delta) })
  }

  await knex.raw(`
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
  `)
}

export const down = async (knex) => {
  await knex.raw(`
    CREATE OR REPLACE VIEW char_mutation_effects_view AS
    SELECT
      cm.char_sheet_id,
      COALESCE(SUM(rm."mod_FOR"), 0)          AS "mod_FOR",
      COALESCE(SUM(rm."mod_CON"), 0)          AS "mod_CON",
      COALESCE(SUM(rm."mod_COO"), 0)          AS "mod_COO",
      COALESCE(SUM(rm."mod_INT"), 0)          AS "mod_INT",
      COALESCE(SUM(rm."mod_VOL"), 0)          AS "mod_VOL",
      COALESCE(SUM(rm."mod_PRE"), 0)          AS "mod_PRE",
      COALESCE(SUM(rm.mod_res_damage), 0)     AS mod_res_damage,
      COALESCE(SUM(rm.mod_res_shock), 0)      AS mod_res_shock,
      COALESCE(SUM(rm.mod_res_drugs), 0)      AS mod_res_drugs,
      COALESCE(SUM(rm.mod_res_disease), 0)    AS mod_res_disease,
      COALESCE(SUM(rm.mod_res_poison), 0)     AS mod_res_poison,
      COALESCE(SUM(rm.mod_res_radiation), 0)  AS mod_res_radiation,
      COALESCE(SUM(rm.natural_armor), 0)      AS natural_armor,
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
  `)

  await knex.schema.alterTable('ref_mutations', (table) => {
    table.dropColumn('stack_deltas')
  })
}
