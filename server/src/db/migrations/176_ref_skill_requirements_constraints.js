// 176_ref_skill_requirements_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX ref_skill_requirements_pkey ON public.ref_skill_requirements USING btree (skill_id, type, value);

alter table "public"."ref_skill_requirements" add constraint "ref_skill_requirements_pkey" PRIMARY KEY using index "ref_skill_requirements_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_skill_requirements" drop constraint if exists "ref_skill_requirements_pkey";
  `)
}
