/**
 * Migration 151 — positions fines des entités 3D.
 *
 * Les objets décoratifs ne sont plus limités aux coordonnées entières de la
 * grille. La convention d'axes PE14 reste inchangée :
 *   pos_x = axe X Three.js
 *   pos_y = profondeur (axe Z Three.js)
 *   pos_z = altitude (axe Y Three.js)
 */

export const up = async (knex) => {
  await knex.raw(`
    ALTER TABLE entities
      ALTER COLUMN pos_x TYPE double precision USING pos_x::double precision,
      ALTER COLUMN pos_y TYPE double precision USING pos_y::double precision,
      ALTER COLUMN pos_z TYPE double precision USING pos_z::double precision
  `)
}

export const down = async (knex) => {
  await knex.raw(`
    ALTER TABLE entities
      ALTER COLUMN pos_x TYPE integer USING ROUND(pos_x)::integer,
      ALTER COLUMN pos_y TYPE integer USING ROUND(pos_y)::integer,
      ALTER COLUMN pos_z TYPE integer USING ROUND(pos_z)::integer
  `)
}
