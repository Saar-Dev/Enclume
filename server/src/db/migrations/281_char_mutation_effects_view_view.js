// 281_char_mutation_effects_view_view.js
export const up = async (knex) => {
  await knex.raw(`
create or replace view "public"."char_mutation_effects_view" as  SELECT cm.char_sheet_id,
    (COALESCE(sum(((rm."mod_FOR" + COALESCE(rmst."mod_FOR", 0)) + ((cm.count - 1) * COALESCE(((rm.stack_deltas ->> 'mod_FOR'::text))::integer, rm."mod_FOR")))), (0)::bigint))::integer AS "mod_FOR",
    (COALESCE(sum(((rm."mod_CON" + COALESCE(rmst."mod_CON", 0)) + ((cm.count - 1) * COALESCE(((rm.stack_deltas ->> 'mod_CON'::text))::integer, rm."mod_CON")))), (0)::bigint))::integer AS "mod_CON",
    (COALESCE(sum(((rm."mod_COO" + COALESCE(rmst."mod_COO", 0)) + ((cm.count - 1) * COALESCE(((rm.stack_deltas ->> 'mod_COO'::text))::integer, rm."mod_COO")))), (0)::bigint))::integer AS "mod_COO",
    (COALESCE(sum(((rm."mod_INT" + COALESCE(rmst."mod_INT", 0)) + ((cm.count - 1) * COALESCE(((rm.stack_deltas ->> 'mod_INT'::text))::integer, rm."mod_INT")))), (0)::bigint))::integer AS "mod_INT",
    (COALESCE(sum(((rm."mod_VOL" + COALESCE(rmst."mod_VOL", 0)) + ((cm.count - 1) * COALESCE(((rm.stack_deltas ->> 'mod_VOL'::text))::integer, rm."mod_VOL")))), (0)::bigint))::integer AS "mod_VOL",
    (COALESCE(sum(((rm."mod_PRE" + COALESCE(rmst."mod_PRE", 0)) + ((cm.count - 1) * COALESCE(((rm.stack_deltas ->> 'mod_PRE'::text))::integer, rm."mod_PRE")))), (0)::bigint))::integer AS "mod_PRE",
    (COALESCE(sum((rm.mod_res_damage + ((cm.count - 1) * COALESCE(((rm.stack_deltas ->> 'mod_res_damage'::text))::integer, rm.mod_res_damage)))), (0)::bigint))::integer AS mod_res_damage,
    (COALESCE(sum((rm.mod_res_shock + ((cm.count - 1) * COALESCE(((rm.stack_deltas ->> 'mod_res_shock'::text))::integer, rm.mod_res_shock)))), (0)::bigint))::integer AS mod_res_shock,
    (COALESCE(sum((rm.mod_res_drugs + ((cm.count - 1) * COALESCE(((rm.stack_deltas ->> 'mod_res_drugs'::text))::integer, rm.mod_res_drugs)))), (0)::bigint))::integer AS mod_res_drugs,
    (COALESCE(sum((rm.mod_res_disease + ((cm.count - 1) * COALESCE(((rm.stack_deltas ->> 'mod_res_disease'::text))::integer, rm.mod_res_disease)))), (0)::bigint))::integer AS mod_res_disease,
    (COALESCE(sum((rm.mod_res_poison + ((cm.count - 1) * COALESCE(((rm.stack_deltas ->> 'mod_res_poison'::text))::integer, rm.mod_res_poison)))), (0)::bigint))::integer AS mod_res_poison,
    (COALESCE(sum((rm.mod_res_radiation + ((cm.count - 1) * COALESCE(((rm.stack_deltas ->> 'mod_res_radiation'::text))::integer, rm.mod_res_radiation)))), (0)::bigint))::integer AS mod_res_radiation,
    (COALESCE(sum((rm.natural_armor + ((cm.count - 1) * COALESCE(((rm.stack_deltas ->> 'natural_armor'::text))::integer, rm.natural_armor)))), (0)::bigint))::integer AS natural_armor,
    bool_or(((rm.mod_sex)::text = 'androgyne'::text)) AS is_androgyne,
    bool_or(((rm.mod_sex)::text = 'asexue'::text)) AS is_asexue,
    bool_or(((rm.mod_fertility)::text = 'sterile'::text)) AS is_sterile,
    bool_or(((rm.mod_fertility)::text = 'self_fertile'::text)) AS is_self_fertile,
    string_agg(rm.special_effect, ' | '::text) FILTER (WHERE (rm.special_effect IS NOT NULL)) AS special_effects
   FROM ((char_mutations cm
     JOIN ref_mutations rm ON ((rm.mutation_id = cm.mutation_id)))
     LEFT JOIN ref_mutation_subtypes rmst ON ((rmst.subtype_id = cm.subtype_id)))
  WHERE (cm.status = 'active'::text)
  GROUP BY cm.char_sheet_id;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop view if exists "public"."char_mutation_effects_view";
  `)
}
