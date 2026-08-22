// 160_ref_careers_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX ref_careers_code_unique ON public.ref_careers USING btree (code);

CREATE UNIQUE INDEX ref_careers_pkey ON public.ref_careers USING btree (id);

alter table "public"."ref_careers" add constraint "ref_careers_pkey" PRIMARY KEY using index "ref_careers_pkey";

alter table "public"."ref_careers" add constraint "ref_careers_code_unique" UNIQUE using index "ref_careers_code_unique";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_careers" drop constraint if exists "ref_careers_code_unique";
alter table "public"."ref_careers" drop constraint if exists "ref_careers_pkey";
  `)
}
