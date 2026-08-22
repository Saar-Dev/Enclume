// 10_char_archetype.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."char_archetype" (
    "char_sheet_id" uuid not null,
    "genotype_id" text,
    "age" integer,
    "sex" text,
    "is_fertile" boolean default false,
    "origin_geo" text,
    "origin_soc" text,
    "training_base" text,
    "higher_ed" text,
    "setback_rolls" jsonb,
    "is_deserter" boolean not null default false,
    "base_age" integer
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."char_archetype" cascade;
  `)
}
