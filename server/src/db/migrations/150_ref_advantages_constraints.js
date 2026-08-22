// 150_ref_advantages_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX ref_advantages_pkey ON public.ref_advantages USING btree (advantage_id);

alter table "public"."ref_advantages" add constraint "ref_advantages_pkey" PRIMARY KEY using index "ref_advantages_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_advantages" drop constraint if exists "ref_advantages_pkey";
  `)
}
