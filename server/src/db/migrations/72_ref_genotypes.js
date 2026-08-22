// 72_ref_genotypes.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."ref_genotypes" (
    "id" text not null,
    "label" text not null,
    "mod_for" integer default 0,
    "mod_con" integer default 0,
    "mod_coo" integer default 0,
    "mod_ada" integer default 0,
    "mod_per" integer default 0,
    "mod_int" integer default 0,
    "mod_vol" integer default 0,
    "mod_pre" integer default 0,
    "description" text,
    "illustration_url" text,
    "prereq_professions" jsonb,
    "pc_cost" integer default 0,
    "has_deserter_option" boolean default false
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."ref_genotypes" cascade;
  `)
}
