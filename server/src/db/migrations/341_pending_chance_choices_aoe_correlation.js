// 341_pending_chance_choices_aoe_correlation.js — corrélation pour le forçage AOE longue/extrême
// portée (docs/PLANS/PLAN_CHANCE.md L4, patron Aggregator/Scatter-Gather EIP). Plusieurs lignes
// pending_chance_choices (une par cible éligible d'un même tir AOE) partagent le même `action_id` —
// identifiant de corrélation de première classe, même précédent que `linked_catastrophe_id`
// (migration 339), pas une clé noyée dans `context`.
//
// `target_token_id` — le token à retirer de la résolution AOE, distinct de `character_id` (le
// destinataire du choix, qui est le PILOTE si la cible est une exo — même distinguo que L3e).
//
// `outcome` — résultat individuel ('avoided' | 'hit') persisté au moment de la résolution de CETTE
// ligne, pour que la dernière réponse d'un groupe puisse agréger sans rejouer un jet déjà fait.
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."pending_chance_choices" add column "action_id" uuid;
alter table "public"."pending_chance_choices" add column "target_token_id" uuid;
alter table "public"."pending_chance_choices" add column "outcome" text;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
alter table "public"."pending_chance_choices" drop column if exists "outcome";
alter table "public"."pending_chance_choices" drop column if exists "target_token_id";
alter table "public"."pending_chance_choices" drop column if exists "action_id";
  `)
}
