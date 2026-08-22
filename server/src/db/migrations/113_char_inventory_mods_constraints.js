// 113_char_inventory_mods_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX char_inventory_mods_pkey ON public.char_inventory_mods USING btree (id);

CREATE UNIQUE INDEX char_inventory_mods_weapon_inv_id_equipment_id_unique ON public.char_inventory_mods USING btree (weapon_inv_id, equipment_id);

CREATE UNIQUE INDEX uq_char_inv_mods_slot ON public.char_inventory_mods USING btree (weapon_inv_id, mod_slot) WHERE (mod_slot IS NOT NULL);

alter table "public"."char_inventory_mods" add constraint "char_inventory_mods_pkey" PRIMARY KEY using index "char_inventory_mods_pkey";

alter table "public"."char_inventory_mods" add constraint "char_inventory_mods_weapon_inv_id_equipment_id_unique" UNIQUE using index "char_inventory_mods_weapon_inv_id_equipment_id_unique";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_inventory_mods" drop constraint if exists "char_inventory_mods_weapon_inv_id_equipment_id_unique";
alter table "public"."char_inventory_mods" drop constraint if exists "char_inventory_mods_pkey";
drop index if exists "uq_char_inv_mods_slot";
  `)
}
