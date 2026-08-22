// 77_ref_mutations.js
export const up = async (knex) => {
  await knex.raw(`
create sequence "public"."ref_mutations_mutation_id_seq";

create table "public"."ref_mutations" (
    "mutation_id" integer not null default nextval('ref_mutations_mutation_id_seq'::regclass),
    "name" character varying(100) not null,
    "subtype" character varying(50),
    "has_subtable" boolean not null default false,
    "cost_pc" integer not null default 0,
    "is_unique" boolean not null default false,
    "is_stackable" boolean not null default false,
    "stack_limit" integer,
    "stack_effect" character varying(100),
    "mod_FOR" integer not null default 0,
    "mod_CON" integer not null default 0,
    "mod_COO" integer not null default 0,
    "mod_INT" integer not null default 0,
    "mod_VOL" integer not null default 0,
    "mod_PRE" integer not null default 0,
    "mod_res_damage" integer not null default 0,
    "mod_res_shock" integer not null default 0,
    "mod_res_drugs" integer not null default 0,
    "mod_res_disease" integer not null default 0,
    "mod_res_poison" integer not null default 0,
    "mod_res_radiation" integer not null default 0,
    "natural_armor" integer not null default 0,
    "mod_sex" character varying(20),
    "mod_fertility" character varying(20),
    "max_cumul_group" character varying(50),
    "max_cumul_limit" integer,
    "special_effect" text,
    "d100_range_start" integer,
    "d100_range_end" integer,
    "ldb_page" integer,
    "description" text not null,
    "created_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone not null default CURRENT_TIMESTAMP,
    "stack_deltas" jsonb,
    "natural_weapon_choc_formula" character varying(20),
    "natural_weapon_formula" character varying(20),
    "natural_weapon_requires_grapple" boolean not null default false
);

alter sequence "public"."ref_mutations_mutation_id_seq" owned by "public"."ref_mutations"."mutation_id";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."ref_mutations" cascade;
  `)
}
