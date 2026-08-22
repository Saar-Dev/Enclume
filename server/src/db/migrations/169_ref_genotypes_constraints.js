// 169_ref_genotypes_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX ref_genotypes_pkey ON public.ref_genotypes USING btree (id);

alter table "public"."ref_genotypes" add constraint "ref_genotypes_pkey" PRIMARY KEY using index "ref_genotypes_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_genotypes" drop constraint if exists "ref_genotypes_pkey";
  `)
}
