// 122_character_macros_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX character_macros_pkey ON public.character_macros USING btree (id);

CREATE INDEX idx_macros_character_id ON public.character_macros USING btree (character_id);

alter table "public"."character_macros" add constraint "character_macros_pkey" PRIMARY KEY using index "character_macros_pkey";

alter table "public"."character_macros" add constraint "chk_macros_modifier" CHECK (((modifier >= '-99'::integer) AND (modifier <= 99)));

alter table "public"."character_macros" add constraint "chk_macros_sources_length" CHECK ((jsonb_array_length(sources) <= 3));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."character_macros" drop constraint if exists "chk_macros_sources_length";
alter table "public"."character_macros" drop constraint if exists "chk_macros_modifier";
alter table "public"."character_macros" drop constraint if exists "character_macros_pkey";
drop index if exists "idx_macros_character_id";
  `)
}
