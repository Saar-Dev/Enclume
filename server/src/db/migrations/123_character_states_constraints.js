// 123_character_states_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX character_states_pkey ON public.character_states USING btree (id);

CREATE INDEX idx_char_states_token ON public.character_states USING btree (token_id);

CREATE UNIQUE INDEX uq_char_states_token_axis ON public.character_states USING btree (token_id, axis);

alter table "public"."character_states" add constraint "character_states_pkey" PRIMARY KEY using index "character_states_pkey";

alter table "public"."character_states" add constraint "uq_char_states_token_axis" UNIQUE using index "uq_char_states_token_axis";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."character_states" drop constraint if exists "uq_char_states_token_axis";
alter table "public"."character_states" drop constraint if exists "character_states_pkey";
drop index if exists "idx_char_states_token";
  `)
}
