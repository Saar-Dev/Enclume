// 53_ref_advantages.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."ref_advantages" (
    "advantage_id" text not null,
    "name" text not null,
    "type" text not null,
    "description" text,
    "cost_pc" integer not null,
    "is_unique" boolean default false,
    "family" text,
    "family_limit" integer,
    "subtype" text,
    "mod_attribute" text,
    "mod_value" integer,
    "mod_resistance" text,
    "mod_res_value" integer,
    "mod_conditions" jsonb,
    "mod_gauges" jsonb,
    "mod_identity" jsonb,
    "mod_savings" integer,
    "mod_monthly_income" integer,
    "mod_monthly_income_formula" text,
    "mod_skill_points" integer,
    "mod_age" integer,
    "special_rule" text
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."ref_advantages" cascade;
  `)
}
