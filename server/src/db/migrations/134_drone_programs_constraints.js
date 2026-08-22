// 134_drone_programs_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX drone_programs_pkey ON public.drone_programs USING btree (id);

alter table "public"."drone_programs" add constraint "drone_programs_pkey" PRIMARY KEY using index "drone_programs_pkey";

alter table "public"."drone_programs" add constraint "chk_dp_source" CHECK (((equipment_id IS NOT NULL) OR (label_override IS NOT NULL)));

alter table "public"."drone_programs" add constraint "drone_programs_level_check" CHECK (((level >= 0) AND (level <= 30)));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."drone_programs" drop constraint if exists "drone_programs_level_check";
alter table "public"."drone_programs" drop constraint if exists "chk_dp_source";
alter table "public"."drone_programs" drop constraint if exists "drone_programs_pkey";
  `)
}
