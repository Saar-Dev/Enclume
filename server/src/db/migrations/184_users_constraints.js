// 184_users_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX users_email_unique ON public.users USING btree (email);

CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);

alter table "public"."users" add constraint "users_pkey" PRIMARY KEY using index "users_pkey";

alter table "public"."users" add constraint "chk_users_role" CHECK ((role = ANY (ARRAY['user'::text, 'admin'::text])));

alter table "public"."users" add constraint "users_email_unique" UNIQUE using index "users_email_unique";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."users" drop constraint if exists "users_email_unique";
alter table "public"."users" drop constraint if exists "chk_users_role";
alter table "public"."users" drop constraint if exists "users_pkey";
  `)
}
