// 360_drone_interception_uses.js — docs/PLANS/PLAN_DRONE_INTERCEPTION.md §5 (Lot 3, CRD)
//
// Compteur des interceptions ENGAGÉES par un drone pendant un Tour de combat : un CRD « peut gérer plusieurs
// interceptions simultanément [...] pour chaque interception supplémentaire, son test subit une pénalité de 1 ;
// il ne peut pas contrer plus de 4 attaques simultanément » (REGLEDRONE.md). Une ligne par (campagne, drone,
// Tour) : `uses` = nombre d'interceptions engagées, incrémenté par UNE requête atomique
// (INSERT … ON CONFLICT DO UPDATE … WHERE uses < plafond … RETURNING, voir droneInterceptionUsesService.js).
//
// Pas de colonne sur `combat_roster` (choix du plan v2.1 abandonné) : un drone d'interception n'agit pas au Tour
// (décision Saar Q3), rien ne garantit qu'il ait une ligne de roster, et un compteur remis à zéro par effet de bord
// en fin de Tour est le patron que l'état « télépiloté ce Tour » a écarté (droneTelepilotState.js) — ici le Tour
// est dans la CLÉ, il n'y a rien à remettre à zéro. Durée de vie : la FK vers `combat_state` (CASCADE) supprime
// les lignes à la fin du combat ; `current_turn` repartant à 1 à chaque combat, un compteur ne peut pas lui survivre.
//
// Structure seulement ; PK / FK / CHECK dans 361_drone_interception_uses_constraints.js
// (une table = structure + contraintes séparées, docs/SYSTEME/CORE.md P55).

export const up = async (knex) => {
  await knex.raw(`
    create table if not exists "public"."drone_interception_uses" (
      "campaign_id" uuid not null,
      "drone_character_id" uuid not null,
      "turn_number" integer not null,
      "uses" smallint not null,
      "updated_at" timestamp with time zone not null default now()
    );
  `)
}

export const down = async (knex) => {
  await knex.raw('drop table if exists "public"."drone_interception_uses" cascade;')
}
