// 204_char_archetype_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."char_archetype" add constraint "char_archetype_char_sheet_id_foreign" FOREIGN KEY (char_sheet_id) REFERENCES char_sheet(id) ON DELETE CASCADE;

alter table "public"."char_archetype" add constraint "char_archetype_genotype_id_foreign" FOREIGN KEY (genotype_id) REFERENCES ref_genotypes(id);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_archetype" drop constraint if exists "char_archetype_genotype_id_foreign";
alter table "public"."char_archetype" drop constraint if exists "char_archetype_char_sheet_id_foreign";
  `)
}
