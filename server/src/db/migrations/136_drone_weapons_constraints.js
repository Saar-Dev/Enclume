// 136_drone_weapons_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX drone_weapons_pkey ON public.drone_weapons USING btree (id);

alter table "public"."drone_weapons" add constraint "drone_weapons_pkey" PRIMARY KEY using index "drone_weapons_pkey";

alter table "public"."drone_weapons" add constraint "chk_drone_weapons_fire_mode" CHECK ((fire_mode = ANY (ARRAY['cc'::text, 'rc'::text, 'rl'::text])));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."drone_weapons" drop constraint if exists "chk_drone_weapons_fire_mode";
alter table "public"."drone_weapons" drop constraint if exists "drone_weapons_pkey";
  `)
}
