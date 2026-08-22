// 151_ref_background_skills_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE INDEX ref_background_skills_background_id_index ON public.ref_background_skills USING btree (background_id);

CREATE UNIQUE INDEX ref_background_skills_pkey ON public.ref_background_skills USING btree (id);

alter table "public"."ref_background_skills" add constraint "ref_background_skills_pkey" PRIMARY KEY using index "ref_background_skills_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_background_skills" drop constraint if exists "ref_background_skills_pkey";
drop index if exists "ref_background_skills_background_id_index";
  `)
}
