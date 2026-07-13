import db from '../db/knex.js'

/** Invalide les lectures monde apres toute mutation dynamique hors des services de mouvement. */
export async function bumpBattlemapRuntimeRevision(battlemapId, database = db) {
  const [row] = await database('battlemaps')
    .where({ id: battlemapId })
    .update({ runtime_revision: database.raw('runtime_revision + 1') })
    .returning('runtime_revision')
  if (!row) throw new RangeError('Battlemap inconnue')
  return Number(row.runtime_revision)
}
