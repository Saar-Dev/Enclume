// 259_ref_mutation_discounts_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."ref_mutation_discounts" add constraint "ref_mutation_discounts_mutation_id_foreign" FOREIGN KEY (mutation_id) REFERENCES ref_mutations(mutation_id) ON DELETE CASCADE;

alter table "public"."ref_mutation_discounts" add constraint "ref_mutation_discounts_target_mutation_id_foreign" FOREIGN KEY (target_mutation_id) REFERENCES ref_mutations(mutation_id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_mutation_discounts" drop constraint if exists "ref_mutation_discounts_target_mutation_id_foreign";
alter table "public"."ref_mutation_discounts" drop constraint if exists "ref_mutation_discounts_mutation_id_foreign";
  `)
}
