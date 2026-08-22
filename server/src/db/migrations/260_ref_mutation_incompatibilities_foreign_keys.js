// 260_ref_mutation_incompatibilities_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."ref_mutation_incompatibilities" add constraint "ref_mutation_incompatibilities_mutation_id_a_foreign" FOREIGN KEY (mutation_id_a) REFERENCES ref_mutations(mutation_id) ON DELETE CASCADE;

alter table "public"."ref_mutation_incompatibilities" add constraint "ref_mutation_incompatibilities_mutation_id_b_foreign" FOREIGN KEY (mutation_id_b) REFERENCES ref_mutations(mutation_id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_mutation_incompatibilities" drop constraint if exists "ref_mutation_incompatibilities_mutation_id_b_foreign";
alter table "public"."ref_mutation_incompatibilities" drop constraint if exists "ref_mutation_incompatibilities_mutation_id_a_foreign";
  `)
}
