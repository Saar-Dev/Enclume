// 166_ref_exo_template_computers_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX ref_exo_template_computers_pkey ON public.ref_exo_template_computers USING btree (id);

alter table "public"."ref_exo_template_computers" add constraint "ref_exo_template_computers_pkey" PRIMARY KEY using index "ref_exo_template_computers_pkey";

alter table "public"."ref_exo_template_computers" add constraint "chk_exo_template_computers_role" CHECK ((role = ANY (ARRAY['principal'::text, 'secours'::text])));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_exo_template_computers" drop constraint if exists "chk_exo_template_computers_role";
alter table "public"."ref_exo_template_computers" drop constraint if exists "ref_exo_template_computers_pkey";
  `)
}
