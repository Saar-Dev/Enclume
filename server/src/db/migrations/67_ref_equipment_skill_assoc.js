// 67_ref_equipment_skill_assoc.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."ref_equipment_skill_assoc" (
    "item_id" uuid not null,
    "skill_id" text not null
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."ref_equipment_skill_assoc" cascade;
  `)
}
