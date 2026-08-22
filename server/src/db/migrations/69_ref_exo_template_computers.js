// 69_ref_exo_template_computers.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."ref_exo_template_computers" (
    "id" uuid not null default gen_random_uuid(),
    "template_id" uuid not null,
    "role" text not null,
    "gen" smallint not null,
    "nt" smallint not null,
    "sort_order" smallint not null default '0'::smallint
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."ref_exo_template_computers" cascade;
  `)
}
