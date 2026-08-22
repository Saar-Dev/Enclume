// 158_ref_career_skills_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE INDEX ref_career_skills_career_id_index ON public.ref_career_skills USING btree (career_id);

CREATE UNIQUE INDEX ref_career_skills_pkey ON public.ref_career_skills USING btree (id);

alter table "public"."ref_career_skills" add constraint "ref_career_skills_pkey" PRIMARY KEY using index "ref_career_skills_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_career_skills" drop constraint if exists "ref_career_skills_pkey";
drop index if exists "ref_career_skills_career_id_index";
  `)
}
