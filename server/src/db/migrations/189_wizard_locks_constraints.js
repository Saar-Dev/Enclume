// 189_wizard_locks_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX wizard_locks_char_sheet_id_step_option_key_unique ON public.wizard_locks USING btree (char_sheet_id, step, option_key);

CREATE UNIQUE INDEX wizard_locks_pkey ON public.wizard_locks USING btree (id);

alter table "public"."wizard_locks" add constraint "wizard_locks_pkey" PRIMARY KEY using index "wizard_locks_pkey";

alter table "public"."wizard_locks" add constraint "chk_wizard_locks_step" CHECK (((step >= 1) AND (step <= 5)));

alter table "public"."wizard_locks" add constraint "wizard_locks_char_sheet_id_step_option_key_unique" UNIQUE using index "wizard_locks_char_sheet_id_step_option_key_unique";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."wizard_locks" drop constraint if exists "wizard_locks_char_sheet_id_step_option_key_unique";
alter table "public"."wizard_locks" drop constraint if exists "chk_wizard_locks_step";
alter table "public"."wizard_locks" drop constraint if exists "wizard_locks_pkey";
  `)
}
