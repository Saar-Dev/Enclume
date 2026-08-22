// 165_ref_equipment_skills_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX ref_equipment_skills_pkey ON public.ref_equipment_skills USING btree (item_id, skill_id);

alter table "public"."ref_equipment_skills" add constraint "ref_equipment_skills_pkey" PRIMARY KEY using index "ref_equipment_skills_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_equipment_skills" drop constraint if exists "ref_equipment_skills_pkey";
  `)
}
