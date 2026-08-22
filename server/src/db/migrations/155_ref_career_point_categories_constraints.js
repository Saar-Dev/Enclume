// 155_ref_career_point_categories_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE INDEX ref_career_point_categories_career_id_index ON public.ref_career_point_categories USING btree (career_id);

CREATE UNIQUE INDEX ref_career_point_categories_career_id_sort_order_unique ON public.ref_career_point_categories USING btree (career_id, sort_order);

CREATE UNIQUE INDEX ref_career_point_categories_pkey ON public.ref_career_point_categories USING btree (id);

alter table "public"."ref_career_point_categories" add constraint "ref_career_point_categories_pkey" PRIMARY KEY using index "ref_career_point_categories_pkey";

alter table "public"."ref_career_point_categories" add constraint "ref_career_point_categories_career_id_sort_order_unique" UNIQUE using index "ref_career_point_categories_career_id_sort_order_unique";
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_career_point_categories" drop constraint if exists "ref_career_point_categories_career_id_sort_order_unique";
alter table "public"."ref_career_point_categories" drop constraint if exists "ref_career_point_categories_pkey";
drop index if exists "ref_career_point_categories_career_id_index";
  `)
}
