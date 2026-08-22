/**
 * Les interactions d'entite etaient comparees a des unites de grille. Le moteur monde exprime
 * toutes les regles en metres ; les valeurs historiques sont donc converties avec 1 case = 1,5 m.
 */

async function scaleRanges(knex, factor, operation = '*') {
  const operator = operation === '/' ? '/' : '*'
  await knex.raw(`
    UPDATE entity_blueprints
    SET interactions = (
      SELECT COALESCE(jsonb_agg(
        CASE
          WHEN jsonb_typeof(item->'range') = 'number'
            THEN jsonb_set(item, '{range}', to_jsonb(((item->>'range')::numeric ${operator} ?::numeric)))
          ELSE item
        END
        ORDER BY ordinal
      ), '[]'::jsonb) AS value
      FROM jsonb_array_elements(entity_blueprints.interactions) WITH ORDINALITY AS entries(item, ordinal)
    ),
        updated_at = NOW()
    WHERE jsonb_typeof(entity_blueprints.interactions) = 'array'
  `, [factor])
}

export const up = async knex => scaleRanges(knex, '1.5')

export const down = async knex => scaleRanges(knex, '1.5', '/')
