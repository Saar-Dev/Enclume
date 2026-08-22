// 181_tokens_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX tokens_pkey ON public.tokens USING btree (id);

alter table "public"."tokens" add constraint "tokens_pkey" PRIMARY KEY using index "tokens_pkey";

alter table "public"."tokens" add constraint "chk_tokens_position_space" CHECK ((position_space = ANY (ARRAY['legacy-cell'::text, 'world-feet'::text])));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."tokens" drop constraint if exists "chk_tokens_position_space";
alter table "public"."tokens" drop constraint if exists "tokens_pkey";
  `)
}
