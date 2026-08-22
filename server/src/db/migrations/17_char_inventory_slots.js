// 17_char_inventory_slots.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."char_inventory_slots" (
    "char_inventory_id" uuid not null,
    "character_id" uuid not null,
    "slot_code" character varying(10) not null
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."char_inventory_slots" cascade;
  `)
}
