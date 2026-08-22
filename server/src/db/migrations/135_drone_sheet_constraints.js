// 135_drone_sheet_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX drone_sheet_pkey ON public.drone_sheet USING btree (character_id);

alter table "public"."drone_sheet" add constraint "drone_sheet_pkey" PRIMARY KEY using index "drone_sheet_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."drone_sheet" drop constraint if exists "drone_sheet_pkey";
  `)
}
