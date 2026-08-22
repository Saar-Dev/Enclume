// 117_char_personal_advantages_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX char_personal_advantages_pkey ON public.char_personal_advantages USING btree (char_sheet_id, advantage_id);

alter table "public"."char_personal_advantages" add constraint "char_personal_advantages_pkey" PRIMARY KEY using index "char_personal_advantages_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_personal_advantages" drop constraint if exists "char_personal_advantages_pkey";
  `)
}
