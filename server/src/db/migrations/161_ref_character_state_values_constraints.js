// 161_ref_character_state_values_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX ref_character_state_values_pkey ON public.ref_character_state_values USING btree (id);

CREATE UNIQUE INDEX uq_char_state_values_axis_code ON public.ref_character_state_values USING btree (axis, value_code);

alter table "public"."ref_character_state_values" add constraint "ref_character_state_values_pkey" PRIMARY KEY using index "ref_character_state_values_pkey";

alter table "public"."ref_character_state_values" add constraint "uq_char_state_values_axis_code" UNIQUE using index "uq_char_state_values_axis_code";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_character_state_values" drop constraint if exists "uq_char_state_values_axis_code";
alter table "public"."ref_character_state_values" drop constraint if exists "ref_character_state_values_pkey";
  `)
}
