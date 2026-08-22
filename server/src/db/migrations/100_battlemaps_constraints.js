// 100_battlemaps_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX battlemaps_pkey ON public.battlemaps USING btree (id);

alter table "public"."battlemaps" add constraint "battlemaps_pkey" PRIMARY KEY using index "battlemaps_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."battlemaps" drop constraint if exists "battlemaps_pkey";
  `)
}
