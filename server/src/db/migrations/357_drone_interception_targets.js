// 357_drone_interception_targets.js — docs/PLANS/PLAN_DRONE_INTERCEPTION.md §3.6
//
// Liens de protection d'un drone d'interception (drone bouclier, CRD) : quels personnages il protège.
// Lien PERSISTANT, porté par le drone (décision Saar Q1, 2026-09-23) — jamais par `combat_roster`, qui
// repart à zéro à chaque combat : c'est un montage physique, pas une consigne tactique. Un drone peut
// protéger plusieurs personnages (jonction plusieurs-à-plusieurs).
//
// Structure seulement ; PK / FK / CHECK / index dans 358_drone_interception_targets_constraints.js
// (une table = structure + contraintes séparées, docs/SYSTEME/CORE.md P55).

export const up = async (knex) => {
  await knex.raw(`
    create table if not exists "public"."drone_interception_targets" (
      "drone_character_id" uuid not null,
      "protected_character_id" uuid not null,
      "created_at" timestamp with time zone not null default now()
    );
  `)
}

export const down = async (knex) => {
  await knex.raw('drop table if exists "public"."drone_interception_targets" cascade;')
}
