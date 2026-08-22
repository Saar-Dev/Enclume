// 157_ref_career_random_benefits_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE INDEX ref_career_random_benefits_career_id_index ON public.ref_career_random_benefits USING btree (career_id);

CREATE UNIQUE INDEX ref_career_random_benefits_pkey ON public.ref_career_random_benefits USING btree (id);

alter table "public"."ref_career_random_benefits" add constraint "ref_career_random_benefits_pkey" PRIMARY KEY using index "ref_career_random_benefits_pkey";

alter table "public"."ref_career_random_benefits" add constraint "ref_career_random_benefits_roll_check" CHECK (((roll >= 1) AND (roll <= 10)));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_career_random_benefits" drop constraint if exists "ref_career_random_benefits_roll_check";
alter table "public"."ref_career_random_benefits" drop constraint if exists "ref_career_random_benefits_pkey";
drop index if exists "ref_career_random_benefits_career_id_index";
  `)
}
