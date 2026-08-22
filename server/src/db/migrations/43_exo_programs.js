// 43_exo_programs.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."exo_programs" (
    "id" uuid not null default gen_random_uuid(),
    "character_id" uuid not null,
    "equipment_id" uuid,
    "label_override" text,
    "category" text not null,
    "level" integer not null,
    "sort_order" smallint not null default '0'::smallint,
    "exo_computer_id" uuid
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."exo_programs" cascade;
  `)
}
