// 369_ref_sources.js — docs/PLANS/PLAN_SUPPLEMENTS.md §2.1 (Lot A)
//
// Catalogue des sources de contenu (Livre de Base, Guide Technique, futures extensions). Une source
// = une ligne insérée, jamais une valeur d'enum figée dans le code (patron Comp/Con : chaque Lancer
// Content Package est une entrée nommée, pas une case dans une liste fixe) — ajouter une source
// future ne demandera donc plus de migration de schéma, seulement une insertion.
//
// `is_core` distingue le Livre de Base : toujours actif par construction, sans ligne dans
// `campaign_enabled_sources` (§2.3) — ce n'est pas une source qu'on active/désactive.
//
// Structure seulement ; PK / UNIQUE dans 370_ref_sources_constraints.js (une table = structure +
// contraintes séparées, docs/SYSTEME/CORE.md P55).

export const up = async (knex) => {
  await knex.raw(`
    create table if not exists "public"."ref_sources" (
      "id" uuid not null default gen_random_uuid(),
      "code" text not null,
      "name" text not null,
      "description" text,
      "is_core" boolean not null default false,
      "created_at" timestamp with time zone not null default now()
    );
  `)
}

export const down = async (knex) => {
  await knex.raw('drop table if exists "public"."ref_sources" cascade;')
}
