// 188_walls_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX walls_pkey ON public.walls USING btree (id);

alter table "public"."walls" add constraint "walls_pkey" PRIMARY KEY using index "walls_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."walls" drop constraint if exists "walls_pkey";
  `)
}
