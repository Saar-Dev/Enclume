// 141_exo_sheet_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX exo_sheet_pilot_unique ON public.exo_sheet USING btree (pilot_character_id) WHERE (pilot_character_id IS NOT NULL);

CREATE UNIQUE INDEX exo_sheet_pkey ON public.exo_sheet USING btree (character_id);

alter table "public"."exo_sheet" add constraint "exo_sheet_pkey" PRIMARY KEY using index "exo_sheet_pkey";

alter table "public"."exo_sheet" add constraint "chk_exo_sheet_category" CHECK ((category = ANY (ARRAY['exo-alpha'::text, 'exo-0'::text, 'exo-1'::text, 'exo-2'::text, 'exo-3'::text, 'exo-4'::text, 'exo-5'::text, 'exo-6'::text, 'exo-omega'::text])));

alter table "public"."exo_sheet" add constraint "chk_exo_sheet_environment" CHECK ((environment = ANY (ARRAY['submarine'::text, 'surface'::text, 'hybrid'::text, 'atmospheric'::text, 'spatial'::text, 'industrial'::text])));

alter table "public"."exo_sheet" add constraint "chk_exo_sheet_surface_mode" CHECK ((surface_movement_mode = ANY (ARRAY['vit'::text, 'pilot'::text, 'blocked'::text])));

alter table "public"."exo_sheet" add constraint "chk_exo_sheet_underwater_mode" CHECK ((underwater_movement_mode = ANY (ARRAY['vit'::text, 'pilot'::text, 'blocked'::text])));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."exo_sheet" drop constraint if exists "chk_exo_sheet_underwater_mode";
alter table "public"."exo_sheet" drop constraint if exists "chk_exo_sheet_surface_mode";
alter table "public"."exo_sheet" drop constraint if exists "chk_exo_sheet_environment";
alter table "public"."exo_sheet" drop constraint if exists "chk_exo_sheet_category";
alter table "public"."exo_sheet" drop constraint if exists "exo_sheet_pkey";
drop index if exists "exo_sheet_pilot_unique";
  `)
}
