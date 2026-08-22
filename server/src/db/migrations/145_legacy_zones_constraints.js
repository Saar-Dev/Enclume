// 145_legacy_zones_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX zones_pkey ON public.legacy_zones USING btree (id);

alter table "public"."legacy_zones" add constraint "zones_pkey" PRIMARY KEY using index "zones_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."legacy_zones" drop constraint if exists "zones_pkey";
  `)
}
