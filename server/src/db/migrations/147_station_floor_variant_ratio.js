const STATION_USED_PACK_ID = '6f3916a6-7c7b-45f7-a020-7d63b7a74176'

const WEIGHTS = [
  { label: 'Station usee - trame', variant_weight: 14 },
  { label: 'Station usee - sas', variant_weight: 1 },
  { label: 'Station usee - trappe', variant_weight: 1 },
  { label: 'Station usee - grille', variant_weight: 1 },
]

export const up = async (knex) => {
  const hasColumn = await knex.schema.hasColumn('voxel_textures', 'variant_weight')
  if (!hasColumn) return

  for (const texture of WEIGHTS) {
    await knex('voxel_textures')
      .where({ pack_id: STATION_USED_PACK_ID, label: texture.label })
      .update({
        variant_weight: texture.variant_weight,
        updated_at: knex.fn.now(),
      })
  }
}

export const down = async () => {
  console.log('[Migration 147] down() irreversible, no-op documented')
}
