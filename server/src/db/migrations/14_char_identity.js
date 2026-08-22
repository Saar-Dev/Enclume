// 14_char_identity.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."char_identity" (
    "char_sheet_id" uuid not null,
    "player_name" text,
    "char_name" text,
    "height" numeric(4,1),
    "weight" numeric(5,1),
    "skin" text,
    "eyes" text,
    "hair" text,
    "build" text,
    "distinctive_signs" text,
    "hand_pref" text
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."char_identity" cascade;
  `)
}
