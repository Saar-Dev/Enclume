// 146_merchants_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX merchants_pkey ON public.merchants USING btree (id);

alter table "public"."merchants" add constraint "merchants_pkey" PRIMARY KEY using index "merchants_pkey";

alter table "public"."merchants" add constraint "chk_merchant_status" CHECK ((status = ANY (ARRAY['OPEN'::text, 'CLOSED'::text])));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."merchants" drop constraint if exists "chk_merchant_status";
alter table "public"."merchants" drop constraint if exists "merchants_pkey";
  `)
}
