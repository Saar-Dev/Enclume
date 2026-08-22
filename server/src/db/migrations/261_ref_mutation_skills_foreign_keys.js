// 261_ref_mutation_skills_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."ref_mutation_skills" add constraint "ref_mutation_skills_mutation_id_foreign" FOREIGN KEY (mutation_id) REFERENCES ref_mutations(mutation_id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_mutation_skills" drop constraint if exists "ref_mutation_skills_mutation_id_foreign";
  `)
}
