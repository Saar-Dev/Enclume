// 109_char_careers_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX char_careers_pkey ON public.char_careers USING btree (id);

alter table "public"."char_careers" add constraint "char_careers_pkey" PRIMARY KEY using index "char_careers_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_careers" drop constraint if exists "char_careers_pkey";
  `)
}
