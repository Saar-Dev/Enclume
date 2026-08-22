// 114_char_inventory_slots_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX char_inventory_slots_pkey ON public.char_inventory_slots USING btree (char_inventory_id, slot_code);

CREATE INDEX idx_inventory_slots_character_slot ON public.char_inventory_slots USING btree (character_id, slot_code);

CREATE UNIQUE INDEX uq_inventory_slots_hand_container ON public.char_inventory_slots USING btree (character_id, slot_code) WHERE ((slot_code)::text = ANY ((ARRAY['MG'::character varying, 'MD'::character varying, '2M'::character varying, 'Tr'::character varying, 'D'::character varying, 'Ce'::character varying])::text[]));

alter table "public"."char_inventory_slots" add constraint "char_inventory_slots_pkey" PRIMARY KEY using index "char_inventory_slots_pkey";

alter table "public"."char_inventory_slots" add constraint "chk_inventory_slots_code" CHECK (((slot_code)::text = ANY ((ARRAY['T'::character varying, 'C'::character varying, 'BG'::character varying, 'BD'::character varying, 'JG'::character varying, 'JD'::character varying, 'D'::character varying, 'Ce'::character varying, 'MG'::character varying, 'MD'::character varying, '2M'::character varying, 'Tr'::character varying])::text[])));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_inventory_slots" drop constraint if exists "chk_inventory_slots_code";
alter table "public"."char_inventory_slots" drop constraint if exists "char_inventory_slots_pkey";
drop index if exists "idx_inventory_slots_character_slot";
drop index if exists "uq_inventory_slots_hand_container";
  `)
}
