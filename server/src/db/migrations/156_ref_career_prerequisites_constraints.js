// 156_ref_career_prerequisites_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE INDEX ref_career_prerequisites_career_id_index ON public.ref_career_prerequisites USING btree (career_id);

CREATE UNIQUE INDEX ref_career_prerequisites_pkey ON public.ref_career_prerequisites USING btree (id);

CREATE INDEX ref_career_prerequisites_prerequisite_career_id_index ON public.ref_career_prerequisites USING btree (prerequisite_career_id);

alter table "public"."ref_career_prerequisites" add constraint "ref_career_prerequisites_pkey" PRIMARY KEY using index "ref_career_prerequisites_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_career_prerequisites" drop constraint if exists "ref_career_prerequisites_pkey";
drop index if exists "ref_career_prerequisites_career_id_index";
drop index if exists "ref_career_prerequisites_prerequisite_career_id_index";
  `)
}
