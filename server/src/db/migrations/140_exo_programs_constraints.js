// 140_exo_programs_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX exo_programs_pkey ON public.exo_programs USING btree (id);

alter table "public"."exo_programs" add constraint "exo_programs_pkey" PRIMARY KEY using index "exo_programs_pkey";

alter table "public"."exo_programs" add constraint "chk_exo_programs_source" CHECK (((equipment_id IS NOT NULL) OR (label_override IS NOT NULL)));

alter table "public"."exo_programs" add constraint "exo_programs_level_check" CHECK (((level >= 0) AND (level <= 30)));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."exo_programs" drop constraint if exists "exo_programs_level_check";
alter table "public"."exo_programs" drop constraint if exists "chk_exo_programs_source";
alter table "public"."exo_programs" drop constraint if exists "exo_programs_pkey";
  `)
}
