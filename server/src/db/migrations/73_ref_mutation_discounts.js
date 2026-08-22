// 73_ref_mutation_discounts.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."ref_mutation_discounts" (
    "mutation_id" integer not null,
    "target_mutation_id" integer not null,
    "discount_amount" integer not null default 1
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."ref_mutation_discounts" cascade;
  `)
}
