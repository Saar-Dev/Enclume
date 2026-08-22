// 61_ref_career_skills.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."ref_career_skills" (
    "id" uuid not null default gen_random_uuid(),
    "career_id" uuid not null,
    "skill_id" text not null,
    "conditional" boolean default false,
    "choice_group" text
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."ref_career_skills" cascade;
  `)
}
