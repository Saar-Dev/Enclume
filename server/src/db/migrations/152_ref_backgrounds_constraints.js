// 152_ref_backgrounds_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX ref_backgrounds_pkey ON public.ref_backgrounds USING btree (id);

CREATE UNIQUE INDEX uq_ref_bg_type_code_parent ON public.ref_backgrounds USING btree (type, code, COALESCE(parent_code, ''::text));

alter table "public"."ref_backgrounds" add constraint "ref_backgrounds_pkey" PRIMARY KEY using index "ref_backgrounds_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_backgrounds" drop constraint if exists "ref_backgrounds_pkey";
drop index if exists "uq_ref_bg_type_code_parent";
  `)
}
