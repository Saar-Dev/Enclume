// 326_combat_timeline_entries_resolve_on_turn.js
//
// Chantier « moteur de tour » M2b (docs/PLANS/PLAN_GRENADES.md §10.3, project_turn_engine_chantier) —
// `combat_timeline_entries` passe d'une échelle RECONSTRUITE chaque Tour (et balayée par `endTurn`) à
// une FILE ROULANTE : une entrée peut être insérée au Tour N pour se résoudre au Tour N+k.
//
// Débloque : (1) report d'Initiative ≤ 0 au Tour suivant — bug RAW REGLESYSCOMBAT.md:354, aujourd'hui
// l'Action est jetée (`status:'lost'`) ; (2) explosion de grenade « au Tour de combat suivant »
// (PLAN_GRENADES 3d/3e) ; (3) futurs minuteurs / mines.
//
// `resolve_on_turn` = le Tour pendant la RÉSOLUTION duquel l'entrée devient éligible. `turn_number`
// est CONSERVÉ = Tour de création (provenance/audit) — plus aucune requête ne le filtre après M2b
// (toutes basculent sur `resolve_on_turn` dans combatTurnEngine.js + socket/index.js). Pour une
// entrée normale les deux sont égaux ; une entrée différée a `resolve_on_turn > turn_number`.
//
// NOT NULL DEFAULT 0 (pas « nullable puis SET NOT NULL ») : évite qu'un INSERT de l'ancien code
// pendant la fenêtre de déploiement produise un NULL qui ferait échouer un SET NOT NULL ultérieur.
// Les Tours étant ≥ 1, une ligne résiduelle à 0 est inerte (ne matche jamais `= current_turn`) et est
// balayée par le nouveau wipe `endTurn` (`resolve_on_turn <= <Tour qui se termine>`). Même patron que
// `status text not null default 'scheduled'` (migration 34).

export const up = async (knex) => {
  await knex.schema.alterTable('combat_timeline_entries', (t) => {
    t.integer('resolve_on_turn').notNullable().defaultTo(0)
  })
  // Backfill : aujourd'hui toute entrée se résout dans son Tour de création.
  await knex('combat_timeline_entries').update({ resolve_on_turn: knex.ref('turn_number') })
  // Index de `pickNextTimelineStep` / `broadcastTimelineState` après M2b.
  await knex.schema.alterTable('combat_timeline_entries', (t) => {
    t.index(['campaign_id', 'resolve_on_turn', 'status'], 'idx_timeline_entries_resolve')
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('combat_timeline_entries', (t) => {
    t.dropIndex(['campaign_id', 'resolve_on_turn', 'status'], 'idx_timeline_entries_resolve')
    t.dropColumn('resolve_on_turn')
  })
}
