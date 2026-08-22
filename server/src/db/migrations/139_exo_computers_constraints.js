// 139_exo_computers_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX exo_computers_pkey ON public.exo_computers USING btree (id);

alter table "public"."exo_computers" add constraint "exo_computers_pkey" PRIMARY KEY using index "exo_computers_pkey";

alter table "public"."exo_computers" add constraint "chk_exo_computers_role" CHECK ((role = ANY (ARRAY['principal'::text, 'secours'::text])));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."exo_computers" drop constraint if exists "chk_exo_computers_role";
alter table "public"."exo_computers" drop constraint if exists "exo_computers_pkey";
  `)
}
