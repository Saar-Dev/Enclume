// 180_token_statuses_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX token_statuses_pkey ON public.token_statuses USING btree (id);

CREATE UNIQUE INDEX token_statuses_token_id_status_code_unique ON public.token_statuses USING btree (token_id, status_code);

alter table "public"."token_statuses" add constraint "token_statuses_pkey" PRIMARY KEY using index "token_statuses_pkey";

alter table "public"."token_statuses" add constraint "token_statuses_token_id_status_code_unique" UNIQUE using index "token_statuses_token_id_status_code_unique";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."token_statuses" drop constraint if exists "token_statuses_token_id_status_code_unique";
alter table "public"."token_statuses" drop constraint if exists "token_statuses_pkey";
  `)
}
