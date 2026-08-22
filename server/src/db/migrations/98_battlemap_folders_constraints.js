// 98_battlemap_folders_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX battlemap_folders_pkey ON public.battlemap_folders USING btree (id);

alter table "public"."battlemap_folders" add constraint "battlemap_folders_pkey" PRIMARY KEY using index "battlemap_folders_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."battlemap_folders" drop constraint if exists "battlemap_folders_pkey";
  `)
}
