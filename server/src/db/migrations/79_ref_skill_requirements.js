// 79_ref_skill_requirements.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."ref_skill_requirements" (
    "skill_id" text not null,
    "type" text not null,
    "value" text not null,
    "threshold" integer default 1,
    "or_group" text
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."ref_skill_requirements" cascade;
  `)
}
