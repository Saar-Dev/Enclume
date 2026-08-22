// 173_ref_mutation_subtypes_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX ref_mutation_subtypes_mutation_id_d4_roll_unique ON public.ref_mutation_subtypes USING btree (mutation_id, d4_roll);

CREATE UNIQUE INDEX ref_mutation_subtypes_pkey ON public.ref_mutation_subtypes USING btree (subtype_id);

alter table "public"."ref_mutation_subtypes" add constraint "ref_mutation_subtypes_pkey" PRIMARY KEY using index "ref_mutation_subtypes_pkey";

alter table "public"."ref_mutation_subtypes" add constraint "chk_sub_d4" CHECK (((d4_roll >= 1) AND (d4_roll <= 4)));

alter table "public"."ref_mutation_subtypes" add constraint "ref_mutation_subtypes_mutation_id_d4_roll_unique" UNIQUE using index "ref_mutation_subtypes_mutation_id_d4_roll_unique";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_mutation_subtypes" drop constraint if exists "ref_mutation_subtypes_mutation_id_d4_roll_unique";
alter table "public"."ref_mutation_subtypes" drop constraint if exists "chk_sub_d4";
alter table "public"."ref_mutation_subtypes" drop constraint if exists "ref_mutation_subtypes_pkey";
  `)
}
