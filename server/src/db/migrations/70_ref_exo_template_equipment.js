// 70_ref_exo_template_equipment.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."ref_exo_template_equipment" (
    "id" uuid not null default gen_random_uuid(),
    "template_id" uuid not null,
    "family" text not null,
    "ref_equipment_id" uuid,
    "label_override" text,
    "level" integer,
    "sort_order" smallint not null default '0'::smallint
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."ref_exo_template_equipment" cascade;
  `)
}
