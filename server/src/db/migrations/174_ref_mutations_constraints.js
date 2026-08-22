// 174_ref_mutations_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX ref_mutations_pkey ON public.ref_mutations USING btree (mutation_id);

CREATE UNIQUE INDEX uq_ref_mutations_name_subtype ON public.ref_mutations USING btree (name, COALESCE(subtype, ''::character varying));

alter table "public"."ref_mutations" add constraint "ref_mutations_pkey" PRIMARY KEY using index "ref_mutations_pkey";

alter table "public"."ref_mutations" add constraint "chk_mut_fertility" CHECK (((mod_fertility IS NULL) OR ((mod_fertility)::text = ANY ((ARRAY['sterile'::character varying, 'self_fertile'::character varying])::text[]))));

alter table "public"."ref_mutations" add constraint "chk_mut_sex" CHECK (((mod_sex IS NULL) OR ((mod_sex)::text = ANY ((ARRAY['androgyne'::character varying, 'asexue'::character varying])::text[]))));

alter table "public"."ref_mutations" add constraint "chk_mut_subtype" CHECK (((subtype IS NULL) OR ((subtype)::text = ANY ((ARRAY['minor'::character varying, 'major'::character varying, 'taste'::character varying, 'smell'::character varying, 'touch'::character varying, 'hearing'::character varying, 'sight'::character varying, 'fire'::character varying, 'cold'::character varying, 'drugs'::character varying, 'disease'::character varying, 'poison'::character varying, 'radiation'::character varying])::text[]))));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_mutations" drop constraint if exists "chk_mut_subtype";
alter table "public"."ref_mutations" drop constraint if exists "chk_mut_sex";
alter table "public"."ref_mutations" drop constraint if exists "chk_mut_fertility";
alter table "public"."ref_mutations" drop constraint if exists "ref_mutations_pkey";
drop index if exists "uq_ref_mutations_name_subtype";
  `)
}
