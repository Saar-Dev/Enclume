// 220_character_states_foreign_keys.js
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."character_states" add constraint "character_states_token_id_foreign" FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE CASCADE;

alter table "public"."character_states" add constraint "fk_char_states_axis_code" FOREIGN KEY (axis, value_code) REFERENCES ref_character_state_values(axis, value_code);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."character_states" drop constraint if exists "fk_char_states_axis_code";
alter table "public"."character_states" drop constraint if exists "character_states_token_id_foreign";
  `)
}
