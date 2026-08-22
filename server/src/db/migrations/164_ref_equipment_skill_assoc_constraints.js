// 164_ref_equipment_skill_assoc_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX ref_equipment_skill_assoc_pkey ON public.ref_equipment_skill_assoc USING btree (item_id, skill_id);

alter table "public"."ref_equipment_skill_assoc" add constraint "ref_equipment_skill_assoc_pkey" PRIMARY KEY using index "ref_equipment_skill_assoc_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_equipment_skill_assoc" drop constraint if exists "ref_equipment_skill_assoc_pkey";
  `)
}
