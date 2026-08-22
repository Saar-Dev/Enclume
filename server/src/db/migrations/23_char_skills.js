// 23_char_skills.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."char_skills" (
    "char_sheet_id" uuid not null,
    "skill_id" text not null,
    "mastery" integer default 0,
    "is_learned" boolean default false
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."char_skills" cascade;
  `)
}
