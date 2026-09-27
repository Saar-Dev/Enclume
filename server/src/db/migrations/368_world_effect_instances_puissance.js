// 368_world_effect_instances_puissance.js — docs/PLANS/PLAN_ZONES_DANGER.md §2.E, Z2 étape 4.
//
// `puissance` : scalaire d'INSTANCE toujours ADDITIF (jamais multiplicatif), distinct d'`intensity`
// (déjà présente, multiplicative — géométrie/ambiance uniquement, cf. `worldEffects.js:
// compileEffectRegions`, mouvement/opacité). Sert à durcir une zone posée par le MJ sans changer sa
// définition catalogue (ex. une capsule d'acide renforcée) — s'ajoute au jet de dégâts dans
// `effectLineResolverService.js:resolveDamageLine` (paramètre déjà câblé depuis Z1.1, jamais alimenté
// jusqu'ici : `degautsBruts = degatsRoll.total + puissance`).
//
// Défaut 0 (neutre, non nul — §2.E) : toute instance déjà posée (les zones legacy `fire`/`gas` de
// Saar comme les zones RAW créées depuis) reste inchangée, aucune migration de données nécessaire.
export const up = async (knex) => {
  await knex.schema.alterTable('world_effect_instances', (t) => {
    t.decimal('puissance', 10, 4).notNullable().defaultTo(0)
  })
}

export const down = async (knex) => {
  await knex.schema.alterTable('world_effect_instances', (t) => {
    t.dropColumn('puissance')
  })
}
