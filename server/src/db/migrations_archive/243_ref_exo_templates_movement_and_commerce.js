/**
 * Migration 243 — ref_exo_templates : mode de déplacement + descriptif/commerce
 *
 * SCHEMADRIFT-EXOTEMPLATES1 (bug_tickets) : ces 8 colonnes/2 contraintes avaient été ajoutées le
 * 2026-08-06 en éditant directement 233_exo_sheet.js, sous l'hypothèse erronée qu'il n'avait pas
 * encore tourné (il avait déjà été appliqué le même jour, 09:50:27, cf. knex_migrations). 233 a été
 * restauré à son contenu réellement exécuté (2026-08-12) ; cette migration porte pour de bon ce qui
 * avait été décrit dans PLAN_EXOARMURE.md §7.5, vérifié contre 16 armures RAW réelles
 * (REGLEARMURE.md p.339-348).
 */

export const up = async (knex) => {
  await knex.schema.alterTable('ref_exo_templates', (t) => {
    // Vitesse — une simple paire d'entiers ne suffit pas. 3 cas réels au-delà d'"une valeur
    // numérique normale" :
    //   - "à terre : capacité de déplacement du personnage" (Explora) → mode='pilot', le mouvement
    //     redirige vers le pilote humain (getCharacterMovementBudget récursif), base_speed_* ignorée.
    //   - "à terre : -" (Vulcain, incapable de se déplacer hors de l'eau) → mode='blocked'.
    //   - Un même milieu offre souvent 2 valeurs (ex. "10 exo-palmes / 20 propulseur" sous l'eau) —
    //     RAW (REGLEARMURE.md:249-255) : seul le déplacement naturel compte pour le mouvement de
    //     combat standard (un propulseur project hors de portée en 1-2 Tours, mécanique d'évasion
    //     narrative distincte, pas un choix d'Allure). base_speed_* porte donc uniquement le mode
    //     naturel ; les modes secondaires vont dans speeds_extra (narratif, non consommé par
    //     movementBudgetService).
    t.text('underwater_movement_mode').notNullable().defaultTo('vit')
    t.text('surface_movement_mode').notNullable().defaultTo('vit')
    t.jsonb('speeds_extra').notNullable().defaultTo('[]')

    // Descriptif/commerce — présents dans 100% des exemples RAW (REGLEARMURE.md p.339-348), absents
    // du schéma initial. tech_level en texte (pas un entier comme ref_equipment.tech_level) : la
    // source donne "III", "III-IV"... jamais un entier propre.
    t.text('manufacturer')
    t.integer('price')
    t.text('rarity')
    t.text('tech_level')
    t.text('autonomy')
  })

  await knex.raw(`
    ALTER TABLE ref_exo_templates
      ADD CONSTRAINT chk_exo_template_underwater_mode CHECK (underwater_movement_mode IN
        ('vit', 'pilot', 'blocked')),
      ADD CONSTRAINT chk_exo_template_surface_mode CHECK (surface_movement_mode IN
        ('vit', 'pilot', 'blocked'))
  `)
}

export const down = async (knex) => {
  await knex.raw(`
    ALTER TABLE ref_exo_templates
      DROP CONSTRAINT IF EXISTS chk_exo_template_underwater_mode,
      DROP CONSTRAINT IF EXISTS chk_exo_template_surface_mode
  `)
  await knex.schema.alterTable('ref_exo_templates', (t) => {
    t.dropColumn('underwater_movement_mode')
    t.dropColumn('surface_movement_mode')
    t.dropColumn('speeds_extra')
    t.dropColumn('manufacturer')
    t.dropColumn('price')
    t.dropColumn('rarity')
    t.dropColumn('tech_level')
    t.dropColumn('autonomy')
  })
}
