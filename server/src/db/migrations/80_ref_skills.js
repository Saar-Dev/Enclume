// 80_ref_skills.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."ref_skills" (
    "id" text not null,
    "family" text not null,
    "label" text not null,
    "parent" text,
    "attr_1" text,
    "attr_2" text,
    "marker" text,
    "description" text,
    "is_category" boolean not null default false
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."ref_skills" cascade;
  `)
}
