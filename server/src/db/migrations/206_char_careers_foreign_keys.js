// 206_char_careers_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."char_careers" add constraint "char_careers_career_id_foreign" FOREIGN KEY (career_id) REFERENCES ref_careers(id) ON DELETE CASCADE;

alter table "public"."char_careers" add constraint "char_careers_char_sheet_id_foreign" FOREIGN KEY (char_sheet_id) REFERENCES char_sheet(id) ON DELETE CASCADE;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_careers" drop constraint if exists "char_careers_char_sheet_id_foreign";
alter table "public"."char_careers" drop constraint if exists "char_careers_career_id_foreign";
  `)
}
