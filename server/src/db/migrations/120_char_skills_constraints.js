// 120_char_skills_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX char_skills_pkey ON public.char_skills USING btree (char_sheet_id, skill_id);

alter table "public"."char_skills" add constraint "char_skills_pkey" PRIMARY KEY using index "char_skills_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_skills" drop constraint if exists "char_skills_pkey";
  `)
}
