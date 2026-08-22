// 52_polaris_mr.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."polaris_mr" (
    "mr_min" integer not null,
    "mr_max" integer,
    "modifier" integer not null
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."polaris_mr" cascade;
  `)
}
