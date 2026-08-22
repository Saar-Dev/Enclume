// 19_char_pc_ledger.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."char_pc_ledger" (
    "char_sheet_id" uuid not null,
    "pc_total" integer not null default 20,
    "pc_spent_step1" integer default 0,
    "pc_spent_step2" integer default 0,
    "pc_spent_step3" integer default 0,
    "pc_spent_step4" integer default 0,
    "pc_spent_step5" integer default 0,
    "pc_gained_desavantages" integer default 0,
    "pc_postcreation" integer default 0,
    "skill_allocations" jsonb,
    "autodidacte_allocations" jsonb
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."char_pc_ledger" cascade;
  `)
}
