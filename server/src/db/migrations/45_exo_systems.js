// 45_exo_systems.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."exo_systems" (
    "id" uuid not null default gen_random_uuid(),
    "character_id" uuid not null,
    "ref_equipment_id" uuid,
    "label_override" text,
    "level" integer,
    "integrite_max" integer,
    "integrite_current" integer,
    "sort_order" smallint not null default '0'::smallint
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."exo_systems" cascade;
  `)
}
