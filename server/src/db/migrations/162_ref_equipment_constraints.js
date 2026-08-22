// 162_ref_equipment_constraints.js
export const up = async (knex) => {
  await knex.raw(`
CREATE UNIQUE INDEX ref_equipment_pkey ON public.ref_equipment USING btree (id);

alter table "public"."ref_equipment" add constraint "ref_equipment_pkey" PRIMARY KEY using index "ref_equipment_pkey";

alter table "public"."ref_equipment" add constraint "chk_eq_fire_mode" CHECK (((fire_mode IS NULL) OR ((fire_mode)::text = ANY ((ARRAY['CC'::character varying, 'RC'::character varying, 'RL'::character varying, 'CC/RC'::character varying, 'CC/RL'::character varying, 'RC/RL'::character varying, 'CC/RC/RL'::character varying, '-'::character varying])::text[]))));

alter table "public"."ref_equipment" add constraint "chk_eq_init_mod" CHECK (((init_mod IS NULL) OR (init_mod < 0)));

alter table "public"."ref_equipment" add constraint "chk_eq_linked_attr" CHECK (((linked_attr IS NULL) OR (linked_attr = ANY (ARRAY['FOR'::text, 'CON'::text, 'COO'::text, 'ADA'::text, 'PER'::text, 'INT'::text, 'VOL'::text, 'PRE'::text]))));

alter table "public"."ref_equipment" add constraint "chk_eq_malus_cat" CHECK (((malus_cat IS NULL) OR (malus_cat = ANY (ARRAY['S'::text, 'A'::text, 'B'::text, 'C'::text, 'D'::text]))));

alter table "public"."ref_equipment" add constraint "chk_eq_min_str" CHECK (((min_str IS NULL) OR ((min_str >= 3) AND (min_str <= 20))));

alter table "public"."ref_equipment" add constraint "chk_eq_shield_atk_malus" CHECK (((shield_atk_malus IS NULL) OR (shield_atk_malus < 0)));

alter table "public"."ref_equipment" add constraint "chk_eq_shield_extra_locations" CHECK (((shield_extra_locations IS NULL) OR (shield_extra_locations = ANY (ARRAY['C'::text, 'C/T'::text]))));

alter table "public"."ref_equipment" add constraint "chk_eq_tech_level" CHECK (((tech_level >= 1) AND (tech_level <= 7)));
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."ref_equipment" drop constraint if exists "chk_eq_tech_level";
alter table "public"."ref_equipment" drop constraint if exists "chk_eq_shield_extra_locations";
alter table "public"."ref_equipment" drop constraint if exists "chk_eq_shield_atk_malus";
alter table "public"."ref_equipment" drop constraint if exists "chk_eq_min_str";
alter table "public"."ref_equipment" drop constraint if exists "chk_eq_malus_cat";
alter table "public"."ref_equipment" drop constraint if exists "chk_eq_linked_attr";
alter table "public"."ref_equipment" drop constraint if exists "chk_eq_init_mod";
alter table "public"."ref_equipment" drop constraint if exists "chk_eq_fire_mode";
alter table "public"."ref_equipment" drop constraint if exists "ref_equipment_pkey";
  `)
}
