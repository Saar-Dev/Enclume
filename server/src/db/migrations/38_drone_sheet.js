// 38_drone_sheet.js
export const up = async (knex) => {
  await knex.raw(`
create table "public"."drone_sheet" (
    "character_id" uuid not null,
    "taille" integer,
    "poids" integer,
    "vitesse" integer,
    "nt" text,
    "source_energie" text,
    "autonomie" text,
    "mode_deplacement" text,
    "blindage" integer default 0,
    "blindage_iem" integer default 0,
    "ordinateur_gen" smallint,
    "ordinateur_nt" smallint,
    "echelle" text default 'H'::text,
    "armure_materiau" text,
    "localisation_ref" text default 'corps'::text,
    "integrite_max" integer default 15,
    "integrite_actuelle" integer default 15,
    "damages" jsonb not null default '{}'::jsonb,
    "equip_special" text,
    "notes_gm" text,
    "profondeur_max" text,
    "disponibilite" text,
    "charge_utile" integer not null default 0
);
  `)
}

export const down = async (knex) => {
  await knex.raw(`
drop table if exists "public"."drone_sheet" cascade;
  `)
}
