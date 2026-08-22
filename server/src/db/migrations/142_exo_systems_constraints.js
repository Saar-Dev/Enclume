// 142_exo_systems_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX exo_systems_pkey ON public.exo_systems USING btree (id);

alter table "public"."exo_systems" add constraint "exo_systems_pkey" PRIMARY KEY using index "exo_systems_pkey";

alter table "public"."exo_systems" add constraint "chk_exo_systems_source" CHECK (((ref_equipment_id IS NOT NULL) OR (label_override IS NOT NULL)));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."exo_systems" drop constraint if exists "chk_exo_systems_source";
alter table "public"."exo_systems" drop constraint if exists "exo_systems_pkey";
  `)
}
