/**
 * Migration 42 — Entités : table entities (instances)
 *
 * Crée la table entities — instances d'entités posées sur une battlemap.
 * Chaque instance référence un blueprint (entity_blueprints) mais est indépendante :
 * ses paramètres lui appartiennent, une modification du blueprint n'a aucun effet rétroactif.
 *
 * Convention pos_x / pos_y / pos_z — NON NÉGOCIABLE (PE14) :
 *   pos_x = axe X Three.js
 *   pos_y = profondeur (axe Z Three.js)   ← cohérent avec threeToDb() et tokens
 *   pos_z = altitude  (axe Y Three.js)    ← cohérent avec threeToDb() et tokens
 *   Ne jamais interpréter pos_y comme l'altitude.
 *
 * Colonnes JSONB :
 *   interaction_overrides : { "interaction_id": { difficulty_dc?, skill_id? } }
 *                           Override partiel par interaction — champs absents = valeur blueprint
 *   state                 : données libres GM (ex: { "note": "Piégée : Explose si échec critique" })
 *
 * disabled_interactions : TEXT[] — IDs d'interactions désactivées sur cette instance
 *                         Pas un JSONB — tableau PostgreSQL natif (PE6)
 *
 * current_state_id : index entier dans states[] du blueprint.
 *                    Si l'index devient invalide suite à modification du blueprint →
 *                    fallback sur states[0] côté client (PE11).
 *
 * down : supprime la table.
 */

export const up = async (knex) => {
  await knex.schema.createTable('entities', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('battlemap_id')
      .notNullable()
      .references('id')
      .inTable('battlemaps')
      .onDelete('CASCADE')
      // CASCADE — suppression de la battlemap supprime toutes ses entités
    table.uuid('blueprint_id')
      .notNullable()
      .references('id')
      .inTable('entity_blueprints')
      // Pas de onDelete — un blueprint deprecated reste référençable (PE8)
      // La suppression physique d'un blueprint utilisé est bloquée côté application (409)
    table.integer('pos_x').notNullable()
    table.integer('pos_y').notNullable()
      // profondeur (axe Z Three.js) — PE14
    table.integer('pos_z').notNullable()
      // altitude  (axe Y Three.js) — PE14
    table.integer('r').notNullable().defaultTo(0)
      // rotation : 0/1/2/3 (quarts de tour axe Y) — PE10
    table.integer('current_state_id').notNullable().defaultTo(0)
      // index dans states[] du blueprint — fallback 0 si invalide (PE11)
    table.boolean('gm_only').notNullable().defaultTo(false)
      // true = non envoyé au client joueur (pièges cachés, objets masqués)
    table.text('label_override').nullable()
      // Remplace blueprint.label pour cette instance ("Sas Alpha-7")
    table.jsonb('interaction_overrides').notNullable().defaultTo('{}')
      // { "pirater": { "difficulty_dc": 10, "skill_id": "ATHLETISME" } }
      // Override partiel — champs absents conservent la valeur blueprint (PE15)
    table.specificType('disabled_interactions', 'TEXT[]').notNullable().defaultTo('{}')
      // IDs d'interactions désactivées — TEXT[] PostgreSQL natif, pas JSONB (PE6)
    table.jsonb('state').notNullable().defaultTo('{}')
      // Données libres GM — non structurées, extensibles
    table.text('notes_gm').nullable()
      // Texte libre GM — visible uniquement en mode éditeur / config
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('entities')
}
