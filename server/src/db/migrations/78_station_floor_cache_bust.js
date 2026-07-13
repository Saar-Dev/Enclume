import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import getMinioClient, { BUCKET } from '../../lib/minio.js'

const STATION_USED_PACK_ID = '6f3916a6-7c7b-45f7-a020-7d63b7a74176'

const VARIANTS = [
  { label: 'Station usee - trame', source: 'station-used-floor-01.png', file: 'station-used-floor-v2-01.png', sort_order: 0, variant_weight: 6 },
  { label: 'Station usee - sas', source: 'station-used-floor-02.png', file: 'station-used-floor-v2-02.png', sort_order: 1, variant_weight: 1 },
  { label: 'Station usee - trappe', source: 'station-used-floor-03.png', file: 'station-used-floor-v2-03.png', sort_order: 2, variant_weight: 1 },
  { label: 'Station usee - grille', source: 'station-used-floor-04.png', file: 'station-used-floor-v2-04.png', sort_order: 3, variant_weight: 1 },
]

export const up = async (knex) => {
  const client = getMinioClient()
  const bucket = BUCKET()
  const migrationDir = path.dirname(fileURLToPath(import.meta.url))
  const assetDir = path.join(migrationDir, '..', 'seed-assets', 'sol-station-use-v2')

  for (const variant of VARIANTS) {
    const relativePath = `sol/${variant.file}`
    const buffer = await fs.readFile(path.join(assetDir, variant.source))
    await client.putObject(
      bucket,
      `textures/${STATION_USED_PACK_ID}/${relativePath}`,
      buffer,
      buffer.length,
      { 'Content-Type': 'image/png' },
    )

    await knex('voxel_textures')
      .where({ pack_id: STATION_USED_PACK_ID, label: variant.label })
      .update({
        faces: JSON.stringify({ all: relativePath }),
        sort_order: variant.sort_order,
        variant_weight: variant.variant_weight,
        deprecated: false,
        updated_at: knex.fn.now(),
      })
  }
}

export const down = async () => {
  console.log('[Migration 78] down() irreversible, no-op documented')
}
