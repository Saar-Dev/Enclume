// 342_pending_chance_choices_aoe_correlation_foreign_keys.js — ON DELETE SET NULL sur les deux
// nouvelles colonnes (341), jamais CASCADE : `combat_actions` est vidée intégralement à COMBAT_END
// (socketCombatState.js) et `tokens` peut être retiré du battlemap indépendamment — une ligne
// pending_chance_choices déjà résolue ne doit jamais disparaître silencieusement parce que sa
// corrélation est devenue caduque, même raisonnement que `linked_catastrophe_id` (migration 339).
export const up = async (knex) => {
  await knex.raw(`
alter table "public"."pending_chance_choices" add constraint "pending_chance_choices_action_id_foreign" FOREIGN KEY (action_id) REFERENCES combat_actions(id) ON DELETE SET NULL;

alter table "public"."pending_chance_choices" add constraint "pending_chance_choices_target_token_id_foreign" FOREIGN KEY (target_token_id) REFERENCES tokens(id) ON DELETE SET NULL;

-- Vérifiée à chaque résolution d'une ligne du groupe (condition de complétion Aggregator) —
-- WHERE action_id = ? AND resolved_at IS NULL, un index composite sert directement ce filtre.
CREATE INDEX pending_chance_choices_action_id_pending_index ON public.pending_chance_choices USING btree (action_id) WHERE resolved_at IS NULL;
  `)
}

export const down = async (knex) => {
  await knex.raw(`
DROP INDEX IF EXISTS pending_chance_choices_action_id_pending_index;
alter table "public"."pending_chance_choices" drop constraint if exists "pending_chance_choices_target_token_id_foreign";
alter table "public"."pending_chance_choices" drop constraint if exists "pending_chance_choices_action_id_foreign";
  `)
}
