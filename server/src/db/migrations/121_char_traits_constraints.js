// 121_char_traits_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX char_traits_pkey ON public.char_traits USING btree (id);

alter table "public"."char_traits" add constraint "char_traits_pkey" PRIMARY KEY using index "char_traits_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_traits" drop constraint if exists "char_traits_pkey";
  `)
}
