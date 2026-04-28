/**
 * Migration 25 — conversion voxel_data : entier nu → { id, r }
 *
 * IRRÉVERSIBLE sur les données.
 * Les données existantes sont du contenu de test jetable — OK.
 *
 * Avant : { "0:0:0": 1, "1:0:0": 2 }
 * Après : { "0:0:0": { "id": 1, "r": 0 }, "1:0:0": { "id": 2, "r": 0 } }
 *
 * Passthrough si la valeur est déjà un objet (idempotent).
 * down : no-op documenté — non réversible.
 */

export const up = async (knex) => {
  const battlemaps = await knex('battlemaps')
    .whereNotNull('voxel_data')
    .select('id', 'voxel_data')

  for (const bm of battlemaps) {
    const data = bm.voxel_data
    if (!data || typeof data !== 'object') continue

    const migrated = {}
    for (const [key, val] of Object.entries(data)) {
      // Entier nu → { id, r: 0 } | Déjà objet → passthrough
      migrated[key] = typeof val === 'number' ? { id: val, r: 0 } : val
    }

    await knex('battlemaps')
      .where({ id: bm.id })
      .update({ voxel_data: JSON.stringify(migrated) })
  }
}

export const down = async (knex) => {
  // Non réversible — down est un no-op documenté
  console.warn('Migration 25 down : non réversible, voxel_data conservé tel quel')
}
