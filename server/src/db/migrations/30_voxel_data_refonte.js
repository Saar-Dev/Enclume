/**
 * Migration 30 — conversion voxel_data { id, r } → { tex, geo, r }
 *
 * IRRÉVERSIBLE sur les données.
 *
 * Utilise legacy_block_type_id (peuplé en migration 29) pour construire
 * le mapping block_type_id → voxel_texture_id.
 * Lit la géométrie depuis block_types (encore présente à ce stade).
 *
 * Dépend de : migration 29 (legacy_block_type_id peuplé) — P36.
 * Valider le résultat AVANT de lancer la migration 31 (irréversible).
 */

export const up = async (knex) => {
  // 1. Construire le mapping legacy_block_type_id → voxel_texture_id
  const textures = await knex('voxel_textures')
    .whereNotNull('legacy_block_type_id')
    .select('id', 'legacy_block_type_id')

  const blockToTex = {}
  for (const t of textures) {
    blockToTex[t.legacy_block_type_id] = t.id
  }

  // 2. Lire geometry depuis block_types (encore présente à ce stade — droppée en 31)
  const blockGeos = {}
  const blocks = await knex('block_types').select('id', 'geometry')
  for (const b of blocks) { blockGeos[b.id] = b.geometry }

  // 3. Convertir chaque battlemap
  const battlemaps = await knex('battlemaps')
    .whereNotNull('voxel_data')
    .select('id', 'voxel_data')

  for (const bm of battlemaps) {
    const data = bm.voxel_data
    if (!data || typeof data !== 'object') continue

    const migrated = {}
    for (const [key, val] of Object.entries(data)) {
      if (typeof val === 'object' && val.id !== undefined) {
        const texId = blockToTex[val.id]
        const geo   = blockGeos[val.id] || 'cube'
        if (!texId) {
          console.warn(`[Migration 30] block_type_id ${val.id} sans voxel_texture — voxel ignoré`)
          continue
        }
        migrated[key] = { tex: texId, geo, r: val.r ?? 0 }
      } else {
        console.warn(`[Migration 30] format inattendu clé ${key}`, val)
      }
    }

    await knex('battlemaps')
      .where({ id: bm.id })
      .update({ voxel_data: JSON.stringify(migrated) })
  }
}

export const down = async (knex) => {
  console.warn('[Migration 30] down : non réversible, voxel_data conservé tel quel')
}
