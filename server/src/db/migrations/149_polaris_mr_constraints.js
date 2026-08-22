// 149_polaris_mr_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX polaris_mr_pkey ON public.polaris_mr USING btree (mr_min);

alter table "public"."polaris_mr" add constraint "polaris_mr_pkey" PRIMARY KEY using index "polaris_mr_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."polaris_mr" drop constraint if exists "polaris_mr_pkey";
  `)
}
