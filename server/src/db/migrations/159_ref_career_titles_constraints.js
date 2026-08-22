// 159_ref_career_titles_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE INDEX ref_career_titles_career_id_index ON public.ref_career_titles USING btree (career_id);

CREATE UNIQUE INDEX ref_career_titles_career_id_min_years_unique ON public.ref_career_titles USING btree (career_id, min_years);

CREATE UNIQUE INDEX ref_career_titles_pkey ON public.ref_career_titles USING btree (id);

alter table "public"."ref_career_titles" add constraint "ref_career_titles_pkey" PRIMARY KEY using index "ref_career_titles_pkey";

alter table "public"."ref_career_titles" add constraint "ref_career_titles_career_id_min_years_unique" UNIQUE using index "ref_career_titles_career_id_min_years_unique";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_career_titles" drop constraint if exists "ref_career_titles_career_id_min_years_unique";
alter table "public"."ref_career_titles" drop constraint if exists "ref_career_titles_pkey";
drop index if exists "ref_career_titles_career_id_index";
  `)
}
