// 163_ref_equipment_ammo_compat_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX ref_equipment_ammo_compat_pkey ON public.ref_equipment_ammo_compat USING btree (ammo_id, weapon_id);

alter table "public"."ref_equipment_ammo_compat" add constraint "ref_equipment_ammo_compat_pkey" PRIMARY KEY using index "ref_equipment_ammo_compat_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_equipment_ammo_compat" drop constraint if exists "ref_equipment_ammo_compat_pkey";
  `)
}
