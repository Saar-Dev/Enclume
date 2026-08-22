// 55_ref_backgrounds.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."ref_backgrounds" (
    "id" uuid not null default gen_random_uuid(),
    "type" text not null,
    "code" text not null,
    "name" text not null,
    "description" text,
    "parent_type" text,
    "parent_code" text,
    "pc_cost" integer default 0,
    "years_added" integer default 0,
    "sort_order" integer
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."ref_backgrounds" cascade;
  `)
}
