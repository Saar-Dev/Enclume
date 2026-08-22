// 212_char_mutations_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."char_mutations" add constraint "char_mutations_char_sheet_id_foreign" FOREIGN KEY (char_sheet_id) REFERENCES char_sheet(id) ON DELETE CASCADE;

alter table "public"."char_mutations" add constraint "char_mutations_subtype_id_foreign" FOREIGN KEY (subtype_id) REFERENCES ref_mutation_subtypes(subtype_id);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_mutations" drop constraint if exists "char_mutations_subtype_id_foreign";
alter table "public"."char_mutations" drop constraint if exists "char_mutations_char_sheet_id_foreign";
  `)
}
