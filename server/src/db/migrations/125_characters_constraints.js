// 125_characters_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX characters_pkey ON public.characters USING btree (id);

alter table "public"."characters" add constraint "characters_pkey" PRIMARY KEY using index "characters_pkey";

alter table "public"."characters" add constraint "chk_character_type" CHECK ((type = ANY (ARRAY['pj'::text, 'pnj'::text, 'drone'::text, 'exo'::text])));

alter table "public"."characters" add constraint "chk_characters_campaign_xor_vault" CHECK (((campaign_id IS NULL) <> (vault_id IS NULL)));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."characters" drop constraint if exists "chk_characters_campaign_xor_vault";
alter table "public"."characters" drop constraint if exists "chk_character_type";
alter table "public"."characters" drop constraint if exists "characters_pkey";
  `)
}
