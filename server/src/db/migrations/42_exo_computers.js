// 42_exo_computers.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."exo_computers" (
    "id" uuid not null default gen_random_uuid(),
    "character_id" uuid not null,
    "role" text not null,
    "gen" smallint not null,
    "nt" smallint not null,
    "blindage_iem" integer,
    "integrite_max" integer,
    "integrite_current" integer,
    "sort_order" smallint not null default '0'::smallint
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."exo_computers" cascade;
  `)
}
