// 74_ref_mutation_incompatibilities.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."ref_mutation_incompatibilities" (
    "mutation_id_a" integer not null,
    "mutation_id_b" integer not null
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."ref_mutation_incompatibilities" cascade;
  `)
}
