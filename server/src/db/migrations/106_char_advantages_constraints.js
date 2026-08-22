// 106_char_advantages_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX char_advantages_char_sheet_id_advantage_id_unique ON public.char_advantages USING btree (char_sheet_id, advantage_id) WHERE (removed_at IS NULL);

CREATE UNIQUE INDEX char_advantages_pkey ON public.char_advantages USING btree (id);

alter table "public"."char_advantages" add constraint "char_advantages_pkey" PRIMARY KEY using index "char_advantages_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_advantages" drop constraint if exists "char_advantages_pkey";
drop index if exists "char_advantages_char_sheet_id_advantage_id_unique";
  `)
}
