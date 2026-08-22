// 112_char_inventory_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX char_inventory_pkey ON public.char_inventory USING btree (id);

CREATE INDEX idx_char_inventory_character_id ON public.char_inventory USING btree (character_id);

CREATE INDEX idx_char_inventory_equipment_id ON public.char_inventory USING btree (equipment_id) WHERE (equipment_id IS NOT NULL);

alter table "public"."char_inventory" add constraint "char_inventory_pkey" PRIMARY KEY using index "char_inventory_pkey";

alter table "public"."char_inventory" add constraint "chk_inventory_quantity" CHECK ((quantity > 0));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_inventory" drop constraint if exists "chk_inventory_quantity";
alter table "public"."char_inventory" drop constraint if exists "char_inventory_pkey";
drop index if exists "idx_char_inventory_character_id";
drop index if exists "idx_char_inventory_equipment_id";
  `)
}
