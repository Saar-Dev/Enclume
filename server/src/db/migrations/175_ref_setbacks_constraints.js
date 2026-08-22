// 175_ref_setbacks_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX ref_setbacks_pkey ON public.ref_setbacks USING btree (id);

alter table "public"."ref_setbacks" add constraint "ref_setbacks_pkey" PRIMARY KEY using index "ref_setbacks_pkey";

alter table "public"."ref_setbacks" add constraint "chk_ref_setbacks_roll_range" CHECK ((((roll_min >= 1) AND (roll_min <= 100)) AND ((roll_max >= 1) AND (roll_max <= 100)) AND (roll_min <= roll_max)));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_setbacks" drop constraint if exists "chk_ref_setbacks_roll_range";
alter table "public"."ref_setbacks" drop constraint if exists "ref_setbacks_pkey";
  `)
}
