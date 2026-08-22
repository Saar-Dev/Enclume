// 138_entity_blueprints_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX entity_blueprints_builtin_key_unique ON public.entity_blueprints USING btree (builtin_key);

CREATE UNIQUE INDEX entity_blueprints_pkey ON public.entity_blueprints USING btree (id);

alter table "public"."entity_blueprints" add constraint "entity_blueprints_pkey" PRIMARY KEY using index "entity_blueprints_pkey";

alter table "public"."entity_blueprints" add constraint "entity_blueprints_builtin_key_unique" UNIQUE using index "entity_blueprints_builtin_key_unique";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."entity_blueprints" drop constraint if exists "entity_blueprints_builtin_key_unique";
alter table "public"."entity_blueprints" drop constraint if exists "entity_blueprints_pkey";
  `)
}
