// 75_ref_mutation_skills.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."ref_mutation_skills" (
    "mutation_id" integer not null,
    "skill_name" character varying(100) not null,
    "skill_attrs" character varying(10) not null,
    "skill_base" integer not null,
    "cost_mult" numeric(3,1) not null default '1'::numeric
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."ref_mutation_skills" cascade;
  `)
}
