// 374_campaign_enabled_sources.js — docs/PLANS/PLAN_SUPPLEMENTS.md §2.3 (Lot A)
//
// Table de jointure : quelles sources non-core sont actives dans quelle campagne. Le Livre de Base
// n'a jamais de ligne ici (`is_core`, 369) — activer/désactiver ne se pose que pour les autres
// sources (Guide Technique, futures extensions). Une ligne = active pour cette campagne.
//
// Table de jointure plutôt qu'une clé dans campaigns.settings (jsonb) : intégrité référentielle,
// filtrage par JOIN/EXISTS SQL direct, cohérent avec le patron MekHQ (filtre calculé à la lecture par
// une requête, pas stocké sur chaque ligne de contenu) — docs/PLANS/PLAN_SUPPLEMENTS.md §1.3/§1.4.
//
// Structure seulement ; PK / FK dans 375_campaign_enabled_sources_constraints.js.

export const up = async (knex) => {
  await knex.raw(`
    create table if not exists "public"."campaign_enabled_sources" (
      "campaign_id" uuid not null,
      "source_id" uuid not null,
      "created_at" timestamp with time zone not null default now()
    );
  `)
}

export const down = async (knex) => {
  await knex.raw('drop table if exists "public"."campaign_enabled_sources" cascade;')
}
