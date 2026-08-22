// 193_world_elevator_passengers_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE INDEX world_elevator_passengers_battlemap_id_elevator_id_index ON public.world_elevator_passengers USING btree (battlemap_id, elevator_id);

CREATE UNIQUE INDEX world_elevator_passengers_pkey ON public.world_elevator_passengers USING btree (battlemap_id, elevator_id, token_id);

CREATE UNIQUE INDEX world_elevator_passengers_token_id_unique ON public.world_elevator_passengers USING btree (token_id);

alter table "public"."world_elevator_passengers" add constraint "world_elevator_passengers_pkey" PRIMARY KEY using index "world_elevator_passengers_pkey";

alter table "public"."world_elevator_passengers" add constraint "chk_world_elevator_local_position" CHECK (((jsonb_typeof(local_position) = 'object'::text) AND ((local_position -> 'x'::text) IS NOT NULL) AND ((local_position -> 'y'::text) IS NOT NULL) AND ((local_position -> 'z'::text) IS NOT NULL) AND (jsonb_typeof((local_position -> 'x'::text)) = 'number'::text) AND (jsonb_typeof((local_position -> 'y'::text)) = 'number'::text) AND (jsonb_typeof((local_position -> 'z'::text)) = 'number'::text)));

alter table "public"."world_elevator_passengers" add constraint "world_elevator_passengers_token_id_unique" UNIQUE using index "world_elevator_passengers_token_id_unique";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."world_elevator_passengers" drop constraint if exists "world_elevator_passengers_token_id_unique";
alter table "public"."world_elevator_passengers" drop constraint if exists "chk_world_elevator_local_position";
alter table "public"."world_elevator_passengers" drop constraint if exists "world_elevator_passengers_pkey";
drop index if exists "world_elevator_passengers_battlemap_id_elevator_id_index";
  `)
}
