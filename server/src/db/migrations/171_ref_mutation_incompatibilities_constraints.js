// 171_ref_mutation_incompatibilities_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX ref_mutation_incompatibilities_pkey ON public.ref_mutation_incompatibilities USING btree (mutation_id_a, mutation_id_b);

alter table "public"."ref_mutation_incompatibilities" add constraint "ref_mutation_incompatibilities_pkey" PRIMARY KEY using index "ref_mutation_incompatibilities_pkey";

alter table "public"."ref_mutation_incompatibilities" add constraint "chk_inc_order" CHECK ((mutation_id_a < mutation_id_b));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_mutation_incompatibilities" drop constraint if exists "chk_inc_order";
alter table "public"."ref_mutation_incompatibilities" drop constraint if exists "ref_mutation_incompatibilities_pkey";
  `)
}
