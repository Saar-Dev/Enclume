// 198_bug_tickets_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."bug_tickets" add constraint "bug_tickets_reporter_id_foreign" FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE SET NULL;

alter table "public"."bug_tickets" add constraint "bug_tickets_reviewed_by_foreign" FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."bug_tickets" drop constraint if exists "bug_tickets_reviewed_by_foreign";
alter table "public"."bug_tickets" drop constraint if exists "bug_tickets_reporter_id_foreign";
  `)
}
