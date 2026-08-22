// 104_campaigns_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX campaigns_invite_code_unique ON public.campaigns USING btree (invite_code);

CREATE UNIQUE INDEX campaigns_pkey ON public.campaigns USING btree (id);

alter table "public"."campaigns" add constraint "campaigns_pkey" PRIMARY KEY using index "campaigns_pkey";

alter table "public"."campaigns" add constraint "campaigns_invite_code_unique" UNIQUE using index "campaigns_invite_code_unique";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."campaigns" drop constraint if exists "campaigns_invite_code_unique";
alter table "public"."campaigns" drop constraint if exists "campaigns_pkey";
  `)
}
