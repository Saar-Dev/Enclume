// 18_char_mutations.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."char_mutations" (
    "id" uuid not null default gen_random_uuid(),
    "char_sheet_id" uuid not null,
    "mutation_id" integer not null,
    "subtype_id" integer,
    "source" text not null default 'chosen'::text,
    "status" text not null default 'active'::text,
    "count" integer default 1,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."char_mutations" cascade;
  `)
}
