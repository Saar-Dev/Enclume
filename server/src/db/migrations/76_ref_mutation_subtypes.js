// 76_ref_mutation_subtypes.js
export const up = async (knex) => {
  await knex.raw(`
create sequence "public"."ref_mutation_subtypes_subtype_id_seq";

create table "public"."ref_mutation_subtypes" (
    "subtype_id" integer not null default nextval('ref_mutation_subtypes_subtype_id_seq'::regclass),
    "mutation_id" integer not null,
    "name" character varying(100) not null,
    "d4_roll" integer not null,
    "mod_FOR" integer not null default 0,
    "mod_CON" integer not null default 0,
    "mod_COO" integer not null default 0,
    "mod_INT" integer not null default 0,
    "mod_VOL" integer not null default 0,
    "mod_PRE" integer not null default 0,
    "skill_bonus" character varying(255),
    "immunity" character varying(255),
    "special_trait" text,
    "description" text
);

alter sequence "public"."ref_mutation_subtypes_subtype_id_seq" owned by "public"."ref_mutation_subtypes"."subtype_id";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."ref_mutation_subtypes" cascade;
  `)
}
