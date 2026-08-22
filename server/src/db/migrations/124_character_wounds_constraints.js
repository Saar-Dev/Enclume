// 124_character_wounds_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX character_wounds_pkey ON public.character_wounds USING btree (id);

CREATE INDEX idx_wounds_char_sheet_id ON public.character_wounds USING btree (char_sheet_id);

alter table "public"."character_wounds" add constraint "character_wounds_pkey" PRIMARY KEY using index "character_wounds_pkey";

alter table "public"."character_wounds" add constraint "chk_wounds_location" CHECK ((location = ANY (ARRAY['tete'::text, 'corps'::text, 'bras_droit'::text, 'bras_gauche'::text, 'jambe_droite'::text, 'jambe_gauche'::text])));

alter table "public"."character_wounds" add constraint "chk_wounds_severity" CHECK ((severity = ANY (ARRAY['legere'::text, 'moyenne'::text, 'grave'::text, 'critique'::text, 'mortelle'::text])));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."character_wounds" drop constraint if exists "chk_wounds_severity";
alter table "public"."character_wounds" drop constraint if exists "chk_wounds_location";
alter table "public"."character_wounds" drop constraint if exists "character_wounds_pkey";
drop index if exists "idx_wounds_char_sheet_id";
  `)
}
