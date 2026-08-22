// 167_ref_exo_template_equipment_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX ref_exo_template_equipment_pkey ON public.ref_exo_template_equipment USING btree (id);

alter table "public"."ref_exo_template_equipment" add constraint "ref_exo_template_equipment_pkey" PRIMARY KEY using index "ref_exo_template_equipment_pkey";

alter table "public"."ref_exo_template_equipment" add constraint "chk_exo_template_equipment_family" CHECK ((family = ANY (ARRAY['arme'::text, 'systeme'::text])));

alter table "public"."ref_exo_template_equipment" add constraint "chk_exo_template_equipment_source" CHECK (((ref_equipment_id IS NOT NULL) OR (label_override IS NOT NULL)));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_exo_template_equipment" drop constraint if exists "chk_exo_template_equipment_source";
alter table "public"."ref_exo_template_equipment" drop constraint if exists "chk_exo_template_equipment_family";
alter table "public"."ref_exo_template_equipment" drop constraint if exists "ref_exo_template_equipment_pkey";
  `)
}
