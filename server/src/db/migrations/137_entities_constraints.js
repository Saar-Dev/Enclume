// 137_entities_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX entities_pkey ON public.entities USING btree (id);

alter table "public"."entities" add constraint "entities_pkey" PRIMARY KEY using index "entities_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."entities" drop constraint if exists "entities_pkey";
  `)
}
