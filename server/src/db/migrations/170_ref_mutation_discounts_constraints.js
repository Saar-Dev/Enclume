// 170_ref_mutation_discounts_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX ref_mutation_discounts_pkey ON public.ref_mutation_discounts USING btree (mutation_id, target_mutation_id);

alter table "public"."ref_mutation_discounts" add constraint "ref_mutation_discounts_pkey" PRIMARY KEY using index "ref_mutation_discounts_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_mutation_discounts" drop constraint if exists "ref_mutation_discounts_pkey";
  `)
}
