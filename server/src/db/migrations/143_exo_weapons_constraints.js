// 143_exo_weapons_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX exo_weapons_pkey ON public.exo_weapons USING btree (id);

alter table "public"."exo_weapons" add constraint "exo_weapons_pkey" PRIMARY KEY using index "exo_weapons_pkey";

alter table "public"."exo_weapons" add constraint "chk_exo_weapons_source" CHECK (((ref_equipment_id IS NOT NULL) OR (label_override IS NOT NULL)));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."exo_weapons" drop constraint if exists "chk_exo_weapons_source";
alter table "public"."exo_weapons" drop constraint if exists "exo_weapons_pkey";
  `)
}
