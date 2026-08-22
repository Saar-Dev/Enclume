// 177_ref_skills_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX ref_skills_pkey ON public.ref_skills USING btree (id);

alter table "public"."ref_skills" add constraint "ref_skills_pkey" PRIMARY KEY using index "ref_skills_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_skills" drop constraint if exists "ref_skills_pkey";
  `)
}
