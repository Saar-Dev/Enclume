// 172_ref_mutation_skills_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX ref_mutation_skills_pkey ON public.ref_mutation_skills USING btree (mutation_id, skill_name);

alter table "public"."ref_mutation_skills" add constraint "ref_mutation_skills_pkey" PRIMARY KEY using index "ref_mutation_skills_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_mutation_skills" drop constraint if exists "ref_mutation_skills_pkey";
  `)
}
