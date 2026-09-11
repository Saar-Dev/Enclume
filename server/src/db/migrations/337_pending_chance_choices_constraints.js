// 337_pending_chance_choices_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX pending_chance_choices_pkey ON public.pending_chance_choices USING btree (id);

alter table "public"."pending_chance_choices" add constraint "pending_chance_choices_pkey" PRIMARY KEY using index "pending_chance_choices_pkey";

CREATE INDEX pending_chance_choices_campaign_id_index ON public.pending_chance_choices USING btree (campaign_id);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
DROP INDEX IF EXISTS pending_chance_choices_campaign_id_index;
alter table "public"."pending_chance_choices" drop constraint if exists "pending_chance_choices_pkey";
  `)
}
