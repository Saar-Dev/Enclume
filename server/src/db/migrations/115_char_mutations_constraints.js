// 115_char_mutations_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX char_mutations_pkey ON public.char_mutations USING btree (id);

CREATE UNIQUE INDEX uq_char_mut_no_sub ON public.char_mutations USING btree (char_sheet_id, mutation_id) WHERE (subtype_id IS NULL);

CREATE UNIQUE INDEX uq_char_mut_with_sub ON public.char_mutations USING btree (char_sheet_id, mutation_id, subtype_id) WHERE (subtype_id IS NOT NULL);

alter table "public"."char_mutations" add constraint "char_mutations_pkey" PRIMARY KEY using index "char_mutations_pkey";

alter table "public"."char_mutations" add constraint "chk_char_mutations_source" CHECK ((source = ANY (ARRAY['chosen'::text, 'random'::text, 'campaign'::text, 'revers'::text])));

alter table "public"."char_mutations" add constraint "chk_char_mutations_status" CHECK ((status = ANY (ARRAY['active'::text, 'removed'::text])));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."char_mutations" drop constraint if exists "chk_char_mutations_status";
alter table "public"."char_mutations" drop constraint if exists "chk_char_mutations_source";
alter table "public"."char_mutations" drop constraint if exists "char_mutations_pkey";
drop index if exists "uq_char_mut_no_sub";
drop index if exists "uq_char_mut_with_sub";
  `)
}
