// 168_ref_exo_templates_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX ref_exo_templates_pkey ON public.ref_exo_templates USING btree (id);

alter table "public"."ref_exo_templates" add constraint "ref_exo_templates_pkey" PRIMARY KEY using index "ref_exo_templates_pkey";

alter table "public"."ref_exo_templates" add constraint "chk_exo_template_category" CHECK ((category = ANY (ARRAY['exo-alpha'::text, 'exo-0'::text, 'exo-1'::text, 'exo-2'::text, 'exo-3'::text, 'exo-4'::text, 'exo-5'::text, 'exo-6'::text, 'exo-omega'::text])));

alter table "public"."ref_exo_templates" add constraint "chk_exo_template_environment" CHECK ((environment = ANY (ARRAY['submarine'::text, 'surface'::text, 'hybrid'::text, 'atmospheric'::text, 'spatial'::text, 'industrial'::text])));

alter table "public"."ref_exo_templates" add constraint "chk_exo_template_surface_mode" CHECK ((surface_movement_mode = ANY (ARRAY['vit'::text, 'pilot'::text, 'blocked'::text])));

alter table "public"."ref_exo_templates" add constraint "chk_exo_template_underwater_mode" CHECK ((underwater_movement_mode = ANY (ARRAY['vit'::text, 'pilot'::text, 'blocked'::text])));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_exo_templates" drop constraint if exists "chk_exo_template_underwater_mode";
alter table "public"."ref_exo_templates" drop constraint if exists "chk_exo_template_surface_mode";
alter table "public"."ref_exo_templates" drop constraint if exists "chk_exo_template_environment";
alter table "public"."ref_exo_templates" drop constraint if exists "chk_exo_template_category";
alter table "public"."ref_exo_templates" drop constraint if exists "ref_exo_templates_pkey";
  `)
}
