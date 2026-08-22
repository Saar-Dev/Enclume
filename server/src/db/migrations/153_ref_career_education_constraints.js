// 153_ref_career_education_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE INDEX ref_career_education_career_id_index ON public.ref_career_education USING btree (career_id);

CREATE UNIQUE INDEX ref_career_education_pkey ON public.ref_career_education USING btree (id);

alter table "public"."ref_career_education" add constraint "ref_career_education_pkey" PRIMARY KEY using index "ref_career_education_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_career_education" drop constraint if exists "ref_career_education_pkey";
drop index if exists "ref_career_education_career_id_index";
  `)
}
