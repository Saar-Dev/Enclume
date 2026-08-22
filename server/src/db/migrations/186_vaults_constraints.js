// 186_vaults_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX vaults_pkey ON public.vaults USING btree (id);

CREATE UNIQUE INDEX vaults_user_id_unique ON public.vaults USING btree (user_id);

alter table "public"."vaults" add constraint "vaults_pkey" PRIMARY KEY using index "vaults_pkey";

alter table "public"."vaults" add constraint "vaults_user_id_unique" UNIQUE using index "vaults_user_id_unique";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."vaults" drop constraint if exists "vaults_user_id_unique";
alter table "public"."vaults" drop constraint if exists "vaults_pkey";
  `)
}
