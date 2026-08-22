// 116_char_pc_ledger_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX char_pc_ledger_pkey ON public.char_pc_ledger USING btree (char_sheet_id);

alter table "public"."char_pc_ledger" add constraint "char_pc_ledger_pkey" PRIMARY KEY using index "char_pc_ledger_pkey";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_pc_ledger" drop constraint if exists "char_pc_ledger_pkey";
  `)
}
