// 63_ref_careers.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."ref_careers" (
    "id" uuid not null default gen_random_uuid(),
    "code" text not null,
    "name" text not null,
    "illustration" text,
    "description" text,
    "restricted_geographic_origin" boolean default false,
    "geographic_origin_details" text,
    "required_genotype" text,
    "min_for" integer,
    "min_con" integer,
    "min_coo" integer,
    "min_ada" integer,
    "min_per" integer,
    "min_int" integer,
    "min_vol" integer,
    "min_pre" integer,
    "min_attributes_logic" text default 'AND'::text,
    "contact_frequency" integer,
    "ally_frequency" integer,
    "ally_type" text default 'ally_or_supplier'::text,
    "opponent_frequency" integer,
    "enemy_rule" text,
    "points_per_year" integer default 5,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."ref_careers" cascade;
  `)
}
