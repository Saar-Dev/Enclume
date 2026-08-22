// 147_pending_catastrophes_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX pending_catastrophes_pkey ON public.pending_catastrophes USING btree (id);

alter table "public"."pending_catastrophes" add constraint "pending_catastrophes_pkey" PRIMARY KEY using index "pending_catastrophes_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."pending_catastrophes" drop constraint if exists "pending_catastrophes_pkey";
  `)
}
